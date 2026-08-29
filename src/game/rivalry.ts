/**
 * Named on-field rivalry for Player Career. A rival is a real world player of the
 * same discipline and a similar level who becomes your season-long benchmark:
 * the hub shows a head-to-head, and out-performing (or being out-performed by)
 * them nudges morale + the story. Pure/mutating helpers, unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { emptyStats } from './stats';
import { careerPlayingTeamId, isYouthFixture, nextYouthFixtureId } from './youthFixtures';

const isBatterRole = (r: Player['role']): boolean =>
  r === 'BATTER' || r === 'WK_BATTER' || r === 'ALLROUNDER';
const isBowlerRole = (r: Player['role']): boolean => r === 'BOWLER' || r === 'ALLROUNDER';

function youthRivalTeamIds(save: SaveGame): string[] | undefined {
  if (save.careerPathLevel !== 'SCHOOL' && save.careerPathLevel !== 'U19') return undefined;
  const activeTeamId = careerPlayingTeamId(save);
  const fixtureId = nextYouthFixtureId(save);
  const next = fixtureId ? save.fixtures[fixtureId] : undefined;
  const nextOpponentId = next
    ? next.homeTeamId === activeTeamId
      ? next.awayTeamId
      : next.homeTeamId
    : undefined;
  const participants = new Set<string>();
  for (const fixture of Object.values(save.fixtures)) {
    if (!isYouthFixture(fixture) || fixture.seasonId !== save.currentSeasonId) continue;
    if (fixture.homeTeamId !== activeTeamId) participants.add(fixture.homeTeamId);
    if (fixture.awayTeamId !== activeTeamId) participants.add(fixture.awayTeamId);
  }
  return [nextOpponentId, ...participants].filter(
    (teamId, index, all): teamId is string => Boolean(teamId) && all.indexOf(teamId) === index,
  );
}

function activeTeamPlayerIds(save: SaveGame, teamId: string): string[] {
  const team = save.teams[teamId];
  if (!team) return [];
  return team.xi?.length ? team.xi : team.playerIds.slice(0, 11);
}

/** Pick (and persist) a rival if the current one is missing/retired. */
export function ensureRival(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  if (!user) return;
  const youthTeamIds = youthRivalTeamIds(save);
  const youthActivePlayerIds = youthTeamIds
    ? new Set(youthTeamIds.flatMap((teamId) => activeTeamPlayerIds(save, teamId)))
    : undefined;
  const nextOpponentId = youthTeamIds?.[0];
  const requiredYouthXI = nextOpponentId
    ? new Set(activeTeamPlayerIds(save, nextOpponentId))
    : undefined;
  const current = save.rivalPlayerId ? save.players[save.rivalPlayerId] : undefined;
  const currentHasYouthFixture =
    !youthActivePlayerIds || youthActivePlayerIds.has(current?.id ?? '');
  if (current && !current.retired && current.id !== user.id && currentHasYouthFixture) return;

  const userTeam = save.userTeamId;
  const eligible = Object.values(save.players).filter(
    (p) =>
      p.id !== user.id &&
      !p.isUserPlayer &&
      !p.retired &&
      !p.hidden &&
      !(userTeam && save.teams[userTeam]?.playerIds.includes(p.id)) &&
      (!requiredYouthXI || requiredYouthXI.has(p.id)),
  );
  let candidates = eligible.filter((player) => player.role === user.role);
  if (candidates.length === 0 && requiredYouthXI) {
    candidates = eligible.filter((player) =>
      isBatterRole(user.role) ? isBatterRole(player.role) : isBowlerRole(player.role),
    );
  }
  if (!candidates.length) {
    save.rivalPlayerId = undefined;
    return;
  }
  // A youth rival is required to be in the next opponent's XI, guaranteeing
  // both sides of the head-to-head actually play in the same round.
  candidates.sort(
    (a, b) => Math.abs(a.overall - user.overall) - Math.abs(b.overall - user.overall),
  );
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
  const metric: 'runs' | 'wickets' =
    isBatterRole(user.role) || !isBowlerRole(user.role) ? 'runs' : 'wickets';
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
  if (user.morale != null)
    user.morale = Math.max(0, Math.min(100, user.morale + (won ? 6 : drew ? 0 : -5)));
  if (won) save.brand = Math.min(100, (save.brand ?? 20) + 3);
  const verb = won ? 'edged' : drew ? 'matched' : 'was outshone by';
  return `You ${verb} your rival ${cmp.rival.name} (${cmp.userValue}–${cmp.rivalValue} ${cmp.metric}).`;
}
