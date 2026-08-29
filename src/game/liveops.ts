/**
 * Retention / live-ops PURE-LOGIC layer.
 *
 * Three retention systems live here — the daily login streak, rotating
 * daily/weekly quests, and a season battle pass. Everything in this module is a
 * pure function of its arguments: there is no `Date.now()`, no I/O and no
 * mutation of the inputs, so the store (see src/state/careerStore.ts) can call
 * these helpers and persist the returned values. Callers pass the current
 * day-index / timestamps in explicitly, which keeps the whole layer trivially
 * unit-testable and deterministic.
 *
 * A "day-index" throughout this file means a whole number of days
 * (e.g. `Math.floor(epochMs / 86_400_000)`) — the module never derives it
 * itself so tests can drive time forward by hand.
 */

/* =========================================================================
 * 1) DAILY LOGIN STREAK
 * ========================================================================= */

/** Persisted per-save streak state. */
export interface DailyState {
  /** Day-index of the most recent successful claim. */
  lastClaimDay: number;
  /** Current consecutive-day streak length (1-based; 0 means "never claimed"). */
  streak: number;
}

/**
 * Decide whether the daily reward can be claimed on `today` and what the streak
 * becomes afterwards.
 *
 * - No prior state → first ever claim, streak 1.
 * - `today === lastClaimDay`       → already claimed, no-op (streak unchanged).
 * - `today === lastClaimDay + 1`   → consecutive day, streak increments.
 * - anything else (gap > 1, or a backwards clock) → streak resets to 1.
 *
 * `newStreak` always reflects the streak the caller should persist: on a no-op
 * it equals the previous streak, otherwise it is the post-claim value.
 */
export function evaluateDailyClaim(
  prev: DailyState | undefined,
  today: number,
): { canClaim: boolean; newStreak: number } {
  if (!prev) return { canClaim: true, newStreak: 1 };
  if (today === prev.lastClaimDay) return { canClaim: false, newStreak: prev.streak };
  if (today === prev.lastClaimDay + 1) return { canClaim: true, newStreak: prev.streak + 1 };
  return { canClaim: true, newStreak: 1 };
}

/** Length of the escalating reward cycle before it repeats. */
export const STREAK_CYCLE_DAYS = 7;
/** Legacy exports retained for save/test compatibility; weekly escalation is disabled. */
export const STREAK_WEEK_BONUS = 0;
export const STREAK_MAX_WEEK_MULTIPLIER = 1;

/** Base coin/gem payout for each day of a single 7-day cycle (day 1 → day 7). */
const STREAK_BASE: readonly { coins: number; gems: number }[] = [
  { coins: 75, gems: 0 },
  { coins: 125, gems: 0 },
  { coins: 150, gems: 0 },
  { coins: 200, gems: 0 },
  { coins: 250, gems: 0 },
  { coins: 300, gems: 0 },
  { coins: 400, gems: 10 }, // 1,500 coins per completed Manager week
];

const PLAYER_STREAK_BASE: readonly { coins: number; gems: number }[] = [
  { coins: 50, gems: 0 },
  { coins: 75, gems: 0 },
  { coins: 100, gems: 0 },
  { coins: 125, gems: 0 },
  { coins: 150, gems: 0 },
  { coins: 200, gems: 0 },
  { coins: 300, gems: 5 },
];

/**
 * Reward for a given streak length. Rewards escalate within the 7-day cycle
 * (day 1 < … < day 7, with gems only on day 7) and repeat without escalating
 * across later weeks. Gems remain scarce and are never multiplied.
 */
export function streakReward(
  streak: number,
  mode: 'career' | 'manager' = 'career',
): { coins: number; gems: number } {
  const s = Math.max(1, Math.floor(streak));
  const dayIndex = (s - 1) % STREAK_CYCLE_DAYS; // 0..6
  if (mode === 'career') return PLAYER_STREAK_BASE[dayIndex];
  return STREAK_BASE[dayIndex];
}

/* =========================================================================
 * 2) QUESTS (rotating daily + weekly)
 * ========================================================================= */

export type QuestScope = 'daily' | 'weekly';

/** The trackable events a quest can key off of. */
export type QuestMetric =
  | 'PLAY_MATCH'
  | 'WIN_MATCH'
  | 'SCORE_RUNS'
  | 'TAKE_WICKETS'
  | 'HIT_BOUNDARIES'
  | 'TRAIN'
  | 'SIGN_PLAYER';

/** Static definition of a quest (content, not progress). */
export interface QuestDef {
  id: string;
  scope: QuestScope;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  rewardCoins: number;
  rewardGems?: number;
}

