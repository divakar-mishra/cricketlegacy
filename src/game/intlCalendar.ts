/**
 * Year-round international calendar for Player Career.
 *
 * Capped players retain their domestic contract. National assignments are
 * scheduled over the domestic calendar and take priority only when dates clash.
 * International assignments are spread across the season, while April and May
 * remain clear for franchise cricket. National duty takes priority over a
 * clashing domestic fixture only while the player is selected.
 */

import {
  Fixture,
  Format,
  InternationalTournamentStanding,
  InternationalTournamentState,
  InternationalSelectionDecision,
  IntlCalendar,
  IntlCalendarEvent,
  ManagerCalendarPhase,
  SaveGame,
  Team,
  WtcCycleState,
  WtcStanding,
} from '../domain/types';
import { COUNTRIES, getCountry } from '../data/countries';
import { generateManagerRoster } from '../generation/players';
import { makeRng } from '../engine/rng';
import { computeOverall } from '../engine/rating';
import { clamp } from '../utils/math';
import { addPassXp } from './liveops';
import { archiveNewspaperStory, buildTournamentEliminationNewspaperStory } from './newspaper';
import { synchronizeSeasonPassState } from './seasonPass';
import {
  buildNationalXI,
  careerFormatModifier,
  ensurePlayerCareerResources,
  nationsWithPool,
} from './career';
import { autoXI } from './squad';
import { nationalReplacementQuality, nationalReplacementQualityFloor } from './nationalTalent';

const INTERNATIONAL_CYCLE_BASE_YEAR = 2026;
const WTC_CYCLE_YEARS = 2;

export type InternationalWindowKind =
  'T20_WORLD_CUP' | 'WORLD_TEST_CHAMPIONSHIP' | 'BILATERAL' | 'CHAMPIONS_TROPHY' | 'ODI_WORLD_CUP';

export interface InternationalCalendarSlot {
  month: number;
  week: number;
}

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
  slots?: InternationalCalendarSlot[];
  fixtureFormats?: Format[];
  wtcPointsSeries?: boolean;
  wtcRound?: number;
}

export interface InternationalWindowOptions {
  controlledTeamId?: string;
  mustIncludePlayerId?: string;
  managerPhase?: ManagerCalendarPhase;
  opponentCountries?: string[];
  wtcCycleId?: string;
}

function currentSeasonYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function cycleYearFor(year: number): 1 | 2 | 3 | 4 {
  const offset = (((year - INTERNATIONAL_CYCLE_BASE_YEAR) % 4) + 4) % 4;
  return (offset + 1) as 1 | 2 | 3 | 4;
}

function stableNumber(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seasonalMonthOrder(month?: number): number {
  if (!month) return 99;
  return month >= 9 ? month - 9 : month + 3;
}

function wtcFinalPlan(year: number): InternationalWindowPlan {
  return {
    year,
    cycleYear: cycleYearFor(year),
    id: `world-test-championship-${year}`,
    name: `World Test Championship Final ${year}`,
    kind: 'WORLD_TEST_CHAMPIONSHIP',
    format: 'TEST',
    months: [8],
    teamCount: 2,
    groupMatches: 0,
    slots: [{ month: 8, week: 4 }],
  };
}

function bilateralSlots(month: number, matches: number): InternationalCalendarSlot[] {
  return Array.from({ length: matches }, (_, index) => ({
    month,
    week: Math.min(4, Math.floor((index * 4) / Math.max(1, matches)) + 1),
  }));
}

function bilateralPlan(
  year: number,
  format: Format,
  series: number,
  matches: number,
  month: number,
  options: Pick<InternationalWindowPlan, 'wtcPointsSeries' | 'wtcRound'> = {},
): InternationalWindowPlan {
  const formatId = format === 'T20' ? 't20i' : format.toLowerCase();
  const id =
    format === 'TEST' && series === 1
      ? `wtc-test-series-${year}`
      : `${formatId}-series-${year}-${series}`;
  return {
    year,
    cycleYear: cycleYearFor(year),
    id,
    name: `${format === 'T20' ? 'T20I' : format === 'TEST' ? 'Test' : 'ODI'} Series ${series}`,
    kind: 'BILATERAL',
    format,
    months: [month],
    teamCount: 2,
    groupMatches: matches,
    slots: bilateralSlots(month, matches),
    ...options,
  };
}

function testSeriesPlans(year: number): InternationalWindowPlan[] {
  const finalYear = cycleYearFor(year) === 2 || cycleYearFor(year) === 4;
  const counts = finalYear ? [2, 2, 2, 2, 1] : [2, 2, 2, 2, 2];
  const months = finalYear ? [9, 11, 1, 3, 6] : [6, 8, 10, 12, 2];
  return counts.map((matches, index) =>
    bilateralPlan(year, 'TEST', index + 1, matches, months[index], {
      wtcPointsSeries: true,
      wtcRound: index,
    }),
  );
}

function odiSeriesPlans(year: number): InternationalWindowPlan[] {
  const cycleYear = cycleYearFor(year);
  const counts = cycleYear === 3 ? [5, 5, 5, 5] : cycleYear === 4 ? [5, 5, 4] : [5, 5, 5, 5, 5];
  const months = cycleYear === 3 ? [9, 11, 1, 3] : cycleYear === 4 ? [10, 1, 3] : [6, 8, 10, 12, 2];
  return counts.map((matches, index) =>
    bilateralPlan(year, 'ODI', index + 1, matches, months[index]),
  );
}

function t20iSeriesPlans(year: number): InternationalWindowPlan[] {
  const t20WorldCupYear = cycleYearFor(year) === 1;
  const counts = t20WorldCupYear ? [5, 4] : [5, 5, 5];
  const months = t20WorldCupYear ? [11, 3] : [7, 11, 3];
  return counts.map((matches, index) =>
    bilateralPlan(year, 'T20', index + 1, matches, months[index]),
  );
}

/** The marquee June-August event in the established four-year rotation. */
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
      slots: [
        { month: 6, week: 1 },
        { month: 6, week: 3 },
        { month: 7, week: 1 },
        { month: 7, week: 3 },
        { month: 8, week: 1 },
        { month: 8, week: 3 },
      ],
    };
  }
  if (cycleYear === 2) {
    return wtcFinalPlan(year);
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
      slots: [
        { month: 6, week: 1 },
        { month: 6, week: 3 },
        { month: 7, week: 2 },
        { month: 8, week: 1 },
        { month: 8, week: 3 },
      ],
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
    slots: Array.from({ length: 11 }, (_, index) => ({
      month: index < 3 ? 6 : index < 7 ? 7 : 8,
      week: index < 3 ? index + 2 : ((index - 3) % 4) + 1,
    })),
  };
}

export function annualInternationalPlans(year: number): InternationalWindowPlan[] {
  const marquee = internationalWindowPlan(year);
  const plans: InternationalWindowPlan[] = [
    ...testSeriesPlans(year),
    ...odiSeriesPlans(year),
    ...t20iSeriesPlans(year),
    marquee,
  ];
  const bounds = wtcCycleBounds(year);
  if (year === bounds.endYear && marquee.kind !== 'WORLD_TEST_CHAMPIONSHIP') {
    plans.push(wtcFinalPlan(year));
  }
  return plans;
}

