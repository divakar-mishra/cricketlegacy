import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import {
  applyThreeTierPromotionRelegation,
  hasDivisions,
  hasThreeDivisions,
  PROMOTE_RELEGATE_COUNT,
} from '../divisions';

function makeSave(teamId: string): SaveGame {
  const player = buildUserPlayer({
    name: 'Div Tester',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
    bowling: { paceOrSpin: 20, accuracy: 20, movement: 20, variations: 20, stamina: 40 },
    fielding: { catching: 60, throwing: 60, agility: 60, keeping: 30 },
    meta: { fitness: 70, confidence: 60, aggression: 55, discipline: 60 },
  });
  return createCareerSave({ player, teamId, difficulty: 'NORMAL', seed: 999 });
}

describe('divisions / promotion + relegation', () => {
  it('a new save has three full eight-team divisions and starts locally', () => {
    const save = makeSave(TEAM_BLUEPRINTS[0].id);
    expect(hasDivisions(save)).toBe(true);
    expect(hasThreeDivisions(save)).toBe(true);
    expect(save.divisions?.tier1).toHaveLength(8);
    expect(save.divisions?.tier2).toHaveLength(8);
    expect(save.divisions?.tier3).toHaveLength(8);
    expect(save.userDivision).toBe(3);
  });

  it('swaps exactly two clubs at both boundaries and preserves sizes', () => {
    const save = makeSave(TEAM_BLUEPRINTS[0].id);
    const res = applyThreeTierPromotionRelegation(save, {
      1: [...save.divisions!.tier1],
      2: [...save.divisions!.tier2],
      3: [...save.divisions!.tier3!],
    });

    expect(res.relegated).toHaveLength(PROMOTE_RELEGATE_COUNT * 2);
    expect(res.promoted).toHaveLength(PROMOTE_RELEGATE_COUNT * 2);
    expect(save.divisions?.tier1).toHaveLength(8);
    expect(save.divisions?.tier2).toHaveLength(8);
    expect(save.divisions?.tier3).toHaveLength(8);
  });

  it('relegates the user when they finish bottom of the top flight', () => {
    const save = makeSave(TEAM_BLUEPRINTS[0].id);
    const user = save.userTeamId!;
    const displaced = save.divisions!.tier1[0];
    save.divisions!.tier1[0] = user;
    save.divisions!.tier3 = save.divisions!.tier3!.map((id) =>
      id === user ? displaced : id,
    );
    save.userDivision = 1;
    const res = applyThreeTierPromotionRelegation(save, {
      1: [...save.divisions!.tier1.filter((id) => id !== user), user],
      2: [...save.divisions!.tier2],
      3: [...save.divisions!.tier3],
    });
    expect(res.userMoved).toBe('RELEGATED');
    expect(save.userDivision).toBe(2);
    expect(save.divisions?.tier2).toContain(user);
  });

  it('promotes a local-tier user who finishes in the top two', () => {
    const save = makeSave(TEAM_BLUEPRINTS[0].id);
    expect(save.userDivision).toBe(3);
    const user = save.userTeamId!;
    const res = applyThreeTierPromotionRelegation(save, {
      1: [...save.divisions!.tier1],
      2: [...save.divisions!.tier2],
      3: [user, ...save.divisions!.tier3!.filter((id) => id !== user)],
    });
    expect(res.userMoved).toBe('PROMOTED');
    expect(save.userDivision).toBe(2);
    expect(save.divisions?.tier2).toContain(user);
  });
});
