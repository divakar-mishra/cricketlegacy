import {
  generateBilateralFixtures,
  generateInternationalWindowFixtures,
  internationalWindowFixtureIds,
  internationalWindowPlan,
} from '../intlCalendar';
import { makeCareerSave } from './_depthHelpers';

function cappedCareerForYear(year: number) {
  const save = makeCareerSave(year);
  const seasonId = `season-${year}`;
  save.capped = true;
  save.userCaps = 12;
  save.playerCareerResources!.cappedCountry = 'india';
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
  return save;
}

describe('four-year international window', () => {
  it('rotates through all four global championship years', () => {
    expect(internationalWindowPlan(2026)).toMatchObject({
      cycleYear: 1,
      kind: 'T20_WORLD_CUP',
      teamCount: 10,
      groupMatches: 4,
    });
    expect(internationalWindowPlan(2027)).toMatchObject({
      cycleYear: 2,
      kind: 'WORLD_TEST_CHAMPIONSHIP',
      teamCount: 8,
      groupMatches: 7,
    });
    expect(internationalWindowPlan(2028)).toMatchObject({
      cycleYear: 3,
      kind: 'CHAMPIONS_TROPHY',
      teamCount: 8,
      groupMatches: 3,
    });
    expect(internationalWindowPlan(2029)).toMatchObject({
      cycleYear: 4,
      kind: 'ODI_WORLD_CUP',
      teamCount: 10,
      groupMatches: 9,
    });
    expect(internationalWindowPlan(2030).kind).toBe('T20_WORLD_CUP');
  });

  it.each([
    [2026, 6, 'INTL_TOURNAMENT', { T20: 6, ODI: 0, TEST: 0 }],
    [2027, 8, 'INTL_TOURNAMENT', { T20: 0, ODI: 0, TEST: 8 }],
    [2028, 5, 'INTL_TOURNAMENT', { T20: 0, ODI: 5, TEST: 0 }],
    [2029, 11, 'INTL_TOURNAMENT', { T20: 0, ODI: 11, TEST: 0 }],
  ] as const)(
    'generates the complete controlled-country path for %s',
    (year, expectedCount, competition, formatCounts) => {
      const save = cappedCareerForYear(year);
      const ids = generateInternationalWindowFixtures(save);
      const fixtures = ids.map((id) => save.fixtures[id]);

      expect(ids).toHaveLength(expectedCount);
      expect(internationalWindowFixtureIds(save)).toEqual(ids);
      expect(fixtures.every((fixture) => fixture.competition === competition)).toBe(true);
      expect(fixtures.every((fixture) => [6, 7, 8].includes(fixture.calendarMonth!))).toBe(true);
      expect(fixtures.every((fixture) => fixture.homeTeamId === 'national-india')).toBe(true);
      for (const format of ['T20', 'ODI', 'TEST'] as const) {
        expect(fixtures.filter((fixture) => fixture.format === format)).toHaveLength(
          formatCounts[format],
        );
      }
    },
  );

  it('runs the WTC as seven league Tests followed by one Final', () => {
    const save = cappedCareerForYear(2027);
    const fixtures = generateInternationalWindowFixtures(save).map((id) => save.fixtures[id]);

    expect(fixtures.slice(0, 7).map((fixture) => fixture.cupRound)).toEqual([
      'League Stage 1',
      'League Stage 2',
      'League Stage 3',
      'League Stage 4',
      'League Stage 5',
      'League Stage 6',
      'League Stage 7',
    ]);
    expect(fixtures.filter((fixture) => fixture.cupRound === 'Semi-Final')).toHaveLength(0);
    expect(fixtures.filter((fixture) => fixture.cupRound === 'Final')).toHaveLength(1);
    expect(new Set(fixtures.slice(0, 7).map((fixture) => fixture.awayTeamId)).size).toBe(7);
    expect(fixtures[7].awayTeamId).toBe(fixtures[0].awayTeamId);
  });

  it('replaces the former bilateral window when upgrading an existing year-two save', () => {
    const save = cappedCareerForYear(2027);
    expect(generateBilateralFixtures(save)).toHaveLength(5);

    const wtcIds = generateInternationalWindowFixtures(save);

    expect(wtcIds).toHaveLength(8);
    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 'bilateral-window-2027',
      ),
    ).toHaveLength(0);
    expect(internationalWindowFixtureIds(save)).toEqual(wtcIds);
  });

  it('is idempotent within a season', () => {
    const save = cappedCareerForYear(2028);
    const first = generateInternationalWindowFixtures(save);
    const second = generateInternationalWindowFixtures(save);

    expect(second).toEqual(first);
    expect(internationalWindowFixtureIds(save)).toHaveLength(5);
  });
});
