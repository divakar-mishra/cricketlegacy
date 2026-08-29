import { CareerCompetitionStatScope, Competition, Format, MatchState } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { applyMatchToStats, resetSeasonStats } from '../stats';

function makeSave() {
  const player = buildUserPlayer({
    name: 'Scope Tester',
    nationality: 'india',
    age: 20,
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    attrScale: 1,
    batting: {
      technique: 70,
      timing: 70,
      power: 70,
      footwork: 70,
      temperament: 70,
      running: 70,
    },
    bowling: { paceOrSpin: 70, accuracy: 70, movement: 70, variations: 70, stamina: 70 },
    fielding: { catching: 70, throwing: 70, agility: 70, keeping: 30 },
    meta: { fitness: 70, confidence: 70, aggression: 60, discipline: 70 },
  });
  return createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 271,
    format: 'T20',
  });
}

function matchFor(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  batterId: string,
  bowlerId: string,
  format: Format = 'T20',
): MatchState {
  return {
    id,
    seed: 1,
    format,
    conditions: { pitch: 'DRY', weather: 'CLEAR' },
    homeTeamId,
    awayTeamId,
    innings: [
      {
        battingTeamId: homeTeamId,
        bowlingTeamId: awayTeamId,
        runs: 12,
        wickets: 0,
        overs: 1,
        balls: 6,
        events: [],
        batting: [
          {
            playerId: batterId,
            runs: 12,
            balls: 6,
            fours: 2,
            sixes: 0,
            out: false,
            battedOrder: 0,
          },
        ],
        bowling: [{ playerId: bowlerId, balls: 6, maidens: 0, runs: 12, wickets: 0 }],
      },
    ],
  };
}

