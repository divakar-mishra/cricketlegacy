import { CREATION } from '../data/attributes';
import { avatarFromLegacy, normalizeAvatarConfig } from '../avatar';
import {
  BattingAttrs,
  BattingStyle,
  BowlingAttrs,
  BowlingStyle,
  CareerPathLevel,
  Difficulty,
  FieldingAttrs,
  Format,
  MentalPhysical,
  Player,
  Role,
  SaveGame,
  SAVE_SCHEMA_VERSION,
  Season,
} from '../domain/types';
import { computeOverall } from '../engine/rating';
import { TEAM_BLUEPRINTS } from '../content/teams';
import {
  buildManagerLeagueWorld,
  buildPlayerLeagueWorld,
  DIV1_LEAGUE_ID,
  DIV2_LEAGUE_ID,
  DIV3_LEAGUE_ID,
} from '../generation/world';
import { startingWallet } from './economy';
import { boardTargetFor } from './finance';
import { autoXI } from './squad';
import { generateYouthFixtures } from './youthFixtures';
import { initialManagerLevel } from './managerCareer';
import { buildManagerSeasonCalendar } from './managerCalendar';
import { buildPlayerSeasonCalendar } from './playerCalendar';
import { ensurePlayerLifeState } from './playerLife';
import { ensureCompetitionFixtures } from './season';
import { ensurePlayerCareerResources } from './career';

export interface UserPlayerInput {
  name: string;
  nationality: string;
  role: Role;
  battingStyle: BattingStyle;
  bowlingStyle?: BowlingStyle;
  batting: BattingAttrs;
  bowling: BowlingAttrs;
  fielding: FieldingAttrs;
  meta: Omit<MentalPhysical, 'form'>;
  age?: number;
  /**
   * Multiplier applied to all raw attributes after the user allocates their
   * point budget. Values < 1 represent younger starters whose physical
   * development hasn't caught up yet. The creation UI displays the resulting
   * active rating directly; this multiplier is never hidden from the player.
   */
  attrScale?: number;
}

function deriveTraits(input: UserPlayerInput): string[] {
  const traits: string[] = [];
  const bowls = input.role === 'BOWLER' || input.role === 'ALLROUNDER';
  const bats = input.role === 'BATTER' || input.role === 'WK_BATTER';
  if (input.batting.power >= 78) traits.push('BIG_HITTER');
  if (input.bowling.variations >= 78 && bowls) traits.push('DEATH_SPECIALIST');
  if (input.bowling.paceOrSpin >= 80 && bowls) traits.push('WICKET_TAKER');
  if (input.batting.temperament <= 38 && bats) traits.push('FRAGILE');
  return traits;
}

/** Scale every numeric value in an attribute object, flooring at 1. */
function scaleObj(obj: object, scale: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, Math.max(1, Math.round((v as number) * scale))]),
  );
}

export function buildUserPlayer(input: UserPlayerInput): Player {
  const scale = input.attrScale ?? 1;
  const needsScale = scale > 0 && scale < 1;

  const batting = needsScale
    ? (scaleObj(input.batting, scale) as unknown as BattingAttrs)
    : input.batting;
  const bowling = needsScale
    ? (scaleObj(input.bowling, scale) as unknown as BowlingAttrs)
    : input.bowling;
  const fielding = needsScale
    ? (scaleObj(input.fielding, scale) as unknown as FieldingAttrs)
    : input.fielding;
  const metaScaled = needsScale
    ? ({ ...scaleObj(input.meta, scale), form: CREATION.startForm } as MentalPhysical)
    : ({ ...input.meta, form: CREATION.startForm } as MentalPhysical);

  const player: Player = {
    id: 'user',
    name: input.name,
    nationality: input.nationality,
    age: input.age ?? 21,
    role: input.role,
    battingStyle: input.battingStyle,
    bowlingStyle: input.bowlingStyle,
    // Apply scale to all attribute groups so young starters have raw numbers
    // that honestly reflect physical development — the allocation UI is the
    // same for everyone; only the in-game values are scaled down.
    batting,
    bowling,
    fielding,
    meta: metaScaled,
    potential: 0,
    traits: deriveTraits(input),
    overall: 0,
    isUserPlayer: true,
  };

  player.overall = computeOverall(player);

  // AI players retain an internal development ceiling, but the protagonist
  // never has an invisible cap that can make paid or earned training stop.
  player.potential = 99;

  return player;
}

