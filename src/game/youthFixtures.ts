/**
 * Youth cricket system — proper career-level gating.
 *
 * SCHOOL (legacy internal key; Grade A in the UI): plays 6 district fixtures
 * U19:          plays 8 inter-zone U19 fixtures
 *
 * The professional league runs in the background (auto-sim); the user
 * exclusively plays these dedicated youth fixtures until they earn promotion.
 * Opponents are generated pathway teams scoped to the player's nationality.
 * Pure functions / mutating helpers, unit-tested.
 */

import { CareerPathLevel, Fixture, Format, Player, SaveGame, Team } from '../domain/types';
import { generatePlayer, generateSquad } from '../generation/players';
import { makeRng } from '../engine/rng';
import { youthOpponentQuality } from './youthBalance';
import { getCountry } from '../data/countries';
import { autoXI } from './squad';
import { isU19WorldCupFixture, u19WorldCupControlledTeamId } from './u19WorldCup';
import { isPlayerFranchiseFixture } from './playerAffiliations';

export const YOUTH_COMP_SCHOOL = 'youth-u14' as const;
export const YOUTH_COMP_U19 = 'youth-u19' as const;
export type YouthCompId = typeof YOUTH_COMP_SCHOOL | typeof YOUTH_COMP_U19;

// ── Opponent team definitions (geography-neutral, works for any nationality) ──

interface YouthTeamDef {
  shortId: string; // used to build stable team IDs
  name: string;
  shortName: string;
}

const SCHOOL_DEFS: YouthTeamDef[] = [
  { shortId: 'ndi', name: 'Northern District XI', shortName: 'NDI' },
  { shortId: 'sdi', name: 'Southern District XI', shortName: 'SDI' },
  { shortId: 'edi', name: 'Eastern District XI', shortName: 'EDI' },
  { shortId: 'wdi', name: 'Western District XI', shortName: 'WDI' },
  { shortId: 'cdi', name: 'Central District XI', shortName: 'CDI' },
  { shortId: 'cod', name: 'Coastal District XI', shortName: 'COD' },
];

const U19_DEFS: YouthTeamDef[] = [
  { shortId: 'nzu', name: 'North Zone U19', shortName: 'NZU' },
  { shortId: 'szu', name: 'South Zone U19', shortName: 'SZU' },
  { shortId: 'ezu', name: 'East Zone U19', shortName: 'EZU' },
  { shortId: 'wzu', name: 'West Zone U19', shortName: 'WZU' },
  { shortId: 'czu', name: 'Central Zone U19', shortName: 'CZU' },
  { shortId: 'nwu', name: 'North-West U19', shortName: 'NWU' },
  { shortId: 'neu', name: 'North-East U19', shortName: 'NEU' },
  { shortId: 'cou', name: 'Coastal Zone U19', shortName: 'COU' },
];

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function competitionId(level: 'SCHOOL' | 'U19'): YouthCompId {
  return level === 'SCHOOL' ? YOUTH_COMP_SCHOOL : YOUTH_COMP_U19;
}

function pathwayTeamId(save: SaveGame, level: 'SCHOOL' | 'U19'): string {
  const nationality =
    (save.userPlayerId ? save.players[save.userPlayerId]?.nationality : undefined) ?? 'india';
  return `career-path-${nationality}-${level.toLowerCase()}`;
}

function activeYouthLevel(level?: CareerPathLevel): level is 'SCHOOL' | 'U19' {
  return level === 'SCHOOL' || level === 'U19';
}

function seniorDestination(save: SaveGame): Team | undefined {
  return save.userTeamId ? save.teams[save.userTeamId] : undefined;
}

function removePlayerFromTeam(team: Team, playerId: string): void {
  team.playerIds = team.playerIds.filter((id) => id !== playerId);
  team.xi = team.xi?.filter((id) => id !== playerId);
}

/**
 * A Grade A/U19 player must not occupy a senior roster slot before earning a
 * domestic contract. Existing saves receive a deterministic replacement so
 * the background senior club keeps a valid squad and XI.
 */
