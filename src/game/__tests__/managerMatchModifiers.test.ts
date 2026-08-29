import {
  applyManagerPreparationToLiveMatch,
  createLiveMatch,
  nextUserFixtureId,
  prepareManagerPlayerForMatch,
} from '../season';
import { ensureNationalTeam } from '../intlCalendar';
import { buildManagerSeasonCalendar } from '../managerCalendar';
import { makeManagerSave } from './_depthHelpers';

describe('manager match modifiers', () => {
  it('applies the continuous condition and morale curve without mutating the save', () => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 40;
    player.morale = 40;
    const technique = player.batting.technique;

    const prepared = prepareManagerPlayerForMatch(save, player, true, false);

    const readiness = (1 - (70 - 40) * 0.003) * (1 + (40 - 50) * 0.001);
    expect(prepared.batting.technique).toBe(Math.round(technique * readiness));
    expect(player.batting.technique).toBe(technique);
  });

  it('does not add a hidden preparation lift after independent morale readiness', () => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 100;
    player.morale = 80;
    const technique = player.batting.technique;

    const prepared = prepareManagerPlayerForMatch(save, player, true, true);

    expect(prepared.batting.technique).toBe(Math.min(99, Math.round(technique * 1.03)));
    expect(player.batting.technique).toBe(technique);
  });

  it('refreshes the current live fixture from save without inventing or stacking a lift', () => {
    const save = makeManagerSave();
    const fixtureId = nextUserFixtureId(save)!;
    const team = save.teams[save.userTeamId!];
    const player = save.players[(team.xi?.length ? team.xi : team.playerIds)[0]];
    player.condition = 100;
    player.morale = 80;
    const permanentTechnique = player.batting.technique;
    const live = createLiveMatch(save, fixtureId);

    // MatchScreen resolves the toss and peeks at the opening pair before the
    // manager confirms preparation.
    expect(live.setTossCall(live.tossDecision.coinFace)).toBe(true);
    expect(live.setTossChoice('BOWL')).toBe(true);
    live.peek();
    const tossBeforePreparation = { ...live.tossDecision };

    // Model Match Analysis changing the save after LiveMatch was constructed.
    player.meta.form += 2;
    player.morale += 1;
    const permanentForm = player.meta.form;
    const permanentMorale = player.morale;
    save.flags = { ...(save.flags ?? {}), [`tactics:${fixtureId}`]: true };

    const replace = jest.spyOn(live, 'replaceControlledTeamBeforeStart');
    expect(applyManagerPreparationToLiveMatch(save, fixtureId, live)).toBe(true);
    expect(live.tossDecision).toEqual(tossBeforePreparation);

    const firstPreparedSide = replace.mock.calls[0][0];
    const firstPreparedPlayer = firstPreparedSide.players.find((item) => item.id === player.id)!;
    expect(firstPreparedPlayer.batting.technique).toBe(
      Math.min(99, Math.round(permanentTechnique * 1.03)),
    );
    expect(firstPreparedPlayer.meta.form).toBe(
      Math.min(99, Math.round(permanentForm * 1.03)),
    );
    expect(firstPreparedPlayer.morale).toBe(permanentMorale);

    // A repeated call replaces from the permanent save again; it never scales
    // the already-prepared LiveMatch side.
    expect(applyManagerPreparationToLiveMatch(save, fixtureId, live)).toBe(true);
    const secondPreparedSide = replace.mock.calls[1][0];
    const secondPreparedPlayer = secondPreparedSide.players.find((item) => item.id === player.id)!;
    expect(secondPreparedPlayer.batting.technique).toBe(firstPreparedPlayer.batting.technique);
    expect(secondPreparedPlayer.meta.form).toBe(firstPreparedPlayer.meta.form);
    expect(live.tossDecision).toEqual(tossBeforePreparation);

    expect(player.batting.technique).toBe(permanentTechnique);
    expect(player.meta.form).toBe(permanentForm);
    expect(player.morale).toBe(permanentMorale);
  });

  it('uses the same condition and morale readiness curve for the AI side', () => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 52;
    player.morale = 65;

    const userSnapshot = prepareManagerPlayerForMatch(save, player, true, false);
    const aiSnapshot = prepareManagerPlayerForMatch(save, player, false, false);

    expect(aiSnapshot.batting).toEqual(userSnapshot.batting);
    expect(aiSnapshot.bowling).toEqual(userSnapshot.bowling);
    expect(aiSnapshot.overall).toBe(userSnapshot.overall);
  });

  it('rejects preparation for another fixture or after the first delivery', () => {
    const save = makeManagerSave();
    const fixtureId = nextUserFixtureId(save)!;
    const live = createLiveMatch(save, fixtureId);
    save.flags = { ...(save.flags ?? {}), [`tactics:${fixtureId}`]: true };

    const anotherFixtureId = Object.keys(save.fixtures).find((id) => id !== fixtureId)!;
    expect(applyManagerPreparationToLiveMatch(save, anotherFixtureId, live)).toBe(false);

    for (let attempt = 0; attempt < 12 && live.scoreState.legalBalls === 0; attempt += 1) {
      live.nextBall();
    }
    expect(live.scoreState.legalBalls).toBeGreaterThan(0);
    expect(applyManagerPreparationToLiveMatch(save, fixtureId, live)).toBe(false);
  });

  it('uses the live controlled team for a national manager fixture', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'NATIONAL';
    save.managerNationalTeamId = ensureNationalTeam(save, 'india');
    buildManagerSeasonCalendar(save, 2026);
    const fixture = Object.values(save.fixtures).find(
      (candidate) =>
        !candidate.played &&
        (candidate.homeTeamId === save.managerNationalTeamId ||
          candidate.awayTeamId === save.managerNationalTeamId),
    )!;
    const live = createLiveMatch(save, fixture.id);
    save.flags = { ...(save.flags ?? {}), [`tactics:${fixture.id}`]: true };

    expect(live.controlledTeamId).toBe(save.managerNationalTeamId);
    expect(applyManagerPreparationToLiveMatch(save, fixture.id, live)).toBe(true);
  });
});
