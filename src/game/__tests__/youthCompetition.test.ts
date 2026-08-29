import { activeCompetitionTable } from '../competitionTable';
import { buildPlayerSeasonCalendar } from '../playerCalendar';
import { ensureRival } from '../rivalry';
import { applyResult, runFixture, simulateUnplayedBefore } from '../season';
import { generateYouthFixtures, nextYouthFixtureId, YOUTH_COMP_U19 } from '../youthFixtures';
import { makeCareerSave } from './_depthHelpers';

function makeU19Save() {
  const save = makeCareerSave(811);
  save.players[save.userPlayerId!].age = 18;
  save.careerPathLevel = 'U19';
  save.playerCalendar = undefined;
  generateYouthFixtures(save);
  buildPlayerSeasonCalendar(save);
  return save;
}

describe('complete youth competition', () => {
  it('builds one unique nine-team round robin without self fixtures or duplicate names', () => {
    const save = makeU19Save();
    const userFixtureIds = generateYouthFixtures(save);
    const fixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === YOUTH_COMP_U19,
    );
    const participants = new Set(
      fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]),
    );
    const pairs = fixtures.map((fixture) =>
      [fixture.homeTeamId, fixture.awayTeamId].sort().join(':'),
    );

    expect(userFixtureIds).toHaveLength(8);
    expect(userFixtureIds.map((id) => save.fixtures[id].format)).toEqual([
      'ODI',
      'ODI',
      'ODI',
      'ODI',
      'T20',
      'T20',
      'T20',
      'T20',
    ]);
    expect(fixtures).toHaveLength(36);
    expect(participants.size).toBe(9);
    expect(new Set(pairs).size).toBe(fixtures.length);
    expect(fixtures.every((fixture) => fixture.homeTeamId !== fixture.awayTeamId)).toBe(true);
    for (const teamId of participants) {
      expect(
        fixtures.filter(
          (fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId,
        ),
      ).toHaveLength(8);
    }
    const names = [...participants].map((teamId) => save.teams[teamId].name.toLocaleLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('repairs a legacy partial schedule while retaining its completed result', () => {
    const save = makeU19Save();
    const activeTeamId = save.careerPathTeamId!;
    const generatedFirstId = nextYouthFixtureId(save)!;
    const first = save.fixtures[generatedFirstId];
    const firstId = 'youth-fx-2026-1';
    delete save.fixtures[generatedFirstId];
    first.id = firstId;
    save.fixtures[firstId] = first;
    for (const event of save.playerCalendar?.events ?? []) {
      if (event.fixtureId === generatedFirstId) event.fixtureId = firstId;
    }
    first.played = true;
    first.resultKind = first.homeTeamId === activeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
    first.winnerTeamId = activeTeamId;
    for (const [id, fixture] of Object.entries(save.fixtures)) {
      if (
        fixture.competitionId === YOUTH_COMP_U19 &&
        fixture.homeTeamId !== activeTeamId &&
        fixture.awayTeamId !== activeTeamId
      ) {
        delete save.fixtures[id];
      }
    }
    save.fixtures['legacy-self-fixture'] = {
      ...first,
      id: 'legacy-self-fixture',
      homeTeamId: activeTeamId,
      awayTeamId: activeTeamId,
      played: false,
      resultKind: undefined,
      winnerTeamId: undefined,
    };

    generateYouthFixtures(save);

    const fixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === YOUTH_COMP_U19,
    );
    expect(fixtures).toHaveLength(36);
    expect(save.fixtures[firstId]).toMatchObject({
      played: true,
      winnerTeamId: activeTeamId,
    });
    expect(save.playerCalendar?.events.some((event) => event.fixtureId === firstId)).toBe(true);
    expect(save.fixtures['legacy-self-fixture']).toBeUndefined();
    expect(fixtures.every((fixture) => fixture.homeTeamId !== fixture.awayTeamId)).toBe(true);
  });

  it('simulates the round around the user so standings and the youth rival both advance', () => {
    const save = makeU19Save();
    ensureRival(save);
    const fixtureId = nextYouthFixtureId(save)!;
    const fixture = save.fixtures[fixtureId];
    const opponentId =
      fixture.homeTeamId === save.careerPathTeamId ? fixture.awayTeamId : fixture.homeTeamId;
    const rival = save.players[save.rivalPlayerId!];
    expect(save.teams[opponentId].playerIds).toContain(rival.id);

    simulateUnplayedBefore(save, fixtureId);
    const match = runFixture(save, fixtureId);
    match.result = { winnerTeamId: save.careerPathTeamId, margin: 'Won by 4 wickets' };
    applyResult(save, match);

    const table = activeCompetitionTable(save);
    const userRow = table.rows.find((row) => row.teamId === save.careerPathTeamId);
    const opponentRow = table.rows.find((row) => row.teamId === opponentId);
    expect(userRow).toMatchObject({ played: 1, won: 1, points: 2 });
    expect(opponentRow).toMatchObject({ played: 1, lost: 1 });
    expect(table.rows.reduce((sum, row) => sum + row.played, 0)).toBe(8);
    expect(rival.seasonStats?.matches).toBe(1);
  });
});
