const mockRows = new Map<string, string>();
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));
const mockKeys = new Map<string, string>();
let mockFailKeyWrite = false;
let mockFailRow: string | undefined;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockRows.get(key) ?? null,
  multiGet: async (keys: string[]) => keys.map((key) => [key, mockRows.get(key) ?? null]),
  multiSet: async (rows: [string, string][]) => {
    if (rows.some(([key]) => key === mockFailRow)) throw new Error('disk full');
    rows.forEach(([key, value]) => mockRows.set(key, value));
  },
  multiRemove: async (keys: string[]) => { keys.forEach((key) => mockRows.delete(key)); },
  setItem: async (key: string, value: string) => {
    if (key === mockFailRow) throw new Error('disk full');
    mockRows.set(key, value);
  },
  removeItem: async (key: string) => {
    mockRows.delete(key);
  },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockKeys.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (mockFailKeyWrite) throw new Error('keystore unavailable');
    mockKeys.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockKeys.delete(key);
  },
}));
// Exercise real AES-GCM in Node, adapting only the Expo native interface.
jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    AESKeySize: { AES256: 256 },
    AESEncryptionKey: {
      generate: async () => ({ encoded: async () => crypto.randomBytes(32).toString('hex') }),
      import: async (hex: string) => Buffer.from(hex, 'hex'),
    },
    // Expo Crypto 57.0.2's Android fromCombined method accepts a native
    // ByteArray/Uint8Array, unlike the more permissive web implementation.
    AESSealedData: {
      fromCombined: (bytes: Uint8Array) => {
        if (!(bytes instanceof Uint8Array)) {
          throw new TypeError('Android fromCombined requires Uint8Array');
        }
        return Buffer.from(bytes);
      },
    },
    aesEncryptAsync: async (
      data: Uint8Array,
      key: Buffer,
      options: { additionalData: Uint8Array },
    ) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(options.additionalData);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      return {
        combined: async () =>
          Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64'),
      };
    },
    aesDecryptAsync: async (data: Buffer, key: Buffer, options: { additionalData: Uint8Array }) => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAAD(options.additionalData);
      decipher.setAuthTag(data.subarray(-16));
      return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]);
    },
  };
});
jest.mock('../migrate', () => ({ runMigrations: (save: unknown) => save }));
import { SaveGame } from '../../domain/types';
import { deleteSave, firstFreeSlot, listSlots, loadSave, writeSave } from '../saveGames';
import { wrapSave } from '../integrity';
import { openSave, sealSave, verifySaveIdentity } from '../saveEncryption';

const makeSave = (coins = 500) =>
  ({
    id: 'career-1',
    mode: 'career',
    schemaVersion: 42,
    updatedAt: 123,
    wallet: { coins, gems: 12 },
    name: 'Cricket 🏏 नाम',
  }) as unknown as SaveGame;
