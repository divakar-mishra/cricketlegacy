import { Difficulty } from '../domain/types';

export interface DifficultyOutcomeBalance {
  wicket: number;
  scoring: number;
}

const USER_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 0.68, scoring: 1.15 },
  NORMAL: { wicket: 0.82, scoring: 1.09 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 1.08, scoring: 0.96 },
};

const OPPOSITION_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 1.28, scoring: 0.86 },
  NORMAL: { wicket: 1.16, scoring: 0.92 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 0.94, scoring: 1.04 },
};

/**
 * Explicit user-side assistance for watched matches. Against the Hard baseline,
 * Normal lowers the user's wicket weight by 18%, raises scoring by 9%, and
 * raises opposition wicket weight by 16%. Hard remains simulation-neutral.
 */
export function difficultyOutcomeBalance(
  difficulty: Difficulty,
  userBatting: boolean,
): DifficultyOutcomeBalance {
  return userBatting ? USER_BATTING[difficulty] : OPPOSITION_BATTING[difficulty];
}
