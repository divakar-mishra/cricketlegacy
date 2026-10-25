/** Rewarded/interstitial/banner boundary with a lazily loaded AdMob native module. */

import { isOnline } from './connectivity';
import { getJSON, setJSON } from '../storage/storage';
import { synchronizeUnityConsent } from './unityConsent';
import { QA_TOOLS_ENABLED } from '../config/qa';

export type AdKind = 'rewarded' | 'interstitial';

/** Local ad simulation is intentionally disabled for reward integrity. */
const ALLOW_LOCAL_AD_SIMULATION = false;
export const MOCK_MODE = typeof __DEV__ !== 'undefined' && __DEV__ && ALLOW_LOCAL_AD_SIMULATION;

/* ---------------------------------------------------------------------------
 * AdMob provider (react-native-google-mobile-ads), loaded lazily so the app
 * never crashes when the dependency is absent (Expo Go / before EAS build).
 *
 * ------------------------------------------------------------------------- */
type AdMobModule = any; // no static types — the dep may be absent
let _admob: AdMobModule | null | undefined;
let _adsConfigured = false;
export type AdAudience = 'none' | 'teen' | 'adult';
let _audience: AdAudience = 'none';
// Also advances when privacy editing starts, invalidating already-loading ads.
let _audienceRevision = 0;
let _configuration: Promise<void> | undefined;
let _privacyBusy = false;
let _unitIds: { rewarded?: string; interstitial?: string; banner?: string } = {};
const _adsStateListeners = new Set<() => void>();
// Ephemeral QA-only overrides. Never persist or rewrite the declared-age answer.
let _qaDebugGeography: number | undefined;
let _qaOriginalAudience: 'adult' | undefined;
let _qaSessionBusy = false;

function consentOptions(audience: AdAudience) {
  return {
    tagForUnderAgeOfConsent: audience === 'teen',
    ...(QA_TOOLS_ENABLED && _qaDebugGeography !== undefined
      ? { debugGeography: _qaDebugGeography } : {}),
  };
}

/** Called only after the native QA/test-device guard, never by normal startup. */
export async function configureQaAdSession(profile: 'us-adult' | 'teen' | 'normal'): Promise<boolean> {
  if (!QA_TOOLS_ENABLED || _audience === 'none' || _privacyBusy || _configuration || _qaSessionBusy) {
    throw new Error('An eligible, idle Android QA ad session is required');
  }
  if (!['us-adult', 'teen', 'normal'].includes(profile)) throw new Error('Unknown QA profile');
  const M = loadAdMob();
  if (typeof M?.AdsConsent?.reset !== 'function') throw new Error('QA consent reset unavailable');
  if (!_qaOriginalAudience) {
    if (_audience !== 'adult') throw new Error('QA overrides require an existing adult test session');
    _qaOriginalAudience = 'adult';
  }
  const audience = profile === 'teen' ? 'teen' : _qaOriginalAudience;
  const revision = ++_audienceRevision;
  _qaSessionBusy = true;
  _adsConfigured = false;
  notifyAdsStateChanged();
  try {
    await synchronizeUnityConsent(_audience, false);
    await M.AdsConsent.reset();
    // Never resurrect eligibility withdrawn while the native reset was pending.
    if (_audienceRevision !== revision) throw new Error('QA audience changed; restart the QA session');
    _qaDebugGeography = profile === 'us-adult' ? 3 : profile === 'teen' ? 4 : undefined;
    // The pinned native SDK wrapper creates a fresh RequestConfiguration.Builder,
    // so the normal adult call clears the QA teen rating by omitting that field.
    await configureAds(_unitIds, audience);
    if (profile === 'normal') _qaOriginalAudience = undefined;
  } finally {
    _qaSessionBusy = false;
    notifyAdsStateChanged();
  }
  return isAdsReady();
}

function notifyAdsStateChanged(): void {
  _adsStateListeners.forEach((listener) => listener());
}

/** Subscribe to initialization/consent changes (used by inline banner slots). */
export function subscribeAdsState(listener: () => void): () => void {
  _adsStateListeners.add(listener);
  return () => _adsStateListeners.delete(listener);
}

function loadAdMob(): AdMobModule | null {
  if (_admob !== undefined) return _admob;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _admob = require('react-native-google-mobile-ads');
  } catch {
    _admob = null;
  }
  return _admob;
}

/**
 * Initialise AdMob once at startup. No-ops in {@link MOCK_MODE} or when the SDK
 * isn't installed. Pass your production ad-unit IDs (falls back to Google's
 * test IDs if omitted so nothing is left un-fillable during bring-up).
 */
