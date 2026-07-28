import { Difficulty } from '../domain/types';

export interface DifficultyOutcomeBalance {
  wicket: number;
  scoring: number;
}

const USER_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 0.78, scoring: 1.08 },
  NORMAL: { wicket: 0.9, scoring: 1.04 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 1.08, scoring: 0.96 },
};

const OPPOSITION_BATTING: Record<Difficulty, DifficultyOutcomeBalance> = {
  EASY: { wicket: 1.18, scoring: 0.92 },
  NORMAL: { wicket: 1.08, scoring: 0.96 },
  HARD: { wicket: 1, scoring: 1 },
  PRO: { wicket: 0.94, scoring: 1.04 },
};

/**
 * Small, explicit user-side assistance for watched matches. Normal now reduces
 * user wicket weight by 10% while batting and raises it by 8% while bowling.
 * Hard remains the neutral simulation baseline.
 */
export function difficultyOutcomeBalance(
  difficulty: Difficulty,
  userBatting: boolean,
): DifficultyOutcomeBalance {
  return userBatting ? USER_BATTING[difficulty] : OPPOSITION_BATTING[difficulty];
}
