jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

let mockRecoverableUserId: string | null = null;
let mockProviderUserId = '$RCAnonymousID:guest-1';
const mockConfigure = jest.fn();
const mockGetAppUserID = jest.fn(async () => mockProviderUserId);
const mockIsAnonymous = jest.fn(async () => mockProviderUserId.startsWith('$RCAnonymousID:'));
const mockLogIn = jest.fn(async (id: string) => { mockProviderUserId = id; });
const mockLogOut = jest.fn(async () => { mockProviderUserId = '$RCAnonymousID:guest-2'; });
const mockGetProducts = jest.fn(async () => [{ identifier: 'coins_medium', priceString: '₹299' }]);
const mockInvalidateCache = jest.fn(async () => undefined);
const mockGetCustomerInfo = jest.fn();
const mockPurchaseStoreProduct = jest.fn(async () => ({
  transaction: { transactionIdentifier: 'play-transaction-1' },
  customerInfo: { entitlements: { active: {} } },
}));

jest.mock('../supabaseClient', () => ({
  currentRecoverableSupabaseUserId: jest.fn(async () => mockRecoverableUserId),
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    getAppUserID: mockGetAppUserID,
    isAnonymous: mockIsAnonymous,
    logIn: mockLogIn,
    logOut: mockLogOut,
    getProducts: mockGetProducts,
    purchaseStoreProduct: mockPurchaseStoreProduct,
    invalidateCustomerInfoCache: mockInvalidateCache,
    getCustomerInfo: mockGetCustomerInfo,
  },
}));

describe('guest Play purchases', () => {
  let store: typeof import('../purchases');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
    mockRecoverableUserId = null;
    mockProviderUserId = '$RCAnonymousID:guest-1';
    mockGetCustomerInfo.mockReset();
    mockGetCustomerInfo.mockResolvedValue({ requestDate: '2026-10-11T12:00:00Z',
      nonSubscriptionTransactions: [], entitlements: { active: {} } });
    store = require('../purchases') as typeof import('../purchases');
  });

  afterAll(() => {
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
  });

  it('loads Play prices and buys on a RevenueCat anonymous customer without Supabase login', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'public-test-key' });
    expect(store.isStoreReady()).toBe(true);
    expect((await store.getProducts()).find((p) => p.id === 'coins_medium')?.priceString).toBe('₹299');
    expect(await store.purchase('coins_medium')).toMatchObject({
      ok: true,
      purchaseToken: 'play-transaction-1',
      accountId: '$RCAnonymousID:guest-1',
    });
    expect(mockPurchaseStoreProduct).toHaveBeenCalledTimes(1);
  });

  it('links guest purchases on login and switches back to a new guest after sign-out', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    mockRecoverableUserId = 'verified-supabase-user';
    store.clearPurchaseIdentity();
    expect(await store.synchronizePurchaseIdentity()).toBe(true);
    expect(mockLogIn).toHaveBeenCalledWith('verified-supabase-user');
    mockRecoverableUserId = null;
    store.clearPurchaseIdentity();
    expect(store.isStoreReady()).toBe(false);
    expect(await store.synchronizePurchaseIdentity()).toBe(true);
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockProviderUserId).toBe('$RCAnonymousID:guest-2');
  });

  it('reads verified transaction IDs, provider time and active entitlements for recovery', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    mockGetCustomerInfo.mockResolvedValue({ requestDate: '2026-10-11T12:00:00Z',
      originalAppUserId: '$RCAnonymousID:guest-1',
      nonSubscriptionTransactions: [
        { transactionIdentifier: 'receipt', productIdentifier: 'coins_medium', purchaseDate: '2026-10-11T11:00:00Z' },
        { transactionIdentifier: '', productIdentifier: 'coins_medium', purchaseDate: 'invalid' },
      ], entitlements: { active: { player_vip: { isActive: true }, manager_vip: { isActive: false } } } });
    expect(await store.getPurchaseRecoverySnapshot()).toEqual({
      accountId: '$RCAnonymousID:guest-1', observedAt: Date.parse('2026-10-11T12:00:00Z'),
      originalAccountId: '$RCAnonymousID:guest-1',
      activeProductIds: ['player_vip'], transactions: [{ token: 'receipt', productId: 'coins_medium',
        purchasedAt: Date.parse('2026-10-11T11:00:00Z') }],
    });
    expect(mockInvalidateCache).toHaveBeenCalled();
  });

  it('retains the provider-confirmed guest origin when reading history after login', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    mockRecoverableUserId = 'linked-owner';
    store.clearPurchaseIdentity();
    mockGetCustomerInfo.mockResolvedValue({ requestDate: '2026-10-11T12:00:00Z',
      originalAppUserId: '$RCAnonymousID:guest-1', nonSubscriptionTransactions: [] });
    expect(await store.getPurchaseRecoverySnapshot()).toMatchObject({
      accountId: 'linked-owner', originalAccountId: '$RCAnonymousID:guest-1',
    });
  });

  it('does not return recovery history after an account switch or provider failure', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    mockGetCustomerInfo.mockImplementationOnce(async () => {
      store.clearPurchaseIdentity();
      return { requestDate: '2026-10-11T12:00:00Z', nonSubscriptionTransactions: [] };
    });
    expect(await store.getPurchaseRecoverySnapshot()).toBeNull();
    mockGetCustomerInfo.mockRejectedValueOnce(new Error('Offline'));
    expect(await store.getPurchaseRecoverySnapshot()).toBeNull();
  });

  it('marks errors before native checkout as safe to cancel the pending intent', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    mockGetProducts.mockRejectedValueOnce(new Error('Product fetch failed'));
    expect(await store.purchase('coins_medium')).toMatchObject({ ok: false, checkoutNotStarted: true });
    expect(mockPurchaseStoreProduct).not.toHaveBeenCalled();
  });

  it('does not charge a different account from the durable checkout intent', async () => {
    await store.configurePurchases({ android: 'public-test-key' });
    expect(await store.purchase('coins_medium', 'other-account')).toMatchObject({
      ok: false, error: 'purchase_account_changed', checkoutNotStarted: true,
    });
    expect(mockPurchaseStoreProduct).not.toHaveBeenCalled();
  });
});