/** Per-save progress toward a single quest. */
export interface QuestProgress {
  id: string;
  progress: number;
  claimed: boolean;
}

/** How many daily quests are active at once (default for {@link pickDailyQuests}). */
export const DAILY_QUEST_COUNT = 2;
export const MANAGER_DAILY_QUEST_COUNT = 2;

/** The daily quest pool. {@link pickDailyQuests} rotates a window across this. */
export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'daily_play_2',
    scope: 'daily',
    title: 'Match Fit',
    description: 'Play 2 matches',
    metric: 'PLAY_MATCH',
    target: 2,
    rewardCoins: 75,
  },
  {
    id: 'daily_win_1',
    scope: 'daily',
    title: 'Winning Feeling',
    description: 'Win a match',
    metric: 'WIN_MATCH',
    target: 1,
    rewardCoins: 100,
  },
  {
    id: 'daily_runs_50',
    scope: 'daily',
    title: 'Run Machine',
    description: 'Score 50 runs',
    metric: 'SCORE_RUNS',
    target: 50,
    rewardCoins: 90,
  },
  {
    id: 'daily_wickets_3',
    scope: 'daily',
    title: 'Strike Bowler',
    description: 'Take 3 wickets',
    metric: 'TAKE_WICKETS',
    target: 3,
    rewardCoins: 90,
  },
  {
    id: 'daily_boundaries_6',
    scope: 'daily',
    title: 'Find the Fence',
    description: 'Hit 6 boundaries',
    metric: 'HIT_BOUNDARIES',
    target: 6,
    rewardCoins: 85,
  },
  {
    id: 'daily_train_1',
    scope: 'daily',
    title: 'Sharpen Up',
    description: 'Complete a training session',
    metric: 'TRAIN',
    target: 1,
    rewardCoins: 70,
  },
];

/** The weekly quest pool — longer grinds, coins only (gems are achievement-earned). */
export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'weekly_play_10',
    scope: 'weekly',
    title: 'Grinder',
    description: 'Play 10 matches this week',
    metric: 'PLAY_MATCH',
    target: 10,
    rewardCoins: 400,
  },
  {
    id: 'weekly_win_5',
    scope: 'weekly',
    title: 'On a Roll',
    description: 'Win 5 matches this week',
    metric: 'WIN_MATCH',
    target: 5,
    rewardCoins: 550,
  },
  {
    id: 'weekly_runs_300',
    scope: 'weekly',
    title: 'Big Week',
    description: 'Score 300 runs this week',
    metric: 'SCORE_RUNS',
    target: 300,
    rewardCoins: 475,
  },
  {
    id: 'weekly_wickets_15',
    scope: 'weekly',
    title: 'Demolition',
    description: 'Take 15 wickets this week',
    metric: 'TAKE_WICKETS',
    target: 15,
    rewardCoins: 475,
  },
];

export const DAILY_CHALLENGE_REWARDS = {
  BRONZE: { coins: 100, gems: 0 },
  SILVER: { coins: 175, gems: 0 },
  GOLD: { coins: 275, gems: 0 },
} as const;

export const MANAGER_DAILY_QUESTS: QuestDef[] = [
  {
    id: 'mgr_daily_play_1',
    scope: 'daily',
    title: 'Matchday Ready',
    description: 'Manage 1 match',
    metric: 'PLAY_MATCH',
    target: 1,
    rewardCoins: 100,
  },
  {
    id: 'mgr_daily_win_1',
    scope: 'daily',
    title: 'Three Points',
    description: 'Win a match',
    metric: 'WIN_MATCH',
    target: 1,
    rewardCoins: 125,
  },
  {
    id: 'mgr_daily_play_2',
    scope: 'daily',
    title: 'Double Header',
    description: 'Manage 2 matches',
    metric: 'PLAY_MATCH',
    target: 2,
    rewardCoins: 150,
  },
  {
    id: 'mgr_daily_sign_1',
    scope: 'daily',
    title: 'Squad Builder',
    description: 'Sign 1 player',
    metric: 'SIGN_PLAYER',
    target: 1,
    rewardCoins: 125,
  },
];

export const MANAGER_WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'mgr_weekly_play_8',
    scope: 'weekly',
    title: 'Touchline General',
    description: 'Manage 8 matches this week',
    metric: 'PLAY_MATCH',
    target: 8,
    rewardCoins: 500,
  },
  {
    id: 'mgr_weekly_win_4',
    scope: 'weekly',
    title: 'Winning Culture',
    description: 'Win 4 matches this week',
    metric: 'WIN_MATCH',
    target: 4,
    rewardCoins: 650,
  },
  {
    id: 'mgr_weekly_sign_2',
    scope: 'weekly',
    title: 'Market Moves',
    description: 'Sign 2 players this week',
    metric: 'SIGN_PLAYER',
    target: 2,
    rewardCoins: 600,
  },
];