function availableCountries(save: SaveGame, controlledCountry?: string): string[] {
  const nationalCountries = Object.values(save.teams)
    .filter((team) => team.isNationalTeam && team.country)
    .map((team) => team.country);
  const countries = [
    ...new Set([
      ...(controlledCountry ? [controlledCountry] : []),
      ...nationsWithPool(save, 11),
      ...nationalCountries,
      ...COUNTRIES.map((country) => country.id),
    ]),
  ];
  // Player counts are an implementation detail, not an international ranking.
  // Compact countries used to jump ahead whenever an ageing squad was refreshed,
  // which could leave a major nation playing almost every tour and knockout
  // against low-ranked opposition. Keep the controlled nation first, then seed
  // the calendar by the explicit country-strength model.
  return countries.sort((left, right) => {
    if (left === controlledCountry) return -1;
    if (right === controlledCountry) return 1;
    return (
      (getCountry(right)?.strength ?? 0) - (getCountry(left)?.strength ?? 0) ||
      left.localeCompare(right)
    );
  });
}

function teamXiOverall(save: SaveGame, teamId: string): number {
  const team = save.teams[teamId];
  if (!team) return 0;
  const ids = team.xi?.length ? team.xi : team.playerIds.slice(0, 11);
  if (!ids.length) return 0;
  return (
    ids.reduce((sum, playerId) => sum + (save.players[playerId]?.overall ?? 0), 0) / ids.length
  );
}

/**
 * A National Manager can arrive with a highly developed domestic core. Peer
 * countries must be able to field a comparable generation rather than remain
 * frozen at new-save strength for the rest of a 25-season career. Country
 * strength still creates real gaps: one strength point is about two OVR.
 */
function managerNationalOpponentFloor(
  save: SaveGame,
  controlledTeamId: string,
  controlledCountry: string,
  opponentCountry: string,
): number | undefined {
  if (save.mode !== 'manager' || save.managerCareerLevel !== 'NATIONAL') return undefined;
  const controlledOverall = teamXiOverall(save, controlledTeamId);
  if (!controlledOverall) return undefined;
  const controlledStrength = getCountry(controlledCountry)?.strength ?? 2;
  const opponentStrength = getCountry(opponentCountry)?.strength ?? 2;
  return clamp(controlledOverall + (opponentStrength - controlledStrength) * 2, 64, 99);
}

function liftGeneratedNationalCohort(
  players: ReturnType<typeof generateManagerRoster>,
  floor: number,
) {
  if (floor <= 0) return;
  const adjustableGroups = ['batting', 'bowling', 'fielding'] as const;
  const adjustableMeta = ['fitness', 'confidence', 'aggression', 'discipline', 'form'] as const;
  // Quality 99 still leaves role-balanced All-Rounders several points below a
  // mature 95+ domestic core. Raise cricket attributes a point at a time while
  // preserving role balance, then stop as soon as the XI reaches the requested
  // standard (or the attributes genuinely cap out). Every meta rating which
  // contributes to overall must rise too; otherwise a nominal 99 target still
  // produces a hidden peer-XI gap.
  for (let pass = 0; pass < 24; pass += 1) {
    const xi = autoXI(players);
    const average = xi.reduce((sum, player) => sum + player.overall, 0) / xi.length;
    if (average >= floor) return;
    for (const player of players) {
      for (const group of adjustableGroups) {
        const attributes = player[group] as unknown as Record<string, number>;
        for (const key of Object.keys(attributes)) {
          attributes[key] = clamp(attributes[key] + 1, 1, 99);
        }
      }
      for (const key of adjustableMeta) player.meta[key] = clamp(player.meta[key] + 1, 1, 99);
      player.overall = computeOverall(player);
    }
  }
}

function countryForTeam(save: SaveGame, teamId: string): string | undefined {
  return save.teams[teamId]?.country;
}

function planCountries(
  save: SaveGame,
  plan: InternationalWindowPlan,
  controlledCountry?: string,
): string[] {
  const fromFixtures = Object.values(save.fixtures)
    .filter(
      (fixture) => fixture.seasonId === save.currentSeasonId && fixture.competitionId === plan.id,
    )
    .flatMap((fixture) => [
      countryForTeam(save, fixture.homeTeamId),
      countryForTeam(save, fixture.awayTeamId),
    ])
    .filter((country): country is string => Boolean(country));
  if (fromFixtures.length) return [...new Set(fromFixtures)];

  if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
    const cycle = wtcCycleForYear(save, plan.year);
    if (cycle?.finalTeamIds) return [...cycle.finalTeamIds];
  }
  return availableCountries(save, controlledCountry).slice(0, plan.teamCount);
}

/** Build the display calendar from the same plans used for playable fixtures. */
export function buildIntlCalendar(year: number, save: SaveGame): IntlCalendar {
  const controlledCountry =
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    (save.managerNationalTeamId ? save.teams[save.managerNationalTeamId]?.country : undefined);
  const selections = save.playerCareerResources?.internationalSelections ?? {};
  return {
    year,
    events: annualInternationalPlans(year).map((plan): IntlCalendarEvent => {
      const decision = selections[plan.id];
      const type: IntlCalendarEvent['type'] =
        plan.kind === 'BILATERAL'
          ? 'SERIES'
          : plan.kind === 'WORLD_TEST_CHAMPIONSHIP'
            ? 'WTC'
            : plan.kind === 'CHAMPIONS_TROPHY'
              ? 'CT'
              : 'WC';
      const cycle =
        plan.kind === 'WORLD_TEST_CHAMPIONSHIP' ? wtcCycleForYear(save, year) : undefined;
      return {
        id: plan.id,
        name: plan.name,
        type,
        format: plan.format,
        months: plan.months,
        teams: planCountries(save, plan, controlledCountry),
        selection:
          plan.kind === 'WORLD_TEST_CHAMPIONSHIP' && !cycle?.finalTeamIds
            ? 'QUALIFICATION_PENDING'
            : decision
              ? decision.selected
                ? 'SELECTED'
                : 'NOT_SELECTED'
              : undefined,
        selectionReason: decision?.reason,
      };
    }),
  };
}

