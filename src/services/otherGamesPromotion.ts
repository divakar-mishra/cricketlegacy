import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

// Owner's campaign date: 15 November 2026 at midnight India time.
export const OTHER_GAMES_START_AT = Date.parse('2026-11-15T00:00:00+05:30');
export const OTHER_GAMES_GAP_MS = 48 * 60 * 60_000;
export const OTHER_GAMES_MAX_IMPRESSIONS = 2;
export const OTHER_GAMES_HISTORY_KEY = 'promotion:sunlight-other-games:v1';
export const OTHER_GAMES_PLAY_URL =
  'https://play.google.com/store/apps/developer?id=Sunlight+Pvt';

interface PromotionHistory {
  version: 1;
  impressions: number;
  lastShownAt: number | null;
  stopped: boolean;
}

// Shared by both retained hubs. Never put marketing state in career/cloud saves.
let operations: Promise<unknown> = Promise.resolve();
let claiming = false;
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.catch(() => undefined).then(operation);
  operations = next;
  return next;
}

async function readHistory(): Promise<PromotionHistory> {
  const raw = await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY);
  if (raw === null) return { version: 1, impressions: 0, lastShownAt: null, stopped: false };
  const state = JSON.parse(raw) as Partial<PromotionHistory> | null;
  if (!state || state.version !== 1 || !Number.isInteger(state.impressions) ||
      state.impressions! < 0 || state.impressions! > OTHER_GAMES_MAX_IMPRESSIONS ||
      typeof state.stopped !== 'boolean' ||
      (state.impressions === 0 ? state.lastShownAt !== null :
        typeof state.lastShownAt !== 'number' || !Number.isFinite(state.lastShownAt) ||
          state.lastShownAt < OTHER_GAMES_START_AT)) {
    throw new Error('Invalid promotion history');
  }
  return state as PromotionHistory;
}

export function hasOtherGamesCampaignStarted(now = Date.now()): boolean {
  return Number.isFinite(now) && now >= OTHER_GAMES_START_AT;
}

function due(state: PromotionHistory, now: number): boolean {
  return hasOtherGamesCampaignStarted(now) && !state.stopped &&
    state.impressions < OTHER_GAMES_MAX_IMPRESSIONS &&
    (state.lastShownAt === null || now - state.lastShownAt >= OTHER_GAMES_GAP_MS);
}

/** Unreadable history suppresses marketing, never assumes a fresh installation. */
export async function canOfferOtherGamesPromotion(): Promise<boolean> {
  if (Platform.OS !== 'android' || !hasOtherGamesCampaignStarted()) return false;
  try { return due(await readHistory(), Date.now()); }
  catch { return false; }
}

/** Reserve an impression durably BEFORE displaying it. At most two across both
 * modes, saves, restarts and normal updates; interrupted claims count conservatively.
 */
export async function claimOtherGamesPromotion(isCurrent: () => boolean): Promise<boolean> {
  if (claiming || Platform.OS !== 'android' || !hasOtherGamesCampaignStarted() || !isCurrent()) return false;
  claiming = true;
  try {
    return await serialize(async () => {
      const state = await readHistory();
      const now = Date.now();
      if (!due(state, now) || !isCurrent()) return false;
      await AsyncStorage.setItem(OTHER_GAMES_HISTORY_KEY, JSON.stringify({
        ...state, impressions: state.impressions + 1, lastShownAt: now,
      }));
      return hasOtherGamesCampaignStarted() && isCurrent();
    });
  } catch { return false; }
  finally { claiming = false; }
}

/** Explicit tap only. Persist the opt-out before opening the exact HTTPS URL.
 * No installed-app queries, install attribution, rewards or provider SDKs.
 * A failed link remains retryable in the open card but cannot trigger future nags.
 */
export async function openOtherGamesPage(isCurrent: () => boolean): Promise<boolean> {
  if (Platform.OS !== 'android' || !hasOtherGamesCampaignStarted() || !isCurrent()) return false;
  try {
    const stopped = await serialize(async () => {
      const state = await readHistory();
      if (!isCurrent()) return false;
      await AsyncStorage.setItem(OTHER_GAMES_HISTORY_KEY, JSON.stringify({ ...state, stopped: true }));
      return true;
    });
    if (!stopped || !hasOtherGamesCampaignStarted() || !isCurrent()) return false;
    await Linking.openURL(OTHER_GAMES_PLAY_URL);
    return true;
  } catch { return false; }
}
