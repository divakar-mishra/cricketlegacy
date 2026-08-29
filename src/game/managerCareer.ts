/**
 * Manager career pathway — progression from domestic club to the national team.
 *
 *   CLUB    : Default start for new managers. Manages a single domestic T20 club.
 *             Multi-format (List-A / First-Class) is locked until promoted.
 *   STATE   : Unlocked after winning 1+ league title or transitioning from a
 *             cricket player legend (50+ caps or 8,000+ career runs).
 *             Full 3-format domestic access; national selectors are watching.
 *   NATIONAL: The pinnacle. Manages the national team through year-round
 *             bilateral tours, WTC Tests and June-August ICC events.
 *
 * Four-year cycle starting in 2026:
 *   T20 World Cup -> World Test Championship -> Champions Trophy -> ODI World Cup.
 */

import { Format, ManagerCareerLevel, SaveGame } from '../domain/types';
import { clamp } from '../utils/math';
import { managerCompetitionStandings } from './managerCalendar';
import {
  generateCountryInternationalWindowFixtures,
  internationalWindowPlan,
} from './intlCalendar';

// ── Constants ─────────────────────────────────────────────────────────────

export const MANAGER_LEVEL_LABEL: Record<ManagerCareerLevel, string> = {
  CLUB: 'Rookie Manager',
  STATE: 'Professional Manager',
  ELITE: 'Master Manager',
  NATIONAL: 'National Team Head Coach',
};

export const MANAGER_LEVEL_DESC: Record<ManagerCareerLevel, string> = {
  CLUB: 'Lead a Tier 3 club through T20. Finish in the top two to reach Tier 2 and unlock 50-over cricket.',
  STATE:
    'Manage a Tier 2 club in the 50-over and T20 blocks. Earn promotion to the elite division.',
  ELITE:
    'Compete through the full domestic year. A Four-Day Shield title or a sustained elite record can earn the national job.',
  NATIONAL:
    'Lead the national side through autumn tours, winter WTC Tests and the global tournament window.',
};

/** Seasons with boardConfidence ≥ 80 needed (without a title) to earn STATE promotion. */
const SEASONS_HIGH_CONF_FOR_PROMOTION = 3;

export const MANAGER_MERIT_REPUTATION_CAP = 88;
export const MANAGER_AD_REPUTATION_CAP = 3;
export const MANAGER_PREMIUM_REPUTATION_CAP = 8;
export const MANAGER_ADS_PER_REPUTATION_POINT = 15;

export interface ManagerReputationBreakdown {
  merit: number;
  adBoost: number;
  premiumBoost: number;
  total: number;
}

function managerLevelReputationBonus(level: ManagerCareerLevel): number {
  if (level === 'NATIONAL') return 2;
  if (level === 'ELITE') return 1;
  if (level === 'STATE') return 0.5;
  return 0;
}

function rewardedManagerMatchCount(save: SaveGame): number {
  return Object.keys(save.flags ?? {}).filter((key) => key.startsWith('rewardTx:match-double:'))
    .length;
}

/**
 * Personal Manager reputation is earned from a complete body of work rather
 * than copied from the current club. Free merit tops out at 88; sustained
 * rewarded-ad engagement and recorded premium assistance can accelerate the
 * final stretch without guaranteeing results, trophies, or appointments.
 */
