/**
 * Typed analytics facade — wired to Firebase Analytics.
 *
 * Uses a lazy require() so the native module is only loaded in EAS Dev/Prod
 * builds. Falls back to console-only logging in Expo Go, web, and Jest — the
 * app never crashes if the dependency is absent.
 *
 * ─── Setup (one-time) ────────────────────────────────────────────────────────
 *  1. npx expo install @react-native-firebase/app @react-native-firebase/analytics expo-build-properties
 *  2. app.json → plugins: add "@react-native-firebase/app" and
 *     ["expo-build-properties", { "ios": { "useFrameworks": "static" } }]
 *  3. Firebase console → create project → add Android app (package
 *     com.coverdrive.cricket) + iOS app (same bundle) → download the
 *     google-services.json / GoogleService-Info.plist and reference them in
 *     app.json (android.googleServicesFile / ios.googleServicesFile).
 *  4. eas build --profile development (Expo Go can't run native Firebase).
 *
 * Once the native module is present, analytics auto-enables (no flag to flip)
 * and Firebase collects D1/D7 retention automatically from first_open /
 * session_start. The EVT events below add the conversion funnel on top.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IS_DEV: boolean = ((): boolean => {
  const g = globalThis as { __DEV__?: boolean };
  return typeof g.__DEV__ === 'boolean' ? g.__DEV__ : false;
})();

export type AnalyticsParamValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

export interface AnalyticsEvent {
  name: string;
  params?: AnalyticsParams;
  ts: number;
}

/**
 * Canonical event-name taxonomy. Keep event names stable and snake_cased so
 * they remain compatible with Firebase/GA naming rules.
 */
export const EVT = {
  APP_OPEN: 'app_open',
  SCREEN_VIEW: 'screen_view',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  PURCHASE: 'purchase',
  PURCHASE_INITIATED: 'purchase_initiated',
  AD_WATCHED: 'ad_watched',
  AD_SKIPPED: 'ad_skipped',
  TRAIN: 'train',
  SIGN_PLAYER: 'sign_player',
  SEASON_ROLLOVER: 'season_rollover',
  DAILY_CLAIM: 'daily_claim',
  QUEST_COMPLETE: 'quest_complete',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  CAREER_START: 'career_start',
  NATIONAL_CALLUP: 'national_callup',
  RETIREMENT: 'retirement',
  HOF_ENTRY: 'hof_entry',
  STREAK_BROKEN: 'streak_broken',
  ENERGY_EMPTY: 'energy_empty',
  STARTER_PACK_SHOWN: 'starter_pack_shown',
  OFFER_SHOWN: 'offer_shown',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_DISMISSED: 'offer_dismissed',
  SHARE_ACHIEVEMENT: 'share_achievement',
  SHARE_NEWSPAPER: 'share_newspaper',
  LEGACY_CONTRIBUTION: 'legacy_contribution',
} as const;

export type EventName = (typeof EVT)[keyof typeof EVT];

// ─── In-memory ring buffer (debug + offline queuing) ─────────────────────────
const RING_CAPACITY = 200;
const ring: AnalyticsEvent[] = [];

function record(event: AnalyticsEvent): void {
  ring.push(event);
  if (ring.length > RING_CAPACITY) ring.shift();
}

// ─── Firebase lazy accessor (auto-enables when the native module is present) ───
type FirebaseAnalytics = {
  logEvent: (n: string, p?: object) => Promise<void>;
  setUserProperty: (k: string, v: string) => Promise<void>;
  logScreenView: (p: object) => Promise<void>;
};

let _fb: FirebaseAnalytics | null | undefined;
let _enabled = true;

function getFirebase(): FirebaseAnalytics | null {
  if (!_enabled) return null;
  if (_fb !== undefined) return _fb;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics').default;
    _fb = mod(); // auto-initialises from google-services once the dep is installed
  } catch {
    _fb = null; // Expo Go / web / Jest / dependency not installed → console-only
  }
  return _fb ?? null;
}

/** Opt out of (or back into) remote analytics, e.g. to honour a privacy toggle. */
export function setAnalyticsEnabled(on: boolean): void {
  _enabled = on;
  if (!on) _fb = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Logs a single analytics event. Always buffers locally; forwards to Firebase when available. */
export function logEvent(name: string, params?: AnalyticsParams): void {
  const event: AnalyticsEvent = params ? { name, params, ts: Date.now() } : { name, ts: Date.now() };
  record(event);
  if (IS_DEV) {
    console.log(`[analytics] ${name}`, params ?? {});
  }
  const fb = getFirebase();
  if (fb) {
    fb.logEvent(name, params).catch(() => {});
  }
}

/** Associates a user-scoped property with subsequent events (e.g. cohort, mode). */
export function setUserProperty(key: string, value: AnalyticsParamValue): void {
  if (IS_DEV) {
    console.log(`[analytics] user.${key} = ${String(value)}`);
  }
  const fb = getFirebase();
  if (fb) {
    fb.setUserProperty(key, String(value)).catch(() => {});
  }
}

/** Records a screen view. */
export function screen(name: string): void {
  logEvent(EVT.SCREEN_VIEW, { screen: name });
  const fb = getFirebase();
  if (fb) {
    fb.logScreenView({ screen_name: name, screen_class: name }).catch(() => {});
  }
}

export function getRecentEvents(): readonly AnalyticsEvent[] {
  return ring.slice();
}

export function clearRecentEvents(): void {
  ring.length = 0;
}