/** Create or refresh a playable national squad, guaranteeing the user only when selected. */
export function ensureNationalTeam(
  save: SaveGame,
  countryId: string,
  mustIncludeId?: string,
  minimumXiOverall = 0,
): string {
  const id = `national-${countryId}`;
  const localPool = Object.values(save.players).filter(
    (player) => player.nationality === countryId && !player.retired && player.age < 40,
  );
  const currentXI = localPool.length >= 11 ? buildNationalXI(save, countryId) : [];
  const currentXiOverall = currentXI.length
    ? currentXI.reduce((sum, player) => sum + player.overall, 0) / currentXI.length
    : 0;
  if (
    localPool.length < 11 ||
    currentXiOverall < Math.max(nationalReplacementQualityFloor(countryId), minimumXiOverall)
  ) {
    const year = currentSeasonYear(save);
    const requestedQuality = Math.min(
      99,
      Math.max(nationalReplacementQuality(countryId), Math.ceil(minimumXiOverall + 3)),
    );
    const generated = generateManagerRoster({
      nationality: countryId,
      quality: requestedQuality,
      idPrefix: `national-refresh-${countryId}-${year}-${requestedQuality}`,
      rng: makeRng(
        stableNumber(`${save.id}:national-refresh:${countryId}:${year}:${requestedQuality}`),
      ),
    });
    liftGeneratedNationalCohort(generated, minimumXiOverall);
    for (const player of generated) {
      if (!save.players[player.id]) save.players[player.id] = player;
    }
  }
  const players = buildNationalXI(save, countryId, mustIncludeId);
  const existing = save.teams[id];
  const team: Team = existing ?? {
    id,
    name: `${getCountry(countryId)?.name ?? 'National'} XI`,
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

export function isInternationalFixture(fixture: Pick<Fixture, 'competition'> | undefined): boolean {
  return fixture?.competition === 'BILATERAL_SERIES' || fixture?.competition === 'INTL_TOURNAMENT';
}

function addFixtureToSeason(save: SaveGame, fixtureId: string): void {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (season && !season.fixtureIds.includes(fixtureId)) season.fixtureIds.push(fixtureId);
  const competitionId = save.fixtures[fixtureId]?.competitionId;
  const competition = season?.competitions?.find((item) => item.id === competitionId);
  if (competition && !competition.fixtureIds.includes(fixtureId)) {
    competition.fixtureIds.push(fixtureId);
  }
}

function removeLegacyCompressedWtc(
  save: SaveGame,
  seasonId: string,
  plan: InternationalWindowPlan,
): void {
  if (plan.kind !== 'WORLD_TEST_CHAMPIONSHIP') return;
  const legacy = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.seasonId === seasonId && fixture.competitionId === plan.id && !fixture.played,
  );
  if (legacy.length <= 1) return;
  const ids = new Set(legacy.map((fixture) => fixture.id));
  for (const id of ids) delete save.fixtures[id];
  const season = save.seasons[seasonId];
  if (season) season.fixtureIds = season.fixtureIds.filter((id) => !ids.has(id));
}

function removeUnplayedLegacyBilateralWindow(save: SaveGame, year: number): void {
  const legacyCompetitionIds = new Set([
    `bilateral-window-${year}`,
    `autumn-t20-tour-${year}`,
    `autumn-odi-tour-${year}`,
  ]);
  const legacyFixtures = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.seasonId === save.currentSeasonId &&
      Boolean(fixture.competitionId && legacyCompetitionIds.has(fixture.competitionId)),
  );
  const competitionsWithPlayedFixtures = new Set(
    legacyFixtures.filter((fixture) => fixture.played).map((fixture) => fixture.competitionId),
  );
  const legacyIds = new Set(
    legacyFixtures
      .filter((fixture) => !competitionsWithPlayedFixtures.has(fixture.competitionId))
      .map((fixture) => fixture.id),
  );
  if (!legacyIds.size) return;
  for (const fixtureId of legacyIds) removeFixture(save, fixtureId);
}

function isDynamicTournamentPlan(plan: InternationalWindowPlan): boolean {
  return plan.kind !== 'BILATERAL' && plan.kind !== 'WORLD_TEST_CHAMPIONSHIP';
}

function removeFixture(save: SaveGame, fixtureId: string): void {
  delete save.fixtures[fixtureId];
  for (const season of Object.values(save.seasons)) {
    season.fixtureIds = season.fixtureIds.filter((id) => id !== fixtureId);
    for (const competition of season.competitions ?? []) {
      competition.fixtureIds = competition.fixtureIds.filter((id) => id !== fixtureId);
    }
  }
}

function removeEagerTournamentKnockouts(
  save: SaveGame,
  seasonId: string,
  plan: InternationalWindowPlan,
): void {
  if (!isDynamicTournamentPlan(plan)) return;
  const state = save.internationalTournaments?.[plan.id];
  const stagedIds = new Set([state?.semiFinalFixtureId, state?.finalFixtureId].filter(Boolean));
  for (const fixture of Object.values(save.fixtures)) {
    if (
      fixture.seasonId === seasonId &&
      fixture.competitionId === plan.id &&
      !fixture.played &&
      (fixture.cupRound === 'Semi-Final' || fixture.cupRound === 'Final') &&
      !stagedIds.has(fixture.id)
    ) {
      removeFixture(save, fixture.id);
    }
  }
}

function createWindowFixtures(
  save: SaveGame,
  countryId: string,
  plan: InternationalWindowPlan,
  options: InternationalWindowOptions,
): string[] {
  const seasonId = save.currentSeasonId ?? `season-${plan.year}`;
  removeLegacyCompressedWtc(save, seasonId, plan);
  removeEagerTournamentKnockouts(save, seasonId, plan);
  const existing = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.seasonId === seasonId &&
        isInternationalFixture(fixture) &&
        fixture.competitionId === plan.id,
    )
    .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id));
  if (existing.length) {
    if (isDynamicTournamentPlan(plan)) {
      ensureInternationalTournamentState(save, countryId, plan, options, existing);
      progressInternationalTournament(save, plan.id);
    }
    return Object.values(save.fixtures)
      .filter((fixture) => fixture.seasonId === seasonId && fixture.competitionId === plan.id)
      .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id))
      .map((fixture) => fixture.id);
  }

  const countries = availableCountries(save, countryId).slice(0, Math.max(2, plan.teamCount));
  const availableOpponents = countries.filter((country) => country !== countryId);
  const opponentOffset = availableOpponents.length
    ? stableNumber(`${save.id}:${plan.id}:opponent`) % availableOpponents.length
    : 0;
  const rotatedOpponents = [
    ...availableOpponents.slice(opponentOffset),
    ...availableOpponents.slice(0, opponentOffset),
  ];
  const opponents = [...(options.opponentCountries ?? []), ...rotatedOpponents].filter(
    (country, index, list) => country !== countryId && list.indexOf(country) === index,
  );
  if (!opponents.length) return [];

  const controlledTeamId =
    options.controlledTeamId ?? ensureNationalTeam(save, countryId, options.mustIncludePlayerId);
  ensureNationalTeam(save, countryId, options.mustIncludePlayerId);
  const added: string[] = [];
  let round = 0;
  const slug = plan.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  const add = (opponentCountry: string, format: Format, stage: string, playoff = false): void => {
    const slot = plan.slots?.[round] ?? {
      month: plan.months[Math.min(round, plan.months.length - 1)] ?? 6,
      week: (round % 4) + 1,
    };
    round += 1;
    const opponentTeamId = ensureNationalTeam(
      save,
      opponentCountry,
      undefined,
      managerNationalOpponentFloor(save, controlledTeamId, countryId, opponentCountry),
    );
    const id = `intl-${plan.year}-${slug}-${round}`;
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
      competition: plan.kind === 'BILATERAL' ? 'BILATERAL_SERIES' : 'INTL_TOURNAMENT',
      competitionId: plan.id,
      calendarMonth: slot.month,
      calendarWeek: slot.week,
      managerPhase: options.managerPhase,
      wtcCycleId:
        plan.wtcPointsSeries || plan.kind === 'WORLD_TEST_CHAMPIONSHIP'
          ? options.wtcCycleId
          : undefined,
    };
    addFixtureToSeason(save, id);
    added.push(id);
  };

  if (plan.kind === 'BILATERAL') {
    for (let index = 0; index < plan.groupMatches; index += 1) {
      const format = plan.fixtureFormats?.[index] ?? plan.format;
      add(opponents[0], format, `${format} ${index + 1}`);
    }
  } else if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
    add(opponents[0], 'TEST', 'Final', true);
  } else {
    for (let index = 0; index < plan.groupMatches; index += 1) {
      add(opponents[index % opponents.length], plan.format, `Group Stage ${index + 1}`);
    }
    const groupFixtures = added.map((fixtureId) => save.fixtures[fixtureId]);
    ensureInternationalTournamentState(save, countryId, plan, options, groupFixtures);
  }

  return added;
}

function emptyTournamentStanding(
  countryId: string,
  competitionId: string,
  saveId: string,
): InternationalTournamentStanding {
  return {
    countryId,
    played: 0,
    won: 0,
    tied: 0,
    lost: 0,
    points: 0,
    tiebreak: stableNumber(`${saveId}:${competitionId}:tiebreak:${countryId}`),
  };
}

