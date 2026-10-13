import type { SaveGame } from '../../domain/types';

// Isolated Node audit. Real store, migrations, save queues and AES-GCM;
// only device I/O, native crypto interfaces and provider responses are replaced.
const mockRows = new Map<string, string>();
const mockKeys = new Map<string, string>();
let mockFailWrites = false;
let mockFailReceiptWrite = false;
let mockFailJournalClear = false;
let mockFailExchangeSave = false;
let mockOnExchangeIntent: (() => void) | undefined;
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
  setItemAsync: async (key: string, value: string) => {
    if (mockFailReceiptWrite && key === 'cricket.pending.checkout.v1' && JSON.parse(value).result) throw new Error('Keystore write failed');
    mockKeys.set(key, value);
    if (mockFailExchangeSave && key === 'cricket.pending.exchange.v1') mockFailWrites = true;
    if (key === 'cricket.pending.exchange.v1') mockOnExchangeIntent?.();
  },
  deleteItemAsync: async (key: string) => {
    if (mockFailJournalClear && key === 'cricket.pending.checkout.v1') throw new Error('Cleanup failed');
    mockKeys.delete(key);
  },
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
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => undefined) }));
jest.mock('../../config/qa', () => ({ QA_TOOLS_ENABLED: false }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { makeCareerSave, makeManagerSave } = jest.requireActual<
  typeof import('../../game/__tests__/_depthHelpers')
>('../../game/__tests__/_depthHelpers');
const { useCareer } = jest.requireActual<typeof import('../../state/careerStore')>('../../state/careerStore');
const { writeSave, loadSave, deleteSave } = jest.requireActual<typeof import('../../storage/saveGames')>('../../storage/saveGames');
const { readPendingCheckout, writePendingCheckout } = jest.requireActual<typeof import('../../services/purchaseRecovery')>('../../services/purchaseRecovery');
const { writePendingExchange, readPendingExchange } = jest.requireActual<typeof import('../../services/walletExchangeRecovery')>('../../services/walletExchangeRecovery');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');
const accountPurchases = jest.requireActual<typeof import('../../services/accountPurchases')>('../../services/accountPurchases');

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
  mockFailReceiptWrite = false;
  mockFailJournalClear = false;
  mockFailExchangeSave = false;
  mockOnExchangeIntent = undefined;
  useCareer.setState({ save: null, ref: null, persistenceError: null, lastPromotion: null, pendingAchievementIds: [] });
  jest.spyOn(purchases, 'getPermanentVipSnapshot').mockResolvedValue(null);
  jest.spyOn(purchases, 'getEntitlementSnapshot').mockResolvedValue({ status: 'UNAVAILABLE' });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(async () => {
  await useCareer.getState().recoverPendingPurchases();
  await useCareer.getState().recoverPendingExchange();
  useCareer.setState({ save: null, ref: null, persistenceError: null });
  jest.restoreAllMocks();
});

async function flush() {
  await new Promise<void>(resolve => setImmediate(resolve));
}

function successfulReceipt(productId = 'coins_medium', token = 'paid-1') {
  return { ok: true, productId, purchaseToken: token,
    purchaseState: 'PURCHASED' as const, verificationState: 'LOCAL_MOCK' as const };
}

describe('durable commerce recovery', () => {
  it('clears a provider-resolved unpaid checkout without any reward or automatic new payment', async () => {
    activate(makeCareerSave(90450));
    await useCareer.getState().persistCritical(true);
    await useCareer.getState().recoverPendingPurchases();
    const before = structuredClone(active().wallet);
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'customer-A', startedAt: 1000, previousTransactions: [] });
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({ accountId: 'customer-A', transactions: [] });
    jest.spyOn(purchases, 'isCheckoutNoLongerPayable').mockResolvedValue(true);
    const checkout = jest.spyOn(purchases, 'purchase');
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'NOT_PURCHASED' });
    expect(await readPendingCheckout()).toBeNull();
    expect(active().wallet).toEqual(before);
    expect(checkout).not.toHaveBeenCalled();
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'NONE' });
    expect(active().wallet).toEqual(before);
    // Cancellation releases the career's deletion/import guard too.
    await expect(deleteSave('career', 1)).resolves.toBeUndefined();
  });

  it('keeps uncertain unpaid checks locked, and still recovers a later successful receipt', async () => {
    activate(makeCareerSave(90451));
    await useCareer.getState().persistCritical(true);
    await useCareer.getState().recoverPendingPurchases();
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'customer-A', startedAt: 1000, previousTransactions: [] });
    const history = { accountId: 'customer-A', transactions: [] as { token: string; productId: string; purchasedAt: number }[] };
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue(history);
    const unpaid = jest.spyOn(purchases, 'isCheckoutNoLongerPayable').mockResolvedValue(false);
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    expect(await readPendingCheckout()).not.toBeNull();
    history.transactions.push({ token: 'later-paid', productId: 'coins_medium', purchasedAt: 2000 });
    expect(await useCareer.getState().recoverPendingPurchases()).toMatchObject({ status: 'DELIVERED' });
    expect(active().wallet.coins).toBe(10750);
    expect(unpaid).toHaveBeenCalledTimes(1); // Paid evidence takes priority.
  });

  it('retains the unpaid journal if cleanup fails, without granting or charging', async () => {
    activate(makeCareerSave(90452));
    await useCareer.getState().persistCritical(true);
    await useCareer.getState().recoverPendingPurchases();
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'starter_pack', accountId: 'customer-A', startedAt: 1000, previousTransactions: [] });
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({ accountId: 'customer-A', transactions: [] });
    jest.spyOn(purchases, 'isCheckoutNoLongerPayable').mockResolvedValue(true);
    mockFailJournalClear = true;
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    expect(await readPendingCheckout()).not.toBeNull();
    expect(active().wallet.coins).toBe(750);
    expect(await accountPurchases.hasStarterPackPurchase()).toBe(false);
    mockFailJournalClear = false;
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'NOT_PURCHASED' });
  });

  it('never releases a checkout against another provider account or ambiguous paid history', async () => {
    activate(makeCareerSave(90453));
    await useCareer.getState().persistCritical(true);
    await useCareer.getState().recoverPendingPurchases();
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'customer-A', startedAt: 1000, previousTransactions: [] });
    const snapshot = jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({ accountId: 'customer-B', transactions: [] });
    const unpaid = jest.spyOn(purchases, 'isCheckoutNoLongerPayable').mockResolvedValue(true);
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    expect(unpaid).not.toHaveBeenCalled();
    snapshot.mockResolvedValue({ accountId: 'customer-A', transactions: ['one', 'two'].map(token => ({
      token, productId: 'coins_medium', purchasedAt: 2000,
    })) });
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    expect(unpaid).not.toHaveBeenCalled();
    expect(active().wallet.coins).toBe(750);
  });

  it('preserves the original career while a paid grant is pending, without blocking unrelated saves', async () => {
    const original = makeCareerSave(90420);
    activate(original);
    await useCareer.getState().persistCritical(true);
    await writeSave('manager', 2, makeManagerSave(90421));
    await writePendingCheckout({ version: 1, saveId: original.id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'LOCAL_MOCK', startedAt: 1000, previousTransactions: [],
      result: successfulReceipt(),
    });
    await expect(deleteSave('career', 1)).rejects.toThrow('unfinished purchase');
    expect((await loadSave('career', 1))?.id).toBe(original.id);
    await expect(deleteSave('manager', 2)).resolves.toBeUndefined();
    expect(await loadSave('manager', 2)).toBeNull();
    await useCareer.getState().recoverPendingPurchases();
    expect(await readPendingCheckout()).toBeNull();
    await expect(deleteSave('career', 1)).resolves.toBeUndefined();
  });

  it('does not delete a save if the pending-purchase record cannot be read', async () => {
    const original = makeCareerSave(90422);
    await writeSave('career', 1, original);
    mockKeys.set('cricket.pending.checkout.v1', '{broken');
    await expect(deleteSave('career', 1)).rejects.toThrow();
    expect((await loadSave('career', 1))?.id).toBe(original.id);
  });

  it('reports no journal honestly without buying or replaying historical consumables', async () => {
    const provider = jest.spyOn(purchases, 'purchase');
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'NONE' });
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    ['starter_pack', 'career', 3000, 50],
    ['starter_pack', 'manager', 3000, 50],
    ['coins_medium', 'career', 10000, 0],
    ['coins_medium', 'manager', 10000, 0],
    ['coins_large', 'career', 20000, 0],
    ['gems_medium', 'career', 0, 600], // First eligible pack doubles Gems.
    ['gems_large', 'manager', 0, 2400],
    ['player_vip', 'career', 0, 0],
    ['manager_vip', 'manager', 0, 0],
    ['bundle_legend', 'career', 40000, 1200],
    ['manager_legend_pack', 'manager', 0, 0],
    ['form_recovery', 'career', 0, 0],
    ['transfer_budget_sm', 'manager', 0, 0],
    ['scout_full_reveal', 'manager', 0, 0],
    ['facility_upgrade_token', 'manager', 0, 0],
    ['recovery_pack', 'manager', 0, 0],
  ] as const)('%s in %s survives an interrupted grant write exactly once', async (productId, mode, coins, gems) => {
    const original = mode === 'career' ? makeCareerSave(90410) : makeManagerSave(90410);
    original.experience = { ...original.experience, starterPackUnlockedAt: Date.now() };
    activate(original);
    jest.spyOn(accountPurchases, 'hasStarterPackPurchase').mockResolvedValue(false);
    jest.spyOn(accountPurchases, 'markStarterPackPurchased').mockResolvedValue();
    if (productId === 'form_recovery') {
      const player = active().players[active().userPlayerId!];
      player.meta.form = 40;
      player.meta.confidence = 40;
      active().wallet.energy = 0;
    }
    const before = { ...active().wallet };
    const clubId = active().userTeamId!;
    const clubBalance = active().teams[clubId].budget;
    const provider = jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
      mockFailWrites = true;
      return successfulReceipt(productId, `interrupted-${productId}`);
    });
    expect(await useCareer.getState().purchaseProduct(productId)).toEqual({ ok: false, error: 'persistence_failed' });
    expect(await readPendingCheckout()).not.toBeNull();
    mockFailWrites = false;
    const delivered = await restartFromDisk(mode);
    expect(delivered.wallet.coins).toBe(before.coins + coins);
    expect(delivered.wallet.gems).toBe(before.gems + gems);
    expect(delivered.flags?.[`purchaseToken:interrupted-${productId}`]).toBe(true);
    if (productId === 'manager_legend_pack' || productId === 'transfer_budget_sm') {
      expect(delivered.teams[clubId].budget).toBe(clubBalance + 1000000);
    } else {
      expect(delivered.teams[clubId].budget).toBe(clubBalance);
    }
    if (productId === 'form_recovery') {
      const player = delivered.players[delivered.userPlayerId!];
      expect(player.meta.form).toBe(99);
      expect(player.meta.confidence).toBe(99);
      expect(delivered.wallet.energy).toBe(36);
    }
    const tokens = productId === 'manager_legend_pack'
      ? { scout_full_reveal_token: 2, facility_upgrade_token: 1, squad_recovery_token: 1 }
      : productId === 'scout_full_reveal' ? { scout_full_reveal_token: 1 }
        : productId === 'facility_upgrade_token' ? { facility_upgrade_token: 1 }
          : productId === 'recovery_pack' ? { squad_recovery_token: 1 } : {};
    expect(delivered.inventory ?? {}).toMatchObject(tokens);
    if (['player_vip', 'manager_vip', 'bundle_legend', 'manager_legend_pack'].includes(productId)) {
      expect(delivered.entitlements.modeVip?.mode).toBe(mode);
      expect(delivered.entitlements.removeAds).toBe(true);
    }
    expect(await readPendingCheckout()).toBeNull();
    const inventory = { ...delivered.inventory };
    const adExpiry = delivered.entitlements.removeAdsUntil;
    const again = await restartFromDisk(mode);
    expect(again.wallet.coins).toBe(before.coins + coins);
    expect(again.wallet.gems).toBe(before.gems + gems);
    expect(again.inventory ?? {}).toEqual(inventory);
    expect(again.entitlements.removeAdsUntil).toBe(adExpiry);
    expect(again.teams[clubId].budget).toBe(delivered.teams[clubId].budget);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each(['career', 'manager'] as const)(
    'a Starter Pack paid before a billing error recovers once in its original %s save', async mode => {
      const save = mode === 'career' ? makeCareerSave(90301) : makeManagerSave(90301);
      save.experience = { ...save.experience, starterPackUnlockedAt: Date.now() };
      activate(save);
      jest.spyOn(accountPurchases, 'hasStarterPackPurchase').mockResolvedValue(false);
      const markOwned = jest.spyOn(accountPurchases, 'markStarterPackPurchased').mockResolvedValue();
      const before = { ...active().wallet };
      const history: import('../../services/purchases').PurchaseRecoverySnapshot = {
        accountId: 'customer-starter', observedAt: Date.now() - 1000, transactions: [],
      };
      jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockImplementation(async () => history);
      const checkout = jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
        history.transactions.push({ token: 'starter-paid', productId: 'starter_pack', purchasedAt: Date.now() });
        return { ok: false, productId: 'starter_pack', error: 'network_error', checkoutNotStarted: false };
      });
      expect(await useCareer.getState().purchaseProduct('starter_pack')).toMatchObject({ ok: false });
      expect(active().wallet.coins).toBe(before.coins);
      expect(await useCareer.getState().purchaseProduct('starter_pack'))
        .toEqual({ ok: false, error: 'purchase_delivery_pending' });
      expect(checkout).toHaveBeenCalledTimes(1);
      const recovered = await restartFromDisk(mode);
      expect(recovered.wallet.coins).toBe(before.coins + 3000);
      expect(recovered.wallet.gems).toBe(before.gems + 50);
      expect(recovered.entitlements.removeAdsUntil).toBeGreaterThan(Date.now());
      expect(markOwned).toHaveBeenCalledWith('starter-paid');
      expect(await readPendingCheckout()).toBeNull();
      const reloaded = await restartFromDisk(mode);
      expect(reloaded.wallet.coins).toBe(before.coins + 3000);
      expect(reloaded.wallet.gems).toBe(before.gems + 50);
    },
  );

  it.each([1, 2])(
    'blocks another Starter Pack charge when %i historical receipt(s) exist but local ownership is missing', async count => {
      const save = makeCareerSave(90302);
      save.experience = { ...save.experience, starterPackUnlockedAt: Date.now() };
      activate(save);
      jest.spyOn(accountPurchases, 'hasStarterPackPurchase').mockResolvedValue(false);
      jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({
        accountId: 'customer-starter', observedAt: Date.now(),
        transactions: Array.from({ length: count }, (_, index) => ({
          token: 'historical-starter-' + index, productId: 'starter_pack', purchasedAt: Date.now() - 3600000,
        })),
      });
      const checkout = jest.spyOn(purchases, 'purchase');
      const before = { ...active().wallet };
      expect(await useCareer.getState().purchaseProduct('starter_pack'))
        .toEqual({ ok: false, error: 'starter_pack_history_requires_support' });
      expect(checkout).not.toHaveBeenCalled();
      expect(active().wallet).toEqual(before);
      expect(await readPendingCheckout()).toBeNull();
      await useCareer.getState().recoverPendingPurchases();
      expect(active().wallet).toEqual(before); // Never blindly regrant old consumed packs.
    },
  );

  it('cancels an unaffordable exchange without undoing intervening spending', async () => {
    activate(makeCareerSave(90222));
    active().wallet.gems = 100;
    mockOnExchangeIntent = () => { active().wallet.gems = 10; };
    expect(await useCareer.getState().convertPlayerGems(25)).toEqual({ ok: false,
      reason: 'Your gem balance changed. The exchange was cancelled without charge.' });
    expect(active().wallet.gems).toBe(10);
    expect(active().wallet.coins).toBe(750);
    expect(await readPendingExchange()).toBeNull();
  });
  it('simultaneous exchange and purchase recovery preserve both grants in an inactive career', async () => {
    const original = makeCareerSave(90220);
    original.wallet.gems = 100;
    activate(original);
    await useCareer.getState().persistCritical(true);
    const manager = makeManagerSave(90221);
    manager.id = 'selected-manager';
    activate(manager, 2);
    await useCareer.getState().recoverPendingPurchases();
    await useCareer.getState().recoverPendingExchange();
    await writePendingCheckout({ version: 1, saveId: original.id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'LOCAL_MOCK', startedAt: 1000, previousTransactions: [],
      result: successfulReceipt() });
    await writePendingExchange({ version: 1, saveId: original.id, slot: 1, token: 'exchange:interrupted', gems: 25 });
    await Promise.all([useCareer.getState().recoverPendingPurchases(), useCareer.getState().recoverPendingExchange()]);
    const disk = await loadSave('career', 1);
    expect(disk?.wallet.coins).toBe(11750);
    expect(disk?.wallet.gems).toBe(75);
    expect(active().id).toBe(manager.id);
    expect(await readPendingCheckout()).toBeNull();
    expect(await readPendingExchange()).toBeNull();
  });
  it.each(['unavailable', 'not_configured', 'already_owned_restore_purchases', 'product-fetch-failed'])('a definite pre-checkout failure leaves no stuck checkout: %s', error => {
    return (async () => {
      activate(makeCareerSave(90210));
      jest.spyOn(purchases, 'purchase').mockResolvedValue({ ok: false, productId: 'coins_medium',
        error, ...(error === 'product-fetch-failed' ? { checkoutNotStarted: true } : {}) });
      expect(await useCareer.getState().purchaseProduct('coins_medium')).toMatchObject({ ok: false });
      expect(await readPendingCheckout()).toBeNull();
      expect(active().wallet.coins).toBe(750);
    })();
  });

  it('ambiguous billing failures retain the original binding and block repeat charges', async () => {
    activate(makeCareerSave(90211));
    const provider = jest.spyOn(purchases, 'purchase').mockResolvedValue({ ok: false,
      productId: 'coins_medium', error: 'network_error', checkoutNotStarted: false });
    await useCareer.getState().purchaseProduct('coins_medium');
    expect(await readPendingCheckout()).not.toBeNull();
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toEqual({ ok: false, error: 'purchase_delivery_pending' });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('uses provider time rather than a fast device clock to recover an interrupted checkout', async () => {
    activate(makeCareerSave(90212));
    const history: import('../../services/purchases').PurchaseRecoverySnapshot = {
      accountId: 'customer-A', observedAt: 1000, transactions: [],
    };
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockImplementation(async () => history);
    jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
      history.transactions.push({ token: 'clock-safe', productId: 'coins_medium', purchasedAt: 2000 });
      return { ok: false, productId: 'coins_medium', error: 'network_error' };
    });
    await useCareer.getState().purchaseProduct('coins_medium');
    expect((await readPendingCheckout())?.startedAt).toBe(1000);
    await useCareer.getState().recoverPendingPurchases();
    expect(active().wallet.coins).toBe(10750);
  });

  it('does not recover a revoked VIP entitlement from an old transaction', async () => {
    activate(makeCareerSave(90213));
    await useCareer.getState().persistCritical(true);
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'player_vip', accountId: 'customer-A', startedAt: 1000, previousTransactions: [] });
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({ accountId: 'customer-A',
      activeProductIds: [], transactions: [{ token: 'revoked', productId: 'player_vip', purchasedAt: 2000 }] });
    await useCareer.getState().recoverPendingPurchases();
    expect(active().entitlements.removeAds).toBeFalsy();
    expect(await readPendingCheckout()).not.toBeNull();
  });
  it('a receipt-journal write failure can reconcile the provider receipt after restart', async () => {
    activate(makeCareerSave(90201));
    const before = active().wallet.coins;
    const history: import('../../services/purchases').PurchaseRecoverySnapshot = { accountId: 'customer-A', transactions: [] };
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockImplementation(async () => history);
    jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
      mockFailReceiptWrite = true;
      history.transactions.push({ token: 'paid-on-provider', productId: 'coins_medium', purchasedAt: Date.now() });
      return { ...successfulReceipt('coins_medium', 'paid-on-provider'), accountId: 'customer-A', verificationState: 'VERIFIED' };
    });
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toMatchObject({ ok: false });
    expect(active().wallet.coins).toBe(before);
    mockFailReceiptWrite = false;
    expect((await restartFromDisk('career')).wallet.coins).toBe(before + 10000);
  });

  it('cleanup failure never grants the same receipt twice', async () => {
    activate(makeCareerSave(90202));
    jest.spyOn(purchases, 'purchase').mockResolvedValue(successfulReceipt());
    mockFailJournalClear = true;
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toMatchObject({ ok: false });
    expect(active().wallet.coins).toBe(10750);
    mockFailJournalClear = false;
    expect((await restartFromDisk('career')).wallet.coins).toBe(10750);
  });

  it('a second tap cannot start another paid checkout', async () => {
    activate(makeCareerSave(90203));
    let finish!: (receipt: ReturnType<typeof successfulReceipt>) => void;
    const provider = jest.spyOn(purchases, 'purchase').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = useCareer.getState().purchaseProduct('coins_medium');
    await flush();
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toEqual({ ok: false, error: 'purchase_in_progress' });
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    finish(successfulReceipt());
    expect(await first).toEqual({ ok: true });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('recovers a paid grant after career storage fails and the process restarts, exactly once', async () => {
    activate(makeCareerSave(90001));
    const before = active().wallet.coins;
    jest.spyOn(purchases, 'purchase').mockImplementation(async () => {
      mockFailWrites = true; // Checkout succeeded after the durable preflight.
      return successfulReceipt();
    });
    expect(await useCareer.getState().purchaseProduct('coins_medium'))
      .toEqual({ ok: false, error: 'persistence_failed' });
    expect(active().wallet.coins).toBe(before + 10000);
    expect(await readPendingCheckout()).not.toBeNull();
    mockFailWrites = false;
    expect((await restartFromDisk('career')).wallet.coins).toBe(before + 10000);
    expect(await readPendingCheckout()).toBeNull();
    expect((await restartFromDisk('career')).wallet.coins).toBe(before + 10000);
  });

  it('delivers to the original career after switching, never changes the selected Manager', async () => {
    activate(makeCareerSave(90002));
    const before = active().wallet.coins;
    let finish!: (receipt: ReturnType<typeof successfulReceipt>) => void;
    jest.spyOn(purchases, 'purchase').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const buying = useCareer.getState().purchaseProduct('coins_medium');
    await flush();
    expect(finish).toBeDefined();
    const manager = makeManagerSave(90003);
    manager.id = 'other-manager';
    activate(manager, 2);
    const managerCoins = active().wallet.coins;
    await writeSave('manager', 2, manager);
    finish(successfulReceipt());
    expect(await buying).toEqual({ ok: true });
    expect(active().id).toBe(manager.id);
    expect(active().wallet.coins).toBe(managerCoins);
    expect((await loadSave('career', 1))?.wallet.coins).toBe(before + 10000);
  });

  it('recovers the checkout intent if the process died before recording its receipt', async () => {
    activate(makeCareerSave(90004));
    await useCareer.getState().persistCritical(true);
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'customer-A', startedAt: 1000, previousTransactions: ['old'] });
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({ accountId: 'customer-A',
      transactions: [{ productId: 'coins_medium', token: 'old', purchasedAt: 10 },
        { productId: 'coins_medium', token: 'new', purchasedAt: 2000 }] });
    const before = active().wallet.coins;
    await useCareer.getState().recoverPendingPurchases();
    expect(active().wallet.coins).toBe(before + 10000);
    await useCareer.getState().recoverPendingPurchases();
    expect(active().wallet.coins).toBe(before + 10000);
  });

  it.each([false, true])('recovers an explicitly linked guest checkout after login (receipt recorded: %s)', async recorded => {
    activate(makeCareerSave(90401));
    await useCareer.getState().persistCritical(true);
    const guest = '$RCAnonymousID:checkout-guest';
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: guest, startedAt: 1000, previousTransactions: [],
      ...(recorded ? { result: { ...successfulReceipt('coins_medium', 'guest-receipt'),
        accountId: guest, verificationState: 'VERIFIED' as const } } : {}),
    });
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({
      accountId: 'signed-in-owner', originalAccountId: guest,
      transactions: [{ token: 'guest-receipt', productId: 'coins_medium', purchasedAt: 2000 }],
    });
    const provider = jest.spyOn(purchases, 'purchase');
    const before = active().wallet.coins;
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({
      status: 'DELIVERED', mode: 'career', saveId: active().id, productId: 'coins_medium',
    });
    expect(active().wallet.coins).toBe(before + 10000);
    expect(await readPendingCheckout()).toBeNull();
    expect((await restartFromDisk('career')).wallet.coins).toBe(before + 10000);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(['unlinked-guest', 'missing-receipt', 'wrong-receipt', 'signed-in-switch', 'new-guest'])
    ('does not treat account switching as proven guest linking: %s', async scenario => {
      activate(makeCareerSave(90402));
      await useCareer.getState().persistCritical(true);
      const original = scenario === 'signed-in-switch' ? 'account-A' : '$RCAnonymousID:checkout-guest';
      await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
        productId: 'coins_medium', accountId: original, startedAt: 1000, previousTransactions: [],
        result: { ...successfulReceipt('coins_medium', 'guest-receipt'), accountId: original,
          verificationState: 'VERIFIED' },
      });
      jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue({
        accountId: scenario === 'new-guest' ? '$RCAnonymousID:another-guest' : 'signed-in-owner',
        originalAccountId: scenario === 'unlinked-guest' ? 'another-origin' : original,
        transactions: scenario === 'missing-receipt' ? [] : [{
          token: scenario === 'wrong-receipt' ? 'another-receipt' : 'guest-receipt',
          productId: 'coins_medium', purchasedAt: 2000,
        }],
      });
      const before = active().wallet.coins;
      await useCareer.getState().recoverPendingPurchases();
      expect(active().wallet.coins).toBe(before);
      expect(await readPendingCheckout()).not.toBeNull();
    });

  it.each(['wrong-account', 'ambiguous', 'old-only', 'offline'])('does not guess a receipt: %s', async scenario => {
    activate(makeCareerSave(90005));
    await useCareer.getState().persistCritical(true);
    await writePendingCheckout({ version: 1, saveId: active().id, mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'customer-A', startedAt: 1000, previousTransactions: ['old'] });
    const newer = { productId: 'coins_medium', token: 'new', purchasedAt: 2000 };
    jest.spyOn(purchases, 'getPurchaseRecoverySnapshot').mockResolvedValue(scenario === 'offline' ? null : {
      accountId: scenario === 'wrong-account' ? 'customer-B' : 'customer-A', transactions:
        scenario === 'old-only' ? [{ ...newer, token: 'old' }] : scenario === 'ambiguous'
          ? [newer, { ...newer, token: 'also-new' }] : [newer],
    });
    const before = active().wallet.coins;
    expect(await useCareer.getState().recoverPendingPurchases()).toEqual({ status: 'PENDING' });
    expect(active().wallet.coins).toBe(before);
    expect(await readPendingCheckout()).not.toBeNull();
  });

  it('never opens checkout if the career cannot be saved', async () => {
    activate(makeCareerSave(90006));
    mockFailWrites = true;
    const provider = jest.spyOn(purchases, 'purchase');
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toMatchObject({ ok: false });
    expect(provider).not.toHaveBeenCalled();
  });

  it('retains pending delivery if the original slot was replaced', async () => {
    activate(makeCareerSave(90007));
    await useCareer.getState().persistCritical(true);
    await writePendingCheckout({ version: 1, saveId: 'deleted-career', mode: 'career', slot: 1,
      productId: 'coins_medium', accountId: 'LOCAL_MOCK', startedAt: 1000, previousTransactions: [], result: successfulReceipt() });
    const before = active().wallet.coins;
    await useCareer.getState().recoverPendingPurchases();
    expect(active().wallet.coins).toBe(before);
    expect((await loadSave('career', 1))?.id).toBe(active().id);
    expect(await readPendingCheckout()).not.toBeNull();
  });

  it('cancelled checkout grants nothing and permits another checkout', async () => {
    activate(makeCareerSave(90008));
    jest.spyOn(purchases, 'purchase').mockResolvedValue({ ok: false, productId: 'coins_medium', error: 'cancelled' });
    expect(await useCareer.getState().purchaseProduct('coins_medium')).toEqual({ ok: false, error: 'cancelled' });
    expect(await readPendingCheckout()).toBeNull();
  });
});