describe('canonical scoped career stats', () => {
  it('uses the completed match XI rather than a later mutable team XI', () => {
    const save = makeSave();
    const homeTeam = save.teams[save.userTeamId!];
    const userId = save.userPlayerId!;
    const replacementId = homeTeam.playerIds.find((id) => id !== userId)!;
    const awayTeamId = Object.keys(save.teams).find((id) => id !== homeTeam.id)!;
    const awayTeam = save.teams[awayTeamId];
    const match = matchFor(
      'benched-appearance',
      homeTeam.id,
      awayTeamId,
      replacementId,
      awayTeam.playerIds[0],
    );
    match.homePlayerIds = homeTeam.playerIds.filter((id) => id !== userId).slice(0, 11);
    match.awayPlayerIds = awayTeam.playerIds.slice(0, 11);

    // Selection for a future fixture must not rewrite who appeared here.
    homeTeam.xi = [userId, ...homeTeam.playerIds.filter((id) => id !== userId)].slice(0, 11);
    applyMatchToStats(save, match);

    expect(save.players[userId].careerStats?.matches ?? 0).toBe(0);
    expect(save.players[replacementId].careerStats?.matches).toBe(1);
  });

  it('counts every selected XI member and separates domestic from international output', () => {
    const save = makeSave();
    const homeTeam = save.teams[save.userTeamId!];
    const userId = save.userPlayerId!;
    homeTeam.xi = [userId, ...homeTeam.playerIds.filter((id) => id !== userId)].slice(0, 11);
    const unusedSelectedId = homeTeam.xi[10];
    const awayTeamId = Object.keys(save.teams).find((id) => id !== homeTeam.id)!;
    const awayTeam = save.teams[awayTeamId];
    awayTeam.xi = awayTeam.playerIds.slice(0, 11);

    const domesticId = 'scope-domestic';
    save.fixtures[domesticId] = {
      id: domesticId,
      seasonId: save.currentSeasonId!,
      format: 'T20',
      homeTeamId: homeTeam.id,
      awayTeamId,
      venue: 'Test Ground',
      round: 1,
      played: true,
      competition: 'LEAGUE',
      competitionId: 't20-league',
    };
    applyMatchToStats(save, matchFor(domesticId, homeTeam.id, awayTeamId, userId, awayTeam.xi[0]));

    expect(save.players[unusedSelectedId].careerStats?.matches).toBe(1);
    expect(save.players[unusedSelectedId].careerStats?.runs).toBe(0);
    expect(save.players[userId].domesticStats).toMatchObject({ matches: 1, runs: 12 });
    expect(save.players[userId].internationalStats?.matches ?? 0).toBe(0);

    const internationalId = 'scope-international';
    save.fixtures[internationalId] = {
      ...save.fixtures[domesticId],
      id: internationalId,
      competition: 'BILATERAL_SERIES',
      competitionId: 'autumn-t20-tour-2026',
    };
    applyMatchToStats(
      save,
      matchFor(internationalId, homeTeam.id, awayTeamId, userId, awayTeam.xi[0]),
    );

    expect(save.players[userId].careerStats).toMatchObject({ matches: 2, runs: 24 });
    expect(save.players[userId].domesticStats).toMatchObject({ matches: 1, runs: 12 });
    expect(save.players[userId].internationalStats).toMatchObject({ matches: 1, runs: 12 });
    expect(save.players[userId].competitionStats?.DOMESTIC_T20).toMatchObject({
      matches: 1,
      runs: 12,
    });
    expect(save.players[userId].competitionStats?.T20I).toMatchObject({ matches: 1, runs: 12 });
    expect(save.players[userId].formatStats?.T20).toMatchObject({ matches: 2, runs: 24 });
    expect(save.players[userId].seasonFormatStats?.T20).toMatchObject({
      matches: 2,
      runs: 24,
    });

    resetSeasonStats(save);
    expect(save.players[userId].seasonFormatStats).toEqual({});
    expect(save.players[userId].formatStats?.T20).toMatchObject({ matches: 2, runs: 24 });
  });

  it('keeps Grade A, youth, domestic and international format records separate', () => {
    const save = makeSave();
    const homeTeam = save.teams[save.userTeamId!];
    const userId = save.userPlayerId!;
    homeTeam.xi = [userId, ...homeTeam.playerIds.filter((id) => id !== userId)].slice(0, 11);
    const awayTeamId = Object.keys(save.teams).find((id) => id !== homeTeam.id)!;
    const awayTeam = save.teams[awayTeamId];
    awayTeam.xi = awayTeam.playerIds.slice(0, 11);

    const cases: Array<{
      scope: CareerCompetitionStatScope;
      format: Format;
      competition: Competition;
      competitionId: string;
    }> = [
      { scope: 'GRADE_A', format: 'T20', competition: 'LEAGUE', competitionId: 'youth-u14' },
      { scope: 'U19', format: 'ODI', competition: 'LEAGUE', competitionId: 'youth-u19' },
      {
        scope: 'U19_WORLD_CUP',
        format: 'ODI',
        competition: 'U19_WORLDCUP',
        competitionId: 'u19-world-cup-2026',
      },
      {
        scope: 'DOMESTIC_T20',
        format: 'T20',
        competition: 'LEAGUE',
        competitionId: 't20-league',
      },
      { scope: 'LIST_A', format: 'ODI', competition: 'LEAGUE', competitionId: 'list-a' },
      {
        scope: 'FIRST_CLASS',
        format: 'TEST',
        competition: 'LEAGUE',
        competitionId: 'first-class',
      },
      {
        scope: 'T20I',
        format: 'T20',
        competition: 'BILATERAL_SERIES',
        competitionId: 'international-t20',
      },
      {
        scope: 'ODI',
        format: 'ODI',
        competition: 'BILATERAL_SERIES',
        competitionId: 'international-odi',
      },
      {
        scope: 'TEST',
        format: 'TEST',
        competition: 'BILATERAL_SERIES',
        competitionId: 'international-test',
      },
    ];

    for (const [index, item] of cases.entries()) {
      const fixtureId = `scope-${item.scope.toLowerCase()}`;
      save.fixtures[fixtureId] = {
        id: fixtureId,
        seasonId: save.currentSeasonId!,
        format: item.format,
        homeTeamId: homeTeam.id,
        awayTeamId,
        venue: 'Test Ground',
        round: index + 1,
        played: true,
        competition: item.competition,
        competitionId: item.competitionId,
      };
      applyMatchToStats(
        save,
        matchFor(fixtureId, homeTeam.id, awayTeamId, userId, awayTeam.xi[0], item.format),
      );
    }

    for (const item of cases) {
      expect(save.players[userId].competitionStats?.[item.scope]).toMatchObject({
        matches: 1,
        runs: 12,
      });
    }
  });
});
