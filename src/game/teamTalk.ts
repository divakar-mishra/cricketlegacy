/** One-to-one player conversations for the manager man-management loop. */
import { SaveGame } from '../domain/types';
import { clamp } from '../utils/math';

/** Move a value a fraction of the way toward a target (diminishing returns). */
function nudge(cur: number, target: number, frac: number): number {
  return clamp(Math.round(cur + (target - cur) * frac), 1, 99);
}

export interface TalkResult {
  ok: boolean;
  text: string;
}

export type PlayerTalkKind = 'PRAISE' | 'WARN' | 'CHALLENGE' | 'REST';

/** Cooldown in match-days between conversations with the same player. */
const TALK_COOLDOWN_DAYS = 3;

export function talkToPlayer(save: SaveGame, playerId: string, kind: PlayerTalkKind): TalkResult {
  const player = save.players[playerId];
  if (!player) return { ok: false, text: 'Unknown player.' };

  const teamId =
    save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL' && save.managerNationalTeamId
      ? save.managerNationalTeamId
      : save.userTeamId;
  const matchesPlayed = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.played && (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
  ).length;
  if (
    (player.lastTalkDay ?? -TALK_COOLDOWN_DAYS) + TALK_COOLDOWN_DAYS >
    matchesPlayed
  ) {
    return {
      ok: false,
      text: `${player.name} needs more time before you speak to them again.`,
    };
  }

  player.lastTalkDay = matchesPlayed;

  switch (kind) {
    case 'PRAISE':
      player.meta.form = nudge(player.meta.form, 80, 0.22);
      player.morale = nudge(player.morale ?? 60, 85, 0.3);
      return { ok: true, text: `${player.name} appreciates the vote of confidence.` };

    case 'CHALLENGE':
      if (player.meta.confidence >= 60) {
        player.meta.form = nudge(player.meta.form, 78, 0.25);
        player.morale = nudge(player.morale ?? 60, 72, 0.2);
        return { ok: true, text: `${player.name} rises to the challenge.` };
      }
      player.morale = nudge(player.morale ?? 60, 50, 0.2);
      return { ok: true, text: `The pressure weighs on ${player.name}.` };

    case 'REST':
      player.morale = nudge(player.morale ?? 60, 90, 0.35);
      player.meta.fitness = clamp(player.meta.fitness + 5, 1, 99);
      return { ok: true, text: `${player.name} is grateful for the rest and feels recharged.` };

    case 'WARN':
    default:
      player.meta.form =
        player.meta.form < 50
          ? nudge(player.meta.form, 66, 0.3)
          : nudge(player.meta.form, 52, 0.15);
      player.morale = nudge(player.morale ?? 60, 55, 0.2);
      return { ok: true, text: `${player.name} has been told to raise their game.` };
  }
}
