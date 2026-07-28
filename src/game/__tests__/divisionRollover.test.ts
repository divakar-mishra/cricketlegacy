import { SaveGame } from '../../domain/types';
import { createManagerSave } from '../createGame';
import { applyManagerPyramidRollover, syncManagerLeagues } from '../managerCalendar';

function makeSave(seed: number): SaveGame {
  const save = createManagerSave({
    teamId: 'mumbai_sharks',
    country: 'india',
    difficulty: 'NORMAL',
    seed,
  });
  save.id = `manager-rollover-${seed}`;
  return save;
}

function forceT20Orders(save: SaveGame, orders: Record<1 | 2 | 3, string[]>): void {
  for (const fixture of Object.values(save.fixtures)) {
    if (fixture.managerPhase !== 'T20' || fixture.playoff || !fixture.divisionTier) continue;
    const order = orders[fixture.divisionTier];
    const homeRank = order.indexOf(fixture.homeTeamId);
    const awayRank = order.indexOf(fixture.awayTeamId);
    fixture.played = true;
    fixture.winnerTeamId = homeRank < awayRank ? fixture.homeTeamId : fixture.awayTeamId;
    fixture.resultKind = fixture.winnerTeamId === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
  }
}

describe('manager three-tier rollover', () => {
  it('promotes the top two from Tier 3 and keeps every division at eight clubs', () => {
    const save = makeSave(9090);
    const userTeamId = save.userTeamId!;
    const orders = {
      1: [...save.divisions!.tier1],
      2: [...save.divisions!.tier2],
      3: [userTeamId, ...save.divisions!.tier3!.filter((id) => id !== userTeamId)],
    };
    forceT20Orders(save, orders);

    applyManagerPyramidRollover(save);

    expect(save.userDivision).toBe(2);
    expect(save.divisions!.tier2).toContain(userTeamId);
    expect(save.divisions!.tier1).toHaveLength(8);
    expect(save.divisions!.tier2).toHaveLength(8);
    expect(save.divisions!.tier3).toHaveLength(8);
    expect(save.leagues['league-1'].divisionTier).toBe(2);
    expect(save.leagues['league-1'].teamIds).toEqual(save.divisions!.tier2);
    expect(save.promotionNews?.userMoved).toBe('PROMOTED');
  });

  it('relegates a bottom-placed Tier 1 manager without allowing a free tier jump', () => {
    const save = makeSave(9091);
    const oldTeam = save.teams[save.userTeamId!];
    oldTeam.isUserTeam = false;
    const userTeamId = save.divisions!.tier1[0];
    save.userTeamId = userTeamId;
    save.userDivision = 1;
    save.teams[userTeamId].isUserTeam = true;
    syncManagerLeagues(save);
    const orders = {
      1: [...save.divisions!.tier1.filter((id) => id !== userTeamId), userTeamId],
      2: [...save.divisions!.tier2],
      3: [...save.divisions!.tier3!],
    };
    forceT20Orders(save, orders);

    applyManagerPyramidRollover(save);

    expect(save.userDivision).toBe(2);
    expect(save.divisions!.tier2).toContain(userTeamId);
    expect(save.leagues['league-1'].divisionTier).toBe(2);
    expect(save.promotionNews?.userMoved).toBe('RELEGATED');
  });
});