export async function configureAds(
  unitIds: { rewarded?: string; interstitial?: string; banner?: string } = {},
  audience: AdAudience = 'none',
): Promise<void> {
  const audienceChanged = _audience !== audience;
  if (audienceChanged) _audienceRevision += 1;
  _audience = audience;
  if (audience === 'none') {
    _adsConfigured = false;
    notifyAdsStateChanged();
    if (audienceChanged) void synchronizeUnityConsent('none', false).catch(() => undefined);
    return;
  }
  // Invalidate any older pending load as well as readiness when iOS identities
  // disappear. Audience withdrawal above must always retain its normal handling.
  if (isIosRuntime() && (!unitIds.rewarded || !unitIds.interstitial || !unitIds.banner)) {
    _audienceRevision += 1;
    _unitIds = {};
    _adsConfigured = false;
    notifyAdsStateChanged();
    return;
  }
  if (MOCK_MODE || _privacyBusy) return;
  if (_configuration) {
    await _configuration;
    if (audienceChanged && _audience === audience) await configureAds(unitIds, audience);
    return;
  }
  if (_adsConfigured && !audienceChanged) return;
  _adsConfigured = false;
  notifyAdsStateChanged();
  const revision = _audienceRevision;
  const isCurrent = () => _audience === audience && _audienceRevision === revision;
  const M = loadAdMob();
  if (!M) return;
  _unitIds = unitIds;
  _configuration = (async () => {
    let stage = 'request_configuration';
    try {
      // Configure treatment before consent or initialization. For eligible
      // teens use the most restrictive flags available in GMA 24.x.
      const init = (M.default ?? M.mobileAds)?.();
      if (!init?.setRequestConfiguration || !init?.initialize) return;
      await init.setRequestConfiguration({
        // The admitted teen audience is 13–17, not an under-13 child-directed audience.
        // Keep the stricter under-age-of-consent and G-rated treatment below.
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: audience === 'teen',
        ...(audience === 'teen' ? { maxAdContentRating: M.MaxAdContentRating?.G ?? 'G' } : {}),
      });
      // UMP may allow requests using a completed decline's limited-ad signal.
      // On a transient form/update error, only use UMP's own current/previous
      // session permission; never infer permission from the age choice alone.
      let consent: { canRequestAds?: boolean } | undefined;
      stage = 'ump';
      try {
        consent = await M.AdsConsent?.gatherConsent(consentOptions(audience));
      } catch {
        consent = await M.AdsConsent?.getConsentInfo();
      }
      if (!isCurrent()) return;
      // The pinned Unity adapter does not forward Additional Consent itself.
      // Apply native vendor/purpose choices before any mediated SDK initializes.
      stage = 'unity_privacy';
      await synchronizeUnityConsent(audience, consent?.canRequestAds === true);
      if (!isCurrent() || consent?.canRequestAds !== true) {
        notifyAdsStateChanged();
        return;
      }
      stage = 'google_initialization';
      await init.initialize();
      _adsConfigured = isCurrent() && !_privacyBusy;
      notifyAdsStateChanged();
    } catch {
      // QA-only stage names, never raw consent strings or account identifiers.
      if (QA_TOOLS_ENABLED) console.warn(`[CricketAdsQA] Configuration failed at ${stage}`);
      _adsConfigured = false;
      notifyAdsStateChanged();
    }
  })();
  try {
    await _configuration;
  } finally {
    _configuration = undefined;
  }
}

export async function showAdPrivacyChoices(): Promise<'shown' | 'not_required' | 'unavailable'> {
  if (_audience === 'none' || _privacyBusy || _qaSessionBusy) return 'unavailable';
  const audience = _audience;
  const M = loadAdMob();
  if (!M?.AdsConsent) return 'unavailable';
  const revision = ++_audienceRevision;
  _privacyBusy = true;
  _adsConfigured = false;
  notifyAdsStateChanged();
  try {
    if (_configuration) await _configuration;
    _adsConfigured = false;
    notifyAdsStateChanged();
    // Suspend personalization while the user edits/withdraws a choice.
    await synchronizeUnityConsent(audience, false);
    const info = await M.AdsConsent.requestInfoUpdate(consentOptions(audience));
    const required = info?.privacyOptionsRequirementStatus === 'REQUIRED';
    const result = required ? await M.AdsConsent.showPrivacyOptionsForm() : info;
    if (_audience !== audience || _audienceRevision !== revision) return 'unavailable';
    await synchronizeUnityConsent(audience, result?.canRequestAds === true);
    if (result?.canRequestAds === true && _audience === audience && _audienceRevision === revision) {
      const init = (M.default ?? M.mobileAds)?.();
      if (init?.initialize) {
        await init.initialize();
        _adsConfigured = _audience === audience && _audienceRevision === revision;
      }
    }
    notifyAdsStateChanged();
    return required ? 'shown' : 'not_required';
  } catch {
    _adsConfigured = false;
    await synchronizeUnityConsent(audience, false).catch(() => undefined);
    notifyAdsStateChanged();
    return 'unavailable';
  } finally {
    _privacyBusy = false;
    notifyAdsStateChanged();
  }
}

