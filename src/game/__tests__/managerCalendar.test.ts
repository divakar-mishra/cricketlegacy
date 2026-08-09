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
} from '../managerCalendar';
import { isInternationalFixture, recordWtcFixtureResult } from '../intlCalendar';
import { addCoins, matchReward } from '../economy';

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
    const autumn = internationalFixtures.filter(
      (fixture) => fixture.competitionId === 'autumn-t20-tour-2026',
    );
    const winter = internationalFixtures.filter(
      (fixture) => fixture.competitionId === 'wtc-test-series-2026',
    );
    const nationalFixtures = internationalFixtures.filter(
      (fixture) => fixture.competitionId === 't20-world-cup-2026',
    );

    expect(internationalFixtures).toHaveLength(9);
    expect(autumn).toHaveLength(3);
    expect(autumn.every((fixture) => fixture.managerPhase === 'LIST_A')).toBe(true);
    expect(winter).toHaveLength(2);
    expect(winter.every((fixture) => fixture.managerPhase === 'FIRST_CLASS')).toBe(true);
    expect(nationalFixtures).toHaveLength(4);
    expect(nationalFixtures.every((fixture) => fixture.format === 'T20')).toBe(true);
    expect(nationalFixtures.every((fixture) => fixture.cupRound?.startsWith('Group Stage'))).toBe(
      true,
    );
    expect(managerControlledTeamId(save, 'LIST_A')).toBe(save.managerNationalTeamId);
    expect(managerControlledTeamId(save, 'FIRST_CLASS')).toBe(save.managerNationalTeamId);
    expect(managerControlledTeamId(save, 'OFF_SEASON')).toBe(save.managerNationalTeamId);
    expect(nextUserFixtureId(save)).toBe(autumn[0].id);

    save.managerCalendar!.phase = 'OFF_SEASON';
    save.managerCalendar!.phaseStartedAtMonth = 6;
    save.managerCalendar!.offSeasonPrepared = true;
    expect(nextUserFixtureId(save)).toBe(nationalFixtures[0].id);
    expect(seasonComplete(save)).toBe(false);
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
      (fixture) => fixture.competitionId === 'wtc-test-series-2027',
    );
    expect(tests).toHaveLength(2);
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

    expect(processManagerSalary(save, 2026)).toBe(5_000);
    expect(processManagerSalary(save, 2026)).toBe(0);
    expect(save.wallet.coins).toBe(5_000);
    expect(save.managerProgression).toMatchObject({
      lastSalaryPaidYear: 2026,
      lastSalaryCoinPayout: 5_000,
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
      Math.floor((standardResult.summary?.userMatches ?? 0) * 320 * MANAGER_BACKGROUND_REWARD_RATE),
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
          save.wallet = addCoins(save.wallet, matchReward(won, tied));
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
