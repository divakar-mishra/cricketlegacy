jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

let mockRecoverableUserId: string | null = null;
let mockProviderUserId = '$RCAnonymousID:guest-1';
const mockConfigure = jest.fn();
const mockGetAppUserID = jest.fn(async () => mockProviderUserId);
const mockIsAnonymous = jest.fn(async () => mockProviderUserId.startsWith('$RCAnonymousID:'));
const mockLogIn = jest.fn(async (id: string) => { mockProviderUserId = id; });
const mockLogOut = jest.fn(async () => { mockProviderUserId = '$RCAnonymousID:guest-2'; });
const mockGetProducts = jest.fn(async () => [{ identifier: 'coins_medium', priceString: '₹299' }]);
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
});
