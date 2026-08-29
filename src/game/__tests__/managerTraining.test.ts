import { activeManagerClub } from '../managerClubState';
import { advanceManagerCalendar, applyManagerCalendarMatchEffects } from '../managerCalendar';
import {
  processManagerFixtureTraining,
  setManagerPlayerTrainingOverride,
  setManagerTeamTraining,
} from '../managerTraining';
import { runFixture } from '../season';
import { makeManagerSave } from './_depthHelpers';

describe('automatic manager training', () => {
  it('uses the actual resolved XI, recovers the bench and is idempotent per fixture', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(
      (item) =>
        item.managerPhase &&
        (item.homeTeamId === save.userTeamId || item.awayTeamId === save.userTeamId),
    )!;
    const match = runFixture(save, fixture.id);
    const actualIds =
      fixture.homeTeamId === save.userTeamId ? match.homePlayerIds! : match.awayPlayerIds!;
    const participant = save.players[actualIds[0]];
    const benchId = save.teams[save.userTeamId!].playerIds.find((id) => !actualIds.includes(id))!;
    const bench = save.players[benchId];
    participant.condition = 80;
    bench.condition = 80;

    processManagerFixtureTraining(save, fixture, match);
    const participantAfter = participant.condition;
    const benchAfter = bench.condition;
    processManagerFixtureTraining(save, fixture, match);

    expect(actualIds).toHaveLength(11);
    expect(participantAfter).toBeLessThan(benchAfter);
    expect(participant.condition).toBe(participantAfter);
    expect(bench.condition).toBe(benchAfter);
  });

  it('counts down an existing injury exactly once', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(
      (item) =>
        item.managerPhase &&
        (item.homeTeamId === save.userTeamId || item.awayTeamId === save.userTeamId),
    )!;
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.injury = { type: 'Test strain', severity: 'STRAIN', matchesOut: 3 };
    const match = runFixture(save, fixture.id);

    processManagerFixtureTraining(save, fixture, match);
    processManagerFixtureTraining(save, fixture, match);

    expect(player.injury?.matchesOut).toBe(2);
  });

  it('stores club plans but refuses to mutate them during national duty', () => {
    const save = makeManagerSave();
    const playerId = save.teams[save.userTeamId!].playerIds[0];
    expect(setManagerTeamTraining(save, { focus: 'BATTING', intensity: 'HIGH' })).toBe(true);
    expect(setManagerPlayerTrainingOverride(save, playerId, 'RECOVERY')).toBe(true);
    expect(activeManagerClub(save)!.trainingPlan.teamFocus).toBe('BATTING');

    save.managerCareerLevel = 'NATIONAL';
    expect(setManagerTeamTraining(save, { focus: 'BOWLING' })).toBe(false);
    expect(setManagerPlayerTrainingOverride(save, playerId, 'FITNESS')).toBe(false);
    expect(activeManagerClub(save)!.trainingPlan.teamFocus).toBe('BATTING');
    expect(activeManagerClub(save)!.trainingPlan.playerOverrides[playerId]).toBe('RECOVERY');
  });

  it('freezes the retained domestic club while its manager is on national duty', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(
      (item) =>
        item.managerPhase &&
        (item.homeTeamId === save.userTeamId || item.awayTeamId === save.userTeamId),
    )!;
    const match = runFixture(save, fixture.id);
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 63;
    player.injury = { type: 'Test strain', severity: 'STRAIN', matchesOut: 3 };
    const club = activeManagerClub(save)!;
    club.trainingPlan.developmentProgress[player.id] = { 'batting.technique': 0.42 };
    const before = JSON.parse(
      JSON.stringify({
        condition: player.condition,
        injury: player.injury,
        plan: club.trainingPlan,
      }),
    );
    save.managerCareerLevel = 'NATIONAL';

    processManagerFixtureTraining(save, fixture, match);

    // Reaching the offseason while on national duty must not perform the
    // ordinary domestic full-condition reset either.
    save.managerCalendar!.phase = 'T20';
    save.managerCalendar!.phaseStartedAtMonth = 3;
    for (const item of Object.values(save.fixtures)) {
      if (item.managerPhase === 'T20') {
        item.played = true;
        item.resultKind = 'HOME_WIN';
        item.winnerTeamId = item.homeTeamId;
      }
    }
    let guard = 0;
    const currentPhase = () => save.managerCalendar?.phase;
    while (currentPhase() !== 'OFF_SEASON' && guard++ < 8) {
      advanceManagerCalendar(save, (fixtureId) => {
        const pending = save.fixtures[fixtureId];
        pending.played = true;
        pending.resultKind = 'HOME_WIN';
        pending.winnerTeamId = pending.homeTeamId;
      });
    }

    expect(save.managerCalendar?.phase).toBe('OFF_SEASON');
    expect({ condition: player.condition, injury: player.injury, plan: club.trainingPlan }).toEqual(
      before,
    );
  });

  it('judges first-class over rate from the actual match XI rather than the saved XI', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(
      (item) =>
        item.managerPhase === 'FIRST_CLASS' &&
        (item.homeTeamId === save.userTeamId || item.awayTeamId === save.userTeamId),
    )!;
    const team = save.teams[save.userTeamId!];
    const actualIds = team.playerIds.slice(0, 11);
    for (const playerId of actualIds.slice(0, 4)) {
      const player = save.players[playerId];
      player.role = 'BOWLER';
      player.bowlingStyle = 'PACE';
      player.bowling.stamina = 50;
    }
    team.xi = team.playerIds.slice(11, 22);
    const match = runFixture(save, fixture.id);
    if (fixture.homeTeamId === save.userTeamId) match.homePlayerIds = actualIds;
    else match.awayPlayerIds = actualIds;

    applyManagerCalendarMatchEffects(save, fixture, match);

    expect(
      fixture.homeTeamId === save.userTeamId
        ? fixture.homePointsPenalty
        : fixture.awayPointsPenalty,
    ).toBe(1);
  });
});
