import {
  achievementsForMode,
  checkManagerMatchAchievements,
  earnedAchievements,
} from '../achievements';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('mode-specific achievements', () => {
  it('does not expose player batting, bowling or life achievements in manager mode', () => {
    const manager = makeManagerSave();
    const catalog = achievementsForMode(manager);
    expect(catalog.some((achievement) => achievement.category === 'batting')).toBe(false);
    expect(catalog.some((achievement) => achievement.category === 'bowling')).toBe(false);
    expect(catalog.some((achievement) => achievement.category === 'team')).toBe(true);
  });

  it('unlocks manager match milestones without a user-player profile', () => {
    const manager = makeManagerSave();
    manager.careerWins = 10;
    expect(checkManagerMatchAchievements(manager)).toContain('meta_10_wins');
    expect(
      earnedAchievements(manager).some((achievement) => achievement.id === 'meta_10_wins'),
    ).toBe(true);

    const career = makeCareerSave();
    expect(
      achievementsForMode(career).some((achievement) => achievement.category === 'batting'),
    ).toBe(true);
  });
});
