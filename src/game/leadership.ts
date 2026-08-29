import { ManagerClubState, Player, SaveGame } from '../domain/types';
import { clamp } from '../utils/math';
import {
  activeManagerClub,
  createManagerClubState,
  persistActiveManagerClub,
} from './managerClubState';

export type ManagerLeadershipRole = 'CAPTAIN' | 'VICE_CAPTAIN';

export interface ManagerLeadershipSelection {
  captainId?: string;
  viceCaptainId?: string;
  autoAssigned: boolean;
}

export interface ActiveLeadership {
  captainId: string;
  appointedRole: 'CAPTAIN' | 'VICE_CAPTAIN' | 'EMERGENCY';
  score: number;
  bonus: number;
  viceSupport: boolean;
}

export function leadershipReviewFlag(teamId: string): string {
  return `managerLeadershipReview:${teamId}`;
}

export function leadershipInitializedFlag(teamId: string): string {
  return `managerLeadershipInitialized:${teamId}`;
}

function clubState(save: SaveGame, teamId: string): ManagerClubState | undefined {
  const team = save.teams[teamId];
  if (save.mode !== 'manager' || !team || team.isNationalTeam) return undefined;
  if (teamId === save.userTeamId) {
    persistActiveManagerClub(save);
    return activeManagerClub(save);
  }
  save.managerClubs ??= {};
  save.managerClubs[teamId] ??= createManagerClubState(save, teamId);
  return save.managerClubs[teamId];
}

/** Leadership is derived from attributes the player already owns; it is not a hidden OVR boost. */
export function leadershipScore(player: Player): number {
  const matches = Math.max(0, player.careerStats?.matches ?? 0);
  const experience = clamp(
    35 + Math.min(matches, 150) * 0.3 + Math.max(0, player.age - 20) * 1.2,
    35,
    95,
  );
  return Math.round(
    clamp(
      player.meta.discipline * 0.35 +
        player.batting.temperament * 0.25 +
        player.meta.confidence * 0.2 +
        experience * 0.2,
      1,
      99,
    ),
  );
}

export function leadershipBonusForScore(score: number): number {
  if (score >= 85) return 0.015;
  if (score >= 70) return 0.01;
  if (score >= 55) return 0.005;
  return 0;
}

function leadershipCandidates(save: SaveGame, teamId: string): Player[] {
  return (save.teams[teamId]?.playerIds ?? [])
    .map((playerId) => save.players[playerId])
    .filter((player): player is Player => Boolean(player) && !player.retired)
    .sort(
      (left, right) =>
        leadershipScore(right) - leadershipScore(left) ||
        right.age - left.age ||
        right.overall - left.overall ||
        left.id.localeCompare(right.id),
    );
}

/**
 * Keep appointments valid and provide sensible first-save defaults. Any automatic
 * change raises a review flag so the manager is asked to confirm the choice.
 */
export function ensureManagerLeadership(
  save: SaveGame,
  teamId = save.userTeamId,
): ManagerLeadershipSelection {
  if (!teamId) return { autoAssigned: false };
  if (teamId === save.userTeamId && save.managerCareerLevel === 'NATIONAL') {
    return { autoAssigned: false };
  }
  const state = clubState(save, teamId);
  if (!state) return { autoAssigned: false };
  const candidates = leadershipCandidates(save, teamId);
  const squadIds = new Set(candidates.map((player) => player.id));
  const initializedFlag = leadershipInitializedFlag(teamId);
  const initialized = Boolean(save.flags?.[initializedFlag]);
  let changed = false;
  let autoAssigned = false;

  if (!initialized) {
    if (!state.captainId || !squadIds.has(state.captainId)) {
      state.captainId = candidates[0]?.id;
      changed = Boolean(state.captainId);
      autoAssigned = Boolean(state.captainId);
    }
    if (
      !state.viceCaptainId ||
      !squadIds.has(state.viceCaptainId) ||
      state.viceCaptainId === state.captainId
    ) {
      state.viceCaptainId = candidates.find((player) => player.id !== state.captainId)?.id;
      changed = changed || Boolean(state.viceCaptainId);
      autoAssigned = autoAssigned || Boolean(state.viceCaptainId);
    }
    save.flags = { ...(save.flags ?? {}), [initializedFlag]: true };
  } else {
    if (state.captainId && !squadIds.has(state.captainId)) {
      state.captainId = undefined;
      changed = true;
    }
    if (
      state.viceCaptainId &&
      (!squadIds.has(state.viceCaptainId) || state.viceCaptainId === state.captainId)
    ) {
      state.viceCaptainId = undefined;
      changed = true;
    }
  }

  if (changed && teamId === save.userTeamId) {
    save.flags = { ...(save.flags ?? {}), [leadershipReviewFlag(teamId)]: true };
  }
  return {
    captainId: state.captainId,
    viceCaptainId: state.viceCaptainId,
    autoAssigned,
  };
}