function applyTournamentOutcome(
  standings: Record<string, InternationalTournamentStanding>,
  competitionId: string,
  saveId: string,
  homeCountry: string,
  awayCountry: string,
  outcome: 'HOME_WIN' | 'AWAY_WIN' | 'TIE',
): void {
  const home = (standings[homeCountry] ??= emptyTournamentStanding(
    homeCountry,
    competitionId,
    saveId,
  ));
  const away = (standings[awayCountry] ??= emptyTournamentStanding(
    awayCountry,
    competitionId,
    saveId,
  ));
  home.played += 1;
  away.played += 1;
  if (outcome === 'HOME_WIN') {
    home.won += 1;
    away.lost += 1;
    home.points += 2;
  } else if (outcome === 'AWAY_WIN') {
    away.won += 1;
    home.lost += 1;
    away.points += 2;
  } else {
    home.tied += 1;
    away.tied += 1;
    home.points += 1;
    away.points += 1;
  }
}

function tournamentFixtureOutcome(fixture: Fixture): 'HOME_WIN' | 'AWAY_WIN' | 'TIE' {
  if (fixture.resultKind === 'HOME_WIN') return 'HOME_WIN';
  if (fixture.resultKind === 'AWAY_WIN') return 'AWAY_WIN';
  return 'TIE';
}

function tournamentStandings(
  save: SaveGame,
  state: InternationalTournamentState,
): InternationalTournamentStanding[] {
  const standings: Record<string, InternationalTournamentStanding> = {};
  for (const countryId of state.groupCountryIds) {
    standings[countryId] = emptyTournamentStanding(countryId, state.id, save.id);
  }

  for (const fixtureId of state.groupFixtureIds) {
    const fixture = save.fixtures[fixtureId];
    if (!fixture?.played) continue;
    const homeCountry = countryForTeam(save, fixture.homeTeamId);
    const awayCountry = countryForTeam(save, fixture.awayTeamId);
    if (!homeCountry || !awayCountry) continue;
    applyTournamentOutcome(
      standings,
      state.id,
      save.id,
      homeCountry,
      awayCountry,
      tournamentFixtureOutcome(fixture),
    );
  }

  const aiCountries = state.groupCountryIds.filter(
    (countryId) => countryId !== state.controlledCountryId,
  );
  for (let homeIndex = 0; homeIndex < aiCountries.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < aiCountries.length; awayIndex += 1) {
      const homeCountry = aiCountries[homeIndex];
      const awayCountry = aiCountries[awayIndex];
      const roll = stableNumber(`${save.id}:${state.id}:group:${homeCountry}:${awayCountry}`) % 7;
      applyTournamentOutcome(
        standings,
        state.id,
        save.id,
        homeCountry,
        awayCountry,
        roll === 0 ? 'TIE' : roll % 2 === 0 ? 'HOME_WIN' : 'AWAY_WIN',
      );
    }
  }

  state.standings = standings;
  return Object.values(standings).sort(
    (left, right) =>
      right.points - left.points ||
      right.won - left.won ||
      right.tiebreak - left.tiebreak ||
      left.countryId.localeCompare(right.countryId),
  );
}

function ensureInternationalTournamentState(
  save: SaveGame,
  countryId: string,
  plan: InternationalWindowPlan,
  options: InternationalWindowOptions,
  fixtures: Fixture[],
): InternationalTournamentState {
  save.internationalTournaments ??= {};
  const groupFixtures = fixtures
    .filter((fixture) => fixture.cupRound?.startsWith('Group Stage'))
    .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id));
  const fixtureCountries = groupFixtures
    .flatMap((fixture) => [
      countryForTeam(save, fixture.homeTeamId),
      countryForTeam(save, fixture.awayTeamId),
    ])
    .filter((candidate): candidate is string => Boolean(candidate));
  const participantCountries = [
    countryId,
    ...(options.opponentCountries ?? []),
    ...availableCountries(save, countryId),
  ].filter((candidate, index, all) => all.indexOf(candidate) === index);
  const groupCountryIds = [countryId, ...fixtureCountries.filter((item) => item !== countryId)]
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .slice(0, plan.groupMatches + 1);
  const controlledTeamId =
    options.controlledTeamId ??
    groupFixtures
      .flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])
      .find((teamId) => countryForTeam(save, teamId) === countryId) ??
    ensureNationalTeam(save, countryId, options.mustIncludePlayerId);

  const state = (save.internationalTournaments[plan.id] ??= {
    id: plan.id,
    year: plan.year,
    name: plan.name,
    format: plan.format,
    controlledCountryId: countryId,
    controlledTeamId,
    participantCountryIds: participantCountries.slice(0, plan.teamCount),
    groupCountryIds,
    groupFixtureIds: groupFixtures.map((fixture) => fixture.id),
    standings: {},
    stage: 'GROUP',
    rewardKeys: [],
    managerPhase: options.managerPhase,
  });
  state.name = plan.name;
  state.format = plan.format;
  state.controlledCountryId = countryId;
  state.controlledTeamId = controlledTeamId;
  state.participantCountryIds =
    state.participantCountryIds?.length > 0
      ? state.participantCountryIds
      : participantCountries.slice(0, plan.teamCount);
  state.groupCountryIds = groupCountryIds;
  state.groupFixtureIds = groupFixtures.map((fixture) => fixture.id);
  state.rewardKeys ??= [];
  state.managerPhase ??= options.managerPhase;
  tournamentStandings(save, state);
  return state;
}

function tournamentPlan(
  save: SaveGame,
  competitionId: string,
): InternationalWindowPlan | undefined {
  const state = save.internationalTournaments?.[competitionId];
  const year = state?.year ?? currentSeasonYear(save);
  return annualInternationalPlans(year).find((plan) => plan.id === competitionId);
}

function tournamentOpponent(
  save: SaveGame,
  state: InternationalTournamentState,
  stage: 'Semi-Final' | 'Final',
  excluded: string[] = [],
): string | undefined {
  const outsideGroup = state.participantCountryIds.filter(
    (countryId) =>
      countryId !== state.controlledCountryId &&
      !state.groupCountryIds.includes(countryId) &&
      !excluded.includes(countryId),
  );
  const fallback = state.participantCountryIds.filter(
    (countryId) => countryId !== state.controlledCountryId && !excluded.includes(countryId),
  );
  const candidates = outsideGroup.length ? outsideGroup : fallback;
  if (!candidates.length) return undefined;
  return candidates[stableNumber(`${save.id}:${state.id}:${stage}:opponent`) % candidates.length];
}

function stageTournamentFixture(
  save: SaveGame,
  state: InternationalTournamentState,
  plan: InternationalWindowPlan,
  stage: 'Semi-Final' | 'Final',
  opponentCountry: string,
): string {
  const existing = Object.values(save.fixtures).find(
    (fixture) => fixture.competitionId === plan.id && fixture.cupRound === stage,
  );
  if (existing) return existing.id;

  const stageOffset = stage === 'Semi-Final' ? 1 : 2;
  const round = plan.groupMatches + stageOffset;
  const slot = plan.slots?.[round - 1] ?? {
    month: plan.months[plan.months.length - 1] ?? 8,
    week: stage === 'Semi-Final' ? 2 : 4,
  };
  const slug = plan.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const id = `intl-${plan.year}-${slug}-${stage === 'Semi-Final' ? 'semi-final' : 'final'}`;
  const opponentTeamId = ensureNationalTeam(
    save,
    opponentCountry,
    undefined,
    managerNationalOpponentFloor(
      save,
      state.controlledTeamId,
      state.controlledCountryId,
      opponentCountry,
    ),
  );
  const fixture: Fixture = {
    id,
    seasonId: save.currentSeasonId ?? `season-${plan.year}`,
    format: plan.format,
    homeTeamId: state.controlledTeamId,
    awayTeamId: opponentTeamId,
    venue: `${plan.name} - ${stage}`,
    round,
    played: false,
    playoff: true,
    cupRound: stage,
    competition: 'INTL_TOURNAMENT',
    competitionId: plan.id,
    calendarMonth: slot.month,
    calendarWeek: slot.week,
    managerPhase: state.managerPhase,
  };
  save.fixtures[id] = fixture;
  addFixtureToSeason(save, id);
  return id;
}

