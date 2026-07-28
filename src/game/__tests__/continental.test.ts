import { makeRng } from '../../engine/rng';
import { resolveContinental, teamStrength } from '../continental';
import { makeManagerSave } from './_depthHelpers';

describe('Continental Cup', () => {
  it('measures a team by its best XI', () => {
    const save = makeManagerSave();
    const id = save.userTeamId!;
    expect(teamStrength(save, id)).toBeGreaterThan(0);
    expect(teamStrength(save, 'nope')).toBe(0);
  });

  it('crowns a champion from the qualifiers, and the strongest side prevails', () => {
    const save = makeManagerSave();
    const userId = save.userTeamId!;
    // Make the user's club overwhelmingly the best so the result is decisive.
    for (const pid of save.teams[userId].playerIds) save.players[pid].overall = 99;
    const others = Object.keys(save.teams).filter((id) => id !== userId).slice(0, 3);
    const quals = [userId, ...others];

    const res = resolveContinental(save, quals, makeRng(7));
    expect(res.championId).toBe(userId);
    expect(res.userWon).toBe(true);
    expect(save.continentalTitles).toBe(1);
    expect(save.continentalChampion).toBe(userId);
  });

  it('needs at least two qualifiers', () => {
    const save = makeManagerSave();
    const res = resolveContinental(save, [save.userTeamId!], makeRng(1));
    expect(res.championId).toBeUndefined();
    expect(res.userWon).toBe(false);
  });
});
