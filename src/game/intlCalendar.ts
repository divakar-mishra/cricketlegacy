/**
 * One authoritative June-August international window for both career modes.
 *
 * 2026-based four-year rotation:
 *   Year 1: T20 World Cup
 *   Year 2: World Test Championship
 *   Year 3: Champions Trophy
 *   Year 4: ODI World Cup
 */

import {
  Fixture,
  Format,
  IntlCalendar,
  IntlCalendarEvent,
  ManagerCalendarPhase,
  SaveGame,
  Team,
} from '../domain/types';
import { getCountry } from '../data/countries';
import { clamp } from '../utils/math';
import { buildNationalXI, ensurePlayerCareerResources, nationsWithPool } from './career';
import { autoXI } from './squad';

const INTERNATIONAL_CYCLE_BASE_YEAR = 2026;

export type InternationalWindowKind =
  | 'T20_WORLD_CUP'
  | 'WORLD_TEST_CHAMPIONSHIP'
  | 'BILATERAL'
  | 'CHAMPIONS_TROPHY'
  | 'ODI_WORLD_CUP';

export interface InternationalWindowPlan {
  year: number;
  cycleYear: 1 | 2 | 3 | 4;
  id: string;
  name: string;
  kind: InternationalWindowKind;
  format: Format;
  months: number[];
  teamCount: number;
  groupMatches: number;
}

export interface InternationalWindowOptions {
  controlledTeamId?: string;
  mustIncludePlayerId?: string;
  managerPhase?: ManagerCalendarPhase;
}

function currentSeasonYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function cycleYearFor(year: number): 1 | 2 | 3 | 4 {
  const offset = ((year - INTERNATIONAL_CYCLE_BASE_YEAR) % 4 + 4) % 4;
  return (offset + 1) as 1 | 2 | 3 | 4;
}

export function internationalWindowPlan(year: number): InternationalWindowPlan {
  const cycleYear = cycleYearFor(year);
  if (cycleYear === 1) {
    return {
      year,
      cycleYear,
      id: `t20-world-cup-${year}`,
      name: `T20 World Cup ${year}`,
      kind: 'T20_WORLD_CUP',
      format: 'T20',
      months: [6, 7, 8],
      teamCount: 10,
      groupMatches: 4,
    };
  }
  if (cycleYear === 2) {
    return {
      year,
      cycleYear,
      id: `world-test-championship-${year}`,
      name: `World Test Championship ${year}`,
      kind: 'WORLD_TEST_CHAMPIONSHIP',
      format: 'TEST',
      months: [6, 7, 8],
      teamCount: 8,
      groupMatches: 7,
    };
  }
  if (cycleYear === 3) {
    return {
      year,
      cycleYear,
      id: `champions-trophy-${year}`,
      name: `Champions Trophy ${year}`,
      kind: 'CHAMPIONS_TROPHY',
      format: 'ODI',
      months: [6, 7, 8],
      teamCount: 8,
      groupMatches: 3,
    };
  }
  return {
    year,
    cycleYear,
    id: `odi-world-cup-${year}`,
    name: `ODI World Cup ${year}`,
    kind: 'ODI_WORLD_CUP',
    format: 'ODI',
    months: [6, 7, 8],
    teamCount: 10,
    groupMatches: 9,
  };
}

function availableCountries(save: SaveGame, controlledCountry?: string): string[] {
  const nationalCountries = Object.values(save.teams)
    .filter((team) => team.isNationalTeam && team.country)
    .map((team) => team.country);
  return [
    ...new Set([
      ...(controlledCountry ? [controlledCountry] : []),
      ...nationsWithPool(save, 8),
      ...nationalCountries,
    ]),
  ];
}

/** Build the display calendar from the same plan used for playable fixtures. */
export function buildIntlCalendar(year: number, save: SaveGame): IntlCalendar {
  const plan = internationalWindowPlan(year);
  const controlledCountry =
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    (save.managerNationalTeamId
      ? save.teams[save.managerNationalTeamId]?.country
      : undefined);
  const countries = availableCountries(save, controlledCountry).slice(0, plan.teamCount);
  const type: IntlCalendarEvent['type'] =
    plan.kind === 'BILATERAL'
      ? 'SERIES'
      : plan.kind === 'WORLD_TEST_CHAMPIONSHIP'
        ? 'WTC'
        : plan.kind === 'CHAMPIONS_TROPHY'
          ? 'CT'
          : 'WC';
  return {
    year,
    events: [
      {
        id: plan.id,
        name: plan.name,
        type,
        format: plan.format,
        months: plan.months,
        teams: countries,
      },
    ],
  };
}

