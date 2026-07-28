const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));

describe('device-global purchase state', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.resetModules();
  });

  it('keeps Starter Pack ownership after the service module reloads', async () => {
    const first =
      jest.requireActual<typeof import('../accountPurchases')>('../accountPurchases');
    expect(await first.hasStarterPackPurchase()).toBe(false);

    await first.markStarterPackPurchased('starter-token', 1234);
    jest.resetModules();
    const reloaded =
      jest.requireActual<typeof import('../accountPurchases')>('../accountPurchases');

    expect(await reloaded.hasStarterPackPurchase()).toBe(true);
    expect(mockStorage.get('account:purchases:v1')).toContain('"starterPackBoughtAt":1234');
    expect(mockStorage.get('account:purchases:v1')).toContain(
      '"starterPackPurchaseToken":"starter-token"',
    );
  });
});

