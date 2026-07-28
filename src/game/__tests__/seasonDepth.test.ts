import { MatchState } from '../../domain/types';
import { makeRng } from '../../engine/rng';
import { createManagerSave } from '../createGame';
import { rolloverSquads } from '../lifecycle';
import { updateRecords } from '../records';
import { ensureCompetitionFixtures } from '../season';

const makeSave = (seed: number) => {
  const save = createManagerSave({
    teamId: 'mumbai_sharks',
    country: 'india',
    difficulty: 'NORMAL',
    seed,
  });
  save.id = `season-depth-${seed}`;
  return save;
};

describe('manager world lifecycle', () => {
  it('retires veterans and refills domestic workload squads to 22 players', () => {
    const save = makeSave(11);
    const team = save.teams[save.userTeamId!];
    const victimId = team.playerIds[0];
    save.players[victimId].age = 40;

    rolloverSquads(save, 2027, makeRng(11));

    expect(save.players[victimId]).toBeUndefined();
    for (const domesticTeam of Object.values(save.teams).filter(
      (candidate) => !candidate.isNationalTeam,
    )) {
      expect(domesticTeam.playerIds).toHaveLength(22);
    }
  });
});

describe('fair manager competition schedules', () => {
  it('gives every club fourteen T20 matches in a double round robin', () => {
    const save = makeSave(19);
    const tierThreeFixtures = Object.values(save.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 't20-league' && fixture.divisionTier === 3 && !fixture.playoff,
    );
    const appearances = new Map<string, number>();
    const rounds = new Map<number, number>();
    for (const fixture of tierThreeFixtures) {
      appearances.set(fixture.homeTeamId, (appearances.get(fixture.homeTeamId) ?? 0) + 1);
      appearances.set(fixture.awayTeamId, (appearances.get(fixture.awayTeamId) ?? 0) + 1);
      rounds.set(fixture.round, (rounds.get(fixture.round) ?? 0) + 1);
    }

    expect(tierThreeFixtures).toHaveLength(56);
    expect([...appearances.values()]).toEqual(expect.arrayContaining(Array(8).fill(14)));
    expect([...rounds.values()]).toEqual(Array(14).fill(4));
  });

  it('builds complete List A and First Class round robins across all three tiers', () => {
    const save = makeSave(23);
    for (const competitionId of ['list-a', 'first-class'] as const) {
      const ids = ensureCompetitionFixtures(save, competitionId);
      const fixtures = ids.map((id) => save.fixtures[id]);
      const userFixtures = fixtures.filter(
        (fixture) =>
          fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId,
      );

      expect(ids).toHaveLength(84);
      expect(userFixtures).toHaveLength(7);
      for (const tier of [1, 2, 3]) {
        const tierFixtures = fixtures.filter((fixture) => fixture.divisionTier === tier);
        expect(tierFixtures).toHaveLength(28);
        expect(
          new Set(
            tierFixtures.map((fixture) =>
              [fixture.homeTeamId, fixture.awayTeamId].sort().join(':'),
            ),
          ).size,
        ).toBe(28);
      }
    }
  });
});

describe('records', () => {
  it('captures hundreds, five-fers and best figures', () => {
    const save = makeSave(13);
    const id = save.teams[save.userTeamId!].playerIds[0];
    const match: MatchState = {
      id: 'm',
      seed: 1,
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      homeTeamId: 'x',
      awayTeamId: 'y',
      innings: [
        {
          battingTeamId: 'x',
          bowlingTeamId: 'y',
          runs: 130,
          wickets: 1,
          overs: 20,
          balls: 120,
          events: [],
          batting: [
            {
              playerId: id,
              runs: 120,
              balls: 55,
              fours: 10,
              sixes: 6,
              out: false,
              battedOrder: 0,
            },
          ],
          bowling: [],
        },
        {
          battingTeamId: 'y',
          bowlingTeamId: 'x',
          runs: 90,
          wickets: 5,
          overs: 18,
          balls: 108,
          events: [],
          batting: [],
          bowling: [{ playerId: id, balls: 24, maidens: 0, runs: 30, wickets: 5 }],
        },
      ],
    };

    updateRecords(save, match, 2027);

    expect(save.records?.centuries.length).toBeGreaterThan(0);
    expect(save.records?.highestScore?.runs).toBe(120);
    expect(save.records?.fiveWicketHauls.length).toBeGreaterThan(0);
    expect(save.records?.bestBowling?.wickets).toBe(5);
  });
});
