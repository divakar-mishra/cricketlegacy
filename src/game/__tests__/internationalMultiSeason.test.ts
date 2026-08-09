import { createManagerSave } from '../createGame';
import {
  generateInternationalWindowFixtures,
  ensureNationalTeam,
  recordWtcFixtureResult,
} from '../intlCalendar';
import { buildManagerSeasonCalendar } from '../managerCalendar';
import { makeCareerSave } from './_depthHelpers';

function prepareCareerYear(save: ReturnType<typeof makeCareerSave>, year: number): void {
  const seasonId = `season-${year}`;
  save.currentSeasonId = seasonId;
  save.seasons[seasonId] = {
    id: seasonId,
    year,
    leagueIds: Object.keys(save.leagues),
    fixtureIds: [],
    currentRound: 1,
    competitions: [],
  };
  save.fixtures = {};
  save.playerCalendar = undefined;
  save.internationalCalendar = undefined;
  save.playerCareerResources!.internationalSelections = {};
}

function recordControlledWtcWins(
  save: ReturnType<typeof makeCareerSave> | ReturnType<typeof createManagerSave>,
  year: number,
): void {
  const fixtures = Object.values(save.fixtures).filter(
    (fixture) => fixture.competitionId === `wtc-test-series-${year}`,
  );
  expect(fixtures).toHaveLength(2);
  for (const fixture of fixtures) {
    fixture.played = true;
    fixture.resultKind = 'HOME_WIN';
    fixture.winnerTeamId = fixture.homeTeamId;
    recordWtcFixtureResult(save, fixture);
  }
}

describe('multi-season international calendar smoke', () => {
  it('keeps Player Career tours, WTC state, and dynamic ICC groups coherent for three years', () => {
    const save = makeCareerSave(2026);
    save.capped = true;
    save.userCaps = 15;
    save.nationalRep = 95;
    save.playerCareerResources!.cappedCountry = 'india';
    save.playerCareerResources!.declaredCountry = 'india';
    save.playerCareerResources!.playerCondition = 100;
    const user = save.players[save.userPlayerId!];
    user.overall = 92;
    user.meta.form = 90;

    prepareCareerYear(save, 2026);
    expect(generateInternationalWindowFixtures(save)).toHaveLength(9);
    recordControlledWtcWins(save, 2026);

    prepareCareerYear(save, 2027);
    expect(generateInternationalWindowFixtures(save)).toHaveLength(5);
    recordControlledWtcWins(save, 2027);
    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 'world-test-championship-2027',
      ),
    ).toHaveLength(1);

    prepareCareerYear(save, 2028);
    const thirdYear = generateInternationalWindowFixtures(save);
    expect(thirdYear).toHaveLength(8);
    expect(
      thirdYear
        .map((fixtureId) => save.fixtures[fixtureId])
        .filter((fixture) => fixture.competitionId === 'champions-trophy-2028')
        .map((fixture) => fixture.cupRound),
    ).toEqual(['Group Stage 1', 'Group Stage 2', 'Group Stage 3']);
    expect(save.wtcCycles?.['wtc-2026-2027'].recordedFixtureIds).toHaveLength(4);
  });

  it('preserves the same two-season WTC cycle for a National Manager', () => {
    const save = createManagerSave({
      teamId: 'mumbai_sharks',
      country: 'india',
      difficulty: 'NORMAL',
      seed: 908,
    });
    save.managerCareerLevel = 'NATIONAL';
    save.managerNationalTeamId = ensureNationalTeam(save, 'india');
    buildManagerSeasonCalendar(save, 2026);
    recordControlledWtcWins(save, 2026);

    save.seasons[save.currentSeasonId!].year = 2027;
    buildManagerSeasonCalendar(save, 2027);
    recordControlledWtcWins(save, 2027);

    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 'world-test-championship-2027',
      ),
    ).toHaveLength(1);
    expect(save.wtcCycles?.['wtc-2026-2027'].recordedFixtureIds).toHaveLength(4);
  });
});