const key = 'sg:career:1';
describe('encrypted career persistence', () => {
  it('does not treat stored JSON null as an empty slot', async () => {
    mockRows.set(key, 'null');
    await expect(loadSave('career', 1)).rejects.toThrow('kept');
    await expect(writeSave('career', 1, makeSave())).rejects.toThrow('kept');
  });
  it('round-trips large encrypted payloads through chunked storage', async () => {
    const save = { ...makeSave(), history: 'x'.repeat(700_000) } as SaveGame;
    await writeSave('career', 1, save);
    expect(mockRows.has(`${key}:__chunk_manifest`)).toBe(true);
    expect(await loadSave('career', 1)).toEqual(save);
  });
  beforeEach(() => {
    mockRows.clear();
    mockKeys.clear();
    mockFailKeyWrite = false;
    mockFailRow = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  it('reopens persisted base64 ciphertext through the Android byte-array API without rewriting it', async () => {
    const save = makeSave();
    await writeSave('career', 1, save);
    const storedRows = new Map(mockRows);
    const storedKeys = new Map(mockKeys);
    // Reload the envelope as storage would after an app restart, not the
    // in-memory SealedData object returned by encryption.
    expect(await loadSave('career', 1)).toEqual(save);
    expect(mockRows).toEqual(storedRows);
    expect(mockKeys).toEqual(storedKeys);
  });
  it('round-trips unicode, hides wallet/plaintext and uses fresh nonces', async () => {
    const save = makeSave();
    await writeSave('career', 1, save);
    const first = mockRows.get(key)!;
    expect(first).not.toContain('wallet');
    expect(first).not.toContain('career-1');
    expect(await loadSave('career', 1)).toEqual(save);
    await writeSave('career', 1, save);
    expect(mockRows.get(key)).not.toBe(first);
    expect(mockRows.get(`${key}:bak`)).not.toContain('wallet');
  });
  it('detects a modified GCM tag and recovers the rolling backup', async () => {
    await writeSave('career', 1, makeSave(500));
    await writeSave('career', 1, makeSave(600));
    const envelope = JSON.parse(mockRows.get(key)!);
    const bytes = Buffer.from(envelope.data, 'base64');
    bytes[bytes.length - 1] ^= 1;
    envelope.data = bytes.toString('base64');
    mockRows.set(key, JSON.stringify(envelope));
    expect((await loadSave('career', 1))?.wallet.coins).toBe(500);
  });
  it('reuses authenticated primary ciphertext for the backup without re-encryption', async () => {
    await writeSave('career', 1, makeSave(500));
    await writeSave('career', 1, makeSave(550));
    const verifiedPrimary = mockRows.get(key);
    const crypto = jest.requireMock('expo-crypto');
    const encrypt = jest.spyOn(crypto, 'aesEncryptAsync');
    const decrypt = jest.spyOn(crypto, 'aesDecryptAsync');
    await writeSave('career', 1, makeSave(600));
    expect(encrypt).toHaveBeenCalledTimes(1);
    expect(decrypt).not.toHaveBeenCalled();
    expect(mockRows.get(`${key}:bak`)).toBe(verifiedPrimary);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(600);
  });
  it('does not reset, overwrite, or reuse a tampered slot without a backup', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await writeSave('career', 1, makeSave());
    mockRows.set(key, 'bad-json');
    await expect(loadSave('career', 1)).rejects.toThrow('kept');
    await expect(writeSave('career', 1, makeSave())).rejects.toThrow('kept');
    expect(mockRows.get(key)).toBe('bad-json');
    const slots = await listSlots('career');
    expect(slots[0].unavailable).toBe(true);
    expect(firstFreeSlot(slots)).toBe(2);
  });
  it('rejects changed ciphertext on the warm write path rather than trusting its cached identity', async () => {
    await writeSave('career', 1, makeSave());
    const envelope = JSON.parse(mockRows.get(key)!);
    const bytes = Buffer.from(envelope.data, 'base64');
    bytes[20] ^= 1;
    envelope.data = bytes.toString('base64');
    const damaged = JSON.stringify(envelope);
    mockRows.set(key, damaged);
    await expect(writeSave('career', 1, makeSave(900))).rejects.toThrow('kept');
    expect(mockRows.get(key)).toBe(damaged);
    expect(mockRows.has(`${key}:bak`)).toBe(false);
  });
  it('does not accept a cached ciphertext with a changed algorithm or device key', async () => {
    const envelope = await sealSave(makeSave(), key);
    await expect(verifySaveIdentity({ ...envelope, algorithm: 'other' }, key)).rejects.toThrow();
    const keyId = 'cricket.save.v2.sg.career.1';
    const record = JSON.parse(mockKeys.get(keyId)!);
    mockKeys.set(keyId, JSON.stringify({ ...record, key: 'ab'.repeat(32) }));
    await expect(verifySaveIdentity(envelope, key)).rejects.toThrow();
  });
  it('authenticates a cold cache fully, then reuses only its immutable identity', async () => {
    const envelope = await sealSave(makeSave(), key);
    let cold!: typeof import('../saveEncryption');
    jest.isolateModules(() => { cold = jest.requireActual('../saveEncryption'); });
    const decrypt = jest.spyOn(jest.requireMock('expo-crypto'), 'aesDecryptAsync');
    expect(await cold.verifySaveIdentity(envelope, key)).toEqual({ id: 'career-1' });
    expect(decrypt).toHaveBeenCalledTimes(1);
    const identity = await cold.verifySaveIdentity(envelope, key);
    identity!.id = 'mutated';
    expect(await cold.verifySaveIdentity(envelope, key)).toEqual({ id: 'career-1' });
    expect(decrypt).toHaveBeenCalledTimes(1);
  });
  it('fully verifies again after bounded cache eviction', async () => {
    const first = await sealSave(makeSave(), key);
    await sealSave(makeSave(), 'sg:career:2');
    await sealSave(makeSave(), 'sg:career:3');
    const decrypt = jest.spyOn(jest.requireMock('expo-crypto'), 'aesDecryptAsync');
    await verifySaveIdentity(first, key);
    expect(decrypt).toHaveBeenCalledTimes(1);
  });
  it('does not let the identity fast path overwrite a different career', async () => {
    await writeSave('career', 1, makeSave());
    const original = mockRows.get(key);
    await expect(writeSave('career', 1, { ...makeSave(), id: 'different' })).rejects.toThrow('occupied');
    expect(mockRows.get(key)).toBe(original);
  });
  it('keeps actual disk state authoritative after a failed write and retries safely', async () => {
    await writeSave('career', 1, makeSave(100));
    const original = mockRows.get(key);
    mockFailRow = key;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(writeSave('career', 1, makeSave(200))).rejects.toThrow('disk full');
    expect(mockRows.get(key)).toBe(original);
    mockFailRow = undefined;
    await writeSave('career', 1, makeSave(300));
    expect((await openSave(JSON.parse(mockRows.get(`${key}:bak`)!), key))?.wallet.coins).toBe(100);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(300);
  });
  it('migrates primary and backup once, preserves totals and blocks plaintext downgrades', async () => {
    const primary = makeSave(3_000_000_000),
      backup = makeSave(400);
    mockRows.set(key, JSON.stringify(primary));
    mockRows.set(`${key}:bak`, JSON.stringify(wrapSave(backup)));
    expect(await loadSave('career', 1)).toEqual(primary);
    expect(mockRows.get(key)).not.toContain('wallet');
    expect(mockRows.get(`${key}:bak`)).not.toContain('wallet');
    mockRows.set(key, JSON.stringify(wrapSave(makeSave(999999))));
    expect((await loadSave('career', 1))?.wallet.coins).toBe(400);
    mockRows.set(`${key}:bak`, JSON.stringify(backup));
    await expect(loadSave('career', 1)).rejects.toThrow('kept');
  });
  it('preserves ciphertext if the device key goes missing', async () => {
    await writeSave('career', 1, makeSave());
    const original = mockRows.get(key);
    mockKeys.clear();
    await expect(loadSave('career', 1)).rejects.toThrow();
    await expect(writeSave('career', 1, makeSave())).rejects.toThrow();
    expect(mockKeys.size).toBe(0);
    expect(mockRows.get(key)).toBe(original);
  });
  it('authenticates slot identity, even when the wrong slot is given the same AES key', async () => {
    const encrypted = await sealSave(makeSave(), key);
    mockKeys.set('cricket.save.v2.sg.career.2', mockKeys.get('cricket.save.v2.sg.career.1')!);
    await expect(openSave(encrypted, 'sg:career:2')).rejects.toThrow();
  });
  it('keeps the old save if secure key creation fails', async () => {
    mockRows.set(key, JSON.stringify(makeSave()));
    mockFailKeyWrite = true;
    await expect(loadSave('career', 1)).rejects.toThrow();
    expect(JSON.parse(mockRows.get(key)!)).toEqual(makeSave());
  });
  it('recovers after an interrupted legacy migration', async () => {
    mockRows.set(key, JSON.stringify(makeSave()));
    mockFailRow = key;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(loadSave('career', 1)).rejects.toThrow();
    mockFailRow = undefined;
    expect(await loadSave('career', 1)).toEqual(makeSave());
  });
  it('snapshots each queued write and keeps mutation order', async () => {
    const save = makeSave(100);
    const first = writeSave('career', 1, save);
    save.wallet.coins = 200;
    const second = writeSave('career', 1, save);
    save.wallet.coins = 300;
    await Promise.all([first, second]);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(200);
    const backup = await openSave(JSON.parse(mockRows.get(`${key}:bak`)!), key);
    expect(backup?.wallet.coins).toBe(100);
  });
  it('deletes the key only on explicit slot deletion and can reuse that slot', async () => {
    await writeSave('career', 1, makeSave());
    await deleteSave('career', 1);
    expect(mockKeys.size).toBe(0);
    await expect(loadSave('career', 1)).resolves.toBeNull();
    await writeSave('career', 1, makeSave());
    expect((await loadSave('career', 1))?.wallet.coins).toBe(500);
  });
});
