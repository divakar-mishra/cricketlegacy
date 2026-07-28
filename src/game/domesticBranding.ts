import { TeamBlueprint, TeamBlueprintSchema } from '../content/teams';
import { DomesticTier, SaveGame } from '../domain/types';
import { COUNTRIES_BY_ID, getCountry } from '../data/countries';
import { isSeasonPassActive } from './seasonPass';

const NICKNAMES = [
  'Pioneers',
  'Guardians',
  'Voyagers',
  'Strikers',
  'Comets',
  'Chargers',
  'Mavericks',
  'Falcons',
  'Titans',
  'Rangers',
  'Blazers',
  'Storm',
] as const;

const COLORS = [
  ['#006D77', '#FFDDD2'],
  ['#1D3557', '#E9C46A'],
  ['#8D1B3D', '#F4D35E'],
  ['#2D6A4F', '#F8F9FA'],
  ['#5A189A', '#FFCA3A'],
  ['#9B2226', '#94D2BD'],
  ['#003566', '#FFC300'],
  ['#3D405B', '#F2CC8F'],
] as const;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function shortName(city: string, nickname: string, index: number): string {
  const letters = `${city[0] ?? 'C'}${nickname[0] ?? 'T'}${nickname[1] ?? 'M'}`.toUpperCase();
  return index < 9 ? letters : `${letters.slice(0, 2)}${index % 10}`;
}

/** Fill a country's fictional pyramid to eight clubs in each division. */
export function completeCountryTier(
  countryId: string,
  tier: DomesticTier,
  existing: readonly TeamBlueprint[],
): TeamBlueprint[] {
  const country = COUNTRIES_BY_ID[countryId];
  if (!country) return existing.filter((team) => team.tier === tier).slice(0, 8);
  const selected = existing
    .filter((team) => team.country === countryId && team.tier === tier)
    .slice(0, 8);
  const usedNames = new Set(selected.map((team) => team.name.toLowerCase()));
  let index = 0;
  while (selected.length < 8) {
    const city = country.cities[index % country.cities.length];
    const nickname = NICKNAMES[(index + (tier === 1 ? 0 : tier === 2 ? 5 : 8)) % NICKNAMES.length];
    const name = `${city.name} ${nickname}`;
    index += 1;
    if (usedNames.has(name.toLowerCase())) continue;
    usedNames.add(name.toLowerCase());
    const palette = COLORS[(index + country.strength + tier) % COLORS.length];
    const strengthBase = 48 + country.strength * 5 + (tier === 1 ? 7 : tier === 2 ? -2 : -10);
    selected.push({
      id: `${countryId}_${slug(city.id)}_${slug(nickname)}_${tier}`,
      name,
      shortName: shortName(city.name, nickname, index),
      country: countryId,
      primaryColor: palette[0],
      secondaryColor: palette[1],
      strength: Math.min(88, strengthBase - (selected.length % 5)),
      tier,
    });
  }
  return selected;
}

const MANAGER_NICKNAMES = [
  'Northstar',
  'Foundry',
  'Meridian',
  'Vanguard',
  'Wayfarers',
  'Citadel',
  'Eclipse',
  'Navigators',
  'Arclight',
  'Summit',
  'Keystone',
  'Truewind',
] as const;

const PLAYER_NICKNAMES = [
  'Blades',
  'Royals',
  'Thunder',
  'Spartans',
  'Phoenix',
  'Warriors',
  'Cyclones',
  'Dynamos',
  'Knights',
  'Stars',
  'Raiders',
  'Dragons',
] as const;

function countryPyramidBlueprints(
  countryId: string,
  mode: 'player' | 'manager',
): TeamBlueprint[] {
  const country = COUNTRIES_BY_ID[countryId];
  if (!country) return [];
  const nicknames = mode === 'player' ? PLAYER_NICKNAMES : MANAGER_NICKNAMES;
  const blueprints: TeamBlueprint[] = [];
  for (const tier of [1, 2, 3] as const) {
    for (let index = 0; index < 8; index += 1) {
      const cityOffset = mode === 'player' ? tier + 1 : tier - 1;
      const nicknameOffset = mode === 'player' ? tier * 3 : (tier - 1) * 4;
      const city = country.cities[(index + cityOffset) % country.cities.length];
      const nickname = nicknames[(index + nicknameOffset) % nicknames.length];
      const palette = COLORS[
        (index + tier * 2 + country.strength + (mode === 'player' ? 3 : 0)) % COLORS.length
      ];
      const strengthBase = 49 + country.strength * 4 + (tier === 1 ? 15 : tier === 2 ? 6 : -3);
      const short = `${city.name[0] ?? 'C'}${nickname[0]}${tier}${index + 1}`
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      blueprints.push(
        TeamBlueprintSchema.parse({
          id: `${mode}_${countryId}_t${tier}_${index + 1}`,
          name: `${city.name} ${nickname}`,
          shortName: short,
          country: countryId,
          primaryColor: palette[0],
          secondaryColor: palette[1],
          strength: Math.min(90, Math.max(42, strengthBase - (index % 4))),
          tier,
        }),
      );
    }
  }
  return blueprints;
}