export function appointManagerLeader(
  save: SaveGame,
  role: ManagerLeadershipRole,
  playerId: string,
): { ok: boolean; reason?: string } {
  const teamId = save.userTeamId;
  if (!teamId || save.mode !== 'manager') return { ok: false, reason: 'No managed club.' };
  if (save.managerCareerLevel === 'NATIONAL') {
    return { ok: false, reason: 'National-team leadership is not available yet.' };
  }
  const team = save.teams[teamId];
  if (
    !team?.playerIds.includes(playerId) ||
    !save.players[playerId] ||
    save.players[playerId].retired
  ) {
    return { ok: false, reason: 'Choose a current senior-squad player.' };
  }
  const state = clubState(save, teamId);
  if (!state) return { ok: false, reason: 'Club leadership is unavailable.' };

  if (role === 'CAPTAIN') {
    if (state.viceCaptainId === playerId) state.viceCaptainId = state.captainId;
    state.captainId = playerId;
  } else {
    if (state.captainId === playerId) state.captainId = state.viceCaptainId;
    state.viceCaptainId = playerId;
  }
  if (state.captainId === state.viceCaptainId) {
    state.viceCaptainId = undefined;
  }
  save.flags = {
    ...(save.flags ?? {}),
    [leadershipInitializedFlag(teamId)]: true,
    [leadershipReviewFlag(teamId)]: !(state.captainId && state.viceCaptainId),
  };
  return { ok: true };
}

/** Match-only pressure bonus. The returned value never changes stored attributes or OVR. */
export function activeLeadershipForXI(
  save: SaveGame,
  teamId: string,
  xiIds: string[],
): ActiveLeadership | undefined {
  ensureManagerLeadership(save, teamId);
  const state = clubState(save, teamId);
  if (!state) return undefined;
  const inXI = new Set(xiIds);
  const fitInXI = (playerId?: string): Player | undefined => {
    if (!playerId || !inXI.has(playerId)) return undefined;
    const player = save.players[playerId];
    return player && !player.injury ? player : undefined;
  };
  const captain = fitInXI(state.captainId);
  const vice = fitInXI(state.viceCaptainId);
  if (captain) {
    const score = leadershipScore(captain);
    const viceSupport = Boolean(vice && leadershipScore(vice) >= 70);
    return {
      captainId: captain.id,
      appointedRole: 'CAPTAIN',
      score,
      bonus: Math.min(0.0175, leadershipBonusForScore(score) + (viceSupport ? 0.0025 : 0)),
      viceSupport,
    };
  }
  if (vice) {
    const score = leadershipScore(vice);
    return {
      captainId: vice.id,
      appointedRole: 'VICE_CAPTAIN',
      score,
      bonus: leadershipBonusForScore(score),
      viceSupport: false,
    };
  }
  const emergency = xiIds
    .map((playerId) => save.players[playerId])
    .filter((player): player is Player => Boolean(player) && !player.injury)
    .sort((left, right) => leadershipScore(right) - leadershipScore(left))[0];
  return emergency
    ? {
        captainId: emergency.id,
        appointedRole: 'EMERGENCY',
        score: leadershipScore(emergency),
        bonus: 0,
        viceSupport: false,
      }
    : undefined;
}
