import type { SaveGame } from '../src/domain/types';

// Isolated Node audit. Real store, migrations, save queues and AES-GCM;
// only device I/O, native crypto interfaces and provider responses are replaced.
const mockRows = new Map<string, string>();
const mockKeys = new Map<string, string>();
let mockFailWrites = false;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockRows.get(key) ?? null,
  multiGet: async (keys: string[]) => keys.map(key => [key, mockRows.get(key) ?? null]),
  setItem: async (key: string, value: string) => {
    if (mockFailWrites) throw new Error('Audit: disk full');
    mockRows.set(key, value);
  },
  multiSet: async (rows: [string, string][]) => {
    if (mockFailWrites) throw new Error('Audit: disk full');
    rows.forEach(([key, value]) => mockRows.set(key, value));
  },
  removeItem: async (key: string) => { mockRows.delete(key); },
  multiRemove: async (keys: string[]) => { keys.forEach(key => mockRows.delete(key)); },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockKeys.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockKeys.set(key, value); },
  deleteItemAsync: async (key: string) => { mockKeys.delete(key); },
}));
jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    AESKeySize: { AES256: 256 },
    AESEncryptionKey: {
      generate: async () => ({ encoded: async () => crypto.randomBytes(32).toString('hex') }),
      import: async (hex: string) => Buffer.from(hex, 'hex'),
    },
    AESSealedData: {
      fromCombined: (bytes: Uint8Array) => {
        if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected Android byte array');
        return Buffer.from(bytes);
      },
    },
    aesEncryptAsync: async (data: Uint8Array, key: Buffer, options: { additionalData: Uint8Array }) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(options.additionalData);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      return { combined: async () => Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64') };
    },
    aesDecryptAsync: async (data: Buffer, key: Buffer, options: { additionalData: Uint8Array }) => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAAD(options.additionalData);
      decipher.setAuthTag(data.subarray(-16));
      return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]);
    },
  };
});
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: (callback: () => void) => { callback(); return { cancel: jest.fn() }; } },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));
jest.mock('../src/services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => undefined) }));
jest.mock('../src/config/qa', () => ({ QA_TOOLS_ENABLED: false }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { makeCareerSave, makeManagerSave } = jest.requireActual<
  typeof import('../src/game/__tests__/_depthHelpers')
>('../src/game/__tests__/_depthHelpers');
const { useCareer } = jest.requireActual<typeof import('../src/state/careerStore')>('../src/state/careerStore');
const { writeSave, loadSave, deleteSave } = jest.requireActual<typeof import('../src/storage/saveGames')>('../src/storage/saveGames');
const { setJSON } = jest.requireActual<typeof import('../src/storage/storage')>('../src/storage/storage');
const { purchases } = jest.requireActual<typeof import('../src/services')>('../src/services');

function activate(save: SaveGame, slot = 1) {
  useCareer.getState().setActive(save, save.mode, slot);
}

function active() {
  const save = useCareer.getState().save;
  if (!save) throw new Error('Audit has no active career');
  return save;
}

async function restartFromDisk(mode: SaveGame['mode'], slot = 1) {
  // Drop all in-memory career state, as a process restart does.
  useCareer.setState({ save: null, ref: null, persistenceError: null });
  const disk = await loadSave(mode, slot);
  if (!disk) throw new Error('Audit slot unexpectedly empty');
  activate(disk, slot);
  await useCareer.getState().recoverPendingPurchases();
  await useCareer.getState().recoverPendingExchange();
  return active();
}

beforeEach(() => {
  mockRows.clear();
  mockKeys.clear();
  mockFailWrites = false;
  useCareer.setState({ save: null, ref: null, persistenceError: null, lastPromotion: null, pendingAchievementIds: [] });
  jest.spyOn(purchases, 'getPermanentVipSnapshot').mockResolvedValue(null);
  jest.spyOn(purchases, 'getEntitlementSnapshot').mockResolvedValue({ status: 'UNAVAILABLE' });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  await useCareer.getState().recoverPendingPurchases();
  await useCareer.getState().recoverPendingExchange();
  useCareer.setState({ save: null, ref: null, persistenceError: null });
  jest.restoreAllMocks();
});

describe('whole-app durable save and commerce audit', () => {
  it.each(['career', 'manager'] as const)('encrypted %s saves survive re-entry with wallet and identity intact', async mode => {
    activate(mode === 'career' ? makeCareerSave(89001) : makeManagerSave(89001));
    active().wallet.coins = 4321;
    const id = active().id;
    await useCareer.getState().persistCritical(true);
    const reloaded = await restartFromDisk(mode);
    expect(reloaded.id).toBe(id);
    expect(reloaded.wallet.coins).toBe(4321);
    expect(reloaded.mode).toBe(mode);
    expect([...mockRows.values()].some(value => value.includes('"wallet"'))).toBe(false);
  });

  it('recovers the previous authenticated backup after primary corruption', async () => {
    activate(makeCareerSave(89002));
    active().wallet.coins = 1000;
    await useCareer.getState().persistCritical(true);
    active().wallet.coins = 2000;
    await useCareer.getState().persistCritical(true);
    // Full careers are chunked: corrupt the logical record, not an unused root row.
    await setJSON('sg:career:1', { __env: 2, algorithm: 'AES-256-GCM', data: 'corrupt-audit-primary' });
    expect((await restartFromDisk('career')).wallet.coins).toBe(1000);
  });

  it('queued writes retain the newest wallet after restarting', async () => {
    activate(makeCareerSave(89003));
    active().wallet.coins = 1000;
    const older = useCareer.getState().persistCritical(true);
    active().wallet.coins = 2000;
    const newer = useCareer.getState().persistCritical(true);
    await Promise.all([older, newer]);
    expect((await restartFromDisk('career')).wallet.coins).toBe(2000);
  });

  it('a confirmed Player Life transfer replaces the occupied slot as promised', async () => {
    activate(makeCareerSave(89004));
    await useCareer.getState().persistCritical(true);
    const transferred = makeCareerSave(89005);
    transferred.id = 'audit-transferred-career';
    expect(transferred.id).not.toBe(active().id);
    const result = await useCareer.getState().importCareerBackup(JSON.stringify(transferred));
    expect(result).toEqual({ ok: true });
    expect((await loadSave('career', 1))?.id).toBe(transferred.id);
  });

  it('a failed import does not leave unsaveable imported state active', async () => {
    activate(makeCareerSave(89006));
    const originalId = active().id;
    await useCareer.getState().persistCritical(true);
    const transferred = makeCareerSave(89007);
    transferred.id = 'audit-other-device-career';
    mockFailWrites = true;
    const result = await useCareer.getState().importCareerBackup(JSON.stringify(transferred));
    mockFailWrites = false;
    expect(result.ok).toBe(false);
    expect((await loadSave('career', 1))?.id).toBe(originalId);
    expect(active().id).toBe(originalId);
  });

  it('a Saved Games deletion stays deleted after the app backgrounds', async () => {
    activate(makeCareerSave(89008));
    await useCareer.getState().persistCritical(true);
    // Same sequence as SavedGamesScreen: delete disk slot without clearing active state.
    await deleteSave('career', 1);
    expect(Boolean(await loadSave('career', 1))).toBe(false);
    // App.tsx backgrounds any screen through this exact call.
    await useCareer.getState().persistCritical(true);
    expect(Boolean(await loadSave('career', 1))).toBe(false);
  });

  it('an import cannot replace a destination with an unresolved checkout', async () => {
    const save = makeCareerSave(89020);
    activate(save);
    await useCareer.getState().persistCritical(true);
    const { writePendingCheckout, clearPendingCheckout } = jest.requireActual<
      typeof import('../src/services/purchaseRecovery')
    >('../src/services/purchaseRecovery');
    await writePendingCheckout({ version: 1, saveId: save.id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'audit-account', startedAt: Date.now(), previousTransactions: [] });
    const imported = makeCareerSave(89021);
    imported.id = 'audit-import-while-checkout-pending';
    expect((await useCareer.getState().importCareerBackup(JSON.stringify(imported))).ok).toBe(false);
    expect(active().id).toBe(save.id);
    expect((await loadSave('career', 1))?.id).toBe(save.id);
    await clearPendingCheckout();
  });

  it('a durable import finishing after a career switch does not steal the active selection', async () => {
    const save = makeCareerSave(89022);
    activate(save);
    await useCareer.getState().persistCritical(true);
    const other = makeManagerSave(89023);
    other.id = 'audit-active-manager-during-import';
    const imported = makeCareerSave(89024);
    imported.id = 'audit-background-import';
    const storage = jest.requireActual<typeof import('../src/storage/saveGames')>('../src/storage/saveGames');
    const originalReplace = storage.replaceSave;
    jest.spyOn(storage, 'replaceSave').mockImplementation(async (...args) => {
      activate(other, 2);
      await originalReplace(...args);
    });
    expect(await useCareer.getState().importCareerBackup(JSON.stringify(imported))).toEqual({ ok: true });
    expect(active().id).toBe(other.id);
    expect(useCareer.getState().ref).toEqual({ mode: 'manager', slot: 2 });
    expect((await loadSave('career', 1))?.id).toBe(imported.id);
  });

  it('a verified consumable remains recoverable after a failed write and process restart', async () => {
    activate(makeCareerSave(89009));
    const before = active().wallet.coins;
    await useCareer.getState().persistCritical(true);
    jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
      mockFailWrites = true; // Fail the grant write, not the pre-checkout save.
      return { ok: true, productId: 'coins_medium', purchaseToken: 'audit-paid-receipt',
        purchaseState: 'PURCHASED', verificationState: 'LOCAL_MOCK' };
    });
    expect(await useCareer.getState().purchaseProduct('coins_medium'))
      .toEqual({ ok: false, error: 'persistence_failed' });
    expect(active().wallet.coins).toBe(before + purchases.GRANTS.coins_medium.coins!);
    mockFailWrites = false;
    expect((await restartFromDisk('career')).wallet.coins)
      .toBe(before + purchases.GRANTS.coins_medium.coins!);
  });

  it('a purchase completing after switching careers is not discarded', async () => {
    activate(makeCareerSave(89010));
    const before = active().wallet.coins;
    await useCareer.getState().persistCritical(true);
    let completePurchase!: (result: Awaited<ReturnType<typeof purchases.purchase>>) => void;
    jest.spyOn(purchases, 'purchase').mockImplementation(() => new Promise(resolve => { completePurchase = resolve; }));
    const buying = useCareer.getState().purchaseProduct('coins_medium');
    await new Promise<void>(resolve => setImmediate(resolve));
    const other = makeManagerSave(89011);
    other.id = 'audit-other-manager-career';
    activate(other, 2);
    await writeSave('manager', 2, other);
    completePurchase({
      ok: true, productId: 'coins_medium', purchaseToken: 'audit-paid-after-switch',
      purchaseState: 'PURCHASED', verificationState: 'LOCAL_MOCK',
    });
    expect(await buying).toEqual({ ok: true });
    expect(active().id).toBe(other.id);
    expect((await restartFromDisk('career')).wallet.coins)
      .toBe(before + purchases.GRANTS.coins_medium.coins!);
  });
});
