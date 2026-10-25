describe('RevenueCat platform-key isolation', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it.each(['true', 'false', undefined])('keeps Android keys unchanged with Apple disabled=%s', disabled => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_android_fixture';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_apple_fixture';
    if (disabled === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED;
    else process.env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED = disabled;
    jest.isolateModules(() => {
      const { MONETIZATION } = jest.requireActual<typeof import('../monetization')>('../monetization');
      expect(MONETIZATION.revenueCat.android).toBe('goog_android_fixture');
      expect(MONETIZATION.revenueCat.ios).toBe(disabled === 'true' ? '' : 'appl_apple_fixture');
    });
  });

  it('keeps missing keys empty without inventing provider credentials', () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED;
    jest.isolateModules(() => {
      const { MONETIZATION } = jest.requireActual<typeof import('../monetization')>('../monetization');
      expect(MONETIZATION.revenueCat).toEqual({ android: '', ios: '' });
    });
  });
});
