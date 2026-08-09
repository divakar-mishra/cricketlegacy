import { seasonProgressMonth, validateSeasonState } from '../season';
import { makeCareerSave } from './_depthHelpers';

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
