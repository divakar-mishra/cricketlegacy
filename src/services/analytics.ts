import { canSendAnalytics, firebaseAnalytics } from './telemetry';

type AnalyticsParamValue = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsParamValue>;

export const EVT = {
  APP_OPEN: 'app_open',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  PURCHASE: 'purchase',
  PURCHASE_INITIATED: 'purchase_initiated',
  AD_WATCHED: 'ad_watched',
  SIGN_PLAYER: 'sign_player',
  SEASON_ROLLOVER: 'season_rollover',
  DAILY_CLAIM: 'daily_claim',
  QUEST_COMPLETE: 'quest_complete',
  CAREER_START: 'career_start',
  STARTER_PACK_SHOWN: 'starter_pack_shown',
  OFFER_SHOWN: 'offer_shown',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_DISMISSED: 'offer_dismissed',
  SHARE_NEWSPAPER: 'share_newspaper',
  NEWSPAPER_TEMPLATE_SELECTED: 'newspaper_template_selected',
  LEGACY_CONTRIBUTION: 'legacy_contribution',
} as const;

// Only aggregate values and fixed enums leave the device, never arbitrary text/IDs.
const numericKeys = new Set(['streak', 'coins', 'energy', 'last_slide', 'coin_cost']);
const booleanKeys = new Set([
  'won',
  'tie',
  'retired',
  'weekly',
  'auctionMove',
  'domesticMove',
  'contractRenewed',
  'managerJobMove',
]);
const enumValues: Record<string, readonly string[]> = {
  mode: ['career', 'manager'],
  difficulty: ['easy', 'normal', 'hard', 'pro', 'EASY', 'NORMAL', 'HARD', 'PRO'],
  format: ['T20', 'ODI', 'TEST', 'FC', 'LIST_A'],
};
export function sanitizeAnalyticsParams(
  params: AnalyticsParams = {},
): Record<string, string | number> {
  const clean: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (numericKeys.has(key) && typeof value === 'number' && Number.isFinite(value))
      clean[key] = value;
    if (booleanKeys.has(key) && typeof value === 'boolean') clean[key] = Number(value);
    if (typeof value === 'string' && enumValues[key]?.includes(value)) clean[key] = value;
  }
  return clean;
}
export function logEvent(name: string, params?: AnalyticsParams): void {
  if (!canSendAnalytics() || !Object.values(EVT).includes(name as (typeof EVT)[keyof typeof EVT]))
    return;
  try {
    const a = firebaseAnalytics();
    a.logEvent(a.getAnalytics(), name, sanitizeAnalyticsParams(params));
  } catch {
    /* Never interrupt gameplay. */
  }
}
export function setUserProperty(key: string, value: AnalyticsParamValue): void {
  if (!canSendAnalytics() || key !== 'mode' || !enumValues.mode.includes(String(value))) return;
  try {
    const a = firebaseAnalytics();
    void a.setUserProperty(a.getAnalytics(), key, String(value)).catch(() => undefined);
  } catch {
    /* Unsupported native runtime. */
  }
}
