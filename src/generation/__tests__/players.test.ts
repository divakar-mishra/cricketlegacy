import { makeRng } from '../../engine/rng';
import { playerDomesticBlueprints } from '../../game/domesticBranding';
import { generateSquad } from '../players';
import { buildPlayerLeagueWorld } from '../world';

describe('procedural generation', () => {
  it('builds a balanced 11-man squad with unique ids', () => {
    const squad = generateSquad({
      nationality: 'india',
      quality: 65,
      idPrefix: 't',
      rng: makeRng(1),
    });
    expect(squad).toHaveLength(11);
    expect(new Set(squad.map((p) => p.id)).size).toBe(11);
    expect(squad.filter((p) => p.role === 'WK_BATTER')).toHaveLength(1);
    expect(squad.filter((p) => p.role === 'BOWLER').length).toBeGreaterThanOrEqual(3);
    for (const p of squad) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.overall).toBeGreaterThan(20);
      expect(p.overall).toBeLessThanOrEqual(99);
      expect(p.potential).toBeGreaterThanOrEqual(p.overall - 30);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateSquad({ nationality: 'india', quality: 65, idPrefix: 't', rng: makeRng(7) });
    const b = generateSquad({ nationality: 'india', quality: 65, idPrefix: 't', rng: makeRng(7) });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('builds a validated three-tier world with linked players and round-robins', () => {
    const requiredTeamId = playerDomesticBlueprints('india').find((team) => team.tier === 3)!.id;
    const w = buildPlayerLeagueWorld(123, {
      country: 'india',
      userDivision: 3,
      requiredTeamId,
    });
    const domesticTeams = Object.values(w.teams).filter((team) => !team.isNationalTeam);
    expect(domesticTeams).toHaveLength(24);
    for (const t of domesticTeams) {
      expect(t.playerIds).toHaveLength(22);
      for (const id of t.playerIds) expect(w.players[id]).toBeDefined();
    }
    expect(Object.keys(w.fixtures)).toHaveLength(168);
    expect(w.leagues['league-1'].table).toHaveLength(8);
    expect(w.leagues['league-2'].table).toHaveLength(8);
    expect(w.leagues['league-3'].table).toHaveLength(8);
    expect(w.divisions.tier1).toHaveLength(8);
    expect(w.divisions.tier2).toHaveLength(8);
    expect(w.divisions.tier3).toHaveLength(8);
    expect(w.freeAgents.length).toBeGreaterThan(0);
  });

  it('squad shape snapshot', () => {
    const squad = generateSquad({
      nationality: 'england',
      quality: 68,
      idPrefix: 'eng',
      rng: makeRng(2026),
    });
    expect(squad.map((p) => ({ role: p.role, ovr: p.overall }))).toMatchSnapshot();
  });
});
