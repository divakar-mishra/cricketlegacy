import { createManagerSave } from '../createGame';
import {
  advanceManagerCalendarPhase,
  applyResult,
  nextUserFixtureId,
  runFixture,
  seasonComplete,
} from '../season';
import {
  buildManagerSeasonCalendar,
  managerPhaseProgress,
  managerPhaseUnlocked,
} from '../managerCalendar';

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

  it('unlocks formats by rank and creates a national off-season tour at level four', () => {
    expect(managerPhaseUnlocked('CLUB', 'LIST_A')).toBe(false);
    expect(managerPhaseUnlocked('STATE', 'LIST_A')).toBe(true);
    expect(managerPhaseUnlocked('STATE', 'FIRST_CLASS')).toBe(false);
    expect(managerPhaseUnlocked('ELITE', 'FIRST_CLASS')).toBe(true);

    const save = makeSave(734);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026);
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.managerCalendar!.phaseStartedAtMonth = 6;
    save.managerCalendar!.offSeasonPrepared = true;
    const nationalFixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competition === 'INTL_TOURNAMENT',
    );

    expect(nationalFixtures).toHaveLength(6);
    expect(nationalFixtures.every((fixture) => fixture.format === 'T20')).toBe(true);
    expect(nationalFixtures.map((fixture) => fixture.cupRound)).toContain('Semi-Final');
    expect(nationalFixtures.map((fixture) => fixture.cupRound)).toContain('Final');
    expect(nextUserFixtureId(save)).toBe(nationalFixtures[0].id);
    expect(seasonComplete(save)).toBe(false);
  });

  it('gives national managers the complete World Test Championship in year two', () => {
    const save = makeSave(735);
    const season = save.seasons[save.currentSeasonId!];
    season.year = 2027;
    save.managerCareerLevel = 'NATIONAL';

    buildManagerSeasonCalendar(save, 2027);

    const nationalFixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 'world-test-championship-2027',
    );
    expect(nationalFixtures).toHaveLength(8);
    expect(nationalFixtures.every((fixture) => fixture.format === 'TEST')).toBe(true);
    expect(nationalFixtures.every((fixture) => fixture.competition === 'INTL_TOURNAMENT')).toBe(
      true,
    );
    expect(nationalFixtures.filter((fixture) => fixture.cupRound === 'Final')).toHaveLength(1);
    expect(nationalFixtures.filter((fixture) => fixture.cupRound === 'Semi-Final')).toHaveLength(0);
  });
});
