import { TEAM_BLUEPRINTS, TeamBlueprint } from '../content/teams';
import { FORMATS } from '../data/gameConfig';
import {
  DomesticTier,
  Fixture,
  Format,
  League,
  LeagueRow,
  Player,
  SeasonCompetition,
  Team,
} from '../domain/types';
import { makeRng } from '../engine/rng';
import { TeamSide } from '../engine/simulateMatch';
import { generateFreeAgents, generateManagerRoster, generateRoster } from './players';
import {
  completeCountryTier,
  domesticLeagueName,
  managerDomesticBlueprints,
  playerDomesticBlueprints,
} from '../game/domesticBranding';
import { COUNTRIES, getCountry } from '../data/countries';

export const DIV1_LEAGUE_ID = 'league-1';
export const DIV2_LEAGUE_ID = 'league-2';
export const DIV3_LEAGUE_ID = 'league-3';

export interface LeagueWorld {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  /** league-1 is always the user's division; all configured tiers are represented. */
  leagues: Record<string, League>;
  /** Domestic fixtures. Three-tier worlds simulate every division. */
  fixtures: Record<string, Fixture>;
  freeAgents: string[];
  divisions: { tier1: string[]; tier2: string[]; tier3?: string[] };
  userDivision: DomesticTier;
  /** Multi-format competitions (Feature 4). */
  competitions?: SeasonCompetition[];
}

function addNationalPoolsAndTeams(
  players: Record<string, Player>,
  teams: Record<string, Team>,
  rng: ReturnType<typeof makeRng>,
): void {
  for (const nation of COUNTRIES) {
    const existingNationals = Object.values(players).filter(
      (player) => player.nationality === nation.id,
    ).length;
    if (existingNationals < 22) {
      const reserve = generateManagerRoster({
        nationality: nation.id,
        quality: 46 + nation.strength * 6,
        idPrefix: `national-reserve-${nation.id}`,
        rng,
      }).slice(0, 22 - existingNationals);
      for (const player of reserve) players[player.id] = player;
    }

    const nationalPlayers = Object.values(players)
      .filter((player) => player.nationality === nation.id && !player.retired)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 22);
    const nationalTeamId = `national-${nation.id}`;
    teams[nationalTeamId] = {
      id: nationalTeamId,
      name: `${nation.name} National XI`,
      shortName: nation.id.slice(0, 3).toUpperCase(),
      country: nation.id,
      primaryColor: '#17324D',
      secondaryColor: '#F2C14E',
      playerIds: nationalPlayers.map((player) => player.id),
      budget: 0,
      reputation: 58 + nation.strength * 7,
      isNationalTeam: true,
    };
  }
}

function emptyTable(teamIds: string[]): LeagueRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
  }));
}

/** Round-robin fixtures (each pair once) for a set of teams. */
export function buildRoundRobin(
  teamIds: string[],
  seasonId: string,
  format: Format,
  teams: Record<string, Team>,
  idPrefix = 'fx',
  competitionId?: string,
): Record<string, Fixture> {
  const fixtures: Record<string, Fixture> = {};
  const rotation: (string | null)[] = [...teamIds];
  if (rotation.length % 2 === 1) rotation.push(null);
  let fx = 0;
  const roundCount = Math.max(0, rotation.length - 1);

  for (let round = 1; round <= roundCount; round += 1) {
    for (let i = 0; i < rotation.length / 2; i += 1) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];
      if (!left || !right) continue;
      const swapHome = (round + i) % 2 === 0;
      const homeTeamId = swapHome ? right : left;
      const awayTeamId = swapHome ? left : right;
      const id = `${idPrefix}-${++fx}`;
      fixtures[id] = {
        id,
        seasonId,
        format,
        homeTeamId,
        awayTeamId,
        venue: teams[homeTeamId].name,
        round,
        played: false,
        ...(competitionId ? { competitionId } : {}),
      };
    }
    const fixed = rotation[0];
    const last = rotation[rotation.length - 1];
    const middle = rotation.slice(1, -1);
    rotation.splice(0, rotation.length, fixed, last, ...middle);
  }
  return fixtures;
}

