import { SaveGame, SeasonPassScenarioProgress } from '../domain/types';
import { PASS_BALANCE_VERSION, synchronizePassBalance } from './liveops';
import {
  MONTHLY_PASS_CONTENT,
  MONTHLY_PASS_ITEM_LABELS,
  MonthlyPassContent,
  monthlyContentForCycle,
} from '../data/seasonPassContent';
import { clamp } from '../utils/math';
import { claimVipCollection, ensureVipState, hasModeVip } from './vip';

export const SEASON_PASS_PRODUCT_ID = 'season_pass';
export const SEASON_PASS_DAYS = 30;
export const SEASON_PASS_PERIOD_MS = SEASON_PASS_DAYS * 24 * 60 * 60 * 1000;
const PASS_PERIOD_ANCHOR = Date.UTC(2026, 0, 1);

export const SEASON_PASS_BENEFITS = {
  trainingGrowthMultiplier: 1.1,
  positiveSelectionRepMultiplier: 1.05,
  superstarInterestBonus: 0.04,
  staffSigningDiscount: 0.05,
} as const;

export interface PassPeriod {
  id: string;
  startsAt: number;
  endsAt: number;
}

export interface SeasonPassScenario {
  id: string;
  title: string;
  description: string;
  objective: string;
  targetMatches: number;
  targetWins: number;
  targetRuns: number;
  targetWickets: number;
  rewardCoins: number;
  tournament: boolean;
}

export const SEASON_PASS_SCENARIOS: SeasonPassScenario[] = MONTHLY_PASS_CONTENT.map(
  ({ scenario }) => ({ ...scenario, targetRuns: 0, targetWickets: 0 }),
);

/** Monthly cosmetics are deliberately separate from every tier-ladder item. */
export const MONTHLY_COSMETIC_DROPS = MONTHLY_PASS_CONTENT.flatMap((content) => [
  content.kit.id,
  content.celebration.id,
  content.office.inventoryId,
]);

export const SEASON_PASS_ITEM_LABELS: Readonly<Record<string, string>> = {
  pass_kit_noir: 'Stadium Noir kit',
  pass_frame_gold: 'Championship profile frame',
  pass_celebration_lights: 'Floodlight celebration',
  pass_stadium_noir: 'Stadium Noir theme',
  pass_office_noir: 'Executive office theme',
  ...MONTHLY_PASS_ITEM_LABELS,
};

export function seasonPassPeriod(now: number): PassPeriod {
  const safeNow = Number.isFinite(now) ? now : PASS_PERIOD_ANCHOR;
  const date = new Date(safeNow);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startsAt = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const endsAt = Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
  return {
    id: `pass-${year}-${String(month + 1).padStart(2, '0')}`,
    startsAt,
    endsAt,
  };
}

export function isSeasonPassActive(save: SaveGame | undefined, now: number = Date.now()): boolean {
  return hasModeVip(save) || isLegacySeasonPassActive(save, now);
}

/** Only the old timed purchase unlocks the retired paid XP ladder. */
export function isLegacySeasonPassActive(save: SaveGame | undefined, now: number = Date.now()): boolean {
  const entitlement = save?.entitlements?.seasonPass;
  if (!entitlement?.premium) return false;
  // A device clock moved backwards cannot extend access beyond the last
  // provider/server observation. Small drift is tolerated for ordinary clocks.
  if (now + 5 * 60 * 1000 < entitlement.lastVerifiedAt) return false;
  return entitlement.expiresAt > now;
}

export function ensureSeasonPassExperience(save: SaveGame, cycleId?: string): void {
  save.seasonPassExperience ??= {
    scenarios: {},
    selectedStadiumTheme: 'stadium_classic',
    selectedOfficeTheme: 'office_classic',
    selectedProfileFrame: 'frame_none',
  };
  save.seasonPassExperience.scenarios ??= {};
  save.seasonPassExperience.selectedStadiumTheme ||= 'stadium_classic';
  save.seasonPassExperience.selectedOfficeTheme ||= 'office_classic';
  save.seasonPassExperience.selectedProfileFrame ||= 'frame_none';
  if (cycleId && !save.seasonPassExperience.scenarioCycleId) {
    // Preserve current-cycle progress when upgrading an existing save.
    save.seasonPassExperience.scenarioCycleId = cycleId;
  } else if (cycleId && save.seasonPassExperience.scenarioCycleId !== cycleId && !hasModeVip(save)) {
    save.seasonPassExperience.scenarioCycleId = cycleId;
    save.seasonPassExperience.activeScenarioId = undefined;
    save.seasonPassExperience.scenarios = {};
  }
}

function canCarryLegacyRollingCycle(pass: NonNullable<SaveGame['pass']>, now: number): boolean {
  if (!/^pass-\d+$/.test(pass.seasonId)) return false;
  if (pass.periodStartedAt == null || pass.periodEndsAt == null) return true;
  return now >= pass.periodStartedAt && now < pass.periodEndsAt;
}

