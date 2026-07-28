/**
 * Team talks and one-to-one player conversations — the man-management loop that
 * was missing from Manager mode. Talks nudge players' form/morale *toward* a
 * target (diminishing returns), so they meaningfully swing a matchday without
 * being spammable to the moon. Pure/mutating + deterministic, unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { clamp } from '../utils/math';

export type TeamTalkTone = 'CALM' | 'FIRE_UP' | 'TRUST' | 'CRITICIZE';

export interface TeamTalkOption {
  value: TeamTalkTone;
  label: string;
  desc: string;
  emoji: string;
}

export const TEAM_TALK_OPTIONS: TeamTalkOption[] = [
  { value: 'CALM', label: 'Stay Calm', desc: 'Settle the nerves — a safe lift', emoji: '🧘' },
  { value: 'FIRE_UP', label: 'Fire Them Up', desc: 'High risk, high reward', emoji: '🔥' },
  { value: 'TRUST', label: 'Show Trust', desc: 'Lifts your confident players', emoji: '🤝' },
  { value: 'CRITICIZE', label: 'Demand More', desc: 'Rockets the underperformers', emoji: '📢' },
];

/** Move a value a fraction of the way toward a target (diminishing returns). */
function nudge(cur: number, target: number, frac: number): number {
  return clamp(Math.round(cur + (target - cur) * frac), 1, 99);
}

function userXI(save: SaveGame): Player[] {
  if (!save.userTeamId) return [];
  const team = save.teams[save.userTeamId];
  const ids = team.xi && team.xi.length ? team.xi : team.playerIds;
  return ids.map((id) => save.players[id]).filter((p): p is Player => Boolean(p));
}

export interface TalkResult {
  ok: boolean;
  text: string;
  formDelta?: number;
  volatility?: number;
  tone?: TeamTalkTone;
}

/** Give a pre-match team talk; nudges the XI's form (and returns a summary). */
export function applyTeamTalk(save: SaveGame, tone: TeamTalkTone, rng: Rng): TalkResult {
  const xi = userXI(save);
  if (!xi.length) return { ok: false, text: 'No XI to address.' };
  const before = xi.reduce((sum, player) => sum + player.meta.form, 0) / xi.length;
  let text: string;
  let volatility = 0;
  switch (tone) {
    case 'CALM':
      for (const p of xi) p.meta.form = nudge(p.meta.form, 68, 0.22);
      text = 'The dressing room is calm and focused.';
      break;
    case 'FIRE_UP': {
      const landed = rng() < 0.6;
      volatility = 0.4;
      for (const p of xi) p.meta.form = nudge(p.meta.form, landed ? 84 : 44, landed ? 0.3 : 0.22);
      text = landed ? 'They come out breathing fire!' : 'It backfires — some look rattled.';
      break;
    }
    case 'TRUST':
      for (const p of xi) if (p.meta.confidence >= 60) p.meta.form = nudge(p.meta.form, 82, 0.3);
      text = 'Your senior players stand tall.';
      break;
    case 'CRITICIZE':
    default:
      for (const p of xi) p.meta.form = p.meta.form < 45 ? nudge(p.meta.form, 66, 0.35) : nudge(p.meta.form, 46, 0.12);
      text = 'You demand more from the passengers.';
      break;
  }
  const after = xi.reduce((sum, player) => sum + player.meta.form, 0) / xi.length;
  return { ok: true, text, formDelta: Math.round(after - before), volatility, tone };
}

export type PlayerTalkKind = 'PRAISE' | 'WARN' | 'CHALLENGE' | 'REST';

/** Cooldown in match-days between talks to the same player. */
const TALK_COOLDOWN_DAYS = 3;

/** A one-to-one word with a player — praise lifts, a warning motivates the slack. */
export function talkToPlayer(save: SaveGame, playerId: string, kind: PlayerTalkKind): TalkResult {
  const p = save.players[playerId];
  if (!p) return { ok: false, text: 'Unknown player.' };

  // Check 3-match cooldown using match count as a proxy for days.
  const matchesPlayed = Object.values(save.fixtures).filter(
    (f) => f.played && (f.homeTeamId === save.userTeamId || f.awayTeamId === save.userTeamId),
  ).length;
  if ((p.lastTalkDay ?? -TALK_COOLDOWN_DAYS) + TALK_COOLDOWN_DAYS > matchesPlayed) {
    return { ok: false, text: `${p.name} needs more time before you speak to them again.` };
  }

  p.lastTalkDay = matchesPlayed;

  switch (kind) {
    case 'PRAISE':
      p.meta.form = nudge(p.meta.form, 80, 0.22);
      p.morale = nudge(p.morale ?? 60, 85, 0.3);
      return { ok: true, text: `${p.name} appreciates the vote of confidence.` };

    case 'CHALLENGE':
      // Sets a high bar — motivates those with confidence but risks the fragile.
      if (p.meta.confidence >= 60) {
        p.meta.form = nudge(p.meta.form, 78, 0.25);
        p.morale = nudge(p.morale ?? 60, 72, 0.2);
        return { ok: true, text: `${p.name} rises to the challenge.` };
      }
      p.morale = nudge(p.morale ?? 60, 50, 0.2);
      return { ok: true, text: `The pressure weighs on ${p.name}.` };

    case 'REST':
      // Gives a tired player breathing room — boosts morale, slightly reduces form pressure.
      p.morale = nudge(p.morale ?? 60, 90, 0.35);
      p.meta.fitness = clamp(p.meta.fitness + 5, 1, 99);
      return { ok: true, text: `${p.name} is grateful for the rest — recharged and ready.` };

    case 'WARN':
    default:
      p.meta.form = p.meta.form < 50 ? nudge(p.meta.form, 66, 0.3) : nudge(p.meta.form, 52, 0.15);
      p.morale = nudge(p.morale ?? 60, 55, 0.2);
      return { ok: true, text: `${p.name} has been told to raise his game.` };
  }
}
