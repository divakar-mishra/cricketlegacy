import type { MatchState, SaveGame } from '../../domain/types';
import {
  annualInternationalPlans,
  generateInternationalWindowFixtures,
  internationalSelectionDecision,
  internationalWindowFixtureIds,
  internationalWindowPlan,
  recordWtcFixtureResult,
  wtcStandings,
} from '../intlCalendar';
import { applyResult, resolveNationalDutyConflict } from '../season';
import { makeCareerSave } from './_depthHelpers';

function cappedCareerForYear(year: number) {
  const save = makeCareerSave(year);
  const seasonId = `season-${year}`;
  save.capped = true;
  save.userCaps = 12;
  save.nationalRep = 95;
  save.playerCareerResources!.cappedCountry = 'india';
  save.playerCareerResources!.declaredCountry = 'india';
  save.playerCareerResources!.playerCondition = 100;
  save.playerCareerResources!.internationalSelections = {};
  const user = save.players[save.userPlayerId!];
  user.overall = 92;
  user.meta.form = 90;
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

function completeInternationalFixture(
  save: SaveGame,
  fixtureId: string,
  winner: 'HOME' | 'AWAY',
): void {
  const fixture = save.fixtures[fixtureId];
  const match: MatchState = {
    id: fixture.id,
    seed: 1,
    format: fixture.format,
    conditions: { pitch: 'FLAT', weather: 'CLEAR' },
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    innings: [],
    result: {
      winnerTeamId: winner === 'HOME' ? fixture.homeTeamId : fixture.awayTeamId,
      margin: 'test result',
    },
  };
  applyResult(save, match);
}

describe('year-round international calendar', () => {
  it('keeps the four-year ICC rotation while making WTC a single final', () => {
    expect(internationalWindowPlan(2026)).toMatchObject({
      cycleYear: 1,
      kind: 'T20_WORLD_CUP',
      teamCount: 10,
      groupMatches: 4,
    });
    expect(internationalWindowPlan(2027)).toMatchObject({
      cycleYear: 2,
      kind: 'WORLD_TEST_CHAMPIONSHIP',
      teamCount: 2,
      groupMatches: 0,
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
    expect(annualInternationalPlans(2029).map((plan) => plan.kind)).toEqual([
      'BILATERAL',
      'BILATERAL',
      'ODI_WORLD_CUP',
      'WORLD_TEST_CHAMPIONSHIP',
    ]);
  });

  it('schedules tours over domestic months and reserves June-August for marquee events', () => {
    const save = cappedCareerForYear(2026);
    const ids = generateInternationalWindowFixtures(save);
    const fixtures = ids.map((id) => save.fixtures[id]);

    expect(ids).toHaveLength(9);
    expect(fixtures.filter((fixture) => fixture.competitionId?.startsWith('autumn-'))).toHaveLength(
      3,
    );
    expect(
      fixtures.filter((fixture) => fixture.competitionId === 'wtc-test-series-2026'),
    ).toHaveLength(2);
    expect(
      fixtures.filter((fixture) => fixture.competitionId === 't20-world-cup-2026'),
    ).toHaveLength(4);
    expect(fixtures.some((fixture) => fixture.cupRound === 'Semi-Final')).toBe(false);
    expect(fixtures.some((fixture) => fixture.cupRound === 'Final')).toBe(false);
    expect(new Set(fixtures.map((fixture) => fixture.calendarMonth))).toEqual(
      new Set([10, 11, 1, 2, 6, 7]),
    );
    expect(fixtures.every((fixture) => fixture.homeTeamId === 'national-india')).toBe(true);
    expect(fixtures.every((fixture) => save.teams[fixture.awayTeamId].playerIds.length >= 11)).toBe(
      true,
    );
  });

  it('persists format-specific drops when form falls below 40', () => {
    const save = cappedCareerForYear(2028);
    save.players[save.userPlayerId!].meta.form = 39;
    const autumn = annualInternationalPlans(2028)[0];
    const decision = internationalSelectionDecision(save, autumn.id, autumn.format);

    expect(decision.selected).toBe(false);
    expect(decision.reason).toContain('below 40');
    expect(generateInternationalWindowFixtures(save)).toHaveLength(0);
    expect(save.playerCareerResources?.internationalSelections?.[autumn.id]).toEqual(decision);
  });

  it('awards WTC points from bilateral Tests exactly once', () => {
    const save = cappedCareerForYear(2026);
    generateInternationalWindowFixtures(save);
    const tests = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 'wtc-test-series-2026',
    );

    tests[0].played = true;
    tests[0].resultKind = 'HOME_WIN';
    recordWtcFixtureResult(save, tests[0]);
    tests[1].played = true;
    tests[1].resultKind = 'TIE';
    recordWtcFixtureResult(save, tests[1]);
    recordWtcFixtureResult(save, tests[1]);

    const india = wtcStandings(save, 2026).find((row) => row.countryId === 'india');
    expect(india).toMatchObject({ played: 2, won: 1, drawn: 1, points: 16 });
  });

  it('stages only one WTC final after the second season completes', () => {
    const save = cappedCareerForYear(2027);
    const initial = generateInternationalWindowFixtures(save);
    const tests = initial
      .map((id) => save.fixtures[id])
      .filter((fixture) => fixture.competitionId === 'wtc-test-series-2027');

    expect(initial).toHaveLength(5);
    expect(tests).toHaveLength(2);
    for (const fixture of tests) {
      fixture.played = true;
      fixture.resultKind = 'HOME_WIN';
      recordWtcFixtureResult(save, fixture);
    }

    const finals = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 'world-test-championship-2027',
    );
    expect(finals).toHaveLength(1);
    expect(finals[0]).toMatchObject({
      format: 'TEST',
      cupRound: 'Final',
      playoff: true,
    });
    const pointsBefore = wtcStandings(save, 2027).find((row) => row.countryId === 'india')!.points;
    finals[0].played = true;
    finals[0].resultKind = 'HOME_WIN';
    recordWtcFixtureResult(save, finals[0]);
    expect(save.wtcCycles?.['wtc-2026-2027'].championCountryId).toBe('india');
    expect(wtcStandings(save, 2027).find((row) => row.countryId === 'india')?.points).toBe(
      pointsBefore,
    );
  });

  it('removes an unplayed legacy June-August bilateral block during upgrade', () => {
    const save = cappedCareerForYear(2028);
    const legacyId = 'legacy-bilateral-2028';
    save.fixtures[legacyId] = {
      id: legacyId,
      seasonId: save.currentSeasonId!,
      format: 'ODI',
      homeTeamId: 'national-india',
      awayTeamId: 'national-australia',
      venue: 'Legacy bilateral window',
      round: 1,
      played: false,
      competition: 'BILATERAL_SERIES',
      competitionId: 'bilateral-window-2028',
    };
    save.seasons[save.currentSeasonId!].fixtureIds.push(legacyId);

    const yearRoundIds = generateInternationalWindowFixtures(save);

    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 'bilateral-window-2028',
      ),
    ).toHaveLength(0);
    expect(yearRoundIds).toHaveLength(8);
  });

  it('auto-simulates a clashing domestic fixture without the player on national duty', () => {
    const save = makeCareerSave(2_026);
    save.capped = true;
    save.userCaps = 8;
    save.nationalRep = 95;
    save.playerCareerResources!.cappedCountry = 'india';
    save.playerCareerResources!.playerCondition = 100;
    save.playerCareerResources!.internationalSelections = {};
    const user = save.players[save.userPlayerId!];
    user.overall = 92;
    user.meta.form = 90;
    const rosterBefore = [...save.teams[save.userTeamId!].playerIds];
    const statsBefore = JSON.stringify(user.seasonStats);
    generateInternationalWindowFixtures(save);
    const international = Object.values(save.fixtures).find(
      (fixture) =>
        fixture.competitionId?.startsWith('autumn-') &&
        fixture.calendarMonth === 10 &&
        fixture.calendarWeek === 3,
    )!;
    const domestic = Object.values(save.fixtures).find(
      (fixture) =>
        fixture.competitionId === 'list-a' &&
        (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId) &&
        fixture.calendarMonth === international.calendarMonth &&
        fixture.calendarWeek === international.calendarWeek,
    )!;

    expect(resolveNationalDutyConflict(save, international.id)).toBe(domestic.id);
    expect(domestic.played).toBe(true);
    expect(domestic.nationalDutyPlayerIds).toContain(save.userPlayerId);
    expect(save.teams[save.userTeamId!].playerIds).toEqual(rosterBefore);
    expect(JSON.stringify(user.seasonStats)).toBe(statsBefore);
    expect(
      save.playerCalendar?.events.find((item) => item.fixtureId === domestic.id)?.outcome,
    ).toContain('Away on National Duty');
    expect(save.inbox?.some((message) => message.title === 'Away on National Duty')).toBe(true);
  });

  it('is idempotent within a season', () => {
    const save = cappedCareerForYear(2028);
    const first = generateInternationalWindowFixtures(save);
    const second = generateInternationalWindowFixtures(save);

    expect(second).toEqual(first);
    expect(internationalWindowFixtureIds(save)).toHaveLength(8);
  });

  it('creates each World Cup knockout only after its feeder result qualifies the user', () => {
    const save = cappedCareerForYear(2026);
    generateInternationalWindowFixtures(save);
    const group = Object.values(save.fixtures)
      .filter((fixture) => fixture.competitionId === 't20-world-cup-2026')
      .sort((left, right) => left.round - right.round);

    expect(group).toHaveLength(4);
    for (const fixture of group.slice(0, -1)) {
      completeInternationalFixture(save, fixture.id, 'HOME');
      expect(
        Object.values(save.fixtures).some(
          (candidate) =>
            candidate.competitionId === 't20-world-cup-2026' && candidate.cupRound === 'Semi-Final',
        ),
      ).toBe(false);
    }

    const lastGroup = group[group.length - 1];
    completeInternationalFixture(save, lastGroup.id, 'HOME');

    const semiFinal = Object.values(save.fixtures).find(
      (fixture) =>
        fixture.competitionId === 't20-world-cup-2026' && fixture.cupRound === 'Semi-Final',
    )!;
    expect(semiFinal).toBeDefined();
    expect(
      Object.values(save.fixtures).some(
        (fixture) => fixture.competitionId === 't20-world-cup-2026' && fixture.cupRound === 'Final',
      ),
    ).toBe(false);
    expect(save.internationalTournaments?.['t20-world-cup-2026']).toMatchObject({
      stage: 'SEMI_FINAL',
      position: 1,
      semiFinalFixtureId: semiFinal.id,
    });
    expect(
      save.playerCalendar?.events.filter((event) => event.fixtureId === semiFinal.id),
    ).toHaveLength(1);

    completeInternationalFixture(save, semiFinal.id, 'HOME');

    const final = Object.values(save.fixtures).find(
      (fixture) => fixture.competitionId === 't20-world-cup-2026' && fixture.cupRound === 'Final',
    );
    expect(final).toBeDefined();
    expect(save.internationalTournaments?.['t20-world-cup-2026']?.stage).toBe('FINAL');
  });

  it('eliminates a bottom-two group side, grants the exit reward once, and stages no semifinal', () => {
    const save = cappedCareerForYear(2026);
    generateInternationalWindowFixtures(save);
    const group = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 't20-world-cup-2026',
    );
    const reputationBefore = save.nationalRep ?? 0;
    const passXpBefore = save.pass?.xp ?? 0;

    for (const fixture of group) {
      completeInternationalFixture(save, fixture.id, 'AWAY');
    }

    const state = save.internationalTournaments?.['t20-world-cup-2026'];
    expect(state).toMatchObject({
      stage: 'ELIMINATED',
      eliminatedAt: 'GROUP',
    });
    expect(state?.position).toBeGreaterThan(2);
    expect(state?.rewardKeys).toEqual(['group-elimination']);
    expect(save.nationalRep).toBe(reputationBefore + 3);
    expect(save.pass?.xp).toBe(passXpBefore + 150);
    expect(
      Object.values(save.fixtures).some(
        (fixture) =>
          fixture.competitionId === 't20-world-cup-2026' &&
          (fixture.cupRound === 'Semi-Final' || fixture.cupRound === 'Final'),
      ),
    ).toBe(false);
    const exitStory = save.experience?.mediaScrapbook?.find(
      (story) => story.kind === 'ELIMINATION',
    );
    expect(exitStory?.headline).toContain('ELIMINATED FROM T20 WORLD CUP');
    expect(save.experience?.pendingNewspaperId).toBe(exitStory?.id);
  });
});
