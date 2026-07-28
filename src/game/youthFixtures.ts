/**
 * Youth cricket system — proper career-level gating.
 *
 * SCHOOL (U14): plays 6 inter-district school fixtures
 * U19:          plays 8 inter-zone U19 fixtures
 *
 * The professional league runs in the background (auto-sim); the user
 * exclusively plays these dedicated youth fixtures until they earn promotion.
 * Opponents are generated youth teams scoped to the player's nationality.
 * Pure functions / mutating helpers, unit-tested.
 */

import { Fixture, Format, SaveGame, Team } from '../domain/types';
import { generateSquad } from '../generation/players';
import { makeRng } from '../engine/rng';
import { youthOpponentQuality } from './youthBalance';
import { getCountry } from '../data/countries';

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
  { shortId: 'edi', name: 'Eastern District XI',  shortName: 'EDI' },
  { shortId: 'wdi', name: 'Western District XI',  shortName: 'WDI' },
  { shortId: 'cdi', name: 'Central District XI',  shortName: 'CDI' },
  { shortId: 'cod', name: 'Coastal District XI',  shortName: 'COD' },
];

const U19_DEFS: YouthTeamDef[] = [
  { shortId: 'nzu', name: 'North Zone U19',   shortName: 'NZU' },
  { shortId: 'szu', name: 'South Zone U19',   shortName: 'SZU' },
  { shortId: 'ezu', name: 'East Zone U19',    shortName: 'EZU' },
  { shortId: 'wzu', name: 'West Zone U19',    shortName: 'WZU' },
  { shortId: 'czu', name: 'Central Zone U19', shortName: 'CZU' },
  { shortId: 'nwu', name: 'North-West U19',   shortName: 'NWU' },
  { shortId: 'neu', name: 'North-East U19',   shortName: 'NEU' },
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

// ── Team generation ────────────────────────────────────────────────────────

/**
 * Ensure all youth opponent teams exist in save.teams (idempotent).
 * Teams are seeded by nationality so they feel local to the player.
 * Returns the list of youth opponent team IDs.
 */
export function ensureYouthTeams(save: SaveGame, level: 'SCHOOL' | 'U19'): string[] {
  const nationality =
    (save.userPlayerId ? save.players[save.userPlayerId]?.nationality : undefined) ?? 'india';
  const defs   = level === 'SCHOOL' ? SCHOOL_DEFS : U19_DEFS;
  const country = getCountry(nationality);
  const cityCount = country?.cities.length ?? 0;
  const quality = youthOpponentQuality(level); // youth teams are weaker than professional sides
  const teamIds: string[] = [];

  for (let index = 0; index < defs.length; index += 1) {
    const def = defs[index];
    const teamId = `youth-${nationality}-${def.shortId}`;
    teamIds.push(teamId);
    if (save.teams[teamId]) continue; // already created

    const rng = makeRng(hashSeed(`youth:${teamId}:${nationality}`));
    const squad = generateSquad({ nationality, quality, idPrefix: teamId, rng });
    const playerIds: string[] = [];
    for (const p of squad) {
      save.players[p.id] = p;
      playerIds.push(p.id);
    }
    const city = cityCount > 0 ? country?.cities[index % cityCount]?.name : undefined;
    const localizedName = city
      ? level === 'SCHOOL'
        ? `${city} District XI`
        : `${city} Under-19`
      : def.name;
    (save.teams as Record<string, Team>)[teamId] = {
      id: teamId,
      name: localizedName,
      shortName: def.shortName,
      country: nationality,
      primaryColor: '#3a5f8a',
      secondaryColor: '#e8e8e8',
      playerIds,
      budget: 0,
      reputation: quality,
    };
  }
  return teamIds;
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

  const seasonId   = save.currentSeasonId ?? 'season-2026';
  const year       = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  const compId     = competitionId(level);
  const formatForRound = (round: number): Format =>
    level === 'U19' && round <= 4 ? 'ODI' : 'T20';
  const monthForRound = (round: number): number => {
    if (level === 'SCHOOL') return Math.min(5, 3 + Math.floor((round - 1) / 2));
    if (round <= 4) return Math.min(11, 9 + Math.floor((round - 1) / 2));
    return Math.min(5, 3 + Math.floor((round - 5) / 2));
  };

  // Idempotency check — return existing fixtures for this season.
  const existing = Object.values(save.fixtures).filter(
    (fx) => fx.competitionId === compId && fx.seasonId === seasonId,
  );
  if (existing.length > 0) {
    for (const fixture of existing) {
      fixture.format = formatForRound(fixture.round);
      fixture.calendarMonth = monthForRound(fixture.round);
    }
    return existing.sort((a, b) => a.round - b.round).map((fixture) => fixture.id);
  }

  const opponentIds = ensureYouthTeams(save, level);
  const fixtureIds: string[] = [];
  const userTeamName = save.teams[save.userTeamId]?.name ?? 'Home Ground';

  for (let i = 0; i < opponentIds.length; i++) {
    const id = `youth-fx-${year}-${i + 1}`;
    const homeFirst = i % 2 === 0; // alternate home/away
    const opponentId = opponentIds[i];
    save.fixtures[id] = {
      id,
      seasonId,
      format: formatForRound(i + 1),
      homeTeamId: homeFirst ? save.userTeamId : opponentId,
      awayTeamId: homeFirst ? opponentId : save.userTeamId,
      venue: homeFirst ? userTeamName : (save.teams[opponentId]?.name ?? opponentId),
      round: i + 1,
      played: false,
      competitionId: compId,
      calendarMonth: monthForRound(i + 1),
    } satisfies Fixture;
    fixtureIds.push(id);
  }

  return fixtureIds;
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** Returns the next unplayed youth fixture for the user's team. */
export function nextYouthFixtureId(save: SaveGame): string | undefined {
  if (!save.userTeamId || !save.userPlayerId) return undefined;
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return undefined;

  const compId     = competitionId(level);
  const seasonId   = save.currentSeasonId;
  const t          = save.userTeamId;

  return Object.values(save.fixtures).find(
    (fx) =>
      !fx.played &&
      fx.competitionId === compId &&
      fx.seasonId === seasonId &&
      (fx.homeTeamId === t || fx.awayTeamId === t),
  )?.id;
}

/** True when all youth fixtures for the current season have been played. */
export function youthSeasonComplete(save: SaveGame): boolean {
  if (!save.userPlayerId) return true;
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return true;

  const compId   = competitionId(level);
  const seasonId = save.currentSeasonId;

  const youthFx = Object.values(save.fixtures).filter(
    (fx) => fx.competitionId === compId && fx.seasonId === seasonId,
  );
  // If no fixtures exist yet (not generated), treat as incomplete.
  return youthFx.length > 0 && youthFx.every((fx) => fx.played);
}

/** How many youth fixtures have been played / total this season. */
export function youthProgress(save: SaveGame): { played: number; total: number } {
  const level = save.careerPathLevel;
  if (level !== 'SCHOOL' && level !== 'U19') return { played: 0, total: 0 };

  const compId   = competitionId(level);
  const seasonId = save.currentSeasonId;
  const youthFx  = Object.values(save.fixtures).filter(
    (fx) => fx.competitionId === compId && fx.seasonId === seasonId,
  );
  return { played: youthFx.filter((fx) => fx.played).length, total: youthFx.length };
}

/** True when this fixture is a youth cricket match (not a professional league game). */
export function isYouthFixture(fixture: Fixture): boolean {
  return fixture.competitionId === YOUTH_COMP_SCHOOL || fixture.competitionId === YOUTH_COMP_U19;
}