function questPoolForMode(mode: 'career' | 'manager' = 'career'): QuestDef[] {
  return mode === 'manager' ? MANAGER_DAILY_QUESTS : DAILY_QUESTS;
}

export function weeklyQuestsForMode(mode: 'career' | 'manager' = 'career'): QuestDef[] {
  return mode === 'manager' ? MANAGER_WEEKLY_QUESTS : WEEKLY_QUESTS;
}

/**
 * Deterministically select the active daily quests for a given day.
 *
 * A window of `count` consecutive quests is taken from {@link DAILY_QUESTS},
 * starting at `daySeed mod pool.length`. This means the same day always yields
 * the same quests (deterministic), consecutive days rotate the window, and the
 * selection repeats with a period of `pool.length` days. `count` is clamped to
 * the pool size; negative seeds are handled.
 */
export function pickDailyQuests(
  daySeed: number,
  count: number | undefined = undefined,
  mode: 'career' | 'manager' = 'career',
): QuestDef[] {
  const pool = questPoolForMode(mode);
  const requested = count ?? (mode === 'manager' ? MANAGER_DAILY_QUEST_COUNT : DAILY_QUEST_COUNT);
  const n = Math.max(0, Math.min(Math.floor(requested), pool.length));
  const start = ((Math.floor(daySeed) % pool.length) + pool.length) % pool.length;
  const out: QuestDef[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

/** Build fresh (zeroed, unclaimed) progress entries for a set of quest defs. */
export function initQuestProgress(defs: QuestDef[]): QuestProgress[] {
  return defs.map((d) => ({ id: d.id, progress: 0, claimed: false }));
}

/**
 * Advance every quest whose definition matches `metric` by `amount`, returning
 * a brand-new array (inputs are never mutated). Progress is clamped to the
 * quest's target and non-positive amounts are a pure no-op copy. Quests whose
 * def is missing or whose metric differs are copied through unchanged.
 */
export function applyQuestEvent(
  progress: QuestProgress[],
  defs: QuestDef[],
  metric: QuestMetric,
  amount: number,
): QuestProgress[] {
  if (amount <= 0) return progress.map((p) => ({ ...p }));
  const defById = new Map(defs.map((d) => [d.id, d] as const));
  return progress.map((p) => {
    const def = defById.get(p.id);
    if (!def || def.metric !== metric) return { ...p };
    return { ...p, progress: Math.min(def.target, p.progress + amount) };
  });
}

/** True once progress has reached (or exceeded) the quest's target. */
export function isQuestComplete(p: QuestProgress, def: QuestDef): boolean {
  return p.progress >= def.target;
}

/**
 * Mark a single quest claimed, returning a new array. Only complete quests can
 * be claimed; anything else (missing id, incomplete, already claimed) is a pure
 * no-op copy so the call is always safe to make.
 */
export function claimQuest(
  progress: QuestProgress[],
  defs: QuestDef[],
  id: string,
): QuestProgress[] {
  const def = defs.find((d) => d.id === id);
  return progress.map((p) => {
    if (p.id !== id || !def || p.claimed || !isQuestComplete(p, def)) return { ...p };
    return { ...p, claimed: true };
  });
}

/* =========================================================================
 * 3) SEASON / BATTLE PASS
 * ========================================================================= */

/** A single battle-pass tier with its cumulative XP gate and free/premium loot. */
export interface PassReward {
  coins?: number;
  item?: string;
}

export interface PassTier {
  tier: number;
  /** Cumulative season XP required to reach (unlock) this tier. */
  xpRequired: number;
  freeReward: PassReward;
  premiumReward: PassReward;
}

/** Persisted per-save battle-pass state for the active season. */
export interface PassState {
  seasonId: string;
  periodStartedAt?: number;
  periodEndsAt?: number;
  /** Reward-curve version used to preserve earned tier progress after rebalancing. */
  balanceVersion?: number;
  xp: number;
  premium: boolean;
  /** Tiers whose *free* reward has already been claimed. */
  claimedFree: number[];
  /** Tiers whose *premium* reward has already been claimed. */
  claimedPremium: number[];
}

/**
 * XP sources. The pass is paced for consistent play across a calendar month:
 * matches provide steady progress while daily and weekly quests do most of the
 * work. A few high-volume sessions can no longer clear all 20 tiers.
 */
export const XP_PER_MATCH = 20;
export const XP_PER_WIN = 10; // awarded on top of XP_PER_MATCH for a win
export const XP_PER_QUEST = 75; // completing a daily quest
export const XP_PER_WEEKLY_QUEST = 500; // completing a weekly quest

/** Number of tiers in the pass. */
export const PASS_TIER_COUNT = 20;
/** XP required to clear tier 1. */
export const PASS_TIER_BASE_XP = 285;
/** Additional XP each subsequent tier costs (rising cost curve). */
export const PASS_TIER_STEP_XP = 28;
/** Current XP/reward balance revision persisted with each pass. */
export const PASS_BALANCE_VERSION = 2;

const LEGACY_PASS_TIER_BASE_XP = 80;
const LEGACY_PASS_TIER_STEP_XP = 16;

/**
 * Cumulative XP required to reach `tier`.
 *
 * Per-tier cost rises linearly (tier k costs `BASE + (k-1)*STEP`), so the
 * cumulative gate is `BASE*tier + STEP * (tier-1)*tier/2` — always an integer
 * because `(tier-1)*tier` is even.
 */
function cumulativeTierXp(tier: number, base: number, step: number): number {
  return base * tier + (step * ((tier - 1) * tier)) / 2;
}

function tierXpRequired(tier: number): number {
  return cumulativeTierXp(tier, PASS_TIER_BASE_XP, PASS_TIER_STEP_XP);
}

const PASS_MILESTONE_TIERS = new Set([1, 5, 10, 15, 20]);

const PASS_MILESTONE_ITEMS_BY_MODE: Readonly<
  Record<'career' | 'manager', Readonly<Partial<Record<number, string>>>>
> = {
  career: {
    1: 'pass_kit_noir',
    5: 'pass_frame_gold',
    10: 'pass_celebration_lights',
    15: 'pass_stadium_noir',
  },
  manager: {
    15: 'pass_stadium_noir',
    20: 'pass_office_noir',
  },
};

function buildPassTiers(
  milestoneItems: Readonly<Partial<Record<number, string>>> = {},
): PassTier[] {
  const tiers: PassTier[] = [];
  for (let t = 1; t <= PASS_TIER_COUNT; t++) {
    const milestoneItem = milestoneItems[t];
    const milestone = PASS_MILESTONE_TIERS.has(t);
    tiers.push({
      tier: t,
      xpRequired: tierXpRequired(t),
      freeReward: { coins: t % 5 === 0 ? 200 + t * 15 : 100 + t * 10 },
      premiumReward: {
        coins: milestone ? 300 + t * 25 : 200 + t * 15,
        ...(milestoneItem ? { item: milestoneItem } : {}),
      },
    });
  }
  return tiers;
}

/** Mode-neutral 20-tier XP and coin curve (index 0 === tier 1). */
export const PASS_TIERS: PassTier[] = buildPassTiers();

const PLAYER_PASS_TIERS = buildPassTiers(PASS_MILESTONE_ITEMS_BY_MODE.career);
const MANAGER_PASS_TIERS = buildPassTiers(PASS_MILESTONE_ITEMS_BY_MODE.manager);

/** The same XP/coin curve with only cosmetics usable by the selected mode. */
export function passTiersForMode(mode: 'career' | 'manager'): PassTier[] {
  return mode === 'manager' ? MANAGER_PASS_TIERS : PLAYER_PASS_TIERS;
}

export const PASS_ITEM_LABELS: Record<string, string> = {
  pass_kit_noir: 'Stadium Noir kit',
  pass_frame_gold: 'Championship profile frame',
  pass_celebration_lights: 'Floodlight celebration',
  pass_stadium_noir: 'Stadium Noir theme',
  pass_office_noir: 'Executive office theme',
};

/**
 * Loot inside a legacy battle-pass reward crate (`crate_t5`, `crate_t10`, …).
 * Crates open immediately and now pay coins only, matching current pass rewards.
 */
export function crateContents(item: string): { coins: number } {
  const tier = Number.parseInt(item.replace(/[^0-9]/g, ''), 10) || 5;
  return { coins: 250 + tier * 40 };
}

function levelForCurve(xp: number, base: number, step: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 0;
  for (let tier = 1; tier <= PASS_TIER_COUNT; tier += 1) {
    if (safeXp < cumulativeTierXp(tier, base, step)) break;
    level = tier;
  }
  return level;
}

function normalizeClaimedTiers(tiers: number[]): number[] {
  return [...new Set(tiers)]
    .filter((tier) => Number.isInteger(tier) && tier >= 1 && tier <= PASS_TIER_COUNT)
    .sort((a, b) => a - b);
}

/**
 * Upgrade an existing pass to the current monthly curve without taking away a
 * tier already earned. Fractional progress toward the next tier is preserved,
 * and claimed tiers are treated as a minimum reached level.
 */
export function synchronizePassBalance(state: PassState): PassState {
  const claimedFree = normalizeClaimedTiers(state.claimedFree ?? []);
  const claimedPremium = normalizeClaimedTiers(state.claimedPremium ?? []);
  if ((state.balanceVersion ?? 1) >= PASS_BALANCE_VERSION) {
    return {
      ...state,
      balanceVersion: PASS_BALANCE_VERSION,
      xp: Math.max(0, Math.floor(state.xp)),
      claimedFree,
      claimedPremium,
    };
  }

  const legacyXp = Math.max(0, Math.floor(state.xp));
  const legacyLevel = levelForCurve(legacyXp, LEGACY_PASS_TIER_BASE_XP, LEGACY_PASS_TIER_STEP_XP);
  const legacyFloor =
    legacyLevel > 0
      ? cumulativeTierXp(legacyLevel, LEGACY_PASS_TIER_BASE_XP, LEGACY_PASS_TIER_STEP_XP)
      : 0;
  const legacyCeiling =
    legacyLevel < PASS_TIER_COUNT
      ? cumulativeTierXp(legacyLevel + 1, LEGACY_PASS_TIER_BASE_XP, LEGACY_PASS_TIER_STEP_XP)
      : legacyFloor;
  const progress =
    legacyCeiling > legacyFloor
      ? Math.min(1, Math.max(0, (legacyXp - legacyFloor) / (legacyCeiling - legacyFloor)))
      : 1;
  const currentFloor = legacyLevel > 0 ? tierXpRequired(legacyLevel) : 0;
  const currentCeiling =
    legacyLevel < PASS_TIER_COUNT ? tierXpRequired(legacyLevel + 1) : currentFloor;
  const highestClaimed = Math.max(0, ...claimedFree, ...claimedPremium);
  const remappedXp = Math.max(
    Math.round(currentFloor + (currentCeiling - currentFloor) * progress),
    highestClaimed > 0 ? tierXpRequired(highestClaimed) : 0,
  );

  return {
    ...state,
    balanceVersion: PASS_BALANCE_VERSION,
    xp: remappedXp,
    claimedFree,
    claimedPremium,
  };
}

/**
 * Highest tier reached for a given amount of cumulative season XP. Returns 0
 * when no tier has been reached yet, and caps at {@link PASS_TIER_COUNT}.
 */
export function passLevel(xp: number): number {
  const x = Math.max(0, Math.floor(xp));
  let level = 0;
  for (const tier of PASS_TIERS) {
    if (x >= tier.xpRequired) level = tier.tier;
    else break;
  }
  return level;
}

/** Cumulative XP needed to reach a tier (0 for out-of-range tiers). */
export function xpForTier(tier: number): number {
  const found = PASS_TIERS.find((t) => t.tier === tier);
  return found ? found.xpRequired : 0;
}

/**
 * Add XP to the pass, returning a new {@link PassState} (input untouched, arrays
 * copied). Negative amounts are ignored so XP never goes backwards.
 */
export function addPassXp(state: PassState, xp: number): PassState {
  const delta = Math.max(0, Math.floor(xp));
  const current = synchronizePassBalance(state);
  return {
    ...current,
    balanceVersion: PASS_BALANCE_VERSION,
    xp: current.xp + delta,
    claimedFree: [...current.claimedFree],
    claimedPremium: [...current.claimedPremium],
  };
}

/**
 * List every reward the player is currently entitled to but has not yet
 * claimed, up to the tier their XP has reached. Free rewards are always
 * eligible; premium rewards only when `state.premium` is true. Results are
 * ordered by tier (free before premium within a tier).
 */
export function claimablePassRewards(state: PassState): { tier: number; premium: boolean }[] {
  const level = passLevel(state.xp);
  const claimedFree = new Set(state.claimedFree);
  const claimedPremium = new Set(state.claimedPremium);
  const out: { tier: number; premium: boolean }[] = [];
  for (const tier of PASS_TIERS) {
    if (tier.tier > level) break;
    if (!claimedFree.has(tier.tier)) out.push({ tier: tier.tier, premium: false });
    if (state.premium && !claimedPremium.has(tier.tier))
      out.push({ tier: tier.tier, premium: true });
  }
  return out;
}
