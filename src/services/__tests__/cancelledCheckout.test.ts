jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const mockProbe = jest.fn();
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(() => ({ hasUnfinishedPurchase: mockProbe })),
}));
let mockUserId = '$RCAnonymousID:original';
const mockGetId = jest.fn(async () => mockUserId);
jest.mock('../supabaseClient', () => ({ currentRecoverableSupabaseUserId: async () => null }));
jest.mock('react-native-purchases', () => ({ default: {
  configure: jest.fn(), getAppUserID: mockGetId,
  isAnonymous: async () => mockUserId.startsWith('$RCAnonymousID:'),
} }));

describe('fresh Google Play unpaid-checkout resolution', () => {
  let store: typeof import('../purchases');
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();
  const intent = { accountId: '$RCAnonymousID:original', productId: 'coins_medium', previousTransactions: ['old-paid'] };
  const fresh = (history: unknown = { coins_medium: [{ id: 'old-paid' }] }) => ({
    ok: true, json: async () => ({ request_date_ms: 1791620000000, subscriber: { non_subscriptions: history } }),
  });

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
    mockUserId = intent.accountId;
    mockProbe.mockReset().mockResolvedValue(false);
    mockFetch.mockReset().mockResolvedValue(fresh());
    global.fetch = mockFetch;
    store = require('../purchases');
    await store.configurePurchases({ android: 'public-sdk-key' });
  });
  afterAll(() => {
    global.fetch = originalFetch;
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
  });

  it('unlocks only after two empty Play reads surround a fresh provider response', async () => {
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(true);
    expect(mockProbe.mock.calls).toEqual([['coins_medium'], ['coins_medium']]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/%24RCAnonymousID%3Aoriginal',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer public-sdk-key' }) }),
    );
    expect(mockProbe.mock.invocationCallOrder[0]).toBeLessThan(mockFetch.mock.invocationCallOrder[0]);
    expect(mockFetch.mock.invocationCallOrder[0]).toBeLessThan(mockProbe.mock.invocationCallOrder[1]);
  });
  it('keeps pending AND purchased-but-undelivered inventory locked', async () => {
    mockProbe.mockResolvedValue(true);
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('does not clear if an order appears during the network read', async () => {
    mockProbe.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
  });
  it.each([
    { coins_medium: [{ id: 'new-paid' }] },
    { 'coins_medium:buy': [{ id: 'new-paid', purchase_date: 'bad-date' }] },
    { coins_medium: [{}] }, { coins_medium: null }, null, [],
  ])('never discards new or malformed payment evidence: %j', async history => {
    mockFetch.mockResolvedValue(fresh(history));
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
  });
  it('permits resolved historical purchases and unrelated product receipts without regranting', async () => {
    mockFetch.mockResolvedValue(fresh({ 'coins_medium:buy': [{ id: 'old-paid' }], gems_medium: [{ id: 'unrelated' }] }));
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(true);
  });
  it.each([false, 'throw'])('fails closed on HTTP failure: %s', async failure => {
    if (failure === 'throw') mockFetch.mockRejectedValue(new Error('offline'));
    else mockFetch.mockResolvedValue({ ok: false });
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
  });
  it('does not use an offline SDK timestamp as fresh history', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ subscriber: { non_subscriptions: {} } }) });
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
  });
  it('fails closed on native billing failure', async () => {
    mockProbe.mockRejectedValue(new Error('billing disconnected'));
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('fails closed when this APK does not contain the native probe', async () => {
    const modules = jest.requireMock('expo-modules-core');
    modules.requireOptionalNativeModule.mockReturnValueOnce(null);
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('requires an explicit successful native empty result, not a missing callback value', async () => {
    mockProbe.mockResolvedValue(undefined);
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('retains a paid result even after its consumable has left Play inventory', async () => {
    expect(await store.isCheckoutNoLongerPayable({ ...intent, result: { ok: true,
      productId: intent.productId, purchaseToken: 'paid' } })).toBe(false);
    expect(mockProbe).not.toHaveBeenCalled();
  });
  it('fails closed if identity is changed while either provider check is running', async () => {
    mockFetch.mockImplementationOnce(async () => { store.clearPurchaseIdentity(); return fresh(); });
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
    mockUserId = '$RCAnonymousID:different';
    expect(await store.isCheckoutNoLongerPayable(intent)).toBe(false);
  });
  it('does not apply a one-time inventory check to a legacy subscription', async () => {
    expect(await store.isCheckoutNoLongerPayable({ ...intent, productId: 'season_pass' })).toBe(false);
    expect(mockProbe).not.toHaveBeenCalled();
  });
});
