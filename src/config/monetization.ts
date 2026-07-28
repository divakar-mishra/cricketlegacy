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

const ADMOB_ANDROID_REWARDED_UNIT = 'ca-app-pub-4249020515368291/1717736882';

export const MONETIZATION = {
  revenueCat: {
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  },
  admob: {
    /**
     * Debug builds use the SDK's TestIds fallback unless explicitly overridden.
     * Release builds default to Cricket Legacy's Android rewarded ad unit.
     */
    rewarded: process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT ?? (IS_DEV_BUILD ? '' : ADMOB_ANDROID_REWARDED_UNIT),
    interstitial: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT ?? '',
  },
} as const;