function controlledCountryWon(
  save: SaveGame,
  state: InternationalTournamentState,
  fixture: Fixture,
): boolean {
  const winnerCountry = fixture.winnerTeamId
    ? countryForTeam(save, fixture.winnerTeamId)
    : fixture.resultKind === 'HOME_WIN'
      ? countryForTeam(save, fixture.homeTeamId)
      : fixture.resultKind === 'AWAY_WIN'
        ? countryForTeam(save, fixture.awayTeamId)
        : stableNumber(`${save.id}:${fixture.id}:knockout-tiebreak`) % 2 === 0
          ? countryForTeam(save, fixture.homeTeamId)
          : countryForTeam(save, fixture.awayTeamId);
  return winnerCountry === state.controlledCountryId;
}

function grantGroupEliminationRewards(save: SaveGame, state: InternationalTournamentState): void {
  const rewardKey = 'group-elimination';
  if (state.rewardKeys.includes(rewardKey)) return;
  state.rewardKeys.push(rewardKey);

  if (save.mode === 'career') {
    save.nationalRep = clamp((save.nationalRep ?? 0) + 3, 0, 100);
  } else if (save.managerProgression) {
    save.managerProgression.reputation = clamp(save.managerProgression.reputation + 2, 0, 100);
  }
  synchronizeSeasonPassState(save);
  if (save.pass) save.pass = addPassXp(save.pass, 150);

  const story = buildTournamentEliminationNewspaperStory(save, {
    competitionId: state.id,
    tournamentName: state.name,
    format: state.format,
    year: state.year,
    position: state.position ?? state.groupCountryIds.length,
    groupSize: state.groupCountryIds.length,
  });
  if (story) archiveNewspaperStory(save, story);
}

function progressInternationalTournament(save: SaveGame, competitionId: string): void {
  const state = save.internationalTournaments?.[competitionId];
  const plan = tournamentPlan(save, competitionId);
  if (!state || !plan || !isDynamicTournamentPlan(plan)) return;

  const standings = tournamentStandings(save, state);
  if (state.stage === 'GROUP') {
    if (
      state.groupFixtureIds.length < plan.groupMatches ||
      state.groupFixtureIds.some((fixtureId) => !save.fixtures[fixtureId]?.played)
    ) {
      return;
    }
    state.position = standings.findIndex((row) => row.countryId === state.controlledCountryId) + 1;
    if (state.position <= 0 || state.position > 2) {
      state.stage = 'ELIMINATED';
      state.eliminatedAt = 'GROUP';
      state.championCountryId =
        state.participantCountryIds.find((countryId) => countryId !== state.controlledCountryId) ??
        state.controlledCountryId;
      grantGroupEliminationRewards(save, state);
      save.internationalCalendar = buildIntlCalendar(state.year, save);
      return;
    }

    const opponent = tournamentOpponent(save, state, 'Semi-Final');
    if (!opponent) return;
    state.semiFinalFixtureId = stageTournamentFixture(save, state, plan, 'Semi-Final', opponent);
    state.stage = 'SEMI_FINAL';
  }

  if (state.stage === 'SEMI_FINAL' && state.semiFinalFixtureId) {
    const semiFinal = save.fixtures[state.semiFinalFixtureId];
    if (!semiFinal?.played) return;
    if (!controlledCountryWon(save, state, semiFinal)) {
      state.stage = 'ELIMINATED';
      state.eliminatedAt = 'SEMI_FINAL';
      state.championCountryId =
        countryForTeam(save, semiFinal.awayTeamId) ?? state.controlledCountryId;
      save.internationalCalendar = buildIntlCalendar(state.year, save);
      return;
    }
    const semiOpponent = countryForTeam(save, semiFinal.awayTeamId);
    const opponent = tournamentOpponent(save, state, 'Final', semiOpponent ? [semiOpponent] : []);
    if (!opponent) return;
    state.finalFixtureId = stageTournamentFixture(save, state, plan, 'Final', opponent);
    state.stage = 'FINAL';
  }

  if (state.stage === 'FINAL' && state.finalFixtureId) {
    const final = save.fixtures[state.finalFixtureId];
    if (!final?.played) return;
    const won = controlledCountryWon(save, state, final);
    state.stage = 'COMPLETE';
    state.eliminatedAt = won ? undefined : 'FINAL';
    state.championCountryId = won
      ? state.controlledCountryId
      : countryForTeam(save, final.awayTeamId);
    save.internationalCalendar = buildIntlCalendar(state.year, save);
  }
}

/** Advance an ICC bracket only after the completed fixture's result is durable. */
export function advanceInternationalTournament(save: SaveGame, fixture: Fixture): void {
  if (
    fixture.competition !== 'INTL_TOURNAMENT' ||
    !fixture.competitionId ||
    fixture.competitionId.startsWith('world-test-championship-')
  ) {
    return;
  }
  const plan = tournamentPlan(save, fixture.competitionId);
  if (!plan) return;
  const countryId =
    save.internationalTournaments?.[plan.id]?.controlledCountryId ??
    controlledInternationalCountry(save) ??
    countryForTeam(save, fixture.homeTeamId);
  if (!countryId) return;
  const competitionFixtures = Object.values(save.fixtures).filter(
    (candidate) => candidate.competitionId === plan.id,
  );
  ensureInternationalTournamentState(
    save,
    countryId,
    plan,
    {
      controlledTeamId:
        save.internationalTournaments?.[plan.id]?.controlledTeamId ?? fixture.homeTeamId,
      mustIncludePlayerId: save.mode === 'career' ? save.userPlayerId : undefined,
      managerPhase: fixture.managerPhase,
    },
    competitionFixtures,
  );
  progressInternationalTournament(save, plan.id);
}

function selectionThreshold(format: Format): number {
  if (format === 'TEST') return 68;
  if (format === 'ODI') return 66;
  return 64;
}

/** Calendar time between assignments restores availability, not attributes. */
function recoverBetweenInternationalAssignments(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  const resources = ensurePlayerCareerResources(save);
  if (!user || !resources) return;
  resources.playerCondition = clamp(resources.playerCondition + 35, 0, 100);
  user.condition = resources.playerCondition;
}