export function managerReputationBreakdown(
  save: SaveGame,
  options: { includeCompletedSeason?: boolean } = {},
): ManagerReputationBreakdown {
  const current = Math.round(
    save.managerProgression?.reputation ??
      (save.userTeamId ? save.teams[save.userTeamId]?.reputation : 0) ??
      0,
  );
  if (save.mode !== 'manager') {
    return { merit: current, adBoost: 0, premiumBoost: 0, total: current };
  }

  const seasons =
    Math.max(0, save.careerSeasons ?? 0) + (options.includeCompletedSeason ? 1 : 0);
  const wins = Math.max(0, save.careerWins ?? 0);
  const losses = Math.max(0, save.careerLosses ?? 0);
  const neutral = Math.max(0, save.careerDraws ?? 0);
  const played = wins + losses + neutral;
  const winRate = played > 0 ? wins / played : 0.5;
  const titles =
    Math.max(0, save.leagueTitles ?? 0) +
    Math.max(0, save.cupWins ?? 0) +
    Math.max(0, save.continentalTitles ?? 0);
  const experience = Math.min(15, seasons * 0.6);
  const results = clamp((winRate - 0.4) * 10, -1, 2);
  const trophies = Math.min(6, titles * 0.5);
  const level = managerLevelReputationBonus(save.managerCareerLevel ?? 'CLUB');
  const hasMeritEvidence = seasons > 0 || played > 0 || titles > 0;
  const merit = hasMeritEvidence
    ? Math.round(
        clamp(66 + experience + results + trophies + level, 40, MANAGER_MERIT_REPUTATION_CAP),
      )
    : 66;
  const adBoost = Math.min(
    MANAGER_AD_REPUTATION_CAP,
    Math.floor(rewardedManagerMatchCount(save) / MANAGER_ADS_PER_REPUTATION_POINT),
  );
  const premiumBoost = Math.min(
    MANAGER_PREMIUM_REPUTATION_CAP,
    save.managerProgression?.premiumAssistanceHistory.length ?? 0,
  );
  return {
    merit,
    adBoost,
    premiumBoost,
    total: Math.round(clamp(merit + adBoost + premiumBoost, 0, 99)),
  };
}

export function updateManagerReputation(
  save: SaveGame,
  options: { includeCompletedSeason?: boolean } = {},
): ManagerReputationBreakdown {
  const breakdown = managerReputationBreakdown(save, options);
  if (save.mode !== 'manager') return breakdown;
  save.managerProgression = save.managerProgression ?? {
    reputation: breakdown.total,
    currentClubId: save.userTeamId ?? '',
    premiumAssistanceHistory: [],
  };
  save.managerProgression.reputation = breakdown.total;
  save.managerProgression.currentClubId = save.userTeamId ?? save.managerProgression.currentClubId;
  return breakdown;
}

// ── Promotion logic ────────────────────────────────────────────────────────

export interface PromotionCheckResult {
  promoted: boolean;
  to?: ManagerCareerLevel;
  reason?: string;
}

/**
 * Check whether the manager has earned promotion to the next level.
 * Call at the end of each season in `settleManagerSeason`.
 */
