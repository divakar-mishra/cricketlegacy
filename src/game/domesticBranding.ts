import { TeamBlueprint, TeamBlueprintSchema } from '../content/teams';
import { DomesticTier, SaveGame } from '../domain/types';
import { COUNTRIES_BY_ID, getCountry } from '../data/countries';
import { isSeasonPassActive } from './seasonPass';

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

const LEGACY_GENERATED_SHORT_NAME = /^[A-Z]{2}\d{2}$/;

/**
 * Human-readable club initials. Generated domestic teams previously included
 * their tier and slot in the abbreviation (for example `BS31`), which exposed
 * internal generation data anywhere a compact name was rendered.
 */
export function domesticTeamShortName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  const initials = words
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 4);
  return name
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(2, 'X');
}

function countryPyramidBlueprints(countryId: string, mode: 'player' | 'manager'): TeamBlueprint[] {
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
      const palette =
        COLORS[(index + tier * 2 + country.strength + (mode === 'player' ? 3 : 0)) % COLORS.length];
      const strengthBase = 49 + country.strength * 4 + (tier === 1 ? 15 : tier === 2 ? 6 : -3);
      const name = `${city.name} ${nickname}`;
      blueprints.push(
        TeamBlueprintSchema.parse({
          id: `${mode}_${countryId}_t${tier}_${index + 1}`,
          name,
          shortName: domesticTeamShortName(name),
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
  return domesticTeamShortName(name);
}

/**
 * Repair domestic abbreviations produced by the old tier/slot naming scheme.
 * This is safe to run repeatedly and preserves premium/custom aliases. The
 * original-name snapshot is repaired too, otherwise a lapsed pass could bring
 * the numeric abbreviation back later.
 */
export function synchronizeDomesticTeamShortNames(save: SaveGame): void {
  const generatedTeam = (id: string) => /^(?:player|manager)_.+_t[123]_\d+$/.test(id);
  for (const [id, team] of Object.entries(save.teams ?? {})) {
    if (!generatedTeam(id) || !LEGACY_GENERATED_SHORT_NAME.test(team.shortName)) continue;
    team.shortName = domesticTeamShortName(team.name);
  }

  for (const [id, original] of Object.entries(save.seasonPassBranding?.originalTeamNames ?? {})) {
    if (!generatedTeam(id) || !LEGACY_GENERATED_SHORT_NAME.test(original.shortName)) continue;
    original.shortName = domesticTeamShortName(original.name);
  }
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