/**
 * Build the same fictional 24-club pyramid for every supported country.
 * Names are deliberately independent of licensed domestic competitions.
 */
export function managerDomesticBlueprints(countryId: string): TeamBlueprint[] {
  return countryPyramidBlueprints(countryId, 'manager');
}

/** Country-specific 24-club pyramid with identities reserved for Player Career. */
export function playerDomesticBlueprints(countryId: string): TeamBlueprint[] {
  return countryPyramidBlueprints(countryId, 'player');
}

export function domesticLeagueName(countryId: string, tier: DomesticTier, format = 'T20'): string {
  const country = getCountry(countryId)?.name ?? 'National';
  if (tier === 1) return `${country} Domestic Elite ${format} Division`;
  if (tier === 2) return `${country} ${format} Championship`;
  return `${country} Local ${format} Division`;
}

export function isPremiumPassActive(save: SaveGame): boolean {
  return isSeasonPassActive(save);
}

export function ensureSeasonPassBranding(save: SaveGame): void {
  const state = (save.seasonPassBranding ??= {
    customTeamNames: {},
    customLeagueNames: {},
    originalTeamNames: {},
    originalLeagueNames: {},
    applied: false,
  });
  for (const [id, team] of Object.entries(save.teams ?? {})) {
    state.originalTeamNames[id] ??= { name: team.name, shortName: team.shortName };
  }
  for (const [id, league] of Object.entries(save.leagues ?? {})) {
    state.originalLeagueNames[id] ??= league.name;
  }
}

function derivedShortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (initials.length >= 2 ? initials : name.slice(0, 3)).slice(0, 4).toUpperCase();
}

/** Apply premium aliases or restore canonical fictional names when premium lapses. */
export function synchronizeSeasonPassBranding(save: SaveGame): void {
  ensureSeasonPassBranding(save);
  const state = save.seasonPassBranding!;
  const active = isPremiumPassActive(save);
  for (const [id, original] of Object.entries(state.originalTeamNames)) {
    const team = save.teams[id];
    if (!team) continue;
    const custom = active ? state.customTeamNames[id]?.trim() : undefined;
    team.name = custom || original.name;
    team.shortName = custom ? derivedShortName(custom) : original.shortName;
  }
  for (const [id, original] of Object.entries(state.originalLeagueNames)) {
    const league = save.leagues[id];
    if (!league) continue;
    const custom = active ? state.customLeagueNames[id]?.trim() : undefined;
    league.name = custom || original;
    const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
    for (const competition of season?.competitions ?? []) {
      if (competition.leagueId === id) competition.name = league.name;
    }
  }
  state.applied = active;
}

export function updateSeasonPassBranding(
  save: SaveGame,
  input: { teamNames: Record<string, string>; leagueNames: Record<string, string> },
): { ok: boolean; reason?: string } {
  if (!isPremiumPassActive(save))
    return { ok: false, reason: 'An active Premium Pass is required.' };
  ensureSeasonPassBranding(save);
  const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
  for (const [id, value] of Object.entries(input.teamNames)) {
    const name = clean(value);
    if (name.length < 2 || name.length > 32)
      return { ok: false, reason: 'Team names must be 2-32 characters.' };
    if (save.teams[id]) save.seasonPassBranding!.customTeamNames[id] = name;
  }
  for (const [id, value] of Object.entries(input.leagueNames)) {
    const name = clean(value);
    if (name.length < 2 || name.length > 40)
      return { ok: false, reason: 'League names must be 2-40 characters.' };
    if (save.leagues[id]) save.seasonPassBranding!.customLeagueNames[id] = name;
  }
  synchronizeSeasonPassBranding(save);
  return { ok: true };
}
