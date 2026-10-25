/**
 * Monetization keys (RevenueCat + AdMob).
 *
 * Populate these via EXPO_PUBLIC_* environment variables (read at build time by
 * Expo). When a value is empty the corresponding provider stays safely disabled
 * or falls back to provider-owned test inventory in debug builds.
 *
 * Where to get each value:
 *   - RevenueCat public SDK keys: RevenueCat dashboard -> Project -> API keys
 *     (Apple key starts with `appl_`, Google key with `goog_`).
 *   - AdMob ad-unit IDs: AdMob console -> your app -> Ad units.
 */
const IS_DEV_BUILD = typeof __DEV__ !== 'undefined' && __DEV__;
function isIOS(): boolean {
  try {
    // Preserve standalone config/engine checks where React Native is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native') as typeof import('react-native')).Platform?.OS === 'ios';
  } catch { return false; }
}

const ADMOB_ANDROID_REWARDED_UNIT = 'ca-app-pub-4249020515368291/1717736882';
const ADMOB_ANDROID_INTERSTITIAL_UNIT = 'ca-app-pub-4249020515368291/6625581037';
const ADMOB_ANDROID_BANNER_UNIT = 'ca-app-pub-4249020515368291/6681421355';

export const MONETIZATION = {
  revenueCat: {
    // EAS rejects empty env values. Simulator profiles explicitly disable the
    // Apple client, including when a preview environment supplies a real key.
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED === 'true'
      ? '' : process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  },
  admob: {
    /**
     * Debug builds use the SDK's TestIds fallback unless explicitly overridden.
     * Release builds default to Cricket Legacy's Android ad units.
     */
    get rewarded() { return isIOS()
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT ?? ''
      : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT ?? (IS_DEV_BUILD ? '' : ADMOB_ANDROID_REWARDED_UNIT); },
    get interstitial() { return isIOS()
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT ?? ''
      : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT ?? (IS_DEV_BUILD ? '' : ADMOB_ANDROID_INTERSTITIAL_UNIT); },
    get banner() { return isIOS()
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT ?? ''
      : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT ?? (IS_DEV_BUILD ? '' : ADMOB_ANDROID_BANNER_UNIT); },
  },
} as const;