function carryLegacyExperienceCycle(save: SaveGame, fromCycleId: string, toCycleId: string): void {
  const experience = save.seasonPassExperience;
  if (!experience || fromCycleId === toCycleId) return;
  if (experience.monthlyDropCycleId === fromCycleId) {
    experience.monthlyDropCycleId = toCycleId;
  }
  if (experience.scenarioCycleId === fromCycleId) {
    experience.scenarioCycleId = toCycleId;
  }
  if (experience.playerStoryCycleId === fromCycleId) {
    experience.playerStoryCycleId = toCycleId;
  }
  if (experience.managerStoryCycleId === fromCycleId) {
    experience.managerStoryCycleId = toCycleId;
  }
}

/** Keep the UTC calendar-month reward cycle and subscription access in sync. */
export function synchronizeSeasonPassState(save: SaveGame, now: number = Date.now()): void {
  ensureVipState(save);
  const period = seasonPassPeriod(now);
  const active = isLegacySeasonPassActive(save, now);
  const previous = save.pass ? synchronizePassBalance(save.pass) : undefined;
  const carryLegacyProgress = Boolean(
    previous && previous.seasonId !== period.id && canCarryLegacyRollingCycle(previous, now),
  );
  if (!previous || (previous.seasonId !== period.id && !carryLegacyProgress)) {
    save.pass = {
      seasonId: period.id,
      periodStartedAt: period.startsAt,
      periodEndsAt: period.endsAt,
      balanceVersion: PASS_BALANCE_VERSION,
      xp: 0,
      premium: active,
      claimedFree: [],
      claimedPremium: [],
    };
  } else {
    save.pass = {
      ...previous,
      seasonId: period.id,
      periodStartedAt: period.startsAt,
      periodEndsAt: period.endsAt,
      balanceVersion: PASS_BALANCE_VERSION,
      premium: active,
    };
  }
  if (carryLegacyProgress && previous) {
    carryLegacyExperienceCycle(save, previous.seasonId, period.id);
  }
  if (save.entitlements.seasonPass) {
    save.entitlements.seasonPass.premium = active;
    save.entitlements.seasonPass.tier = Math.max(0, save.entitlements.seasonPass.tier ?? 0);
  }
  ensureSeasonPassExperience(save, period.id);
}

export function activateSeasonPass(
  save: SaveGame,
  input: {
    now: number;
    expiresAt?: number;
    periodStartedAt?: number;
    lastVerifiedAt?: number;
    provider: 'GOOGLE_PLAY' | 'REVENUECAT' | 'LOCAL_MOCK' | 'LEGACY_MIGRATION';
    willRenew?: boolean;
  },
): void {
  const expiresAt = Math.max(
    input.now + 60_000,
    input.expiresAt ?? input.now + SEASON_PASS_PERIOD_MS,
  );
  save.entitlements.seasonPass = {
    productId: SEASON_PASS_PRODUCT_ID,
    premium: true,
    tier: save.entitlements.seasonPass?.tier ?? 0,
    periodStartedAt: input.periodStartedAt ?? input.now,
    expiresAt,
    lastVerifiedAt: input.lastVerifiedAt ?? input.now,
    provider: input.provider,
    willRenew: input.willRenew,
  };
  synchronizeSeasonPassState(save, input.now);
}

export function monthlyBundleForCycle(cycleId: string): MonthlyPassContent {
  return monthlyContentForCycle(cycleId);
}

export function monthlyBundleForSave(save: SaveGame): MonthlyPassContent {
  if (hasModeVip(save)) {
    return MONTHLY_PASS_CONTENT.find(item => item.id === save.vipCollections?.selectedId)
      ?? MONTHLY_PASS_CONTENT.find(item => !save.vipCollections?.owned.includes(item.id))
      ?? MONTHLY_PASS_CONTENT[0];
  }
  return monthlyBundleForCycle(save.pass?.seasonId ?? seasonPassPeriod(Date.now()).id);
}

export function passContentCycleId(save: SaveGame): string | undefined {
  return hasModeVip(save) ? `vip-collection:${monthlyBundleForSave(save).id}` : save.pass?.seasonId;
}

export function claimMonthlyCosmeticDrop(
  save: SaveGame,
  now: number = Date.now(),
): { ok: boolean; item?: string; items?: string[]; rewardItem?: string; reason?: string } {
  synchronizeSeasonPassState(save, now);
  if (hasModeVip(save)) return claimVipCollection(save);
  if (!isSeasonPassActive(save, now)) return { ok: false, reason: 'Premium Pass is not active.' };
  const cycleId = save.pass!.seasonId;
  if (save.seasonPassExperience!.monthlyDropCycleId === cycleId) {
    return { ok: false, reason: "This cycle's cosmetic drop is already claimed." };
  }
  const bundle = monthlyBundleForCycle(cycleId);
  const items =
    save.mode === 'manager' ? [bundle.office.inventoryId] : [bundle.kit.id, bundle.celebration.id];
  const inventory = { ...(save.inventory ?? {}) };
  for (const item of [...items, bundle.collectible.id]) inventory[item] = 1;
  save.inventory = inventory;
  save.seasonPassExperience!.monthlyDropCycleId = cycleId;
  save.seasonPassExperience!.monthlyDropItemIds = items;
  return { ok: true, item: items[0], items, rewardItem: bundle.collectible.id };
}

