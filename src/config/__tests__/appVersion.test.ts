import { GENERATED_BUILD_INFO } from '../buildInfo.generated';

let mockNativeVersion: string | null = null;
let mockPlatform = 'android';

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() { return mockNativeVersion; },
  nativeBuildVersion: '18',
}));
jest.mock('react-native', () => ({
  Platform: { get OS() { return mockPlatform; } },
}));

describe('main-menu application version', () => {
  it.each([
    { platform: 'android', nativeVersion: '1.0.12' },
    { platform: 'android', nativeVersion: '2.3.4' },
    { platform: 'ios', nativeVersion: '1.0.12' },
    { platform: 'ios', nativeVersion: '2.3.4' },
    { platform: 'android', nativeVersion: null },
    { platform: 'web', nativeVersion: null },
  ])('uses installed metadata or the existing generated fallback: $platform / $nativeVersion', ({ platform, nativeVersion }) => {
    mockPlatform = platform;
    mockNativeVersion = nativeVersion;
    jest.isolateModules(() => {
      const { APP_VERSION } = jest.requireActual<typeof import('../app')>('../app');
      expect(APP_VERSION).toBe(nativeVersion ?? GENERATED_BUILD_INFO.appVersion);
    });
  });
});
