import { Player, SaveGame } from '../domain/types';
import { COUNTRIES, COUNTRIES_BY_ID } from '../data/countries';
import { buildPlayerLeagueWorld } from '../generation/world';
import { autoXI } from './squad';
import { contractOffer, ensurePlayerCareerResources } from './career';
import { playerDomesticBlueprints } from './domesticBranding';
import { addCoins } from './economy';
import { currentPlayerCalendarEvent } from './playerCalendar';

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface DomesticCountryContractOffer {
  countryId: string;
  countryName: string;
  teamId: string;
  teamName: string;
  seasonSalary: number;
  signingBonus: number;
  years: number;
}

/**
 * The transfer window presents a small, stable set of real club offers rather
 * than a country picker. Terms reuse the existing player-contract economy and
 * auction pay-rise curve so accepting an overseas move has a genuine meaning.
 */
export function domesticCountryContractOffers(save: SaveGame): DomesticCountryContractOffer[] {
  const resources = ensurePlayerCareerResources(save);
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!resources || !user || save.mode !== 'career') return [];
  if (save.careerPathLevel === 'SCHOOL' || save.careerPathLevel === 'U19') return [];

  const tier = save.userDivision ?? 3;
  const seasonKey = save.currentSeasonId ?? String(save.careerSeasons ?? 0);
  const base = contractOffer(save);
  const currentSalary = user.contract?.wage ?? base.wage;

  return COUNTRIES.filter((country) => country.id !== resources.domesticCountry)
    .sort((left, right) => {
      const strengthDifference = right.strength - left.strength;
      if (strengthDifference !== 0) return strengthDifference;
      return (
        hashSeed(`${save.id}:${seasonKey}:country:${left.id}`) -
        hashSeed(`${save.id}:${seasonKey}:country:${right.id}`)
      );
    })
    .slice(0, 3)
    .map((country) => {
      const clubs = playerDomesticBlueprints(country.id).filter(
        (blueprint) => blueprint.tier === tier,
      );
      const club = clubs[hashSeed(`${save.id}:${seasonKey}:club:${country.id}`) % clubs.length];
      const seasonSalary = Math.round(
        Math.max(
          currentSalary * (1.2 + club.strength / 300),
          base.wage * (1.3 + club.strength / 200),
        ),
      );
      return {
        countryId: country.id,
        countryName: country.name,
        teamId: club.id,
        teamName: club.name,
        seasonSalary,
        signingBonus: base.signingBonus,
        years: base.years,
      };
    });
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
    save.pendingDomesticCountry = undefined;
    return { ok: true };
  }
  const calendarEvent = currentPlayerCalendarEvent(save);
  const inWindow =
    calendarEvent?.kind === 'TRANSFER_WINDOW' ||
    (save.currentMonth !== undefined && save.currentMonth >= 6 && save.currentMonth <= 8);
  if (!inWindow) {
    return { ok: false, reason: 'Country moves are available only in the June-August window.' };
  }
  if (!domesticCountryContractOffers(save).some((offer) => offer.countryId === countryId)) {
    return { ok: false, reason: 'That country has not made a contract offer in this window.' };
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
  const retainedFranchise = save.franchiseTeamId
    ? save.teams[save.franchiseTeamId]
    : undefined;
  const retainedFranchisePlayers = new Map<string, Player>();
  for (const playerId of retainedFranchise?.playerIds ?? []) {
    const player = save.players[playerId];
    if (playerId !== userId && player) retainedFranchisePlayers.set(playerId, player);
  }
  const tier = save.userDivision ?? 3;
  const acceptedOffer = domesticCountryContractOffers(save).find(
    (offer) => offer.countryId === countryId,
  );
  const destination =
    playerDomesticBlueprints(countryId).find(
      (blueprint) => blueprint.id === acceptedOffer?.teamId && blueprint.tier === tier,
    ) ?? playerDomesticBlueprints(countryId).find((blueprint) => blueprint.tier === tier);
  if (!destination) return false;

  const world = buildPlayerLeagueWorld(hashSeed(`${save.id}:${countryId}:${year}`), {
    country: countryId,
    userDivision: tier,
    requiredTeamId: destination.id,
    seasonId,
  });
  const team = world.teams[destination.id];

  // A domestic-country move changes only the First-Class/List A contract.
  // Keep the existing T20 affiliation alive by carrying that fictional club
  // into the new season's T20 division instead of silently cancelling it.
  let nextFranchiseTeamId: string | undefined;
  if (retainedFranchise) {
    const divisionIds =
      tier === 1 ? world.divisions.tier1 : tier === 2 ? world.divisions.tier2 : world.divisions.tier3;
    const replaceIndex = (divisionIds ?? []).findIndex((teamId) => teamId !== destination.id);
    if (divisionIds && replaceIndex >= 0) {
      const displacedId = divisionIds[replaceIndex];
      divisionIds[replaceIndex] = retainedFranchise.id;
      const league = Object.values(world.leagues).find((item) => item.divisionTier === tier);
      if (league) {
        league.teamIds = league.teamIds.map((teamId) =>
          teamId === displacedId ? retainedFranchise.id : teamId,
        );
        league.table = league.table.map((row) =>
          row.teamId === displacedId ? { ...row, teamId: retainedFranchise.id } : row,
        );
      }
      for (const [playerId, player] of retainedFranchisePlayers) world.players[playerId] = player;
      world.teams[retainedFranchise.id] = {
        ...retainedFranchise,
        playerIds: [...retainedFranchisePlayers.keys()],
        xi: retainedFranchise.xi?.filter((playerId) => playerId !== userId),
        isUserTeam: false,
      };
      nextFranchiseTeamId = retainedFranchise.id;
    }
  }
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
  save.franchiseTeamId = nextFranchiseTeamId ?? team.id;
  save.freeAgents = world.freeAgents;
  save.auctionOffers = undefined;
  save.domesticClubOffers = undefined;
  save.rivalPlayerId = undefined;
  save.playerCalendar = undefined;
  save.pendingDomesticCountry = undefined;
  if (acceptedOffer) {
    user.contract = {
      wage: acceptedOffer.seasonSalary,
      yearsLeft: acceptedOffer.years,
      releaseClause: user.contract?.releaseClause,
    };
    save.wallet = addCoins(save.wallet, acceptedOffer.signingBonus);
    (save.timeline ??= []).push({
      year,
      kind: 'TRANSFER',
      text: `Joined ${acceptedOffer.teamName} in ${acceptedOffer.countryName}.`,
    });
  }
  const resources = ensurePlayerCareerResources(save);
  if (resources) {
    resources.domesticCountry = countryId;
    resources.residencySeasons[countryId] ??= 0;
  }
  return true;
}
