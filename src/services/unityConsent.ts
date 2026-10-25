import type { AdAudience } from './ads';

/** Android-only native metadata bridge. No iOS Unity SDK is configured. */
export async function synchronizeUnityConsent(
  audience: AdAudience,
  canRequestAds: boolean,
): Promise<void> {
  // Keep the native dependency lazy, like the existing AdMob boundary (Expo Go).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeModules, Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS !== 'android') return;
  const bridge = NativeModules.CricketUnityConsent;
  // An older binary must not initialize mediated SDKs without the privacy bridge.
  if (typeof bridge?.applyConsent !== 'function') throw new Error('Unity privacy bridge unavailable');
  await bridge.applyConsent(audience, canRequestAds === true);
}