describe('gem exchange atomicity', () => {
  it('a committed exchange survives a failed wallet write and restart without duplication', async () => {
    activate(makeCareerSave(90301)); active().wallet.gems = 100;
    mockFailExchangeSave = true;
    expect((await useCareer.getState().convertPlayerGems(25)).ok).toBe(false);
    expect(active().wallet).toMatchObject({ coins: 1750, gems: 75 });
    mockFailExchangeSave = false; mockFailWrites = false;
    expect((await restartFromDisk('career')).wallet).toMatchObject({ coins: 1750, gems: 75 });
    expect((await restartFromDisk('career')).wallet).toMatchObject({ coins: 1750, gems: 75 });
  });
  it('failed preflight preserves concurrent rewards, energy changes and spending', async () => {
    activate(makeCareerSave(90101));
    active().wallet.gems = 100;
    await useCareer.getState().recoverPendingExchange();
    let rejectWrite!: (e: Error) => void;
    const spy = jest.spyOn(useCareer.getState(), 'persistCritical').mockImplementation(() => new Promise((_, reject) => { rejectWrite = reject; }));
    const changing = useCareer.getState().convertPlayerGems(25);
    await flush();
    expect(active().wallet.coins).toBe(750); // No speculative coins to spend.
    useCareer.getState().grantAdReward(100, 'separate-reward');
    active().wallet.coins -= 50;
    active().wallet.energy = 12;
    rejectWrite(new Error('disk full'));
    expect((await changing).ok).toBe(false);
    expect(active().wallet).toMatchObject({ coins: 800, gems: 100, energy: 12 });
    spy.mockRestore();
  });

  it('failed exchange never replaces the newly selected career', async () => {
    activate(makeCareerSave(90102));
    active().wallet.gems = 100;
    await useCareer.getState().recoverPendingExchange();
    let rejectWrite!: (e: Error) => void;
    const spy = jest.spyOn(useCareer.getState(), 'persistCritical').mockImplementation(() => new Promise((_, reject) => { rejectWrite = reject; }));
    const changing = useCareer.getState().convertPlayerGems(25);
    await flush();
    const other = makeManagerSave(90103); other.id = 'manager-2'; activate(other, 2);
    rejectWrite(new Error('disk full'));
    await changing;
    expect(active().id).toBe(other.id);
    expect(useCareer.getState().ref).toEqual({ mode: 'manager', slot: 2 });
    spy.mockRestore();
  });

  it('successful exchange is saved and cannot replay after reopening', async () => {
    activate(makeCareerSave(90104)); active().wallet.gems = 100;
    expect(await useCareer.getState().convertPlayerGems(25)).toEqual({ ok: true, gems: 25, coins: 1000 });
    expect((await restartFromDisk('career')).wallet).toMatchObject({ coins: 1750, gems: 75 });
    expect((await restartFromDisk('career')).wallet).toMatchObject({ coins: 1750, gems: 75 });
  });
});
