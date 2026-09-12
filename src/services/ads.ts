/**
 * Rewarded/interstitial boundary with a lazily loaded AdMob native module.
 *
 * ---------------------------------------------------------------------------
 * The live provider is implemented below and kept behind this interface.
 * Keep all SDK usage inside this module and flip {@link MOCK_MODE} to `false`.
 *
 *   import mobileAds, { RewardedAd, InterstitialAd, RewardedAdEventType,
 *     AdEventType, TestIds } from 'react-native-google-mobile-ads';
 *
 *   // once at startup: await mobileAds().initialize();
 *   // preload RewardedAd/InterstitialAd for a unit id and track `loaded` state
 *   // so isReady() reflects it; on show, resolve completed on EARNED_REWARD.
 * ---------------------------------------------------------------------------
 */

import { isOnline } from './connectivity';
import { getJSON, setJSON } from '../storage/storage';

export type AdKind = 'rewarded' | 'interstitial';

/** Local ad simulation is intentionally disabled for reward integrity. */
const ALLOW_LOCAL_AD_SIMULATION = false;
export const MOCK_MODE = typeof __DEV__ !== 'undefined' && __DEV__ && ALLOW_LOCAL_AD_SIMULATION;

/* ---------------------------------------------------------------------------
 * AdMob provider (react-native-google-mobile-ads), loaded lazily so the app
 * never crashes when the dependency is absent (Expo Go / before EAS build).
 *
 * To go live:
 *   1. npx expo install react-native-google-mobile-ads
 *   2. Add the config plugin + your AdMob app IDs to app.json.
 *   3. Call configureAds({ rewarded, interstitial }) once at App.tsx startup.
 * ------------------------------------------------------------------------- */
type AdMobModule = any; // no static types — the dep may be absent
let _admob: AdMobModule | null | undefined;
let _adsConfigured = false;
let _adultEligible = false;
let _configuration: Promise<void> | undefined;
let _privacyBusy = false;
let _unitIds: { rewarded?: string; interstitial?: string } = {};

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
  unitIds: { rewarded?: string; interstitial?: string } = {},
  adultEligible = false,
): Promise<void> {
  _adultEligible = adultEligible;
  if (!adultEligible) {
    _adsConfigured = false;
    return;
  }
  if (MOCK_MODE || _adsConfigured) return;
  if (_configuration) return _configuration;
  const M = loadAdMob();
  if (!M) return;
  _unitIds = unitIds;
  _configuration = (async () => {
    try {
      // Fail closed if UMP is absent, errors or does not allow ad requests.
      const consent = await M.AdsConsent?.gatherConsent({ tagForUnderAgeOfConsent: false });
      if (!_adultEligible || consent?.canRequestAds !== true) return;
      const init = (M.default ?? M.mobileAds)?.();
      if (!init?.initialize) return;
      await init.initialize();
      _adsConfigured = _adultEligible;
    } catch {
      _adsConfigured = false;
    }
  })();
  try {
    await _configuration;
  } finally {
    _configuration = undefined;
  }
}

export async function showAdPrivacyChoices(): Promise<'shown' | 'not_required' | 'unavailable'> {
  if (!_adultEligible || _privacyBusy) return 'unavailable';
  const M = loadAdMob();
  if (!M?.AdsConsent) return 'unavailable';
  _privacyBusy = true;
  _adsConfigured = false;
  try {
    if (_configuration) await _configuration;
    _adsConfigured = false;
    const info = await M.AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: false });
    const required = info?.privacyOptionsRequirementStatus === 'REQUIRED';
    const result = required ? await M.AdsConsent.showPrivacyOptionsForm() : info;
    if (result?.canRequestAds === true && _adultEligible) {
      const init = (M.default ?? M.mobileAds)?.();
      if (init?.initialize) {
        await init.initialize();
        _adsConfigured = _adultEligible;
      }
    }
    return required ? 'shown' : 'not_required';
  } catch {
    _adsConfigured = false;
    return 'unavailable';
  } finally {
    _privacyBusy = false;
  }
}

