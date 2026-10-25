/**
 * World lifecycle on a season rollover: veterans retire, youth prospects come
 * through to refill squads, and the transfer market is refreshed. Keeps rosters
 * at full strength and makes long dynasties feel alive.
 */
import { COUNTRIES } from '../data/countries';
import { Role, SaveGame, Team } from '../domain/types';
import { Rng } from '../engine/rng';
import { playerWorldSex } from './playerIdentity';
import {
  generatePlayer,
  generateYouth,
  MANAGER_ROSTER_SIZE,
  ROSTER_SIZE,
} from '../generation/players';

export const RETIRE_AGE = 37;
const FILL_ROLES: Role[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER', 'BATTER', 'BOWLER'];
const FREE_AGENT_TARGET = 24;

/** Existing youth pathway, also used to recover legacy depleted club rosters. */
function promoteToRoster(save: SaveGame, team: Team, year: number, rng: Rng, target: number): number {
  let promoted = 0;
  let n = 0;
  while (team.playerIds.length < target) {
    const role = FILL_ROLES[n % FILL_ROLES.length];
    const id = `y-${year}-${team.id}-${n++}`;
    if (save.players[id]) continue; // Never overwrite an existing prospect.
    save.players[id] = generateYouth({ id, nationality: team.country, role, sex: playerWorldSex(save),
      quality: Math.max(45, team.reputation - 6), rng });
    save.players[id].condition = save.managerCalendar ? 100 : undefined;
    team.playerIds.push(id);
    promoted++;
  }
  return promoted;
}

export function repairDepletedManagerRoster(save: SaveGame, year: number, rng: Rng): void {
  if (save.mode !== 'manager' || save.managerCareerLevel === 'NATIONAL' || !save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  if (!team || team.isNationalTeam) return;
  team.playerIds = [...new Set(team.playerIds)].filter(id => Boolean(save.players[id]));
  if (team.playerIds.length >= 11) return;
  promoteToRoster(save, team, year, rng, 11);
  team.xi = undefined;
}

export interface RolloverReport {
  retired: number;
  promoted: number;
}

/** Retire veterans (never the user), then promote youth to refill each roster. */
export function rolloverSquads(
  save: SaveGame,
  year: number,
  rng: Rng,
  options: { preserveTeamIds?: ReadonlySet<string> } = {},
): RolloverReport {
  let retired = 0;
  let promoted = 0;
  const rosterTarget = save.managerCalendar ? MANAGER_ROSTER_SIZE : ROSTER_SIZE;

  for (const team of Object.values(save.teams)) {
    if (team.isNationalTeam) continue;
    if (options.preserveTeamIds?.has(team.id)) continue;
    team.playerIds = team.playerIds.filter((id) => {
      const p = save.players[id];
      if (!p) return false;
      if (id === save.userPlayerId) return true; // the user retires manually
      if (p.age >= RETIRE_AGE) {
        delete save.players[id];
        retired++;
        return false;
      }
      return true;
    });

    promoted += promoteToRoster(save, team, year, rng, rosterTarget);

    // Drop a stale XI selection that references departed players.
    if (team.xi && !team.xi.every((id) => save.players[id])) team.xi = undefined;
  }

  return { retired, promoted };
}

/** Remove retired-age free agents and top the market back up with fresh talent. */
export function refreshFreeAgents(save: SaveGame, year: number, rng: Rng): void {
  const nats = COUNTRIES.map((c) => c.id);
  const roles: Role[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'];

  let list = (save.freeAgents ?? []).filter((id) => {
    const p = save.players[id];
    if (!p) return false;
    if (p.age >= RETIRE_AGE) {
      delete save.players[id];
      return false;
    }
    return true;
  });

  let n = 0;
  while (list.length < FREE_AGENT_TARGET) {
    const id = `fa-${year}-${n}`;
    if (!save.players[id]) {
      const nationality = nats[Math.floor(rng() * nats.length)];
      const role = roles[Math.floor(rng() * roles.length)];
      // A mix of youth and journeymen keeps the market interesting.
      save.players[id] =
        rng() < 0.5
          ? generateYouth({ id, nationality, role, quality: 48 + Math.floor(rng() * 22), rng, sex: playerWorldSex(save) })
          : generatePlayer({ id, nationality, role, quality: 50 + Math.floor(rng() * 24), rng, sex: playerWorldSex(save) });
      list.push(id);
    }
    n++;
    if (n > FREE_AGENT_TARGET * 3) break; // safety
  }

  save.freeAgents = list;
}