/** Home-and-away round robin: fourteen rounds for an eight-club division. */
export function buildDoubleRoundRobin(
  teamIds: string[],
  seasonId: string,
  format: Format,
  teams: Record<string, Team>,
  idPrefix = 'fx',
  competitionId?: string,
): Record<string, Fixture> {
  const firstLeg = buildRoundRobin(
    teamIds,
    seasonId,
    format,
    teams,
    `${idPrefix}-a`,
    competitionId,
  );
  const roundOffset = Math.max(0, teamIds.length - 1);
  const secondLeg: Record<string, Fixture> = {};
  let index = 0;
  for (const fixture of Object.values(firstLeg)) {
    const id = `${idPrefix}-b-${++index}`;
    secondLeg[id] = {
      ...fixture,
      id,
      homeTeamId: fixture.awayTeamId,
      awayTeamId: fixture.homeTeamId,
      venue: teams[fixture.awayTeamId].name,
      round: fixture.round + roundOffset,
    };
  }
  return { ...firstLeg, ...secondLeg };
}

/** Number of teams per division (must be even for round-robin). */
const DIVISION_SIZE = 8;

/**
 * Builds a complete, deterministic two-division world (16 teams split into a
 * top flight + a second tier) with the promotion/relegation pyramid. The user's
 * division (`userDivision`) becomes league-1 and gets a full round-robin; the
 * other division is carried as a table and auto-simulated at season rollover.
 *
 * When `country` is provided, teams from that country are prioritised.
 * The world always selects exactly DIVISION_SIZE teams per tier regardless of
 * how many blueprints exist, preserving test invariants.
 */
export function buildLeagueWorld(
  seed: number,
  opts?: {
    seasonId?: string;
    format?: Format;
    userDivision?: 1 | 2;
    country?: string;
    requiredTeamId?: string;
  },
): LeagueWorld {
  const rng = makeRng(seed);
  const players: Record<string, Player> = {};
  const teams: Record<string, Team> = {};
  const seasonId = opts?.seasonId ?? 'season-1';
  const format: Format = opts?.format ?? 'T20';
  const userDivision = opts?.userDivision ?? 1;
  const country = opts?.country;

  // Select exactly DIVISION_SIZE teams per tier.
  // If country is provided, pick from that country first, then fill with others.
  function selectTier(tier: 1 | 2): TeamBlueprint[] {
    const allInTier = TEAM_BLUEPRINTS.filter((b) => b.tier === tier);
    const selected = country
      ? completeCountryTier(country, tier, TEAM_BLUEPRINTS)
      : allInTier.slice(0, DIVISION_SIZE);
    const required = opts?.requiredTeamId
      ? TEAM_BLUEPRINTS.find((team) => team.id === opts.requiredTeamId && team.tier === tier)
      : undefined;
    if (required && !selected.some((team) => team.id === required.id)) {
      selected[selected.length - 1] = required;
    }
    return selected.slice(0, DIVISION_SIZE);
  }

  const tier1 = selectTier(1);
  const tier2 = selectTier(2);
  const tier1Ids = tier1.map((team) => team.id);
  const tier2Ids = tier2.map((team) => team.id);

  for (const bp of [...tier1, ...tier2]) {
    const squad = generateRoster({
      nationality: bp.country,
      quality: bp.strength,
      idPrefix: bp.id,
      rng,
    });
    const playerIds: string[] = [];
    for (const p of squad) {
      players[p.id] = p;
      playerIds.push(p.id);
    }
    teams[bp.id] = {
      id: bp.id,
      name: bp.name,
      shortName: bp.shortName,
      country: bp.country,
      primaryColor: bp.primaryColor,
      secondaryColor: bp.secondaryColor,
      playerIds,
      budget: bp.tier === 1 ? 1_200_000 : 800_000,
      reputation: bp.strength,
    };
  }

  // A domestic league remains country-specific, while international cricket
  // still needs a viable XI for every selectable nation. These reserve players
  // are not attached to domestic clubs or the transfer market.
  for (const nation of COUNTRIES) {
    const existingNationals = Object.values(players).filter(
      (player) => player.nationality === nation.id,
    ).length;
    if (existingNationals >= 11) continue;
    const reserve = generateRoster({
      nationality: nation.id,
      quality: 46 + nation.strength * 6,
      idPrefix: `national-reserve-${nation.id}`,
      rng,
    }).slice(0, 11 - existingNationals);
    for (const player of reserve) players[player.id] = player;
  }

  const userTeams = userDivision === 1 ? tier1Ids : tier2Ids;
  const otherTeams = userDivision === 1 ? tier2Ids : tier1Ids;

  const formatLabel = FORMATS[format].label;
  const userTierLabel = country
    ? domesticLeagueName(country, userDivision, formatLabel)
    : userDivision === 1
      ? `Premier ${formatLabel} League`
      : `${formatLabel} Championship`;
  const otherTierLabel = country
    ? domesticLeagueName(country, userDivision === 1 ? 2 : 1, formatLabel)
    : userDivision === 1
      ? `${formatLabel} Championship`
      : `Premier ${formatLabel} League`;

  // Only generate T20 fixtures in the initial world build.
  // ODI / First-Class competitions are generated lazily by startNewSeason so
  // that existing tests (which expect exactly 28 T20 fixtures) stay green.
  const fixtures = buildRoundRobin(userTeams, seasonId, format, teams, 'fx', 't20-league');
  for (const fixture of Object.values(fixtures)) {
    fixture.calendarMonth = Math.min(5, 3 + Math.floor((fixture.round - 1) / 3));
  }
  const t20FixtureIds = Object.keys(fixtures);

  const leagues: Record<string, League> = {
    [DIV1_LEAGUE_ID]: {
      id: DIV1_LEAGUE_ID,
      name: userTierLabel,
      format,
      teamIds: userTeams,
      table: emptyTable(userTeams),
    },
    [DIV2_LEAGUE_ID]: {
      id: DIV2_LEAGUE_ID,
      name: otherTierLabel,
      format,
      teamIds: otherTeams,
      table: emptyTable(otherTeams),
    },
  };

  // Season competition metadata (fixture IDs for ODI/FC left empty — populated by startNewSeason).
  const competitions: SeasonCompetition[] = [
    {
      id: 't20-league',
      name: userTierLabel,
      format,
      leagueId: DIV1_LEAGUE_ID,
      fixtureIds: t20FixtureIds,
    },
    {
      id: 'list-a',
      name: country
        ? `${getCountry(country)?.name ?? country} Domestic 50-Over Cup`
        : 'List A (50-Over)',
      format: 'ODI',
      leagueId: DIV1_LEAGUE_ID,
      fixtureIds: [],
    },
    {
      id: 'first-class',
      name: country
        ? `${getCountry(country)?.name ?? country} First-Class Championship`
        : 'First-Class (4-Day)',
      format: 'TEST',
      leagueId: DIV1_LEAGUE_ID,
      fixtureIds: [],
    },
  ];

  const freeAgents: string[] = [];
  for (const p of generateFreeAgents((seed ^ 0x5bd1e995) >>> 0)) {
    players[p.id] = p;
    freeAgents.push(p.id);
  }

  return {
    players,
    teams,
    leagues,
    fixtures,
    freeAgents,
    divisions: { tier1: tier1Ids, tier2: tier2Ids },
    userDivision,
    competitions,
  };
}