async function mayRequestAds(): Promise<boolean> {
  if (!_adultEligible || !_adsConfigured || _privacyBusy) return false;
  try {
    return (await loadAdMob()?.AdsConsent?.getConsentInfo())?.canRequestAds === true;
  } catch {
    return false;
  }
}

/** Whether a live ad backend is ready (SDK loaded + initialised). */
export function isAdsReady(): boolean {
  return _adultEligible && !_privacyBusy && _adsConfigured && loadAdMob() != null;
}

/** Real rewarded ad — resolves completed=true only on EARNED_REWARD. */
function showRealRewarded(unitId: string, M: AdMobModule): Promise<{ completed: boolean }> {
  const { RewardedAd, RewardedAdEventType, AdEventType } = M;
  return new Promise((resolve) => {
    let earned = false;
    let settled = false;
    const subs: (() => void)[] = [];
    const cleanup = () =>
      subs.forEach((u) => {
        try {
          u();
        } catch {
          /* noop */
        }
      });
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ completed: earned });
    };
    try {
      const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
      subs.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          try {
            ad.show();
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
      ad.load();
      setTimeout(finish, 30_000); // safety: never hang the caller
    } catch {
      finish();
    }
  });
}

/** Real interstitial ad — resolves when the ad closes (or errors/times out). */
function showRealInterstitial(unitId: string, M: AdMobModule): Promise<boolean> {
  const { InterstitialAd, AdEventType } = M;
  return new Promise((resolve) => {
    let settled = false;
    let shown = false;
    const subs: (() => void)[] = [];
    const cleanup = () =>
      subs.forEach((u) => {
        try {
          u();
        } catch {
          /* noop */
        }
      });
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(shown);
    };
    try {
      const ad = InterstitialAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
      subs.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          try {
            ad.show();
            shown = true;
          } catch {
            finish();
          }
        }),
      );
      subs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
      subs.push(ad.addAdEventListener(AdEventType.ERROR, finish));
      ad.load();
      setTimeout(finish, 20_000);
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
const INTERSTITIAL_HISTORY_KEY = 'ads:interstitial-history:v1';
export const INTERSTITIAL_WINDOW_MS = 60 * 60_000;
export const INTERSTITIAL_MAX_PER_WINDOW = 2;
export const DEFAULT_INTERSTITIAL_GAP_MS = 30 * 60_000;

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
 * @param adsEnabled pass `false` (e.g. for the removeAds entitlement) to skip.
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
export async function showInterstitial(adsEnabled = true): Promise<boolean> {
  if (!adsEnabled) return false;
  if (!(await mayRequestAds())) return false;
  if (!(await isOnline())) return false;

  if (MOCK_MODE) {
    lastInterstitialAt = Date.now();
    await delay(MOCK_INTERSTITIAL_DELAY_MS);
    return true;
  }

  const M = loadAdMob();
  if (!M || !_adsConfigured) return false;
  const unitId = _unitIds.interstitial ?? M.TestIds?.INTERSTITIAL;
  if (!unitId) return false;
  const shown = await showRealInterstitial(unitId, M);
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
  minGapMs: number = DEFAULT_INTERSTITIAL_GAP_MS,
): Promise<boolean> {
  if (!adsEnabled) return false;
  const now = Date.now();
  const stored = (await getJSON<number[]>(INTERSTITIAL_HISTORY_KEY)) ?? [];
  const history = stored.filter(
    (timestamp) => Number.isFinite(timestamp) && now - timestamp < INTERSTITIAL_WINDOW_MS,
  );
  const latest = history.length > 0 ? Math.max(...history) : lastInterstitialAt;
  if (history.length >= INTERSTITIAL_MAX_PER_WINDOW || now - latest < minGapMs) return false;
  const shown = await showInterstitial(true);
  if (!shown) return false;
  try {
    await setJSON(INTERSTITIAL_HISTORY_KEY, [...history, Date.now()]);
  } catch {
    // The ad was already shown. Persistence failure must not become an
    // unhandled rejection in the hub; keep the in-memory gap as a fallback.
  }
  return true;
}
