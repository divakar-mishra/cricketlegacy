import { QA_TOOLS_ENABLED } from '../config/qa';
import { MONETIZATION } from '../config/monetization';
import { configureQaAdSession, isAdsReady } from './ads';

/** Native build AND test-device checks precede any UMP reset/region override. */
export async function prepareQaAdSession(profile: 'us-adult' | 'teen' | 'normal'): Promise<boolean> {
  if (!QA_TOOLS_ENABLED) throw new Error('QA ad profiles are disabled');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeModules, Platform } = require('react-native') as typeof import('react-native');
  const bridge = NativeModules.CricketUnityConsent;
  if (Platform.OS !== 'android' || typeof bridge?.assertQaTestDevice !== 'function') {
    throw new Error('QA profiles require the matching Android QA build');
  }
  await bridge.assertQaTestDevice();
  return configureQaAdSession(profile);
}

/** UI and native build-type guards both apply; never initializes ads or grants rewards. */
export async function openQaAdDiagnostics(): Promise<void> {
  if (!QA_TOOLS_ENABLED || !isAdsReady()) throw new Error('QA ads need an eligible, initialized test session');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeModules, Platform } = require('react-native') as typeof import('react-native');
  const bridge = NativeModules.CricketUnityConsent;
  if (Platform.OS !== 'android' || typeof bridge?.openQaDiagnostics !== 'function') {
    throw new Error('Ad diagnostics require the matching Android QA build');
  }
  await bridge.openQaDiagnostics(MONETIZATION.admob);
}