const SEASON_ID = 'season-2026';

function makeSeason(
  fixtureIds: string[],
  competitions?: import('../domain/types').SeasonCompetition[],
  leagueIds = [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID],
): Season {
  return {
    id: SEASON_ID,
    year: 2026,
    leagueIds,
    fixtureIds,
    currentRound: 1,
    competitions,
  };
}

/** The starting division of a team, from its blueprint (defaults to the top flight). */
/** Map career-start key → initial career path level. */
function initialPathLevel(age: number): CareerPathLevel {
  if (age <= 15) return 'SCHOOL';
  if (age <= 19) return 'U19';
  return 'DOMESTIC';
}

export function createCareerSave(params: {
  player: Player;
  teamId: string;
  difficulty: Difficulty;
  seed?: number;
  format?: Format;
  /** New Game+ generation — a protégé inherits a little of the legacy. */
  newGamePlus?: number;
  /** The retiring mentor's 0..100 Legacy score — scales the protégé's head-start. */
  legacyScore?: number;
  archetype?: import('../domain/types').CareerArchetype;
  ironman?: boolean;
  avatarCustomization?: import('../domain/types').AvatarCustomization;
  avatarConfig?: import('../avatar').AvatarConfig;
}): SaveGame {
  const now = Date.now();
  params.player.condition ??= 100;
  const selectedBlueprint = TEAM_BLUEPRINTS.find((team) => team.id === params.teamId);
  const world = buildPlayerLeagueWorld(params.seed ?? now >>> 0, {
    seasonId: SEASON_ID,
    format: params.format,
    userDivision: 3,
    country: selectedBlueprint?.country ?? params.player.nationality,
    requiredTeamId: params.teamId,
  });
  const startLevel = initialPathLevel(params.player.age);

  // The chosen Tier 3 club is a future destination for School/U19 starts.
  // Only a senior starter is inserted into that professional roster now.
  const team = world.teams[params.teamId];
  world.players[params.player.id] = params.player;
  if (startLevel === 'DOMESTIC') {
    const squad = team.playerIds.map((id) => world.players[id]);
    const sameRole = squad
      .filter((p) => p.role === params.player.role)
      .sort((a, b) => a.overall - b.overall);
    const victim = sameRole[0] ?? [...squad].sort((a, b) => a.overall - b.overall)[0];
    team.playerIds = team.playerIds.map((id) => (id === victim.id ? params.player.id : id));
    delete world.players[victim.id];
    team.isUserTeam = true;
    const finalSquad = team.playerIds.map((id) => world.players[id]);
    team.xi = autoXI(finalSquad, params.player.id).map((p) => p.id);
  }

  // New Game+ legacy: a protégé starts with a head-start in money and profile.
  // The head-start scales with BOTH the generation count and the mentor's Legacy
  // score (0..100), so a storied career genuinely gives the next player a boost.
  const ng = params.newGamePlus ?? 0;
  const legScore = Math.max(0, Math.min(100, Math.round(params.legacyScore ?? 0)));
  const wallet = startingWallet(now);
  if (ng > 0) wallet.coins += ng * 500;
  if (legScore > 0) wallet.coins += legScore * 25; // up to +2,500 coins from a strong legacy

  const save: import('../domain/types').SaveGame = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: `career-${now}`,
    mode: 'career',
    createdAt: now,
    updatedAt: now,
    wallet,
    entitlements: { removeAds: false },
    userPlayerId: params.player.id,
    userTeamId: params.teamId,
    players: world.players,
    teams: world.teams,
    seasons: {
      [SEASON_ID]: makeSeason(Object.keys(world.fixtures), world.competitions, [
        DIV1_LEAGUE_ID,
        DIV2_LEAGUE_ID,
        DIV3_LEAGUE_ID,
      ]),
    },
    leagues: world.leagues,
    fixtures: world.fixtures,
    currentSeasonId: SEASON_ID,
    currentMonth: 9,
    difficulty: params.difficulty,
    flags: {},
    freeAgents: world.freeAgents,
    divisions: world.divisions,
    userDivision: world.userDivision,
    boardObjective: { year: 2026, targetPosition: boardTargetFor(team.reputation) },
    newGamePlus: ng > 0 ? ng : undefined,
    brand:
      ng > 0 || legScore > 0 ? Math.min(80, 20 + ng * 8 + Math.round(legScore * 0.4)) : undefined,
    careerPathLevel: startLevel,
    careerPathMatches: 0,
    userCapsAtSeasonStart: 0,
    experience: {
      playerArchetype: params.archetype,
      ironman: params.ironman,
    },
    cosmetics: {
      avatar: 'avatar_custom',
      kit: 'kit_white',
      celebration: 'cel_wave',
      avatarCustomization: params.avatarCustomization,
      avatarConfig: params.avatarConfig
        ? normalizeAvatarConfig(params.avatarConfig)
        : avatarFromLegacy(params.avatarCustomization, 'kit_white'),
    },
  };

  // Youth players get dedicated youth fixtures — not the professional league.
  if (startLevel === 'SCHOOL' || startLevel === 'U19') {
    generateYouthFixtures(save);
  } else {
    ensureCompetitionFixtures(save, 'list-a');
    ensureCompetitionFixtures(save, 'first-class');
  }
  ensurePlayerCareerResources(save);
  ensurePlayerLifeState(save);
  buildPlayerSeasonCalendar(save);

  return save;
}

