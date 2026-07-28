import {
  earlySessionPhase,
  shouldShowAdvancedLiveOps,
  shouldShowSeasonPass,
} from '../readiness';
import { seasonProgressMonth, validateSeasonState } from '../season';
import { makeCareerSave } from './_depthHelpers';

describe('first-session trust gates', () => {
  it('hides the Season Pass for the first two matches (0 and 1), then reveals it', () => {
    expect(shouldShowSeasonPass(0)).toBe(false);
    expect(shouldShowSeasonPass(1)).toBe(false);
    expect(shouldShowSeasonPass(2)).toBe(true);
    expect(shouldShowSeasonPass(5)).toBe(true);
  });

  it('hides advanced liveops until the trusted loop', () => {
    expect(shouldShowAdvancedLiveOps(0)).toBe(false);
    expect(shouldShowAdvancedLiveOps(1)).toBe(false);
    expect(shouldShowAdvancedLiveOps(2)).toBe(true);
  });

  it('progresses first -> second -> trusted across the opening matches', () => {
    expect(earlySessionPhase(0)).toBe('FIRST_MATCH');
    expect(earlySessionPhase(1)).toBe('SECOND_MATCH');
    expect(earlySessionPhase(2)).toBe('TRUSTED_LOOP');
    expect(earlySessionPhase(9)).toBe('TRUSTED_LOOP');
  });
});

describe('validateSeasonState auto-heal', () => {
  it('repairs an out-of-range calendar month and a negative wallet', () => {
    const save = makeCareerSave();
    // Corrupt the save the way a bad migration might.
    save.currentMonth = 99;
    save.wallet.coins = -50;
    save.wallet.gems = -3;

    validateSeasonState(save);

    expect(save.currentMonth).toBeGreaterThanOrEqual(1);
    expect(save.currentMonth).toBeLessThanOrEqual(12);
    expect(save.wallet.coins).toBeGreaterThanOrEqual(0);
    expect(save.wallet.gems).toBeGreaterThanOrEqual(0);
  });

  it('drops fixtures that reference missing teams and is idempotent', () => {
    const save = makeCareerSave();
    const template = Object.values(save.fixtures)[0];
    save.fixtures['broken'] = {
      ...template,
      id: 'broken',
      homeTeamId: 'ghost-home',
      awayTeamId: 'ghost-away',
    };

    validateSeasonState(save);
    expect(save.fixtures['broken']).toBeUndefined();

    const snapshot = JSON.stringify(save.fixtures);
    validateSeasonState(save);
    expect(JSON.stringify(save.fixtures)).toBe(snapshot);
  });

  it('derives a valid season month from progress', () => {
    const save = makeCareerSave();
    const month = seasonProgressMonth(save);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});