/** Create or refresh a playable national squad, guaranteeing the user when requested. */
export function ensureNationalTeam(
  save: SaveGame,
  countryId: string,
  mustIncludeId?: string,
): string {
  const id = `national-${countryId}`;
  const players = buildNationalXI(save, countryId, mustIncludeId);
  const existing = save.teams[id];
  const team: Team = existing ?? {
    id,
    name: `${getCountry(countryId)?.name ?? countryId} National XI`,
    shortName: countryId.slice(0, 3).toUpperCase(),
    country: countryId,
    primaryColor: '#17324D',
    secondaryColor: '#F2C14E',
    playerIds: [],
    budget: 0,
    reputation: 75,
    isNationalTeam: true,
  };
  team.playerIds = players.map((player) => player.id);
  team.xi = autoXI(players, mustIncludeId).map((player) => player.id);
  team.isNationalTeam = true;
  save.teams[id] = team;
  return id;
}

export function isInternationalFixture(
  fixture: Pick<Fixture, 'competition'> | undefined,
): boolean {
  return (
    fixture?.competition === 'BILATERAL_SERIES' ||
    fixture?.competition === 'INTL_TOURNAMENT'
  );
}

function addFixtureToSeason(save: SaveGame, fixtureId: string): void {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (season && !season.fixtureIds.includes(fixtureId)) season.fixtureIds.push(fixtureId);
}

function removeReplacedBilateralWindow(
  save: SaveGame,
  seasonId: string,
  plan: InternationalWindowPlan,
): void {
  if (plan.kind !== 'WORLD_TEST_CHAMPIONSHIP') return;
  const replacedCompetitionId = `bilateral-window-${plan.year}`;
  const replacedFixtureIds = new Set(
    Object.values(save.fixtures)
      .filter(
        (fixture) =>
          fixture.seasonId === seasonId &&
          fixture.competitionId === replacedCompetitionId,
      )
      .map((fixture) => fixture.id),
  );
  if (!replacedFixtureIds.size) return;

  for (const fixtureId of replacedFixtureIds) delete save.fixtures[fixtureId];
  const season = save.seasons[seasonId];
  if (season) {
    season.fixtureIds = season.fixtureIds.filter(
      (fixtureId) => !replacedFixtureIds.has(fixtureId),
    );
  }
}

function createWindowFixtures(
  save: SaveGame,
  countryId: string,
  plan: InternationalWindowPlan,
  options: InternationalWindowOptions,
): string[] {
  const seasonId = save.currentSeasonId ?? `season-${plan.year}`;
  removeReplacedBilateralWindow(save, seasonId, plan);
  const existing = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.seasonId === seasonId &&
        isInternationalFixture(fixture) &&
        fixture.competitionId === plan.id,
    )
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  if (existing.length) return existing.map((fixture) => fixture.id);

  const countries = availableCountries(save, countryId).slice(0, plan.teamCount);
  const opponents = countries.filter((country) => country !== countryId);
  if (!opponents.length) return [];

  const controlledTeamId =
    options.controlledTeamId ??
    ensureNationalTeam(save, countryId, options.mustIncludePlayerId);
  ensureNationalTeam(save, countryId, options.mustIncludePlayerId);
  const added: string[] = [];
  let round = 0;

  const add = (
    opponentCountry: string,
    format: Format,
    month: number,
    stage: string,
    playoff = false,
  ): void => {
    round += 1;
    const opponentTeamId = ensureNationalTeam(save, opponentCountry);
    const id = `intl-${plan.year}-${plan.kind.toLowerCase()}-${round}`;
    save.fixtures[id] = {
      id,
      seasonId,
      format,
      homeTeamId: controlledTeamId,
      awayTeamId: opponentTeamId,
      venue: `${plan.name} - ${stage}`,
      round,
      played: false,
      playoff,
      cupRound: stage,
      competition:
        plan.kind === 'BILATERAL' ? 'BILATERAL_SERIES' : 'INTL_TOURNAMENT',
      competitionId: plan.id,
      calendarMonth: month,
      managerPhase: options.managerPhase,
    };
    addFixtureToSeason(save, id);
    added.push(id);
  };

  if (plan.kind === 'BILATERAL') {
    const odiOpponent = opponents[0];
    const testOpponent = opponents[1] ?? opponents[0];
    [6, 6, 7].forEach((month, index) =>
      add(odiOpponent, 'ODI', month, `ODI ${index + 1}`),
    );
    [7, 8].forEach((month, index) =>
      add(testOpponent, 'TEST', month, `Test ${index + 1}`),
    );
  } else if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
    for (let index = 0; index < plan.groupMatches; index += 1) {
      const month = index < 3 ? 6 : index < 6 ? 7 : 8;
      add(
        opponents[index % opponents.length],
        'TEST',
        month,
        `League Stage ${index + 1}`,
      );
    }
    add(
      opponents[plan.groupMatches % opponents.length],
      'TEST',
      8,
      'Final',
      true,
    );
  } else {
    for (let index = 0; index < plan.groupMatches; index += 1) {
      const opponent = opponents[index % opponents.length];
      const month = index < Math.ceil(plan.groupMatches / 2) ? 6 : 7;
      add(opponent, plan.format, month, `Group Stage ${index + 1}`);
    }
    add(
      opponents[plan.groupMatches % opponents.length],
      plan.format,
      8,
      'Semi-Final',
      true,
    );
    add(
      opponents[(plan.groupMatches + 1) % opponents.length],
      plan.format,
      8,
      'Final',
      true,
    );
  }

  save.internationalCalendar = buildIntlCalendar(plan.year, save);
  return added;
}