export function checkManagerLevelPromotion(save: SaveGame): PromotionCheckResult {
  if (save.mode !== 'manager') return { promoted: false };

  const level = save.managerCareerLevel ?? 'CLUB';
  const seasons = save.managerCareerSeasons ?? 0;
  const titles = save.managerTitlesAtLevel ?? 0;
  const topFinishes = save.managerTopFinishes ?? 0;
  const conf = save.boardConfidence ?? 60;

  if (save.managerCalendar && save.userTeamId) {
    if (save.managerCalendar.phase !== 'OFF_SEASON') return { promoted: false };
    if (level === 'CLUB' && (save.userDivision ?? 3) === 3) {
      const position =
        managerCompetitionStandings(save, 'T20', 3).findIndex(
          (row) => row.teamId === save.userTeamId,
        ) + 1;
      return position > 0 && position <= 2
        ? {
            promoted: true,
            to: 'STATE',
            reason: 'A top-two Tier 3 finish earns promotion to the professional division.',
          }
        : { promoted: false };
    }
    if (level === 'STATE' && save.userDivision === 2) {
      const position =
        managerCompetitionStandings(save, 'T20', 2).findIndex(
          (row) => row.teamId === save.userTeamId,
        ) + 1;
      if (position > 0 && position <= 2) {
        return {
          promoted: true,
          to: 'ELITE',
          reason: 'Promotion to Tier 1 unlocks the complete domestic calendar.',
        };
      }
      const completedStateSeasons = seasons + 1;
      const reputation = save.managerProgression?.reputation ?? 0;
      const careerTitles =
        (save.leagueTitles ?? 0) + (save.cupWins ?? 0) + (save.continentalTitles ?? 0);
      const careerMatches =
        (save.careerWins ?? 0) + (save.careerLosses ?? 0) + (save.careerDraws ?? 0);
      const careerWinRate = careerMatches > 0 ? (save.careerWins ?? 0) / careerMatches : 0;
      if (
        completedStateSeasons >= 6 &&
        reputation >= 73 &&
        careerTitles >= 4 &&
        careerWinRate >= 0.5
      ) {
        return {
          promoted: true,
          to: 'ELITE',
          reason: 'A sustained professional trophy record earns an elite appointment.',
        };
      }
      if (completedStateSeasons >= 10 && reputation >= 76 && careerTitles >= 6) {
        return {
          promoted: true,
          to: 'ELITE',
          reason: 'A long, decorated professional career earns an elite appointment.',
        };
      }
      return { promoted: false };
    }
    if (level === 'ELITE') {
      if (save.managerWonTierOneFirstClass) {
        return {
          promoted: true,
          to: 'NATIONAL',
          reason: 'Winning the Tier 1 Four-Day Shield earns the national team appointment.',
        };
      }
      const reputation = save.managerProgression?.reputation ?? 0;
      const completedEliteSeasons = seasons + 1;
      if (
        completedEliteSeasons >= 3 &&
        reputation >= 73 &&
        (titles >= 1 || topFinishes >= 2)
      ) {
        return {
          promoted: true,
          to: 'NATIONAL',
          reason: 'Sustained Tier 1 contention earns the national team appointment.',
        };
      }
      if (completedEliteSeasons >= 5 && reputation >= 75) {
        return {
          promoted: true,
          to: 'NATIONAL',
          reason: 'A long elite-level record earns the national team appointment.',
        };
      }
    }
    return { promoted: false };
  }

  if (level === 'CLUB') {
    // Win a title → straight up. Trophies are the clearest performance signal.
    if (titles >= 1) {
      return {
        promoted: true,
        to: 'STATE',
        reason: 'League title earned — national selectors are calling.',
      };
    }
    // OR: two top-2 finishes — consistent over-performance without the trophy.
    if (topFinishes >= 2) {
      return {
        promoted: true,
        to: 'STATE',
        reason: 'Back-to-back top-two finishes prove you belong at a higher level.',
      };
    }
    // OR: sustained excellence over 3 seasons with high board confidence.
    if (seasons >= SEASONS_HIGH_CONF_FOR_PROMOTION && conf >= 80) {
      return {
        promoted: true,
        to: 'STATE',
        reason: 'Consistent excellence earns a state programme appointment.',
      };
    }
  }

  if (level === 'STATE') {
    // Two state titles → the national job is yours.
    if (titles >= 2) {
      return {
        promoted: true,
        to: 'NATIONAL',
        reason: "Your trophy record makes you the nation's top coaching choice.",
      };
    }
    const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
    // OR: three top-2 finishes with a strong reputation.
    if (topFinishes >= 3 && (team?.reputation ?? 0) >= 78) {
      return {
        promoted: true,
        to: 'NATIONAL',
        reason: 'Years of contending at the top earn the national appointment.',
      };
    }
    // OR: 4+ seasons of consistently high confidence + strong reputation.
    if (seasons >= 4 && conf >= 85 && (team?.reputation ?? 0) >= 80) {
      return {
        promoted: true,
        to: 'NATIONAL',
        reason: 'An exceptional coaching career earns the national job.',
      };
    }
  }

  if (level === 'ELITE' && save.managerWonTierOneFirstClass) {
    return {
      promoted: true,
      to: 'NATIONAL',
      reason: 'Winning the Tier 1 Four-Day Shield earns the national team appointment.',
    };
  }

  return { promoted: false };
}

/** Apply a manager level promotion to the save. Returns true if changed. */
export function applyManagerLevelPromotion(save: SaveGame, to: ManagerCareerLevel): boolean {
  if (save.managerCareerLevel === to) return false;
  save.managerCareerLevel = to;
  save.managerCareerSeasons = 0;
  save.managerTitlesAtLevel = 0;
  save.managerTopFinishes = 0;
  return true;
}