async function mayRequestAds(): Promise<boolean> {
  if (_audience === 'none' || !_adsConfigured || _privacyBusy || _qaSessionBusy) return false;
  const revision = _audienceRevision;
  try {
    const permitted = (await loadAdMob()?.AdsConsent?.getConsentInfo())?.canRequestAds === true;
    if (revision !== _audienceRevision || _privacyBusy) return false;
    if (!permitted) {
      _adsConfigured = false;
      notifyAdsStateChanged();
      await synchronizeUnityConsent(_audience, false);
    }
    return permitted && revision === _audienceRevision && !_privacyBusy && _adsConfigured;
  } catch {
    return false;
  }
}

/** Whether a live ad backend is ready (SDK loaded + initialised). */
export function isAdsReady(): boolean {
  return _audience !== 'none' && !_privacyBusy && !_qaSessionBusy && _adsConfigured && loadAdMob() != null;
}

/** Return a configured production banner unit, or Google's test unit in dev. */
export function getBannerAdUnitId(): string | undefined {
  if (!isAdsReady()) return undefined;
  const M = loadAdMob();
  return _unitIds.banner ?? (__DEV__ ? M?.TestIds?.BANNER : undefined);
}

/** Let AdMob's UMP/TCF signal select adult serving mode, including limited ads. */
export function getAdRequestOptions(): { requestNonPersonalizedAdsOnly?: boolean } {
  // The initial iOS port does not request ATT authorization or use IDFA tracking.
  // Keep its requests contextual until a separately reviewed tracking flow exists.
  return _audience === 'teen' || isIosRuntime() ? { requestNonPersonalizedAdsOnly: true } : {};
}

function isIosRuntime(): boolean {
  try {
    // Keep pure-engine/test imports independent of React Native's native entry.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native') as typeof import('react-native')).Platform.OS === 'ios';
  } catch {
    return false;
  }
}

/** Real rewarded ad — resolves completed=true only on EARNED_REWARD. */
function showRealRewarded(unitId: string, M: AdMobModule): Promise<{ completed: boolean }> {
  const { RewardedAd, RewardedAdEventType, AdEventType } = M;
  const revision = _audienceRevision;
  return new Promise((resolve) => {
    let earned = false;
    let settled = false;
    let presenting = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subs: (() => void)[] = [];
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      subs.forEach((u) => {
        try {
          u();
        } catch {
          /* noop */
        }
      });
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ completed: earned });
    };
    try {
      const ad = RewardedAd.createForAdRequest(unitId, getAdRequestOptions());
      subs.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (settled || presenting) return;
          if (!isAdsReady() || _audienceRevision !== revision) { finish(); return; }
          presenting = true;
          try {
            // Native adapters may reject asynchronously (e.g. stale Activity).
            void Promise.resolve(ad.show()).catch(finish);
          } catch {
            finish();
          }
        }),
      );
      subs.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        }),
      );
      subs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
      subs.push(ad.addAdEventListener(AdEventType.ERROR, finish));
      // Loading plus an optional 60-second rewarded creative may exceed 30s.
      timeout = setTimeout(finish, 180_000); // safety: never hang the caller
      ad.load();
    } catch {
      finish();
    }
  });
}

/** Real interstitial ad — resolves when the ad closes (or errors/times out). */
function showRealInterstitial(unitId: string, M: AdMobModule, canPresent: () => boolean): Promise<boolean> {
  const { InterstitialAd, AdEventType } = M;
  const revision = _audienceRevision;
  return new Promise((resolve) => {
    let settled = false;
    let shown = false;
    let presenting = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subs: (() => void)[] = [];
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      subs.forEach((u) => {
        try {
          u();
        } catch {
          /* noop */
        }
      });
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(shown);
    };
    try {
      const ad = InterstitialAd.createForAdRequest(unitId, getAdRequestOptions());
      subs.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          if (settled || presenting) return;
          if (!isAdsReady() || _audienceRevision !== revision || !canPresent()) { finish(); return; }
          presenting = true;
          try {
            const presentation = ad.show();
            shown = true;
            void Promise.resolve(presentation).catch(() => { shown = false; finish(); });
          } catch {
            finish();
          }
        }),
      );
      subs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
      subs.push(ad.addAdEventListener(AdEventType.ERROR, finish));
      timeout = setTimeout(finish, 20_000);
      ad.load();
    } catch {
      finish();
    }
  });
}

const MOCK_REWARDED_DELAY_MS = 800;
const MOCK_INTERSTITIAL_DELAY_MS = 300;