export function detachCareerPlayerFromSenior(save: SaveGame): void {
  if (!save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  const team = seniorDestination(save);
  if (!user || !team || !team.playerIds.includes(user.id)) return;

  let replacementId = `${team.id}-path-reserve`;
  let suffix = 2;
  while (save.players[replacementId] && replacementId !== user.id) {
    replacementId = `${team.id}-path-reserve-${suffix++}`;
  }
  const rng = makeRng(hashSeed(`${save.id}:${replacementId}`));
  const replacement =
    save.players[replacementId] ??
    generatePlayer({
      id: replacementId,
      nationality: team.country,
      role: user.role,
      quality: team.reputation,
      age: 20,
      rng,
    });
  save.players[replacement.id] = replacement;
  team.playerIds = team.playerIds.map((id) => (id === user.id ? replacement.id : id));
  team.xi = autoXI(team.playerIds.map((id) => save.players[id]).filter(Boolean)).map(
    (player) => player.id,
  );
}

/**
 * Build the user's real active Grade A/U19 XI. The senior destination remains
 * in the 24-club world and continues to simulate in the background.
 */
export function ensureCareerPathTeam(save: SaveGame, level: 'SCHOOL' | 'U19'): string | undefined {
  if (!save.userPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  if (!user) return undefined;
  user.contract = undefined;

  const id = pathwayTeamId(save, level);
  const destination = seniorDestination(save);
  let team = save.teams[id];
  if (!team) {
    const nationality = user.nationality;
    const quality = youthOpponentQuality(level);
    const rng = makeRng(hashSeed(`${save.id}:${id}:squad`));
    const squad = generateSquad({ nationality, quality, idPrefix: id, rng });
    for (const player of squad) {
      player.age = level === 'SCHOOL' ? 16 + Math.floor(rng() * 13) : 16 + Math.floor(rng() * 4);
      save.players[player.id] = player;
    }
    const sameRole = squad
      .filter((player) => player.role === user.role)
      .sort((left, right) => left.overall - right.overall);
    const victim = sameRole[0] ?? [...squad].sort((a, b) => a.overall - b.overall)[0];
    delete save.players[victim.id];
    const playerIds = squad.map((player) => (player.id === victim.id ? user.id : player.id));
    const place = destination?.name.split(/\s+/)[0] ?? getCountry(nationality)?.name ?? 'Local';
    team = {
      id,
      name: level === 'SCHOOL' ? `${place} Grade A XI` : `${place} Under-19`,
      shortName: level === 'SCHOOL' ? 'GRA' : 'U19',
      country: nationality,
      primaryColor: destination?.primaryColor ?? '#315A86',
      secondaryColor: destination?.secondaryColor ?? '#F2F4F7',
      isUserTeam: true,
      playerIds,
      xi: autoXI(playerIds.map((playerId) => save.players[playerId]).filter(Boolean), user.id).map(
        (player) => player.id,
      ),
      budget: 0,
      reputation: quality,
    };
    save.teams[id] = team;
  } else if (!team.playerIds.includes(user.id)) {
    const candidates = team.playerIds
      .map((playerId) => save.players[playerId])
      .filter((player): player is Player => Boolean(player))
      .sort(
        (left, right) =>
          Number(left.role !== user.role) - Number(right.role !== user.role) ||
          left.overall - right.overall,
      );
    const victim = candidates[0];
    if (victim) {
      removePlayerFromTeam(team, victim.id);
      delete save.players[victim.id];
    }
    team.playerIds.push(user.id);
    team.xi = autoXI(
      team.playerIds.map((playerId) => save.players[playerId]).filter(Boolean),
      user.id,
    ).map((player) => player.id);
  }

  if (destination) destination.isUserTeam = false;
  team.isUserTeam = true;
  save.careerPathTeamId = id;
  return id;
}

/** Activate a youth level and repair fixtures written by pre-v26 saves. */
export function activateCareerPathTeam(
  save: SaveGame,
  level: 'SCHOOL' | 'U19',
): string | undefined {
  detachCareerPlayerFromSenior(save);
  const previousPathTeamId = save.careerPathTeamId;
  const activeId = ensureCareerPathTeam(save, level);
  if (!activeId) return undefined;
  if (previousPathTeamId && previousPathTeamId !== activeId) {
    const previousTeam = save.teams[previousPathTeamId];
    if (previousTeam && save.userPlayerId) {
      removePlayerFromTeam(previousTeam, save.userPlayerId);
      previousTeam.isUserTeam = false;
    }
  }

  const compId = competitionId(level);
  for (const fixture of Object.values(save.fixtures)) {
    if (fixture.competitionId !== compId) continue;
    if (fixture.homeTeamId === save.userTeamId || fixture.homeTeamId === previousPathTeamId) {
      fixture.homeTeamId = activeId;
    }
    if (fixture.awayTeamId === save.userTeamId || fixture.awayTeamId === previousPathTeamId) {
      fixture.awayTeamId = activeId;
    }
    if (fixture.homeTeamId === activeId)
      fixture.venue = save.teams[activeId]?.name ?? fixture.venue;
  }
  return activeId;
}

/** Move the earned career contract into the reserved Tier 3 senior club. */
export function activateSeniorDomesticContract(save: SaveGame): string | undefined {
  if (!save.userPlayerId || !save.userTeamId) return undefined;
  const user = save.players[save.userPlayerId];
  const team = save.teams[save.userTeamId];
  if (!user || !team) return undefined;

  const pathTeam = save.careerPathTeamId ? save.teams[save.careerPathTeamId] : undefined;
  if (pathTeam) {
    removePlayerFromTeam(pathTeam, user.id);
    pathTeam.isUserTeam = false;
  }
  if (!team.playerIds.includes(user.id)) {
    const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
    const sameRole = squad
      .filter((player) => player.role === user.role)
      .sort((left, right) => left.overall - right.overall);
    const victim = sameRole[0] ?? [...squad].sort((left, right) => left.overall - right.overall)[0];
    if (victim) {
      team.playerIds = team.playerIds.map((id) => (id === victim.id ? user.id : id));
      save.freeAgents = [...new Set([...(save.freeAgents ?? []), victim.id])];
    } else {
      team.playerIds.push(user.id);
    }
  }
  team.xi = autoXI(team.playerIds.map((id) => save.players[id]).filter(Boolean), user.id).map(
    (player) => player.id,
  );
  team.isUserTeam = true;
  save.careerPathTeamId = undefined;
  return team.id;
}

/** Team actually controlled in a fixture; youth uses its dedicated pathway XI. */
export function careerPlayingTeamId(save: SaveGame, fixtureId?: string): string | undefined {
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  if (save.mode === 'career' && isU19WorldCupFixture(fixture)) {
    return u19WorldCupControlledTeamId(save);
  }
  if (
    save.mode === 'career' &&
    activeYouthLevel(save.careerPathLevel) &&
    (!fixture || isYouthFixture(fixture))
  ) {
    return save.careerPathTeamId ?? save.userTeamId;
  }
  if (save.mode === 'career' && isPlayerFranchiseFixture(fixture)) {
    return save.franchiseTeamId ?? save.userTeamId;
  }
  return save.userTeamId;
}

// ── Team generation ────────────────────────────────────────────────────────

/**
 * Ensure all youth opponent teams exist in save.teams (idempotent).
 * Teams are seeded by nationality so they feel local to the player.
 * Returns the list of youth opponent team IDs.
 */
export function ensureYouthTeams(save: SaveGame, level: 'SCHOOL' | 'U19'): string[] {
  const nationality =
    (save.userPlayerId ? save.players[save.userPlayerId]?.nationality : undefined) ?? 'india';
  const defs = level === 'SCHOOL' ? SCHOOL_DEFS : U19_DEFS;
  const country = getCountry(nationality);
  const cityCount = country?.cities.length ?? 0;
  const quality = youthOpponentQuality(level); // youth teams are weaker than professional sides
  const teamIds: string[] = [];
  const reservedNames = new Set<string>();
  const activePathName = save.careerPathTeamId
    ? save.teams[save.careerPathTeamId]?.name.toLocaleLowerCase()
    : undefined;

  for (let index = 0; index < defs.length; index += 1) {
    const def = defs[index];
    const teamId = `youth-${nationality}-${def.shortId}`;
    teamIds.push(teamId);

    const city = index < cityCount ? country?.cities[index]?.name : undefined;
    const cityName = city
      ? level === 'SCHOOL'
        ? `${city} District XI`
        : `${city} Under-19`
      : undefined;
    // The reserved senior destination can share a city with the youth pool.
    // Fall back to a unique zone identity instead of displaying "Delhi v Delhi".
    const localizedName =
      cityName &&
      cityName.toLocaleLowerCase() !== activePathName &&
      !reservedNames.has(cityName.toLocaleLowerCase())
        ? cityName
        : def.name;
    reservedNames.add(localizedName.toLocaleLowerCase());

    const existing = save.teams[teamId];
    if (existing) {
      // Repair duplicate city labels in existing saves without replacing the
      // squad or touching any completed results.
      existing.name = localizedName;
      existing.shortName = def.shortName;
      existing.xi = autoXI(
        existing.playerIds.map((playerId) => save.players[playerId]).filter(Boolean),
      ).map((player) => player.id);
      continue;
    }

    const rng = makeRng(hashSeed(`youth:${teamId}:${nationality}`));
    const squad = generateSquad({ nationality, quality, idPrefix: teamId, rng });
    const playerIds: string[] = [];
    for (const p of squad) {
      save.players[p.id] = p;
      playerIds.push(p.id);
    }
    (save.teams as Record<string, Team>)[teamId] = {
      id: teamId,
      name: localizedName,
      shortName: def.shortName,
      country: nationality,
      primaryColor: '#3a5f8a',
      secondaryColor: '#e8e8e8',
      playerIds,
      xi: autoXI(playerIds.map((playerId) => save.players[playerId]).filter(Boolean)).map(
        (player) => player.id,
      ),
      budget: 0,
      reputation: quality,
    };
  }
  return teamIds;
}

interface YouthFixtureSpec {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  id: string;
}

function fixturePairKey(homeTeamId: string, awayTeamId: string): string {
  return [homeTeamId, awayTeamId].sort().join(':');
}

/**
 * Complete single round robin with the user's bye in the middle. Placing the
 * bye there gives U19 players four 50-over fixtures, then four T20 fixtures,
 * while every AI team still plays the same eight-match season.
 */
function youthRoundRobin(
  activeTeamId: string,
  opponentIds: string[],
  level: 'SCHOOL' | 'U19',
  year: number,
): YouthFixtureSpec[] {
  const bye = '__youth_bye__';
  const byeIndex = Math.floor(opponentIds.length / 2);
  const userSequence = [...opponentIds.slice(0, byeIndex), bye, ...opponentIds.slice(byeIndex)];
  // In the circle method the fixed first team meets the rotating list from
  // right to left. Reversing the desired sequence preserves fixture order.
  let rotation = [activeTeamId, ...[...userSequence].reverse()];
  const specs: YouthFixtureSpec[] = [];
  const userFixtureIndex = new Map(opponentIds.map((teamId, index) => [teamId, index + 1]));

  for (let round = 1; round < rotation.length; round += 1) {
    let matchNumber = 0;
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (left === bye || right === bye) continue;
      matchNumber += 1;

      const opponentId = left === activeTeamId ? right : right === activeTeamId ? left : undefined;
      if (opponentId) {
        const fixtureIndex = userFixtureIndex.get(opponentId)!;
        const homeFirst = fixtureIndex % 2 === 1;
        specs.push({
          round,
          homeTeamId: homeFirst ? activeTeamId : opponentId,
          awayTeamId: homeFirst ? opponentId : activeTeamId,
          id: `youth-fx-${year}-${level.toLowerCase()}-${fixtureIndex}`,
        });
      } else {
        const swap = (round + matchNumber) % 2 === 0;
        specs.push({
          round,
          homeTeamId: swap ? right : left,
          awayTeamId: swap ? left : right,
          id: `youth-fx-${year}-${level.toLowerCase()}-r${round}-m${matchNumber}`,
        });
      }
    }
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }

  return specs.sort(
    (left, right) =>
      left.round - right.round ||
      fixturePairKey(left.homeTeamId, left.awayTeamId).localeCompare(
        fixturePairKey(right.homeTeamId, right.awayTeamId),
      ),
  );
}

// ── Fixture generation ─────────────────────────────────────────────────────

/**
 * Generate a fresh set of youth fixtures for the current season.
 * Idempotent — returns existing IDs if fixtures already exist for this season.
 * Call once on new career save (if SCHOOL/U19) and at each season rollover.
 */
export function generateYouthFixtures(save: SaveGame): string[] {
  if (!save.userTeamId || !save.userPlayerId) return [];
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return [];
  const activeTeamId = activateCareerPathTeam(save, level);
  if (!activeTeamId) return [];

  const seasonId = save.currentSeasonId ?? 'season-2026';
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  const compId = competitionId(level);
  const formatForRound = (round: number): Format => (level === 'U19' && round <= 4 ? 'ODI' : 'T20');
  const monthForRound = (round: number): number => {
    if (level === 'SCHOOL') return Math.min(5, 3 + Math.floor((round - 1) / 2));
    if (round <= 4) return Math.min(11, 9 + Math.floor((round - 1) / 2));
    return Math.min(5, 3 + Math.floor((round - 5) / 2));
  };

  const opponentIds = ensureYouthTeams(save, level);
  const expected = youthRoundRobin(activeTeamId, opponentIds, level, year);
  const existing = Object.values(save.fixtures).filter(
    (fx) => fx.competitionId === compId && fx.seasonId === seasonId,
  );
  const existingByPair = new Map<string, Fixture>();
  for (const fixture of existing.sort(
    (left, right) => Number(right.played) - Number(left.played),
  )) {
    if (fixture.homeTeamId === fixture.awayTeamId) continue;
    const key = fixturePairKey(fixture.homeTeamId, fixture.awayTeamId);
    if (!existingByPair.has(key)) existingByPair.set(key, fixture);
  }

  const retainedIds = new Set<string>();
  const fixtureIds: string[] = [];
  for (const spec of expected) {
    const key = fixturePairKey(spec.homeTeamId, spec.awayTeamId);
    const previous = existingByPair.get(key);
    const id = previous?.id ?? spec.id;
    const fixture: Fixture = previous ?? {
      id,
      seasonId,
      format: formatForRound(spec.round),
      homeTeamId: spec.homeTeamId,
      awayTeamId: spec.awayTeamId,
      venue: save.teams[spec.homeTeamId]?.name ?? 'Neutral ground',
      round: spec.round,
      played: false,
      competitionId: compId,
      calendarMonth: monthForRound(spec.round),
    };
    fixture.id = id;
    fixture.seasonId = seasonId;
    fixture.format = formatForRound(spec.round);
    fixture.homeTeamId = spec.homeTeamId;
    fixture.awayTeamId = spec.awayTeamId;
    fixture.venue = save.teams[spec.homeTeamId]?.name ?? fixture.venue;
    fixture.round = spec.round;
    fixture.competitionId = compId;
    fixture.calendarMonth = monthForRound(spec.round);
    save.fixtures[id] = fixture;
    retainedIds.add(id);
    if (spec.homeTeamId === activeTeamId || spec.awayTeamId === activeTeamId) fixtureIds.push(id);
  }

  // Keep completed legacy pairings, but remove malformed or duplicate youth
  // fixtures after their canonical counterpart has been retained.
  for (const fixture of existing) {
    if (!retainedIds.has(fixture.id)) delete save.fixtures[fixture.id];
  }
  const season = save.seasons[seasonId];
  if (season) {
    const previousYouthIds = new Set(existing.map((fixture) => fixture.id));
    const youthIds = Object.values(save.fixtures)
      .filter((fixture) => fixture.seasonId === seasonId && fixture.competitionId === compId)
      .map((fixture) => fixture.id);
    season.fixtureIds = [
      ...season.fixtureIds.filter((id) => !previousYouthIds.has(id)),
      ...youthIds,
    ];
  }

  return fixtureIds.sort((left, right) => save.fixtures[left].round - save.fixtures[right].round);
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** Returns the next unplayed youth fixture for the user's team. */
export function nextYouthFixtureId(save: SaveGame): string | undefined {
  if (!save.userTeamId || !save.userPlayerId) return undefined;
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return undefined;

  const compId = competitionId(level);
  const seasonId = save.currentSeasonId;
  const t = save.careerPathTeamId ?? save.userTeamId;

  return Object.values(save.fixtures)
    .filter(
      (fx) =>
        !fx.played &&
        fx.competitionId === compId &&
        fx.seasonId === seasonId &&
        (fx.homeTeamId === t || fx.awayTeamId === t),
    )
    .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id))[0]?.id;
}

/** True when all youth fixtures for the current season have been played. */
export function youthSeasonComplete(save: SaveGame): boolean {
  if (!save.userPlayerId) return true;
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return true;

  const compId = competitionId(level);
  const seasonId = save.currentSeasonId;

  const youthFx = Object.values(save.fixtures).filter(
    (fx) => fx.competitionId === compId && fx.seasonId === seasonId,
  );
  // If no fixtures exist yet (not generated), treat as incomplete.
  return youthFx.length > 0 && youthFx.every((fx) => fx.played);
}

/** True when this fixture is a youth cricket match (not a professional league game). */
export function isYouthFixture(fixture: Fixture): boolean {
  return fixture.competitionId === YOUTH_COMP_SCHOOL || fixture.competitionId === YOUTH_COMP_U19;
}
