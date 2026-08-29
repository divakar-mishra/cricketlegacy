import { createManagerSave } from '../createGame';
import {
  advanceManagerCalendarPhase,
  applyResult,
  nextUserFixtureId,
  runFixture,
  seasonComplete,
  startNewSeason,
} from '../season';
import {
  buildManagerSeasonCalendar,
  managerControlledTeamId,
  managerPhaseProgress,
  managerPhaseUnlocked,
  MANAGER_BACKGROUND_REWARD_RATE,
  processManagerSalary,
  refreshManagerNationalTeams,
} from '../managerCalendar';
import { isInternationalFixture, recordWtcFixtureResult } from '../intlCalendar';
import { addCoins, matchReward } from '../economy';
import { nationalReplacementQualityFloor } from '../nationalTalent';
import { getCountry } from '../../data/countries';

function makeSave(seed = 731) {
  const save = createManagerSave({
    teamId: 'mumbai_sharks',
    country: 'india',
    difficulty: 'NORMAL',
    seed,
  });
  save.id = `manager-calendar-${seed}`;
  return save;
}

describe('manager domestic calendar', () => {
  it('creates a 24-club, three-tier world with workload-sized squads', () => {
    const save = makeSave();
    const domesticTeams = Object.values(save.teams).filter((team) => !team.isNationalTeam);

    expect(domesticTeams).toHaveLength(24);
    expect(save.divisions?.tier1).toHaveLength(8);
    expect(save.divisions?.tier2).toHaveLength(8);
    expect(save.divisions?.tier3).toHaveLength(8);
    expect(save.userDivision).toBe(3);
    expect(save.managerCareerLevel).toBe('CLUB');
    for (const team of domesticTeams) expect(team.playerIds).toHaveLength(22);
  });

  it('schedules every division through the exact three-format structure', () => {
    const save = makeSave(732);
    const regular = Object.values(save.fixtures).filter((fixture) => !fixture.playoff);
    const listA = regular.filter((fixture) => fixture.managerPhase === 'LIST_A');
    const firstClass = regular.filter((fixture) => fixture.managerPhase === 'FIRST_CLASS');
    const t20 = regular.filter((fixture) => fixture.managerPhase === 'T20');

    expect(listA).toHaveLength(84);
    expect(firstClass).toHaveLength(84);
    expect(t20).toHaveLength(168);
    for (const tier of [1, 2, 3]) {
      expect(listA.filter((fixture) => fixture.divisionTier === tier)).toHaveLength(28);
      expect(firstClass.filter((fixture) => fixture.divisionTier === tier)).toHaveLength(28);
      expect(t20.filter((fixture) => fixture.divisionTier === tier)).toHaveLength(56);
    }
    const userT20 = t20.filter(
      (fixture) => fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId,
    );
    expect(userT20).toHaveLength(14);
  });

  it('simulates locked blocks, stops at playable T20 fixtures, and reaches the off-season', () => {
    const save = makeSave(733);
    buildManagerSeasonCalendar(save, 2026, 'LIST_A');
    expect(managerPhaseProgress(save)).toMatchObject({
      phase: 'LIST_A',
      unlocked: false,
    });

    const listAResult = advanceManagerCalendarPhase(save);
    expect(listAResult.kind).toBe('PHASE_ADVANCED');
    expect(listAResult.summary?.phase).toBe('LIST_A');
    expect(save.managerCalendar?.phase).toBe('FIRST_CLASS');

    const firstClassResult = advanceManagerCalendarPhase(save);
    expect(firstClassResult.kind).toBe('PHASE_ADVANCED');
    expect(firstClassResult.summary?.phase).toBe('FIRST_CLASS');
    expect(save.managerCalendar?.phase).toBe('T20');
    expect(nextUserFixtureId(save)).toBeDefined();

    let guard = 0;
    while (save.managerCalendar?.phase === 'T20' && guard++ < 40) {
      const fixtureId = nextUserFixtureId(save);
      if (fixtureId) {
        applyResult(save, runFixture(save, fixtureId));
      } else {
        advanceManagerCalendarPhase(save);
      }
    }

    expect(save.managerCalendar?.phase).toBe('OFF_SEASON');
    expect(seasonComplete(save)).toBe(true);
    expect(
      save.teams[save.userTeamId!].playerIds.every(
        (playerId) => save.players[playerId].condition === 100,
      ),
    ).toBe(true);
  }, 30_000);

  it('gives a national coach year-round tours and creates only World Cup group fixtures upfront', () => {
    expect(managerPhaseUnlocked('CLUB', 'LIST_A')).toBe(false);
    expect(managerPhaseUnlocked('STATE', 'LIST_A')).toBe(true);
    expect(managerPhaseUnlocked('STATE', 'FIRST_CLASS')).toBe(false);
    expect(managerPhaseUnlocked('ELITE', 'FIRST_CLASS')).toBe(true);

    const save = makeSave(734);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026);
    const internationalFixtures = Object.values(save.fixtures).filter((fixture) =>
      isInternationalFixture(fixture),
    );
    const tests = internationalFixtures.filter((fixture) => fixture.format === 'TEST');
    const odis = internationalFixtures.filter((fixture) => fixture.format === 'ODI');
    const t20is = internationalFixtures.filter((fixture) => fixture.format === 'T20');
    const nationalFixtures = internationalFixtures.filter(
      (fixture) => fixture.competitionId === 't20-world-cup-2026',
    );

    expect(internationalFixtures).toHaveLength(48);
    expect(tests).toHaveLength(10);
    expect(tests.every((fixture) => fixture.managerPhase === 'FIRST_CLASS')).toBe(true);
    expect(odis).toHaveLength(25);
    expect(odis.every((fixture) => fixture.managerPhase === 'LIST_A')).toBe(true);
    expect(t20is).toHaveLength(13);
    expect(t20is.every((fixture) => fixture.managerPhase === 'T20')).toBe(true);
    expect(internationalFixtures.every((fixture) => fixture.calendarMonth !== 4)).toBe(true);
    expect(internationalFixtures.every((fixture) => fixture.calendarMonth !== 5)).toBe(true);
    expect(nationalFixtures).toHaveLength(4);
    expect(nationalFixtures.every((fixture) => fixture.format === 'T20')).toBe(true);
    expect(nationalFixtures.every((fixture) => fixture.cupRound?.startsWith('Group Stage'))).toBe(
      true,
    );
    expect(managerControlledTeamId(save, 'LIST_A')).toBe(save.managerNationalTeamId);
    expect(managerControlledTeamId(save, 'FIRST_CLASS')).toBe(save.managerNationalTeamId);
    expect(managerControlledTeamId(save, 'OFF_SEASON')).toBe(save.managerNationalTeamId);
    expect(save.fixtures[nextUserFixtureId(save)!].format).toBe('ODI');

    save.managerCalendar!.phase = 'T20';
    save.managerCalendar!.phaseStartedAtMonth = 3;
    expect(save.fixtures[nextUserFixtureId(save)!].format).toBe('T20');
    expect(seasonComplete(save)).toBe(false);
  });

  it('keeps free agents eligible when refreshing smaller national squads', () => {
    const save = makeSave(7341);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026);
    const usa = save.teams['national-usa'];
    expect(usa.playerIds.length).toBeGreaterThanOrEqual(11);
    const usaPool = Object.values(save.players)
      .filter((player) => player.nationality === 'usa')
      .map((player) => player.id);
    save.freeAgents = [...new Set([...(save.freeAgents ?? []), ...usaPool.slice(1)])];
    for (const playerId of usaPool.slice(1)) save.players[playerId].age = 41;
    usa.playerIds = usa.playerIds.slice(0, 1);

    refreshManagerNationalTeams(save);

    expect(usa.playerIds.length).toBeGreaterThanOrEqual(11);
    expect(usa.xi).toHaveLength(11);
    expect(usa.playerIds.every((playerId) => save.players[playerId].age < 40)).toBe(true);
    const averageOverall =
      usa.xi!.reduce((sum, playerId) => sum + save.players[playerId].overall, 0) / usa.xi!.length;
    expect(averageOverall).toBeGreaterThanOrEqual(nationalReplacementQualityFloor('usa'));
  });

  it('gives peer nations comparable senior talent instead of a host-country depth monopoly', () => {
    const save = makeSave(7342);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026);
    const xiAverage = (teamId: string) => {
      const team = save.teams[teamId];
      const xi = team.xi?.length ? team.xi : team.playerIds.slice(0, 11);
      return xi.reduce((sum, playerId) => sum + save.players[playerId].overall, 0) / xi.length;
    };

    const india = xiAverage('national-india');
    const australia = xiAverage('national-australia');
    const england = xiAverage('national-england');

    expect(australia).toBeGreaterThanOrEqual(nationalReplacementQualityFloor('australia'));
    expect(england).toBeGreaterThanOrEqual(nationalReplacementQualityFloor('england'));
    expect(Math.abs(india - australia)).toBeLessThanOrEqual(5);
    expect(Math.abs(india - england)).toBeLessThanOrEqual(5);
  });

  it('refreshes peer opponents to match a late-career National Manager generation', () => {
    const save = makeSave(7343);
    for (const player of Object.values(save.players)) {
      if (player.nationality === 'india') player.overall = 99;
    }
    save.managerCareerLevel = 'NATIONAL';

    buildManagerSeasonCalendar(save, 2026);

    const fixtures = Object.values(save.fixtures).filter((fixture) =>
      isInternationalFixture(fixture),
    );
    const opponentCountries = fixtures.map((fixture) => save.teams[fixture.awayTeamId].country);
    expect(
      opponentCountries.filter((country) => (getCountry(country)?.strength ?? 0) < 4),
    ).toHaveLength(2);
    expect(
      fixtures
        .filter((fixture) => fixture.competitionId === 't20-world-cup-2026')
        .every(
          (fixture) => (getCountry(save.teams[fixture.awayTeamId].country)?.strength ?? 0) >= 4,
        ),
    ).toBe(true);
    const australia = save.teams['national-australia'];
    const australiaAverage =
      australia.xi!.reduce((sum, playerId) => sum + save.players[playerId].overall, 0) /
      australia.xi!.length;
    const india = save.teams['national-india'];
    const indiaAverage =
      india.xi!.reduce((sum, playerId) => sum + save.players[playerId].overall, 0) /
      india.xi!.length;
    expect(Math.abs(indiaAverage - australiaAverage)).toBeLessThanOrEqual(1);
  });

  it('uses the save identity for background international tournament worlds', () => {
    const first = makeSave(7344);
    const second = makeSave(7345);
    first.managerCareerLevel = 'NATIONAL';
    second.managerCareerLevel = 'NATIONAL';

    buildManagerSeasonCalendar(first, 2026);
    buildManagerSeasonCalendar(second, 2026);

    const tiebreaks = (save: typeof first) =>
      Object.values(save.internationalTournaments?.['t20-world-cup-2026']?.standings ?? {})
        .sort((left, right) => left.countryId.localeCompare(right.countryId))
        .map((row) => row.tiebreak);
    expect(tiebreaks(first)).not.toEqual(tiebreaks(second));
  });

  it('stages the national manager WTC Final only after the second-season Tests finish', () => {
    const save = makeSave(735);
    const season = save.seasons[save.currentSeasonId!];
    season.year = 2027;
    save.managerCareerLevel = 'NATIONAL';

    buildManagerSeasonCalendar(save, 2027);

    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 'world-test-championship-2027',
      ),
    ).toHaveLength(0);
    const tests = Object.values(save.fixtures).filter(
      (fixture) => fixture.wtcCycleId && fixture.competition === 'BILATERAL_SERIES',
    );
    expect(tests).toHaveLength(9);
    for (const fixture of tests) {
      fixture.played = true;
      fixture.resultKind = 'HOME_WIN';
      fixture.winnerTeamId = fixture.homeTeamId;
      recordWtcFixtureResult(save, fixture);
    }

    const nationalFixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 'world-test-championship-2027',
    );
    expect(nationalFixtures).toHaveLength(1);
    expect(nationalFixtures.every((fixture) => fixture.format === 'TEST')).toBe(true);
    expect(nationalFixtures.every((fixture) => fixture.competition === 'INTL_TOURNAMENT')).toBe(
      true,
    );
    expect(nationalFixtures.filter((fixture) => fixture.cupRound === 'Final')).toHaveLength(1);
    expect(nationalFixtures.filter((fixture) => fixture.cupRound === 'Semi-Final')).toHaveLength(0);
  });

  it('pays a manager contract into the personal wallet once per season', () => {
    const save = makeSave(736);
    save.wallet.coins = 0;
    save.managerProgression!.contractSalary = 1_000_000;

    expect(processManagerSalary(save, 2026)).toBe(2_500);
    expect(processManagerSalary(save, 2026)).toBe(0);
    expect(save.wallet.coins).toBe(2_500);
    expect(save.managerProgression).toMatchObject({
      lastSalaryPaidYear: 2026,
      lastSalaryCoinPayout: 2_500,
    });
    expect(save.inbox?.filter((message) => message.id === 'manager-salary-2026')).toHaveLength(1);
  });

  it('applies VIP coin rewards to locked background blocks', () => {
    const standard = makeSave(737);
    const vip = makeSave(737);
    buildManagerSeasonCalendar(standard, 2026, 'LIST_A');
    buildManagerSeasonCalendar(vip, 2026, 'LIST_A');
    standard.wallet.coins = 0;
    vip.wallet.coins = 0;
    vip.entitlements.removeAds = true;

    const standardResult = advanceManagerCalendarPhase(standard);
    const vipResult = advanceManagerCalendarPhase(vip);

    expect(standardResult.summary?.walletCoins).toBeGreaterThan(0);
    expect(standardResult.summary?.walletCoins).toBeLessThanOrEqual(
      Math.floor((standardResult.summary?.userMatches ?? 0) * 160 * MANAGER_BACKGROUND_REWARD_RATE),
    );
    expect(vipResult.summary?.walletCoins).toBeGreaterThan(
      standardResult.summary?.walletCoins ?? 0,
    );
    expect(vip.wallet.coins).toBe(vipResult.summary?.walletCoins);
  });

  it('starts a new rookie appointment directly in the March T20 block', () => {
    const save = makeSave(739);
    expect(save.managerCalendar?.phase).toBe('T20');
    expect(save.currentMonth).toBe(3);
    expect(nextUserFixtureId(save)).toBeDefined();
  });

  it('keeps three no-spend Rookie seasons within a bounded wallet-income range', () => {
    const save = makeSave(738);
    save.wallet.coins = 0;
    const annualIncome: number[] = [];

    for (let seasonIndex = 0; seasonIndex < 3; seasonIndex += 1) {
      const openingCoins = save.wallet.coins;
      let guard = 0;
      while (save.managerCalendar?.phase !== 'OFF_SEASON' && guard++ < 100) {
        const fixtureId = nextUserFixtureId(save);
        if (fixtureId) {
          const match = runFixture(save, fixtureId);
          applyResult(save, match);
          const won = match.result?.winnerTeamId === save.userTeamId;
          const tied = Boolean(match.result?.tie);
          save.wallet = addCoins(save.wallet, matchReward(won, tied, undefined, 'MANAGER'));
        } else {
          advanceManagerCalendarPhase(save);
        }
      }
      expect(guard).toBeLessThan(100);
      expect(save.managerCalendar?.phase).toBe('OFF_SEASON');
      annualIncome.push(save.wallet.coins - openingCoins);
      if (seasonIndex < 2) startNewSeason(save);
    }

    expect(annualIncome.every((coins) => coins > 0 && coins < 15_000)).toBe(true);
    expect(annualIncome.reduce((sum, coins) => sum + coins, 0)).toBeLessThan(40_000);
  }, 60_000);
});