/** Format-specific national selection, persisted independently per assignment. */
export function internationalSelectionDecision(
  save: SaveGame,
  assignmentId: string,
  format: Format,
  forceRefresh = false,
): InternationalSelectionDecision {
  const year = currentSeasonYear(save);
  const resources = ensurePlayerCareerResources(save);
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const existing = resources?.internationalSelections?.[assignmentId];
  if (existing && !forceRefresh) return existing;

  const threshold = selectionThreshold(format);
  const userScore = user
    ? user.overall * 0.4 +
      user.meta.form * 0.35 +
      (save.nationalRep ?? 0) * 0.25 +
      careerFormatModifier(save, format)
    : 0;
  const priorSelections = Object.values(resources?.internationalSelections ?? {});
  const debutCallUp =
    Boolean(save.capped) &&
    (save.userCaps ?? 0) === 0 &&
    !priorSelections.some((decision) => decision.selected);

  let selected = debutCallUp || userScore >= threshold;
  let reason = debutCallUp
    ? `Selected for a debut tour after earning a senior national call-up.`
    : selected
      ? `Selected for ${format}: score ${Math.round(userScore)} meets the ${threshold} target.`
      : `Not selected for ${format}: score ${Math.round(userScore)} is below the ${threshold} target.`;
  if (!user || !resources) {
    selected = false;
    reason = 'Player career data is unavailable.';
  } else if (user.injury) {
    selected = false;
    reason = `Unavailable for ${format}: ${user.injury.type}.`;
  } else if (user.meta.form < 30) {
    selected = false;
    reason = `Dropped from the ${format} squad because international form is below 30.`;
  } else if (resources.playerCondition < 25) {
    selected = false;
    reason = `Rested from the ${format} squad because condition is below 25.`;
  }

  const decision: InternationalSelectionDecision = {
    assignmentId,
    format,
    year,
    selected,
    userScore: Math.round(userScore),
    threshold,
    reason,
  };
  if (resources) {
    resources.internationalSelections ??= {};
    resources.internationalSelections[assignmentId] = decision;
  }
  return decision;
}

function wtcCycleBounds(year: number): { startYear: number; endYear: number; id: string } {
  const offset = year - INTERNATIONAL_CYCLE_BASE_YEAR;
  const startYear =
    INTERNATIONAL_CYCLE_BASE_YEAR + Math.floor(offset / WTC_CYCLE_YEARS) * WTC_CYCLE_YEARS;
  const endYear = startYear + WTC_CYCLE_YEARS - 1;
  return { startYear, endYear, id: `wtc-${startYear}-${endYear}` };
}