function emptyScenario(id: string): SeasonPassScenarioProgress {
  return { id, matches: 0, wins: 0, runs: 0, wickets: 0, completed: false, rewardClaimed: false };
}

export function activateSeasonPassScenario(
  save: SaveGame,
  scenarioId: string,
  now: number = Date.now(),
): { ok: boolean; reason?: string } {
  synchronizeSeasonPassState(save, now);
  if (!isSeasonPassActive(save, now)) return { ok: false, reason: 'Premium Pass is not active.' };
  const featured = monthlyBundleForSave(save).scenario;
  if (scenarioId !== featured.id) {
    return { ok: false, reason: 'This scenario is not featured in the current cycle.' };
  }
  const existing = save.seasonPassExperience!.scenarios[scenarioId];
  if (existing?.completed) return { ok: false, reason: 'Scenario already completed this cycle.' };
  const attemptExpired = existing && existing.matches >= featured.targetMatches;
  save.seasonPassExperience!.scenarios[scenarioId] =
    !existing || attemptExpired ? emptyScenario(scenarioId) : existing;
  save.seasonPassExperience!.activeScenarioId = scenarioId;
  return { ok: true };
}

export function recordSeasonPassScenarioMatch(
  save: SaveGame,
  result: { won: boolean; runs: number; wickets: number },
  now: number = Date.now(),
): void {
  synchronizeSeasonPassState(save, now);
  const id = save.seasonPassExperience?.activeScenarioId;
  const definition = SEASON_PASS_SCENARIOS.find((scenario) => scenario.id === id);
  if (!id || !definition || !isSeasonPassActive(save, now)) return;
  const progress = save.seasonPassExperience!.scenarios[id] ?? emptyScenario(id);
  if (progress.completed) return;
  progress.matches += 1;
  progress.wins += result.won ? 1 : 0;
  progress.runs += Math.max(0, result.runs);
  progress.wickets += Math.max(0, result.wickets);
  const contributionMet =
    definition.targetRuns === 0 ||
    progress.runs >= definition.targetRuns ||
    progress.wickets >= definition.targetWickets;
  progress.completed =
    progress.matches >= definition.targetMatches &&
    progress.wins >= definition.targetWins &&
    contributionMet;
  if (progress.matches >= definition.targetMatches || progress.completed) {
    save.seasonPassExperience!.activeScenarioId = undefined;
  }
  save.seasonPassExperience!.scenarios[id] = progress;
}

export function claimSeasonPassScenarioReward(
  save: SaveGame,
  scenarioId: string,
  now: number = Date.now(),
): { ok: boolean; coins: number; reason?: string } {
  synchronizeSeasonPassState(save, now);
  const definition = SEASON_PASS_SCENARIOS.find((scenario) => scenario.id === scenarioId);
  const progress = save.seasonPassExperience?.scenarios[scenarioId];
  if (!definition || !progress?.completed) {
    return { ok: false, coins: 0, reason: 'Complete the scenario first.' };
  }
  if (progress.rewardClaimed) {
    return { ok: false, coins: 0, reason: 'Reward already claimed.' };
  }
  progress.rewardClaimed = true;
  save.wallet.coins += definition.rewardCoins;
  return { ok: true, coins: definition.rewardCoins };
}

export function passTrainingMultiplier(save: SaveGame, now: number = Date.now()): number {
  return isSeasonPassActive(save, now) ? SEASON_PASS_BENEFITS.trainingGrowthMultiplier : 1;
}

export function passSelectionMultiplier(
  save: SaveGame,
  delta: number,
  now: number = Date.now(),
): number {
  if (delta <= 0 || !isSeasonPassActive(save, now)) return 1;
  return SEASON_PASS_BENEFITS.positiveSelectionRepMultiplier;
}

export function passSuperstarInterestBonus(save: SaveGame, now: number = Date.now()): number {
  return isSeasonPassActive(save, now) ? SEASON_PASS_BENEFITS.superstarInterestBonus : 0;
}

export function passStaffSigningMultiplier(save: SaveGame, now: number = Date.now()): number {
  return isSeasonPassActive(save, now) ? 1 - SEASON_PASS_BENEFITS.staffSigningDiscount : 1;
}

export function daysRemaining(save: SaveGame, now: number = Date.now()): number {
  const expiresAt = save.entitlements.seasonPass?.expiresAt ?? now;
  return clamp(Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)), 0, SEASON_PASS_DAYS);
}