/**
 * Builds Player Career's country-specific 24-club pyramid. The user begins in
 * tier three on a new career and every tier plays a 14-match T20 league.
 */
export function buildPlayerLeagueWorld(
  seed: number,
  opts: {
    country: string;
    userDivision: DomesticTier;
    requiredTeamId: string;
    seasonId?: string;
    format?: Format;
  },
): LeagueWorld {
  const rng = makeRng(seed);
  const players: Record<string, Player> = {};
  const teams: Record<string, Team> = {};
  const seasonId = opts.seasonId ?? 'season-1';
  const format = opts.format ?? 'T20';
  const blueprints = playerDomesticBlueprints(opts.country);
  const requested = TEAM_BLUEPRINTS.find((team) => team.id === opts.requiredTeamId);
  const requiredGenerated = blueprints.find((team) => team.id === opts.requiredTeamId);

  if (requiredGenerated && requiredGenerated.tier !== opts.userDivision) {
    const requiredIndex = blueprints.findIndex((team) => team.id === requiredGenerated.id);
    const targetIndex = blueprints.findIndex((team) => team.tier === opts.userDivision);
    if (requiredIndex >= 0 && targetIndex >= 0) {
      const displaced = blueprints[targetIndex];
      blueprints[targetIndex] = { ...requiredGenerated, tier: opts.userDivision };
      blueprints[requiredIndex] = { ...displaced, tier: requiredGenerated.tier };
    }
  } else if (!requiredGenerated) {
    const replacement = blueprints.findIndex((team) => team.tier === opts.userDivision);
    if (replacement >= 0) {
      blueprints[replacement] = {
        ...blueprints[replacement],
        id: opts.requiredTeamId,
        name: requested?.name ?? blueprints[replacement].name,
        shortName: requested?.shortName ?? blueprints[replacement].shortName,
        primaryColor: requested?.primaryColor ?? blueprints[replacement].primaryColor,
        secondaryColor: requested?.secondaryColor ?? blueprints[replacement].secondaryColor,
        tier: opts.userDivision,
      };
    }
  }

  const byTier = (tier: DomesticTier): TeamBlueprint[] =>
    blueprints.filter((team) => team.tier === tier).slice(0, DIVISION_SIZE);
  const tier1 = byTier(1);
  const tier2 = byTier(2);
  const tier3 = byTier(3);

  for (const blueprint of [...tier1, ...tier2, ...tier3]) {
    const squad = generateManagerRoster({
      nationality: opts.country,
      quality: blueprint.strength,
      idPrefix: blueprint.id,
      rng,
    });
    for (const player of squad) players[player.id] = player;
    teams[blueprint.id] = {
      id: blueprint.id,
      name: blueprint.name,
      shortName: blueprint.shortName,
      country: blueprint.country,
      primaryColor: blueprint.primaryColor,
      secondaryColor: blueprint.secondaryColor,
      playerIds: squad.map((player) => player.id),
      budget: blueprint.tier === 1 ? 1_400_000 : blueprint.tier === 2 ? 950_000 : 650_000,
      reputation: blueprint.strength,
    };
  }

  addNationalPoolsAndTeams(players, teams, rng);

  const divisions = {
    tier1: tier1.map((team) => team.id),
    tier2: tier2.map((team) => team.id),
    tier3: tier3.map((team) => team.id),
  };
  const idsByTier: Record<DomesticTier, string[]> = {
    1: divisions.tier1,
    2: divisions.tier2,
    3: divisions.tier3,
  };
  const tierOrder = [
    opts.userDivision,
    ...([1, 2, 3] as DomesticTier[]).filter((tier) => tier !== opts.userDivision),
  ];
  const leagueIds = [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID, DIV3_LEAGUE_ID];
  const leagues: Record<string, League> = {};
  tierOrder.forEach((tier, index) => {
    const id = leagueIds[index];
    const teamIds = idsByTier[tier];
    leagues[id] = {
      id,
      name: domesticLeagueName(opts.country, tier, FORMATS[format].label),
      format,
      teamIds,
      table: emptyTable(teamIds),
      divisionTier: tier,
    };
  });

  const fixtures: Record<string, Fixture> = {};
  for (const tier of [1, 2, 3] as DomesticTier[]) {
    const tierFixtures = buildDoubleRoundRobin(
      idsByTier[tier],
      seasonId,
      format,
      teams,
      `fx-t20-t${tier}`,
      't20-league',
    );
    for (const fixture of Object.values(tierFixtures)) {
      fixture.divisionTier = tier;
      fixture.calendarMonth = Math.min(5, 3 + Math.floor((fixture.round - 1) / 5));
      fixtures[fixture.id] = fixture;
    }
  }

  const userLeague = Object.values(leagues).find(
    (league) => league.divisionTier === opts.userDivision,
  )!;
  const competitions: SeasonCompetition[] = [
    {
      id: 't20-league',
      name: userLeague.name,
      format,
      leagueId: userLeague.id,
      fixtureIds: Object.keys(fixtures),
    },
    {
      id: 'list-a',
      name: `${getCountry(opts.country)?.name ?? opts.country} Domestic 50-Over Cup`,
      format: 'ODI',
      leagueId: userLeague.id,
      fixtureIds: [],
    },
    {
      id: 'first-class',
      name: `${getCountry(opts.country)?.name ?? opts.country} First-Class Championship`,
      format: 'TEST',
      leagueId: userLeague.id,
      fixtureIds: [],
    },
  ];

  const freeAgents: string[] = [];
  for (const player of generateFreeAgents((seed ^ 0x5bd1e995) >>> 0, 48)) {
    players[player.id] = player;
    freeAgents.push(player.id);
  }

  return {
    players,
    teams,
    leagues,
    fixtures,
    freeAgents,
    divisions,
    userDivision: opts.userDivision,
    competitions,
  };
}