export function createManagerSave(params: {
  teamId: string;
  country?: string;
  difficulty: Difficulty;
  seed?: number;
  format?: Format;
  /**
   * True when this save is created via a player-legend career-to-manager
   * transition. If the player had 50+ caps or 8,000+ career runs, they start
   * at STATE level instead of the default CLUB.
   */
  legendTransition?: boolean;
  /** Career stats from the retiring player (used to determine starting level). */
  legendStats?: { caps: number; runs: number };
}): SaveGame {
  const now = Date.now();
  const selectedBlueprint = TEAM_BLUEPRINTS.find((team) => team.id === params.teamId);
  const startLevel = initialManagerLevel({
    isLegendTransition: params.legendTransition,
    caps: params.legendStats?.caps,
    careerRuns: params.legendStats?.runs,
  });
  const startDivision = startLevel === 'CLUB' ? 3 : startLevel === 'STATE' ? 2 : 1;
  const generatedCountry = params.teamId.match(/^manager_(.+)_t[123]_\d+$/)?.[1];
  const country = params.country ?? selectedBlueprint?.country ?? generatedCountry ?? 'india';
  const world = buildManagerLeagueWorld(params.seed ?? now >>> 0, {
    country,
    userDivision: startDivision,
    requiredTeamId: params.teamId,
  });
  const team = world.teams[params.teamId];
  team.isUserTeam = true;

  const save: SaveGame = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: `manager-${now}`,
    mode: 'manager',
    createdAt: now,
    updatedAt: now,
    wallet: startingWallet(now),
    entitlements: { removeAds: false },
    userTeamId: params.teamId,
    players: world.players,
    teams: world.teams,
    seasons: {
      [SEASON_ID]: {
        ...makeSeason([], []),
        leagueIds: [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID, DIV3_LEAGUE_ID],
      },
    },
    leagues: world.leagues,
    fixtures: world.fixtures,
    currentSeasonId: SEASON_ID,
    difficulty: params.difficulty,
    flags: params.legendTransition ? { transitionedToManager: true } : {},
    freeAgents: world.freeAgents,
    divisions: world.divisions,
    userDivision: world.userDivision,
    boardObjective: { year: 2026, targetPosition: boardTargetFor(team.reputation) },
    managerCareerLevel: startLevel,
    managerCareerSeasons: 0,
    managerTitlesAtLevel: 0,
    managerNationalTeamId: `national-${country}`,
    managerProgression: {
      reputation: team.reputation,
      currentClubId: team.id,
      premiumAssistanceHistory: [],
      contractSalary: Math.round(250_000 + team.reputation * 14_000),
    },
    experience: {},
  };
  // A rookie appointment begins with the marquee T20 block in March. Later
  // seasons use the complete September-August calendar.
  buildManagerSeasonCalendar(save, 2026, 'T20');
  return save;
}
