import { SaveGame } from '../domain/types';
import { COUNTRIES_BY_ID } from '../data/countries';
import { buildPlayerLeagueWorld } from '../generation/world';
import { autoXI } from './squad';
import { ensurePlayerCareerResources } from './career';
import { playerDomesticBlueprints } from './domesticBranding';
import { currentPlayerCalendarEvent } from './playerCalendar';

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Queue an off-season move to another country's domestic pyramid. */
export function requestPlayerCountryMove(
  save: SaveGame,
  countryId: string,
): { ok: boolean; reason?: string } {
  const resources = ensurePlayerCareerResources(save);
  if (!resources || save.mode !== 'career') {
    return { ok: false, reason: 'No active player career.' };
  }
  if (!COUNTRIES_BY_ID[countryId]) return { ok: false, reason: 'Unknown domestic country.' };
  if (countryId === resources.domesticCountry) {
    return { ok: false, reason: 'You already play domestic cricket in that country.' };
  }
  const calendarEvent = currentPlayerCalendarEvent(save);
  const inWindow =
    calendarEvent?.kind === 'TRANSFER_WINDOW' ||
    (save.currentMonth !== undefined && save.currentMonth >= 6 && save.currentMonth <= 8);
  if (!inWindow) {
    return { ok: false, reason: 'Country moves are available only in the June-August window.' };
  }
  save.pendingDomesticCountry = countryId;
  return { ok: true };
}

/** Apply a queued country move while the new season is being constructed. */
export function applyPendingPlayerCountryMove(
  save: SaveGame,
  seasonId: string,
  year: number,
): boolean {
  const countryId = save.pendingDomesticCountry;
  const userId = save.userPlayerId;
  if (
    save.mode !== 'career' ||
    !countryId ||
    !COUNTRIES_BY_ID[countryId] ||
    !userId ||
    !save.players[userId]
  ) {
    return false;
  }
  const user = save.players[userId];
  const tier = save.userDivision ?? 3;
  const destination = playerDomesticBlueprints(countryId).find(
    (blueprint) => blueprint.tier === tier,
  );
  if (!destination) return false;

  const world = buildPlayerLeagueWorld(hashSeed(`${save.id}:${countryId}:${year}`), {
    country: countryId,
    userDivision: tier,
    requiredTeamId: destination.id,
    seasonId,
  });
  const team = world.teams[destination.id];
  const squad = team.playerIds.map((id) => world.players[id]);
  const sameRole = squad
    .filter((player) => player.role === user.role)
    .sort((a, b) => a.overall - b.overall);
  const victim = sameRole[0] ?? [...squad].sort((a, b) => a.overall - b.overall)[0];
  world.players[user.id] = user;
  team.playerIds = team.playerIds.map((id) => (id === victim.id ? user.id : id));
  delete world.players[victim.id];
  team.xi = autoXI(
    team.playerIds.map((id) => world.players[id]).filter(Boolean),
    user.id,
  ).map((player) => player.id);
  team.isUserTeam = true;

  save.players = world.players;
  save.teams = world.teams;
  save.leagues = world.leagues;
  save.divisions = world.divisions;
  save.userDivision = world.userDivision;
  save.userTeamId = team.id;
  save.freeAgents = world.freeAgents;
  save.auctionOffers = undefined;
  save.rivalPlayerId = undefined;
  save.playerCalendar = undefined;
  save.pendingDomesticCountry = undefined;
  const resources = ensurePlayerCareerResources(save);
  if (resources) {
    resources.domesticCountry = countryId;
    resources.residencySeasons[countryId] ??= 0;
  }
  return true;
}