/** Ad readiness. Local simulation is disabled unless explicitly re-enabled. */
const loaded: Record<AdKind, boolean> = {
  rewarded: MOCK_MODE,
  interstitial: MOCK_MODE,
};

/** Timestamp (epoch millis) of the last shown interstitial, for frequency capping. */
let lastInterstitialAt = 0;
let hubInterstitialPending = false;
const INTERSTITIAL_HISTORY_KEY = 'ads:interstitial-history:v1';
export const INTERSTITIAL_WINDOW_MS = 60 * 60_000;
/** Approved closed-test policy: at most four safe-point ads per rolling hour. */
export const INTERSTITIAL_MAX_PER_WINDOW = 4;
export const DEFAULT_INTERSTITIAL_GAP_MS = 15 * 60_000;
/** A match, an innings and an unsettled result must never be ad entry points. */
export type InterstitialSafePoint = 'career-hub-return';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether an ad of the given kind is loaded and ready to show. */
export function isReady(kind: AdKind): boolean {
  return loaded[kind] === true;
}

/**
 * Shows a rewarded ad. Resolves `{ completed: true }` only if the user earned
 * the reward. Returns `{ completed: false }` when ads are disabled or offline.
 * @param adsEnabled pass `false` only when an optional rewarded request must be skipped.
 */
export async function showRewarded(adsEnabled = true): Promise<{ completed: boolean }> {
  if (!adsEnabled) return { completed: false };
  if (!(await mayRequestAds())) return { completed: false };
  if (!(await isOnline())) return { completed: false };

  if (MOCK_MODE) {
    await delay(MOCK_REWARDED_DELAY_MS);
    return { completed: false };
  }

  const M = loadAdMob();
  if (!M || !_adsConfigured) return { completed: false };
  const unitId = _unitIds.rewarded ?? M.TestIds?.REWARDED;
  if (!unitId) return { completed: false };
  return showRealRewarded(unitId, M);
}

/**
 * Shows an interstitial ad if allowed. No-ops when ads are disabled or offline.
 * Updates the frequency-cap timestamp when an ad is actually shown.
 * @param adsEnabled pass `false` (e.g. for the removeAds entitlement) to skip.
 */
export async function showInterstitial(adsEnabled = true, canPresent: () => boolean = () => true): Promise<boolean> {
  if (!adsEnabled || !canPresent()) return false;
  if (!(await mayRequestAds())) return false;
  if (!(await isOnline())) return false;
  if (!canPresent()) return false;

  if (MOCK_MODE) {
    lastInterstitialAt = Date.now();
    await delay(MOCK_INTERSTITIAL_DELAY_MS);
    return true;
  }

  const M = loadAdMob();
  if (!M || !_adsConfigured) return false;
  const unitId = _unitIds.interstitial ?? M.TestIds?.INTERSTITIAL;
  if (!unitId) return false;
  const shown = await showRealInterstitial(unitId, M, canPresent);
  if (shown) lastInterstitialAt = Date.now();
  return shown;
}

/**
 * Show an interstitial only if ads are enabled for this user AND the frequency
 * cap allows it. Safe to call liberally (e.g. on returning to the hub) — it
 * self-limits. Returns true when an ad was attempted.
 *
 * @param adsEnabled pass the result of `!areAdsRemoved(entitlements)`.
 */
export async function maybeShowInterstitial(
  adsEnabled: boolean,
  safePoint: InterstitialSafePoint,
  minGapMs: number = DEFAULT_INTERSTITIAL_GAP_MS,
  canPresent: () => boolean = () => true,
): Promise<boolean> {
  // Require an explicit, reviewed safe navigation point at every call site.
  if (!adsEnabled || safePoint !== 'career-hub-return' || hubInterstitialPending || !canPresent()) return false;
  // Reserve synchronously, before the history/consent/network awaits. Rapid
  // focus changes must not start two ads against the same stale history.
  hubInterstitialPending = true;
  try {
    const now = Date.now();
    const stored = await getJSON<number[]>(INTERSTITIAL_HISTORY_KEY);
    const history = (Array.isArray(stored) ? stored : []).filter(
      (timestamp) => Number.isFinite(timestamp) && now - timestamp < INTERSTITIAL_WINDOW_MS,
    );
    // A failed history write must not let an older stored timestamp override
    // the ad we just showed in this process.
    const latest = Math.max(lastInterstitialAt, ...history);
    if (history.length >= INTERSTITIAL_MAX_PER_WINDOW || now - latest < minGapMs) return false;
    const shown = await showInterstitial(true, canPresent);
    if (!shown) return false;
    try {
      await setJSON(INTERSTITIAL_HISTORY_KEY, [...history, Date.now()]);
    } catch {
      // The ad was already shown; the in-memory timestamp still enforces gap.
    }
    return true;
  } finally {
    hubInterstitialPending = false;
  }
}
