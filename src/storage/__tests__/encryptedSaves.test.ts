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
import { deleteSave, findCreationSlot, firstFreeSlot, getLastPlayedSummary, listSlotSummaries, listSlots, loadSave, recoverSaveToEmptySlot, replaceSave, SaveDeletedError, setLastPlayed, writeSave } from '../saveGames';
import * as encryption from '../saveEncryption';
import { setBackupOwner } from '../accountBackupJournal';
import * as backupJournal from '../accountBackupJournal';
import { wrapSave } from '../integrity';
import { openSave, sealSave, verifySaveIdentity } from '../saveEncryption';
import { syncVipArchive } from '../../services/vipArchive';
import { setJSON } from '../storage';

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
  it('never offers a migration-rejected occupied career as an empty slot', async () => {
    const snapshot = { ...makeSave(), id: 'summary-rejected-schema' };
    await writeSave('career', 1, snapshot);
    mockRows.delete('sg:summary:v1:career:1');
    const bytes = mockRows.get(key);
    jest.spyOn(require('../migrate'), 'runMigrations').mockReturnValue(null);
    expect((await listSlotSummaries('career'))[0]).toEqual({ slot: 1, summary: null, unavailable: true });
    await expect(loadSave('career', 1)).rejects.toThrow('kept');
    expect(mockRows.get(key)).toBe(bytes);
    expect(await findCreationSlot('career', 1)).toBeNull();
  });
  it('invalidates the old index before a primary-write failure, preserving the old verified career', async () => {
    const snapshot = { ...makeSave(), id: 'summary-primary-failure' };
    await writeSave('career', 1, snapshot);
    mockFailRow = key;
    await expect(writeSave('career', 1, { ...snapshot, wallet: { ...snapshot.wallet, coins: 999 } })).rejects.toThrow('disk full');
    expect(mockRows.has('sg:summary:v1:career:1')).toBe(false);
    mockFailRow = undefined;
    expect((await listSlotSummaries('career'))[0].summary?.coins).toBe(500);
  });
  it('rebuilds a summary from the verified rolling backup when the primary is corrupt', async () => {
    const snapshot = { ...makeSave(), id: 'summary-backup-fallback' };
    await writeSave('career', 1, snapshot);
    await writeSave('career', 1, { ...snapshot, wallet: { ...snapshot.wallet, coins: 900 } });
    mockRows.delete('sg:summary:v1:career:1');
    mockRows.set(key, 'broken-primary');
    const [first] = await listSlotSummaries('career');
    expect(first.summary).toMatchObject({ id: snapshot.id, coins: 500 });
    expect(first.unavailable).not.toBe(true);
    expect(mockRows.get(key)).toBe('broken-primary');
  });
  it('lists/refreshes both modes and Continue without opening complete worlds after save publication', async () => {
    for (const mode of ['career', 'manager'] as const) {
      for (let slot = 1; slot <= (mode === 'career' ? 6 : 4); slot++) {
        const snapshot = { ...makeSave(), id: `summary-${mode}-${slot}`, mode, history: 'x'.repeat(100_000) } as SaveGame;
        await writeSave(mode, slot, snapshot);
        await writeSave(mode, slot, snapshot);
      }
    }
    await setLastPlayed('career', 1);
    const open = jest.spyOn(encryption, 'openSave');
    const [player, manager, duplicate, resume] = await Promise.all([
      listSlotSummaries('career'), listSlotSummaries('manager'), listSlotSummaries('career'), getLastPlayedSummary(),
    ]);
    expect(player.filter(row => row.summary)).toHaveLength(6);
    expect(manager.filter(row => row.summary)).toHaveLength(4);
    expect(duplicate).toEqual(player);
    expect(resume?.summary.id).toBe('summary-career-1');
    expect(open).not.toHaveBeenCalled();
    expect(JSON.stringify(player)).not.toContain('history');
    expect(mockRows.get('sg:summary:v1:career:1')).not.toContain('summary-career-1');
    expect(mockRows.get('sg:summary:v1:career:1')).not.toContain('coins');
  });
  it('bootstraps a missing/corrupt summary once, including concurrent readers, without altering protected copies', async () => {
    await writeSave('career', 1, makeSave());
    await writeSave('career', 1, makeSave(600));
    const primary = mockRows.get(key), backup = mockRows.get(`${key}:bak`);
    mockRows.set('sg:summary:v1:career:1', 'bad-json');
    const open = jest.spyOn(encryption, 'openSave');
    const [one, two] = await Promise.all([listSlotSummaries('career'), listSlotSummaries('career')]);
    expect(one[0].summary?.coins).toBe(600);
    expect(two).toEqual(one);
    expect(open.mock.calls.filter(([raw]) => raw !== null)).toHaveLength(2);
    open.mockClear();
    await listSlotSummaries('career');
    expect(open).not.toHaveBeenCalled();
    expect(mockRows.get(key)).toBe(primary);
    expect(mockRows.get(`${key}:bak`)).toBe(backup);
  });
  it('stops an abandoned cold scan before opening the backup or later slots', async () => {
    await writeSave('career', 1, makeSave());
    await writeSave('career', 2, { ...makeSave(), id: 'cancel-second' });
    mockRows.delete('sg:summary:v1:career:1');
    mockRows.delete('sg:summary:v1:career:2');
    const controller = new AbortController();
    const actual = encryption.openSave;
    const open = jest.spyOn(encryption, 'openSave').mockImplementation(async (raw, context) => {
      const result = await actual(raw, context);
      controller.abort();
      return result;
    });
    await expect(listSlotSummaries('career', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][1]).toBe(key);
  });
  it('keeps corrupted occupied data unavailable and verifies playable bytes even when a summary exists', async () => {
    await writeSave('career', 1, makeSave());
    mockRows.set(key, '{"__env":2,"algorithm":"AES-256-GCM","data":"tampered"}');
    await expect(loadSave('career', 1)).rejects.toThrow('kept');
    mockRows.delete('sg:summary:v1:career:1');
    const rows = await listSlotSummaries('career');
    expect(rows[0]).toEqual({ slot: 1, summary: null, unavailable: true });
    expect(await findCreationSlot('career', 1)).toBeNull();
  });
  it('does not trust a summary after key loss or cross-slot ciphertext substitution', async () => {
    await writeSave('career', 1, makeSave());
    await writeSave('career', 2, { ...makeSave(), id: 'other-summary' });
    mockRows.set('sg:summary:v1:career:1', mockRows.get('sg:summary:v1:career:2')!);
    expect((await listSlotSummaries('career'))[0].summary?.id).toBe('career-1');
    mockKeys.clear();
    expect((await listSlotSummaries('career'))[0].unavailable).toBe(true);
  });
  it('retains successful local writes when summary publication fails and safely rebuilds on retry', async () => {
    const snapshot = { ...makeSave(), id: 'summary-publication-failure' };
    await writeSave('career', 1, snapshot);
    mockFailRow = 'sg:summary:v1:career:1';
    await expect(writeSave('career', 1, { ...snapshot, wallet: { ...snapshot.wallet, coins: 987, gems: 12 } })).resolves.toBeUndefined();
    expect(mockRows.has('sg:summary:v1:career:1')).toBe(false);
    mockFailRow = undefined;
    expect((await listSlotSummaries('career'))[0].summary?.coins).toBe(987);
    await deleteSave('career', 1, snapshot.id);
    expect((await listSlotSummaries('career'))[0]).toEqual({ slot: 1, summary: null });
  });
  it('keeps reserved high-numbered QA slots out of account backup metadata', async () => {
    setBackupOwner('owner-a');
    await writeSave('career', 900, { ...makeSave(), id: 'qa-reserved-slot' });
    expect(await backupJournal.backupBindings()).toEqual([]);
    await writeSave('career', 1, { ...makeSave(), id: 'ordinary-slot' });
    expect(await backupJournal.backupBindings()).toEqual([expect.objectContaining({ saveId: 'ordinary-slot', slot: 1 })]);
  });
  it('rejects a sign-out while recovered-save ownership is being written, before committing the career', async () => {
    const snapshot = { ...makeSave(), id: 'recovery-account-changed-during-binding' };
    let signedIn = true;
    const bind = backupJournal.bindRecoveredSave;
    jest.spyOn(backupJournal, 'bindRecoveredSave').mockImplementationOnce(async (binding) => {
      await bind(binding);
      signedIn = false;
    });
    await expect(recoverSaveToEmptySlot(snapshot, { saveId: snapshot.id, ownerId: 'owner-a', mode: 'career', slot: 1,
      revision: 1, generation: 0, pending: false, deleted: false }, () => signedIn)).rejects.toThrow('account changed');
    expect(await loadSave('career', 1)).toBeNull();
  });
  it('retries an interrupted restored-career write without duplication or timer restart', async () => {
    const snapshot = { ...makeSave(2100), id: 'recovery-interrupted-primary',
      entitlements: { removeAdsUntil: 50 }, flags: { 'iap:tx:original-order': true } } as unknown as SaveGame;
    const binding = { saveId: snapshot.id, ownerId: 'owner-a', mode: 'career' as const, slot: 1,
      revision: 3, generation: 0, pending: false, deleted: false };
    mockFailRow = key;
    await expect(recoverSaveToEmptySlot(snapshot, binding, () => true)).rejects.toThrow('disk full');
    expect(await loadSave('career', 1)).toBeNull();
    mockFailRow = undefined;
    await recoverSaveToEmptySlot(snapshot, binding, () => true);
    expect(await loadSave('career', 1)).toEqual(snapshot);
    await expect(recoverSaveToEmptySlot(snapshot, binding, () => true)).rejects.toThrow('no longer empty');
    expect(await loadSave('career', 1)).toEqual(snapshot);
  });
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
    setBackupOwner(null);
  });
  afterEach(() => jest.restoreAllMocks());
  it('finds an empty slot without decrypting, migrating or refreshing any existing career', async () => {
    // A large world with two rolling copies reproduces the avoidable old slot scan.
    await writeSave('career', 1, { ...makeSave(), history: 'x'.repeat(700_000) } as SaveGame);
    await writeSave('career', 1, { ...makeSave(600), history: 'x'.repeat(700_000) } as SaveGame);
    const decrypt = jest.spyOn(require('expo-crypto'), 'aesDecryptAsync');
    jest.mocked(syncVipArchive).mockClear();
    const before = performance.now();
    expect(firstFreeSlot(await listSlots('career'))).toBe(2);
    const fullScanMs = performance.now() - before;
    expect(decrypt).toHaveBeenCalledTimes(2);
    expect(syncVipArchive).toHaveBeenCalledTimes(1);
    decrypt.mockClear();
    jest.mocked(syncVipArchive).mockClear();
    const bytesBefore = new Map(mockRows);
    const quick = performance.now();
    await expect(findCreationSlot('career')).resolves.toBe(2);
    const occupancyMs = performance.now() - quick;
    expect(decrypt).not.toHaveBeenCalled();
    expect(syncVipArchive).not.toHaveBeenCalled();
    expect(mockRows).toEqual(bytesBefore);
    if (process.env.CREATION_SLOT_BENCH === '1') console.info('HOST SLOT BENCH (not emulator)', {
      fullScanMs: Math.round(fullScanMs), occupancyMs: Math.round(occupancyMs),
      decryptionsBefore: 2, decryptionsAfter: 0,
    });
  });
  it('never offers corrupt primaries, backup-only or malformed chunk manifests as empty', async () => {
    mockRows.set('sg:career:1', 'null');
    mockRows.set('sg:career:2:bak', 'bad-json');
    mockRows.set('sg:career:3:__chunk_manifest', 'broken');
    await expect(findCreationSlot('career')).resolves.toBe(4);
    for (const slot of [1, 2, 3]) await expect(findCreationSlot('career', slot)).resolves.toBeNull();
  });
  it('ignores invalid requested slots and treats storage errors as occupied', async () => {
    for (const slot of [0, 7, -1, 1.5, NaN]) await expect(findCreationSlot('career', slot)).resolves.toBeNull();
    const storage = require('@react-native-async-storage/async-storage');
    const original = storage.getItem;
    jest.spyOn(storage, 'getItem').mockImplementation(async (...args: unknown[]) => {
      const key = args[0] as string;
      if (key.startsWith('sg:career:1')) throw new Error('disk unreadable');
      return original(key);
    });
    await expect(findCreationSlot('career')).resolves.toBe(2);
    await expect(findCreationSlot('career', 1)).resolves.toBeNull();
  });
  it('preserves mode-scoped premium slot eligibility, including an explicit slot-six request', async () => {
    const expiry = Date.now() + 100_000;
    for (let slot = 1; slot <= 5; slot++) await setJSON(`sg:career:${slot}`, await sealSave(
      { ...makeSave(), id: `career-${slot}`, entitlements: { removeAds: false,
        seasonPass: { premium: true, expiresAt: expiry, lastVerifiedAt: Date.now() } } } as SaveGame, `sg:career:${slot}`));
    await expect(findCreationSlot('career')).resolves.toBe(6);
    await expect(findCreationSlot('career', 6)).resolves.toBe(6);
    await expect(findCreationSlot('manager', 6)).resolves.toBeNull();
    mockRows.set('sg:career:6:bak', 'unreadable');
    await expect(findCreationSlot('career', 6)).resolves.toBeNull();
  });
  it('waits for an in-flight slot write and still rejects a race after selection', async () => {
    const writing = writeSave('career', 1, makeSave());
    const finding = findCreationSlot('career');
    await writing;
    await expect(finding).resolves.toBe(2);
    const selected = await findCreationSlot('career', 2);
    expect(selected).toBe(2);
    await writeSave('career', 2, { ...makeSave(), id: 'other-creator' });
    await expect(writeSave('career', 2, { ...makeSave(), id: 'this-creator' })).rejects.toThrow('occupied');
    expect((await loadSave('career', 2))?.id).toBe('other-creator');
  });
  it('reseals an account snapshot with a fresh device key after reinstall, preserving remaining paid state', async () => {
    setBackupOwner('owner-a');
    const paid = { ...makeSave(900), wallet: { ...makeSave().wallet, coins: 900, gems: 25 },
      entitlements: { removeAds: false, removeAdsUntil: 123456 }, flags: { 'iap:tx:paid-once': true } } as SaveGame;
    await writeSave('career', 1, paid);
    const oldCiphertext = mockRows.get(key);
    const oldDeviceKeys = new Map(mockKeys);
    const backedUp = (await loadSave('career', 1))!;
    // Uninstall loses device ciphertext/keys, but the server snapshot survives.
    mockRows.clear(); mockKeys.clear();
    await recoverSaveToEmptySlot(backedUp, { saveId: backedUp.id, ownerId: 'owner-a', mode: 'career', slot: 1,
      revision: 3, generation: 0, pending: false, deleted: false }, () => true);
    expect(await loadSave('career', 1)).toEqual(backedUp);
    expect(mockRows.get(key)).not.toBe(oldCiphertext);
    expect(mockKeys).not.toEqual(oldDeviceKeys);
    expect((await loadSave('career', 1))!.entitlements.removeAdsUntil).toBe(123456);
  });
  it('account recovery never overwrites an occupied or unreadable slot', async () => {
    const snapshot = makeSave();
    const binding = { saveId: snapshot.id, ownerId: 'owner-a', mode: 'career' as const, slot: 1,
      revision: 1, generation: 0, pending: false, deleted: false };
    await writeSave('career', 1, snapshot);
    const old = mockRows.get(key);
    await expect(recoverSaveToEmptySlot(snapshot, binding, () => true)).rejects.toThrow('no longer empty');
    expect(mockRows.get(key)).toBe(old);
    mockRows.set(key, 'unreadable');
    await expect(recoverSaveToEmptySlot(snapshot, binding, () => true)).rejects.toThrow('no longer empty');
    expect(mockRows.get(key)).toBe('unreadable');
  });
  it('account recovery requires the same signed-in identity at the commit point', async () => {
    const snapshot = makeSave();
    await expect(recoverSaveToEmptySlot(snapshot, { saveId: snapshot.id, ownerId: 'owner-a', mode: 'career', slot: 1,
      revision: 1, generation: 0, pending: false, deleted: false }, () => false)).rejects.toThrow('account changed');
    expect(mockRows.has(key)).toBe(false);
  });
  it('reopens persisted base64 ciphertext through the Android byte-array API without rewriting it', async () => {
    const save = makeSave();
    await writeSave('career', 1, save);
    const storedRows = new Map(mockRows);
    const storedKeys = new Map(mockKeys);
    // Reload the envelope as storage would after an app restart, not the
    // in-memory SealedData object returned by encryption.
    expect(await loadSave('career', 1)).toEqual(save);
    // Only the disposable summary may be refreshed; playable bytes/key remain exact.
    expect(mockRows.get(key)).toEqual(storedRows.get(key));
    expect(mockRows.get(`${key}:bak`)).toEqual(storedRows.get(`${key}:bak`));
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
    expect(encrypt).toHaveBeenCalledTimes(2); // one full save + one small encrypted summary
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
    const oldSave = { ...makeSave(), id: 'career-deleted' };
    await writeSave('career', 1, oldSave);
    await deleteSave('career', 1);
    expect(mockKeys.size).toBe(0);
    await expect(loadSave('career', 1)).resolves.toBeNull();
    await expect(writeSave('career', 1, oldSave)).rejects.toBeInstanceOf(SaveDeletedError);
    await writeSave('career', 1, makeSave());
    expect((await loadSave('career', 1))?.wallet.coins).toBe(500);
  });
  it('only explicitly replaces the expected career and keeps the old primary on write failure', async () => {
    const oldSave = makeSave(500);
    const imported = { ...makeSave(700), id: 'career-imported' };
    await writeSave('career', 1, oldSave);
    await expect(writeSave('career', 1, imported)).rejects.toThrow('occupied');
    await expect(replaceSave('career', 1, imported, 'stale-destination')).rejects.toThrow('destination career changed');
    mockFailRow = key;
    await expect(replaceSave('career', 1, imported, oldSave.id)).rejects.toThrow('disk full');
    mockFailRow = undefined;
    expect((await loadSave('career', 1))?.id).toBe(oldSave.id);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(500);
    await replaceSave('career', 1, imported, oldSave.id);
    expect((await loadSave('career', 1))?.id).toBe(imported.id);
    await expect(writeSave('career', 1, oldSave)).rejects.toThrow();
    expect((await loadSave('career', 1))?.wallet.coins).toBe(700);
    // Replacing is not deleting: if the new primary is damaged, the rolling
    // backup must still be recoverable AND saveable under its old identity.
    mockRows.set(key, JSON.stringify({ __env: 2, algorithm: 'AES-256-GCM', data: 'corrupt' }));
    const recovered = (await loadSave('career', 1))!;
    expect(recovered.id).toBe(oldSave.id);
    await writeSave('career', 1, recovered);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(500);
  });
  it('a stale deletion confirmation cannot delete a replacement career', async () => {
    const original = { ...makeSave(), id: 'delete-confirmation-original' };
    const replacement = { ...makeSave(), id: 'delete-confirmation-replacement' };
    await writeSave('career', 1, original);
    await replaceSave('career', 1, replacement, original.id);
    await expect(deleteSave('career', 1, original.id)).rejects.toThrow('different career');
    expect((await loadSave('career', 1))?.id).toBe(replacement.id);
  });
  it('revokes the confirmed active identity even when disk copies became unreadable', async () => {
    const active = { ...makeSave(), id: 'deleted-after-disk-corruption' };
    await writeSave('career', 1, active);
    mockRows.set(key, JSON.stringify({ __env: 2, algorithm: 'AES-256-GCM', data: 'corrupt' }));
    await deleteSave('career', 1, active.id);
    await expect(writeSave('career', 1, active)).rejects.toBeInstanceOf(SaveDeletedError);
    await expect(loadSave('career', 1)).resolves.toBeNull();
  });
});
