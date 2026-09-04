import { Difficulty, Format } from '../domain/types';
import { clamp } from '../utils/math';

export interface DifficultyOutcomeBalance {
  wicket: number;
  scoring: number;
}

export type DifficultyBalanceProfile = 'PLAYER' | 'MANAGER';

/**
 * Player Career ODI output needs to reward genuine batting development without
 * restoring the old blanket protagonist advantage. This curve applies only to
 * the focus batter: an established professional receives a modest floor, while
 * progress from 80 to 92 OVR supplies the separation between earned-coin and
 * rewarded-coin careers. Bowlers with no meaningful batting skill are excluded.
 */
export function playerCareerOdiBattingBalance(
  base: DifficultyOutcomeBalance,
  format: Format,
  profile: DifficultyBalanceProfile,
  overall: number,
  battingAbility: number,
): DifficultyOutcomeBalance {
  if (profile !== 'PLAYER' || format !== 'ODI' || battingAbility < 55) return base;
  const professionalProgress = clamp((overall - 80) / 12, 0, 1);
  const careerProgress = clamp((overall - 72) / 20, 0, 1);
  const eliteProgress = clamp((overall - 88) / 4, 0, 1);
  const legendProgress = clamp((overall - 90) / 2, 0, 1);
  return {
    wicket:
      base.wicket *
      (0.93584 -
        professionalProgress * 0.05504 -
        careerProgress * 0.0156 -
        eliteProgress ** 2 * 0.1014 -
        legendProgress * 0.0234),
    scoring:
      base.scoring *
      (1.015 +
        professionalProgress * 0.0172 +
        careerProgress * 0.0078 +
        eliteProgress * 0.0156 +
        legendProgress * 0.00416),
  };
}

const USER_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 0.88, scoring: 1.06 },
  NORMAL: { wicket: 1, scoring: 1 },
  HARD: { wicket: 1.05, scoring: 0.975 },
  PRO: { wicket: 1.1, scoring: 0.95 },
};

const OPPOSITION_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 1.12, scoring: 0.94 },
  NORMAL: { wicket: 1, scoring: 1 },
  HARD: { wicket: 0.95, scoring: 1.025 },
  PRO: { wicket: 0.9, scoring: 1.05 },
};

/**
 * Manager Career is a team-building simulation, so ratings, selection and
 * tactics must decide most results. These adjustments are deliberately much
 * narrower than Player Career's protagonist assistance.
 */
const MANAGER_USER_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 0.95, scoring: 1.025 },
  NORMAL: { wicket: 1, scoring: 1 },
  HARD: { wicket: 1.025, scoring: 0.9875 },
  PRO: { wicket: 1.05, scoring: 0.975 },
};

const MANAGER_OPPOSITION_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 1.05, scoring: 0.975 },
  NORMAL: { wicket: 1, scoring: 1 },
  HARD: { wicket: 0.975, scoring: 1.0125 },
  PRO: { wicket: 0.95, scoring: 1.025 },
};

/** Symmetric format environment applied to both Manager teams in every match mode. */
export const MANAGER_FORMAT_SCORING: Record<Format, number> = {
  T10: 1,
  T20: 1,
  HUNDRED: 1,
  ODI: 0.86,
  TEST: 1,
};

/**
 * Player Career applies difficulty only to the protagonist, while Manager
 * Career applies it to the whole controlled XI. Normal is neutral in both
 * modes; Easy provides modest help and Hard/Pro provide the approved roughly
 * five/ten-percent opposition edge without changing the underlying match
 * authority used by Instant Sim, Key Moments or Watch.
 */
export function difficultyOutcomeBalance(
  difficulty: Difficulty,
  userBatting: boolean,
  profile: DifficultyBalanceProfile = 'PLAYER',
  managerRatingAdvantage = 0,
  format?: Format,
): DifficultyOutcomeBalance {
  if (profile === 'MANAGER') {
    const base = userBatting
      ? MANAGER_USER_BATTING[difficulty]
      : MANAGER_OPPOSITION_BATTING[difficulty];
    // Team ratings need to matter more than they do in the ball model alone.
    // A better XI compounds a small edge in scoring and wicket preservation;
    // the bounded curve prevents mismatches from becoming deterministic.
    const rawAdvantage = Math.max(-12, Math.min(12, managerRatingAdvantage));
    const magnitude = Math.abs(rawAdvantage);
    // The first few rating points should be clearly visible, while a large
    // mismatch must still leave the underdog a plausible upset chance.
    const compressedMagnitude = magnitude <= 3 ? magnitude : 3 + (magnitude - 3) * 0.25;
    const advantage = Math.sign(rawAdvantage) * compressedMagnitude;
    const scoringRating = userBatting ? 1 + advantage * 0.012 : 1 - advantage * 0.012;
    const wicketRating = userBatting ? 1 - advantage * 0.02 : 1 + advantage * 0.02;
    const formatScoring = format ? MANAGER_FORMAT_SCORING[format] : 1;
    return {
      wicket: Math.max(0.65, Math.min(1.35, base.wicket * wicketRating)),
      scoring: Math.max(0.65, Math.min(1.22, base.scoring * scoringRating * formatScoring)),
    };
  }
  return userBatting ? USER_BATTING[difficulty] : OPPOSITION_BATTING[difficulty];
}
