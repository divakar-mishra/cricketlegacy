/**
 * Named on-field rivalry for Player Career. A rival is a real world player of the
 * same discipline and a similar level who becomes your season-long benchmark:
 * the hub shows a head-to-head, and out-performing (or being out-performed by)
 * them nudges morale + the story. Pure/mutating helpers, unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { emptyStats } from './stats';

const isBatterRole = (r: Player['role']): boolean => r === 'BATTER' || r === 'WK_BATTER' || r === 'ALLROUNDER';
const isBowlerRole = (r: Player['role']): boolean => r === 'BOWLER' || r === 'ALLROUNDER';

/** Pick (and persist) a rival if the current one is missing/retired. */
export function ensureRival(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  if (!user) return;
  const current = save.rivalPlayerId ? save.players[save.rivalPlayerId] : undefined;
  if (current && !current.retired && current.id !== user.id) return;

  const userTeam = save.userTeamId;
  const candidates = Object.values(save.players).filter(
    (p) =>
      p.id !== user.id &&
      !p.isUserPlayer &&
      !p.retired &&
      !p.hidden &&
      p.role === user.role &&
      !(userTeam && save.teams[userTeam]?.playerIds.includes(p.id)),
  );
  if (!candidates.length) {
    save.rivalPlayerId = undefined;
    return;
  }
  // Closest overall to the user makes the most compelling benchmark.
  candidates.sort((a, b) => Math.abs(a.overall - user.overall) - Math.abs(b.overall - user.overall));
  save.rivalPlayerId = candidates[0].id;
}

export interface RivalComparison {
  rival: Player;
  metric: 'runs' | 'wickets';
  userValue: number;
  rivalValue: number;
  leading: boolean; // is the user ahead this season?
}

/** Season head-to-head vs the rival on the most relevant metric for the user. */
export function rivalComparison(save: SaveGame): RivalComparison | undefined {
  if (!save.userPlayerId || !save.rivalPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  const rival = save.players[save.rivalPlayerId];
  if (!user || !rival) return undefined;

  const us = user.seasonStats ?? emptyStats();
  const rs = rival.seasonStats ?? emptyStats();
  const metric: 'runs' | 'wickets' = isBatterRole(user.role) || !isBowlerRole(user.role) ? 'runs' : 'wickets';
  const userValue = metric === 'runs' ? us.runs : us.wickets;
  const rivalValue = metric === 'runs' ? rs.runs : rs.wickets;
  return { rival, metric, userValue, rivalValue, leading: userValue >= rivalValue };
}

/**
 * End-of-season rivalry settlement: the winner of the head-to-head gets a
 * morale/brand bump; the loser stews. Returns a short headline for the timeline.
 */
export function settleRivalrySeason(save: SaveGame): string | undefined {
  const cmp = rivalComparison(save);
  if (!cmp || !save.userPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  const won = cmp.userValue > cmp.rivalValue;
  const drew = cmp.userValue === cmp.rivalValue;
  if (user.morale != null) user.morale = Math.max(0, Math.min(100, user.morale + (won ? 6 : drew ? 0 : -5)));
  if (won) save.brand = Math.min(100, (save.brand ?? 20) + 3);
  const verb = won ? 'edged' : drew ? 'matched' : 'was outshone by';
  return `You ${verb} your rival ${cmp.rival.name} (${cmp.userValue}–${cmp.rivalValue} ${cmp.metric}).`;
}