/**
 * Builds the manager-only domestic world: 24 fictional clubs in three tiers,
 * with 22-player squads. Calendar fixtures are added separately so all formats
 * can share this same pyramid.
 */
export function buildManagerLeagueWorld(
  seed: number,
  opts: {
    country: string;
    userDivision: DomesticTier;
    requiredTeamId: string;
  },
): LeagueWorld {
  const rng = makeRng(seed);
  const players: Record<string, Player> = {};
  const teams: Record<string, Team> = {};
  const blueprints = managerDomesticBlueprints(opts.country);
  const requiredGenerated = blueprints.find((team) => team.id === opts.requiredTeamId);

  if (requiredGenerated && requiredGenerated.tier !== opts.userDivision) {
    const requiredIndex = blueprints.findIndex((team) => team.id === requiredGenerated.id);
    const targetIndex = blueprints.findIndex((team) => team.tier === opts.userDivision);
    if (requiredIndex >= 0 && targetIndex >= 0) {
      const displaced = blueprints[targetIndex];
      blueprints[targetIndex] = { ...requiredGenerated, tier: opts.userDivision };
      blueprints[requiredIndex] = { ...displaced, tier: requiredGenerated.tier };
    }
  } else if (!requiredGenerated) {
    const requested = TEAM_BLUEPRINTS.find((team) => team.id === opts.requiredTeamId);
    const replacement = blueprints.findIndex((team) => team.tier === opts.userDivision);
    if (replacement >= 0) {
      blueprints[replacement] = {
        ...blueprints[replacement],
        id: opts.requiredTeamId,
        name: requested?.name ?? blueprints[replacement].name,
        shortName: requested?.shortName ?? blueprints[replacement].shortName,
        primaryColor: requested?.primaryColor ?? blueprints[replacement].primaryColor,
        secondaryColor: requested?.secondaryColor ?? blueprints[replacement].secondaryColor,
        tier: opts.userDivision,
      };
    }
  }

  const byTier = (tier: DomesticTier): TeamBlueprint[] =>
    blueprints.filter((team) => team.tier === tier).slice(0, DIVISION_SIZE);
  const tier1 = byTier(1);
  const tier2 = byTier(2);
  const tier3 = byTier(3);

  for (const blueprint of [...tier1, ...tier2, ...tier3]) {
    const squad = generateManagerRoster({
      nationality: opts.country,
      quality: blueprint.strength,
      idPrefix: blueprint.id,
      rng,
    });
    for (const player of squad) players[player.id] = player;
    teams[blueprint.id] = {
      id: blueprint.id,
      name: blueprint.name,
      shortName: blueprint.shortName,
      country: blueprint.country,
      primaryColor: blueprint.primaryColor,
      secondaryColor: blueprint.secondaryColor,
      playerIds: squad.map((player) => player.id),
      budget: blueprint.tier === 1 ? 1_500_000 : blueprint.tier === 2 ? 1_050_000 : 750_000,
      reputation: blueprint.strength,
    };
  }

  addNationalPoolsAndTeams(players, teams, rng);

  const divisions = {
    tier1: tier1.map((team) => team.id),
    tier2: tier2.map((team) => team.id),
    tier3: tier3.map((team) => team.id),
  };
  const idsByTier: Record<DomesticTier, string[]> = {
    1: divisions.tier1,
    2: divisions.tier2,
    3: divisions.tier3,
  };
  const tierOrder = [
    opts.userDivision,
    ...([1, 2, 3] as DomesticTier[]).filter((tier) => tier !== opts.userDivision),
  ];
  const leagues: Record<string, League> = {};
  tierOrder.forEach((tier, index) => {
    const id = [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID, DIV3_LEAGUE_ID][index];
    leagues[id] = {
      id,
      name: domesticLeagueName(opts.country, tier, 'T20'),
      format: 'T20',
      teamIds: idsByTier[tier],
      table: emptyTable(idsByTier[tier]),
      divisionTier: tier,
    };
  });

  const freeAgents: string[] = [];
  for (const player of generateFreeAgents((seed ^ 0x5bd1e995) >>> 0, 48)) {
    players[player.id] = player;
    freeAgents.push(player.id);
  }

  return {
    players,
    teams,
    leagues,
    fixtures: {},
    freeAgents,
    divisions,
    userDivision: opts.userDivision,
    competitions: [],
  };
}

export function teamSideFromWorld(world: LeagueWorld, teamId: string): TeamSide {
  const team = world.teams[teamId];
  return { teamId, players: team.playerIds.map((id) => world.players[id]) };
}
