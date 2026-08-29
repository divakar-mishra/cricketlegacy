import { Difficulty, Format } from '../domain/types';

export interface DifficultyOutcomeBalance {
  wicket: number;
  scoring: number;
}

export type DifficultyBalanceProfile = 'PLAYER' | 'MANAGER';

const USER_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 0.5, scoring: 1.28 },
  NORMAL: { wicket: 0.56, scoring: 1.24 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 1.08, scoring: 0.96 },
};

const OPPOSITION_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 1.34, scoring: 0.84 },
  NORMAL: { wicket: 1.2, scoring: 0.9 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 0.94, scoring: 1.04 },
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
 * Player Career retains its protagonist-focused assistance. Manager Career
 * uses the narrower table above in every presentation mode, with team rating
 * differences then applied consistently on top.
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
    const scoringRating = userBatting
      ? 1 + advantage * 0.012
      : 1 - advantage * 0.012;
    const wicketRating = userBatting
      ? 1 - advantage * 0.02
      : 1 + advantage * 0.02;
    const formatScoring = format ? MANAGER_FORMAT_SCORING[format] : 1;
    return {
      wicket: Math.max(0.65, Math.min(1.35, base.wicket * wicketRating)),
      scoring: Math.max(
        0.65,
        Math.min(1.22, base.scoring * scoringRating * formatScoring),
      ),
    };
  }
  return userBatting ? USER_BATTING[difficulty] : OPPOSITION_BATTING[difficulty];
}