function emptyWtcStanding(countryId: string): WtcStanding {
  return { countryId, played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
}

function ensureWtcCycle(save: SaveGame, year: number, countries: string[]): WtcCycleState {
  const bounds = wtcCycleBounds(year);
  save.wtcCycles ??= {};
  const cycle = (save.wtcCycles[bounds.id] ??= {
    ...bounds,
    standings: {},
    processedSeriesIds: [],
    recordedFixtureIds: [],
  });
  for (const country of countries) {
    cycle.standings[country] ??= emptyWtcStanding(country);
  }
  return cycle;
}

export function wtcCycleForYear(save: SaveGame, year: number): WtcCycleState | undefined {
  return save.wtcCycles?.[wtcCycleBounds(year).id];
}

export function wtcStandings(save: SaveGame, year: number): WtcStanding[] {
  const cycle = wtcCycleForYear(save, year);
  return Object.values(cycle?.standings ?? {}).sort(
    (left, right) =>
      right.points - left.points ||
      right.won - left.won ||
      left.played - right.played ||
      left.countryId.localeCompare(right.countryId),
  );
}

function applyWtcOutcome(
  cycle: WtcCycleState,
  homeCountry: string,
  awayCountry: string,
  result: 'HOME_WIN' | 'AWAY_WIN' | 'DRAW',
): void {
  const home = (cycle.standings[homeCountry] ??= emptyWtcStanding(homeCountry));
  const away = (cycle.standings[awayCountry] ??= emptyWtcStanding(awayCountry));
  home.played += 1;
  away.played += 1;
  if (result === 'HOME_WIN') {
    home.won += 1;
    away.lost += 1;
    home.points += 12;
  } else if (result === 'AWAY_WIN') {
    away.won += 1;
    home.lost += 1;
    away.points += 12;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 4;
    away.points += 4;
  }
}

function wtcPairings(
  countries: string[],
  year: number,
  cycle: WtcCycleState,
  round = 0,
): [string, string][] {
  const unique = [...new Set(countries)].slice(0, 8);
  if (unique.length % 2 === 1) unique.pop();
  if (unique.length < 2) return [];
  const anchor = unique[0];
  const rotating = unique.slice(1);
  const shift = (Math.max(0, year - cycle.startYear) * 5 + Math.max(0, round)) % rotating.length;
  const shifted = [anchor, ...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairings: [string, string][] = [];
  for (let index = 0; index < shifted.length / 2; index += 1) {
    pairings.push([shifted[index], shifted[shifted.length - 1 - index]]);
  }
  return pairings;
}

function simulateWtcSeries(
  saveId: string,
  cycle: WtcCycleState,
  seriesId: string,
  homeCountry: string,
  awayCountry: string,
  matchCount: number,
): void {
  if (cycle.processedSeriesIds.includes(seriesId)) return;
  for (let match = 1; match <= matchCount; match += 1) {
    const roll = stableNumber(`${saveId}:${seriesId}:${match}`) % 5;
    applyWtcOutcome(
      cycle,
      homeCountry,
      awayCountry,
      roll === 0 ? 'DRAW' : roll % 2 === 0 ? 'HOME_WIN' : 'AWAY_WIN',
    );
  }
  cycle.processedSeriesIds.push(seriesId);
}

function reopenSimulatedWtcSeries(
  save: SaveGame,
  cycle: WtcCycleState,
  seriesId: string,
  homeCountry: string,
  awayCountry: string,
  matchCount: number,
): void {
  if (!cycle.processedSeriesIds.includes(seriesId)) return;
  const home = cycle.standings[homeCountry];
  const away = cycle.standings[awayCountry];
  if (!home || !away) return;
  for (let match = 1; match <= matchCount; match += 1) {
    const roll = stableNumber(`${save.id}:${seriesId}:${match}`) % 5;
    const result = roll === 0 ? 'DRAW' : roll % 2 === 0 ? 'HOME_WIN' : 'AWAY_WIN';
    home.played = Math.max(0, home.played - 1);
    away.played = Math.max(0, away.played - 1);
    if (result === 'HOME_WIN') {
      home.won = Math.max(0, home.won - 1);
      away.lost = Math.max(0, away.lost - 1);
      home.points = Math.max(0, home.points - 12);
    } else if (result === 'AWAY_WIN') {
      away.won = Math.max(0, away.won - 1);
      home.lost = Math.max(0, home.lost - 1);
      away.points = Math.max(0, away.points - 12);
    } else {
      home.drawn = Math.max(0, home.drawn - 1);
      away.drawn = Math.max(0, away.drawn - 1);
      home.points = Math.max(0, home.points - 4);
      away.points = Math.max(0, away.points - 4);
    }
  }
  cycle.processedSeriesIds = cycle.processedSeriesIds.filter((id) => id !== seriesId);
}

function wtcSeriesId(assignmentId: string, countryA: string, countryB: string): string {
  return `wtc-series-${assignmentId}-${[countryA, countryB].sort().join('-')}`;
}

function processWtcAssignmentBackground(
  save: SaveGame,
  plan: InternationalWindowPlan,
  countries: string[],
  controlledCountry: string,
  controlledSeriesPlayable: boolean,
): { cycle: WtcCycleState; opponent?: string } {
  const cycle = ensureWtcCycle(save, plan.year, countries);
  let opponent: string | undefined;
  for (const [homeCountry, awayCountry] of wtcPairings(
    countries,
    plan.year,
    cycle,
    plan.wtcRound,
  )) {
    const controlledPair = homeCountry === controlledCountry || awayCountry === controlledCountry;
    if (controlledPair) opponent = homeCountry === controlledCountry ? awayCountry : homeCountry;
    if (controlledPair && controlledSeriesPlayable) continue;
    simulateWtcSeries(
      save.id,
      cycle,
      wtcSeriesId(plan.id, homeCountry, awayCountry),
      homeCountry,
      awayCountry,
      plan.groupMatches,
    );
  }
  return { cycle, opponent };
}

function processWtcBackgroundYear(
  save: SaveGame,
  year: number,
  countries: string[],
  controlledCountry: string,
): void {
  for (const plan of annualInternationalPlans(year).filter(
    (candidate) => candidate.wtcPointsSeries,
  )) {
    processWtcAssignmentBackground(save, plan, countries, controlledCountry, false);
  }
}

function allWtcAssignmentsResolved(save: SaveGame, year: number): boolean {
  if (save.mode !== 'career') return true;
  const selections = save.playerCareerResources?.internationalSelections ?? {};
  return annualInternationalPlans(year)
    .filter((plan) => plan.wtcPointsSeries)
    .every((plan) => Boolean(selections[plan.id]));
}

function managerPhaseForFormat(format: Format): ManagerCalendarPhase {
  if (format === 'TEST') return 'FIRST_CLASS';
  if (format === 'ODI') return 'LIST_A';
  return 'T20';
}

function controlledInternationalCountry(save: SaveGame): string | undefined {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  return (
    (save.managerNationalTeamId ? save.teams[save.managerNationalTeamId]?.country : undefined) ??
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    user?.nationality
  );
}

function stageWtcFinal(
  save: SaveGame,
  year: number,
  controlledCountry: string,
  options: InternationalWindowOptions = {},
): string[] {
  const cycle = wtcCycleForYear(save, year);
  if (!cycle || year !== cycle.endYear) return [];
  const pendingSeries = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.seasonId === save.currentSeasonId &&
      fixture.wtcCycleId === cycle.id &&
      !fixture.played,
  );
  if (pendingSeries.length) return [];

  const topTwo = wtcStandings(save, year)
    .slice(0, 2)
    .map((row) => row.countryId);
  if (topTwo.length < 2) return [];
  cycle.finalTeamIds = [topTwo[0], topTwo[1]];
  const plan = wtcFinalPlan(year);

  if (!topTwo.includes(controlledCountry)) {
    cycle.championCountryId = topTwo[stableNumber(`${save.id}:${cycle.id}:final`) % topTwo.length];
    save.internationalCalendar = buildIntlCalendar(year, save);
    return [];
  }

  if (save.mode === 'career') {
    const decision = internationalSelectionDecision(save, plan.id, 'TEST');
    if (!decision.selected) {
      cycle.championCountryId =
        topTwo[stableNumber(`${save.id}:${cycle.id}:final-unselected`) % topTwo.length];
      save.internationalCalendar = buildIntlCalendar(year, save);
      return [];
    }
  }
  const opponent = topTwo.find((country) => country !== controlledCountry);
  if (!opponent) return [];
  const ids = createWindowFixtures(save, controlledCountry, plan, {
    controlledTeamId: options.controlledTeamId,
    mustIncludePlayerId:
      options.mustIncludePlayerId ?? (save.mode === 'career' ? save.userPlayerId : undefined),
    managerPhase: options.managerPhase,
    opponentCountries: [opponent],
    wtcCycleId: cycle.id,
  });
  cycle.finalFixtureId = ids[0];
  save.internationalCalendar = buildIntlCalendar(year, save);
  return ids;
}

/** Fold a completed bilateral Test into the rolling WTC table exactly once. */
export function recordWtcFixtureResult(save: SaveGame, fixture: Fixture): void {
  if (!fixture.wtcCycleId || fixture.wtcPointsRecorded || !fixture.played) return;
  const cycle = save.wtcCycles?.[fixture.wtcCycleId];
  const homeCountry = countryForTeam(save, fixture.homeTeamId);
  const awayCountry = countryForTeam(save, fixture.awayTeamId);
  if (!cycle || !homeCountry || !awayCountry) return;

  if (
    fixture.competitionId === `world-test-championship-${currentSeasonYear(save)}` &&
    fixture.cupRound === 'Final'
  ) {
    cycle.championCountryId =
      fixture.resultKind === 'HOME_WIN'
        ? homeCountry
        : fixture.resultKind === 'AWAY_WIN'
          ? awayCountry
          : [homeCountry, awayCountry][stableNumber(`${save.id}:${cycle.id}:drawn-final`) % 2];
    fixture.wtcPointsRecorded = true;
    if (!cycle.recordedFixtureIds.includes(fixture.id)) {
      cycle.recordedFixtureIds.push(fixture.id);
    }
    save.internationalCalendar = buildIntlCalendar(currentSeasonYear(save), save);
    return;
  }

  applyWtcOutcome(
    cycle,
    homeCountry,
    awayCountry,
    fixture.resultKind === 'HOME_WIN'
      ? 'HOME_WIN'
      : fixture.resultKind === 'AWAY_WIN'
        ? 'AWAY_WIN'
        : 'DRAW',
  );
  fixture.wtcPointsRecorded = true;
  if (!cycle.recordedFixtureIds.includes(fixture.id)) cycle.recordedFixtureIds.push(fixture.id);
  const seriesId = wtcSeriesId(
    fixture.competitionId ?? `legacy-${currentSeasonYear(save)}`,
    homeCountry,
    awayCountry,
  );
  if (!cycle.processedSeriesIds.includes(seriesId)) cycle.processedSeriesIds.push(seriesId);
  const controlledCountry = controlledInternationalCountry(save);
  if (controlledCountry && allWtcAssignmentsResolved(save, currentSeasonYear(save))) {
    stageWtcFinal(save, currentSeasonYear(save), controlledCountry, {
      controlledTeamId: save.mode === 'manager' ? save.managerNationalTeamId : undefined,
      mustIncludePlayerId: save.mode === 'career' ? save.userPlayerId : undefined,
      managerPhase: save.mode === 'manager' ? 'FIRST_CLASS' : undefined,
    });
  }
}

/** Prepare assignment metadata without locking selection or creating fixtures early. */
export function prepareInternationalCalendar(save: SaveGame): void {
  if (!save.capped || !save.userPlayerId) return;
  const year = currentSeasonYear(save);
  removeUnplayedLegacyBilateralWindow(save, year);
  save.internationalCalendar = buildIntlCalendar(year, save);
}

function clearUnplayedInternationalAssignment(save: SaveGame, assignmentId: string): void {
  const removed = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.seasonId === save.currentSeasonId &&
        fixture.competitionId === assignmentId &&
        !fixture.played,
    )
    .map((fixture) => fixture.id);
  for (const fixtureId of removed) removeFixture(save, fixtureId);
  if (!removed.length) return;
  const playedAssignment = Object.values(save.fixtures).some(
    (fixture) => fixture.competitionId === assignmentId && fixture.played,
  );
  if (!playedAssignment && save.internationalTournaments?.[assignmentId]) {
    delete save.internationalTournaments[assignmentId];
  }
  for (const cycle of Object.values(save.wtcCycles ?? {})) {
    if (cycle.finalFixtureId && removed.includes(cycle.finalFixtureId)) {
      cycle.finalFixtureId = undefined;
      cycle.championCountryId = undefined;
    }
  }
}

/**
 * Re-evaluate one assignment when its calendar week arrives and create only
 * that assignment's fixtures. This prevents September form from deciding an
 * entire international year.
 */