/** Generate the correct annual window for a capped Player Career. */
export function generateInternationalWindowFixtures(save: SaveGame): string[] {
  if (!save.capped || !save.userPlayerId) return [];
  const user = save.players[save.userPlayerId];
  if (!user) return [];
  const resources = ensurePlayerCareerResources(save);
  const countryId = resources?.cappedCountry ?? resources?.declaredCountry ?? user.nationality;
  return createWindowFixtures(save, countryId, internationalWindowPlan(currentSeasonYear(save)), {
    mustIncludePlayerId: save.userPlayerId,
  });
}

/** Generate the annual window for a National Manager's controlled country. */
export function generateCountryInternationalWindowFixtures(
  save: SaveGame,
  countryId: string,
  options: InternationalWindowOptions = {},
): string[] {
  return createWindowFixtures(
    save,
    countryId,
    internationalWindowPlan(currentSeasonYear(save)),
    options,
  );
}

/**
 * Compatibility helper for callers that explicitly need the bilateral format.
 * Normal season flow should call generateInternationalWindowFixtures instead.
 */
export function generateBilateralFixtures(save: SaveGame, _seriesCount = 2): string[] {
  if (!save.capped || !save.userPlayerId) return [];
  const user = save.players[save.userPlayerId];
  if (!user) return [];
  const resources = ensurePlayerCareerResources(save);
  const countryId = resources?.cappedCountry ?? resources?.declaredCountry ?? user.nationality;
  const year = currentSeasonYear(save);
  const bilateralPlan: InternationalWindowPlan = {
    ...internationalWindowPlan(year),
    cycleYear: 2,
    id: `bilateral-window-${year}`,
    name: `International Bilateral Window ${year}`,
    kind: 'BILATERAL',
    format: 'ODI',
    teamCount: 3,
    groupMatches: 5,
  };
  return createWindowFixtures(save, countryId, bilateralPlan, {
    mustIncludePlayerId: save.userPlayerId,
  });
}

export function internationalWindowFixtureIds(save: SaveGame): string[] {
  return Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.seasonId === save.currentSeasonId && isInternationalFixture(fixture),
    )
    .sort(
      (a, b) =>
        (a.calendarMonth ?? 99) - (b.calendarMonth ?? 99) ||
        a.round - b.round ||
        a.id.localeCompare(b.id),
    )
    .map((fixture) => fixture.id);
}

export function nextInternationalFixtureId(save: SaveGame): string | undefined {
  return internationalWindowFixtureIds(save).find((id) => !save.fixtures[id]?.played);
}

/** Update ICC rankings after a bilateral series or tournament result. */
export function updateIccRankings(
  save: SaveGame,
  winnerTeamId: string,
  loserTeamId: string,
  points = 10,
): void {
  if (!save.iccRankings) save.iccRankings = {};
  save.iccRankings[winnerTeamId] = (save.iccRankings[winnerTeamId] ?? 100) + points;
  save.iccRankings[loserTeamId] = clamp(
    (save.iccRankings[loserTeamId] ?? 100) - Math.round(points * 0.5),
    0,
    1000,
  );
}

/** Top-N teams by ICC ranking points. */
export function topIccTeams(save: SaveGame, n = 5): { teamId: string; points: number }[] {
  const rankings = save.iccRankings ?? {};
  return Object.entries(rankings)
    .map(([teamId, points]) => ({ teamId, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}