/** Record a league finish at the current level — top-2 finishes count toward promotion. */
export function recordManagerFinish(save: SaveGame, position: number): void {
  if (save.mode !== 'manager' || position <= 0) return;
  if (position <= 2) save.managerTopFinishes = (save.managerTopFinishes ?? 0) + 1;
}

/** Tick the manager's seasons-at-current-level counter. Call at startNewSeason. */
export function tickManagerCareerSeason(save: SaveGame): void {
  if (save.mode !== 'manager') return;
  save.managerCareerSeasons = (save.managerCareerSeasons ?? 0) + 1;
}

/** Record a league title at the current manager level. */
export function recordManagerTitle(save: SaveGame): void {
  if (save.mode !== 'manager') return;
  save.managerTitlesAtLevel = (save.managerTitlesAtLevel ?? 0) + 1;
}

// ── Determine starting level ───────────────────────────────────────────────

/**
 * Determine the correct starting level for a new manager save.
 * A transitioning player-legend (50+ caps or 8,000+ career runs) skips
 * straight to STATE — they already have the pedigree.
 */
export function initialManagerLevel(opts: {
  isLegendTransition?: boolean;
  caps?: number;
  careerRuns?: number;
}): ManagerCareerLevel {
  const { isLegendTransition, caps = 0, careerRuns = 0 } = opts;
  if (isLegendTransition && (caps >= 50 || careerRuns >= 8_000)) return 'STATE';
  return 'CLUB';
}

// ── ICC Tournament Calendar ────────────────────────────────────────────────

export interface IccEvent {
  id: string;
  name: string;
  type: 'T20_WC' | 'WORLD_TEST_CHAMPIONSHIP' | 'ODI_WC' | 'CHAMPIONS_TROPHY';
  format: Format;
  year: number;
  /** In-game months (1-12) when this event is played. */
  months: number[];
  /** Number of teams in the event. */
  teams: number;
}

/**
 * Return the headline ICC event for the given game year.
 */
export function iccEventsForYear(year: number): IccEvent[] {
  const plan = internationalWindowPlan(year);
  if (plan.kind === 'BILATERAL') return [];
  return [
    {
      id: plan.id,
      name: plan.name,
      type:
        plan.kind === 'T20_WORLD_CUP'
          ? 'T20_WC'
          : plan.kind === 'WORLD_TEST_CHAMPIONSHIP'
            ? 'WORLD_TEST_CHAMPIONSHIP'
            : plan.kind === 'CHAMPIONS_TROPHY'
              ? 'CHAMPIONS_TROPHY'
              : 'ODI_WC',
      format: plan.format,
      year,
      months: plan.months,
      teams: plan.teamCount,
    },
  ];
}

/** Return ICC events for the next N years starting from the given year. */
export function upcomingIccEvents(fromYear: number, years = 4): IccEvent[] {
  const out: IccEvent[] = [];
  for (let y = fromYear; y < fromYear + years; y++) {
    out.push(...iccEventsForYear(y));
  }
  return out;
}

/**
 * Ensure ICC tournament fixtures are generated for NATIONAL managers
 * at the start of each season. Idempotent.
 */
export function ensureIccFixtures(save: SaveGame): string[] {
  if (save.mode !== 'manager' || save.managerCareerLevel !== 'NATIONAL') return [];
  if (!save.managerNationalTeamId) return [];
  const country =
    save.teams[save.managerNationalTeamId]?.country ??
    (save.userTeamId ? save.teams[save.userTeamId]?.country : undefined) ??
    'india';
  return generateCountryInternationalWindowFixtures(save, country, {
    controlledTeamId: save.managerNationalTeamId,
    managerPhase: save.managerCalendar ? 'OFF_SEASON' : undefined,
  });
}

// ── Multi-format access by manager level ───────────────────────────────────

/**
 * Which domestic competition IDs are accessible at a given manager level.
 * CLUB = T20 only · STATE/NATIONAL = all three domestic formats.
 */
export function allowedCompetitionIds(level: ManagerCareerLevel): Set<string> {
  if (level === 'CLUB') return new Set(['t20-league']);
  if (level === 'STATE') return new Set(['t20-league', 'list-a']);
  return new Set(['t20-league', 'list-a', 'first-class']);
}
