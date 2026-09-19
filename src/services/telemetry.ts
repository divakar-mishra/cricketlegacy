// Native defaults are off too: no collection before settings hydration/opt-in.
let analyticsReady = false;
let crashesReady = false;
let generation = 0;
let queue: Promise<void> = Promise.resolve();
export function canSendAnalytics(): boolean {
  return analyticsReady;
}
export function canSendCrashes(): boolean {
  return crashesReady;
}

export function firebaseAnalytics() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-firebase/analytics') as typeof import('@react-native-firebase/analytics');
}
export function firebaseCrashes() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-firebase/crashlytics') as typeof import('@react-native-firebase/crashlytics');
}

export function configureTelemetry(usage: boolean, crashes: boolean): Promise<void> {
  const revision = ++generation;
  analyticsReady = false;
  crashesReady = false;
  queue = queue
    .then(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Platform } = require('react-native') as typeof import('react-native');
      if (Platform.OS !== 'android') return;
      try {
        const a = firebaseAnalytics();
        const instance = a.getAnalytics();
        await a.setConsent(instance, {
          analytics_storage: usage,
          ad_storage: false,
          ad_user_data: false,
          ad_personalization: false,
        });
        await a.setAnalyticsCollectionEnabled(instance, usage);
        if (!usage) await a.resetAnalyticsData(instance);
        if (revision === generation) analyticsReady = usage;
      } catch {
        /* Unsupported native runtime: fail closed, never interrupt play. */
      }
      try {
        const c = firebaseCrashes();
        const instance = c.getCrashlytics();
        await c.setCrashlyticsCollectionEnabled(instance, crashes);
        if (!crashes) await c.deleteUnsentReports(instance);
        if (revision === generation) crashesReady = crashes;
      } catch {
        /* Keep collection unavailable if native setup fails. */
      }
    })
    .catch(() => undefined);
  return queue;
}

export function startTelemetry(): () => void {
  // Keep pure engine imports independent of native storage/platform modules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSettings } = require('../state/settingsStore') as typeof import('../state/settingsStore');
  let previous = '';
  const sync = () => {
    const s = useSettings.getState();
    if (!s.hasHydrated) return;
    const key = `${s.usageAnalytics === true}:${s.crashReports === true}`;
    if (key === previous) return;
    previous = key;
    void configureTelemetry(s.usageAnalytics === true, s.crashReports === true);
  };
  const unsubscribe = useSettings.subscribe(sync);
  sync();
  return unsubscribe;
}
