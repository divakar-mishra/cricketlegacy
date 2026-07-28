import { MatchState } from '../../domain/types';
import { applyResult, resolveMatchResult, standings } from '../season';
import { makeManagerSave } from './_depthHelpers';

function tiedMatch(id: string, homeTeamId: string, awayTeamId: string): MatchState {
  return {
    id,
    seed: 1,
    format: 'T20',
    conditions: { pitch: 'DRY', weather: 'CLEAR' },
    homeTeamId,
    awayTeamId,
    innings: [
      {
        battingTeamId: homeTeamId,
        bowlingTeamId: awayTeamId,
        runs: 140,
        wickets: 6,
        overs: 20,
        balls: 120,
        events: [],
        batting: [],
        bowling: [],
      },
      {
        battingTeamId: awayTeamId,
        bowlingTeamId: homeTeamId,
        runs: 140,
        wickets: 7,
        overs: 20,
        balls: 120,
        events: [],
        batting: [],
        bowling: [],
      },
    ],
    result: { tie: true, margin: 'Match tied' },
  };
}

describe('canonical match result resolver', () => {
  it('records ties separately from no-results and preserves table invariants', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(
      (candidate) =>
        candidate.managerPhase === 'T20' &&
        candidate.divisionTier === save.userDivision &&
        candidate.homeTeamId &&
        candidate.awayTeamId,
    )!;
    const match = tiedMatch(fixture.id, fixture.homeTeamId, fixture.awayTeamId);

    expect(resolveMatchResult(match, fixture).kind).toBe('TIE');
    applyResult(save, match);

    const home = standings(save).find((r) => r.teamId === fixture.homeTeamId)!;
    const away = standings(save).find((r) => r.teamId === fixture.awayTeamId)!;
    for (const row of [home, away]) {
      expect(row.played).toBe(row.won + row.lost + row.tied + row.noResult);
      expect(row.tied).toBe(1);
      expect(row.noResult).toBe(0);
      expect(row.points).toBe(1);
    }
  });
});
