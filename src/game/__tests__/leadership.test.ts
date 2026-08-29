import { activeManagerClub } from '../managerClubState';
import {
  activeLeadershipForXI,
  appointManagerLeader,
  ensureManagerLeadership,
  leadershipInitializedFlag,
  leadershipReviewFlag,
} from '../leadership';
import { makeManagerSave } from './_depthHelpers';

describe('manager leadership', () => {
  it('auto-appoints distinct leaders once and asks for review', () => {
    const save = makeManagerSave();
    const selection = ensureManagerLeadership(save);

    expect(selection.captainId).toBeTruthy();
    expect(selection.viceCaptainId).toBeTruthy();
    expect(selection.captainId).not.toBe(selection.viceCaptainId);
    expect(save.flags[leadershipInitializedFlag(save.userTeamId!)]).toBe(true);
    expect(save.flags[leadershipReviewFlag(save.userTeamId!)]).toBe(true);
  });

  it('clears a departed captain without silently promoting another player', () => {
    const save = makeManagerSave();
    ensureManagerLeadership(save);
    const club = activeManagerClub(save)!;
    const departedId = club.captainId!;
    save.teams[save.userTeamId!].playerIds = save.teams[save.userTeamId!].playerIds.filter(
      (id) => id !== departedId,
    );

    const selection = ensureManagerLeadership(save);

    expect(selection.captainId).toBeUndefined();
    expect(selection.autoAssigned).toBe(false);
    expect(save.flags[leadershipReviewFlag(save.userTeamId!)]).toBe(true);
  });

  it('uses the vice in the XI, then a zero-bonus emergency, without changing OVR', () => {
    const save = makeManagerSave();
    ensureManagerLeadership(save);
    const club = activeManagerClub(save)!;
    const overallBefore = Object.fromEntries(
      Object.values(save.players).map((player) => [player.id, player.overall]),
    );

    const viceLeadership = activeLeadershipForXI(save, save.userTeamId!, [club.viceCaptainId!]);
    expect(viceLeadership?.appointedRole).toBe('VICE_CAPTAIN');

    const emergencyId = save.teams[save.userTeamId!].playerIds.find(
      (id) => id !== club.captainId && id !== club.viceCaptainId,
    )!;
    const emergency = activeLeadershipForXI(save, save.userTeamId!, [emergencyId]);
    expect(emergency?.appointedRole).toBe('EMERGENCY');
    expect(emergency?.bonus).toBe(0);
    expect(
      Object.fromEntries(Object.values(save.players).map((player) => [player.id, player.overall])),
    ).toEqual(overallBefore);
  });

  it('rejects club appointments during an unconfigured national-team job', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'NATIONAL';
    const playerId = save.teams[save.userTeamId!].playerIds[0];

    expect(ensureManagerLeadership(save).captainId).toBeUndefined();
    expect(appointManagerLeader(save, 'CAPTAIN', playerId).ok).toBe(false);
  });
});
