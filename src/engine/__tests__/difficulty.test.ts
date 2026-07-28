import { difficultyAggression } from '../ai';
import { difficultyOutcomeBalance } from '../difficulty';

describe('difficulty aggression tuning', () => {
  it('makes easy mode clearly easier than normal without changing other tiers', () => {
    expect(difficultyAggression('EASY')).toBe(0.78);
    expect(difficultyAggression('NORMAL')).toBe(1);
    expect(difficultyAggression('HARD')).toBe(1.08);
    expect(difficultyAggression('PRO')).toBe(1.15);
  });
});

describe('difficulty outcome balance', () => {
  it('gives Normal a measured user-side edge without changing the Hard baseline', () => {
    expect(difficultyOutcomeBalance('NORMAL', true)).toEqual({ wicket: 0.9, scoring: 1.04 });
    expect(difficultyOutcomeBalance('NORMAL', false)).toEqual({ wicket: 1.08, scoring: 0.96 });
    expect(difficultyOutcomeBalance('HARD', true)).toEqual({ wicket: 1, scoring: 1 });
    expect(difficultyOutcomeBalance('HARD', false)).toEqual({ wicket: 1, scoring: 1 });
  });

  it('keeps Easy more forgiving and Pro less forgiving than Normal', () => {
    expect(difficultyOutcomeBalance('EASY', true).wicket).toBeLessThan(
      difficultyOutcomeBalance('NORMAL', true).wicket,
    );
    expect(difficultyOutcomeBalance('PRO', true).wicket).toBeGreaterThan(
      difficultyOutcomeBalance('NORMAL', true).wicket,
    );
  });
});