export function generateInternationalAssignmentFixtures(
  save: SaveGame,
  assignmentId: string,
): { decision: InternationalSelectionDecision; fixtureIds: string[] } | undefined {
  if (!save.capped || !save.userPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  if (!user) return undefined;
  const resources = ensurePlayerCareerResources(save);
  const countryId = resources?.cappedCountry ?? resources?.declaredCountry ?? user.nationality;
  const year = currentSeasonYear(save);
  const plan = annualInternationalPlans(year).find((candidate) => candidate.id === assignmentId);
  if (!plan) return undefined;
  const countries = availableCountries(save, countryId).slice(0, 8);
  if (countries.length < 2) return undefined;

  removeUnplayedLegacyBilateralWindow(save, year);
  clearUnplayedInternationalAssignment(save, assignmentId);
  recoverBetweenInternationalAssignments(save);
  const decision = internationalSelectionDecision(save, plan.id, plan.format, true);
  const fixtureIds: string[] = [];

  if (plan.wtcPointsSeries) {
    const currentBounds = wtcCycleBounds(year);
    if (year === currentBounds.endYear) {
      processWtcBackgroundYear(save, year - 1, countries, countryId);
    }
    const cycle = ensureWtcCycle(save, year, countries);
    const controlledPair = wtcPairings(countries, year, cycle, plan.wtcRound).find(
      ([home, away]) => home === countryId || away === countryId,
    );
    if (controlledPair && decision.selected) {
      const seriesId = wtcSeriesId(plan.id, controlledPair[0], controlledPair[1]);
      const alreadyRecorded = cycle.recordedFixtureIds.some(
        (fixtureId) => save.fixtures[fixtureId]?.competitionId === plan.id,
      );
      if (!alreadyRecorded) {
        reopenSimulatedWtcSeries(
          save,
          cycle,
          seriesId,
          controlledPair[0],
          controlledPair[1],
          plan.groupMatches,
        );
      }
    }
    const background = processWtcAssignmentBackground(
      save,
      plan,
      countries,
      countryId,
      decision.selected,
    );
    if (decision.selected && background.opponent) {
      fixtureIds.push(
        ...createWindowFixtures(save, countryId, plan, {
          mustIncludePlayerId: save.userPlayerId,
          opponentCountries: [background.opponent],
          wtcCycleId: background.cycle.id,
        }),
      );
    }
  } else if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
    fixtureIds.push(...stageWtcFinal(save, year, countryId));
  } else if (decision.selected) {
    fixtureIds.push(
      ...createWindowFixtures(save, countryId, plan, {
        mustIncludePlayerId: save.userPlayerId,
      }),
    );
  }

  save.internationalCalendar = buildIntlCalendar(year, save);
  return {
    decision,
    fixtureIds: fixtureIds.length
      ? fixtureIds
      : internationalWindowFixtureIds(save).filter(
          (fixtureId) => save.fixtures[fixtureId]?.competitionId === assignmentId,
        ),
  };
}

/** Generate all selected Player Career assignments for audits and legacy callers. */
export function generateInternationalWindowFixtures(save: SaveGame): string[] {
  if (!save.capped || !save.userPlayerId) return [];
  const user = save.players[save.userPlayerId];
  if (!user) return [];
  const resources = ensurePlayerCareerResources(save);
  const countryId = resources?.cappedCountry ?? resources?.declaredCountry ?? user.nationality;
  const year = currentSeasonYear(save);
  removeUnplayedLegacyBilateralWindow(save, year);
  const plans = annualInternationalPlans(year);
  const countries = availableCountries(save, countryId).slice(0, 8);
  if (countries.length < 2) return [];
  const currentBounds = wtcCycleBounds(year);
  if (year === currentBounds.endYear) {
    processWtcBackgroundYear(save, year - 1, countries, countryId);
  }

  for (const plan of plans) {
    if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
      stageWtcFinal(save, year, countryId);
      continue;
    }
    const decision = internationalSelectionDecision(save, plan.id, plan.format);
    if (plan.wtcPointsSeries) {
      const { cycle, opponent } = processWtcAssignmentBackground(
        save,
        plan,
        countries,
        countryId,
        decision.selected,
      );
      if (decision.selected && opponent) {
        createWindowFixtures(save, countryId, plan, {
          mustIncludePlayerId: save.userPlayerId,
          opponentCountries: [opponent],
          wtcCycleId: cycle.id,
        });
      }
      continue;
    }
    if (decision.selected) {
      createWindowFixtures(save, countryId, plan, {
        mustIncludePlayerId: save.userPlayerId,
      });
    }
  }

  save.internationalCalendar = buildIntlCalendar(year, save);
  return internationalWindowFixtureIds(save);
}

/** Generate the same year-round programme used by Player Career for a National Manager. */
export function generateCountryInternationalWindowFixtures(
  save: SaveGame,
  countryId: string,
  options: InternationalWindowOptions = {},
): string[] {
  const year = currentSeasonYear(save);
  const plans = annualInternationalPlans(year);
  const countries = availableCountries(save, countryId).slice(0, 8);
  if (countries.length < 2) return [];
  const currentBounds = wtcCycleBounds(year);
  if (year === currentBounds.endYear) {
    processWtcBackgroundYear(save, year - 1, countries, countryId);
  }

  for (const plan of plans) {
    const managerPhase = managerPhaseForFormat(plan.format);
    if (plan.kind === 'WORLD_TEST_CHAMPIONSHIP') {
      stageWtcFinal(save, year, countryId, {
        ...options,
        managerPhase,
      });
      continue;
    }
    if (plan.wtcPointsSeries) {
      const { cycle, opponent } = processWtcAssignmentBackground(
        save,
        plan,
        countries,
        countryId,
        true,
      );
      if (opponent) {
        createWindowFixtures(save, countryId, plan, {
          ...options,
          managerPhase,
          opponentCountries: [opponent],
          wtcCycleId: cycle.id,
        });
      }
      continue;
    }
    createWindowFixtures(save, countryId, plan, {
      ...options,
      managerPhase,
    });
  }

  save.internationalCalendar = buildIntlCalendar(year, save);
  return internationalWindowFixtureIds(save);
}

export function internationalWindowFixtureIds(save: SaveGame): string[] {
  return Object.values(save.fixtures)
    .filter(
      (fixture) => fixture.seasonId === save.currentSeasonId && isInternationalFixture(fixture),
    )
    .sort(
      (left, right) =>
        seasonalMonthOrder(left.calendarMonth) - seasonalMonthOrder(right.calendarMonth) ||
        (left.calendarWeek ?? 1) - (right.calendarWeek ?? 1) ||
        left.round - right.round ||
        left.id.localeCompare(right.id),
    )
    .map((fixture) => fixture.id);
}

export function nextInternationalFixtureId(save: SaveGame): string | undefined {
  return internationalWindowFixtureIds(save).find((id) => !save.fixtures[id]?.played);
}

/** Mark the rest of a tour for AI simulation after a sustained form collapse. */
export function releaseFromInternationalTourIfOutOfForm(
  save: SaveGame,
  completedFixture: Fixture,
): string[] {
  if (
    save.mode !== 'career' ||
    !save.userPlayerId ||
    !completedFixture.competitionId ||
    !isInternationalFixture(completedFixture)
  ) {
    return [];
  }
  const user = save.players[save.userPlayerId];
  const assignmentAppearances = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.seasonId === save.currentSeasonId &&
      fixture.competitionId === completedFixture.competitionId &&
      fixture.played,
  ).length;
  // A single failure cannot erase a full tour. Selectors act only after at
  // least three appearances and genuinely collapsed form.
  if (!user || user.meta.form >= 30 || assignmentAppearances < 3) return [];
  const resources = ensurePlayerCareerResources(save);
  const decision = resources?.internationalSelections?.[completedFixture.competitionId];
  if (decision) {
    decision.selected = false;
    decision.reason = `Released to domestic cricket after sustained international form fell below 30.`;
  }
  return Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.seasonId === save.currentSeasonId &&
        fixture.competitionId === completedFixture.competitionId &&
        !fixture.played,
    )
    .map((fixture) => fixture.id);
}
