/**
 * Year-round international calendar for Player Career.
 *
 * Capped players retain their domestic contract. National assignments are
 * scheduled over the domestic calendar and take priority only when dates clash.
 * Global tournaments remain in June-August, while bilateral white-ball tours
 * and WTC Test series run during the domestic List A and First-Class blocks.
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
import { generateRoster } from '../generation/players';
import { makeRng } from '../engine/rng';
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
    months: [6],
    teamCount: 2,
    groupMatches: 0,
    slots: [{ month: 6, week: 1 }],
  };
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
  const cycleYear = cycleYearFor(year);
  const autumnFormat: Format = cycleYear === 1 || cycleYear === 3 ? 'T20' : 'ODI';
  const marquee = internationalWindowPlan(year);
  const plans: InternationalWindowPlan[] = [
    {
      year,
      cycleYear,
      id: `autumn-${autumnFormat.toLowerCase()}-tour-${year}`,
      name: `${autumnFormat} Bilateral Tour ${year}`,
      kind: 'BILATERAL',
      format: autumnFormat,
      months: [10, 11],
      teamCount: 2,
      groupMatches: 3,
      slots: [
        { month: 10, week: 1 },
        { month: 10, week: 3 },
        { month: 11, week: 2 },
      ],
    },
    {
      year,
      cycleYear,
      id: `wtc-test-series-${year}`,
      name: `WTC Test Series ${year}`,
      kind: 'BILATERAL',
      format: 'TEST',
      months: [1, 2],
      teamCount: 2,
      groupMatches: 2,
      slots: [
        { month: 1, week: 1 },
        { month: 2, week: 1 },
      ],
      wtcPointsSeries: true,
    },
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
  return [
    ...new Set([
      ...(controlledCountry ? [controlledCountry] : []),
      ...nationsWithPool(save, 11),
      ...nationalCountries,
      ...COUNTRIES.map((country) => country.id),
    ]),
  ];
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
): string {
  const id = `national-${countryId}`;
  const localPool = Object.values(save.players).filter(
    (player) => player.nationality === countryId && !player.retired,
  );
  if (localPool.length < 11) {
    const country = getCountry(countryId);
    const generated = generateRoster({
      nationality: countryId,
      quality: 56 + (country?.strength ?? 2) * 5,
      idPrefix: `national-pool-${countryId}`,
      rng: makeRng(stableNumber(`${save.id}:national-pool:${countryId}`)),
    });
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
  const competitionId = `bilateral-window-${year}`;
  const legacyIds = new Set(
    Object.values(save.fixtures)
      .filter(
        (fixture) =>
          fixture.seasonId === save.currentSeasonId &&
          fixture.competitionId === competitionId &&
          !fixture.played,
      )
      .map((fixture) => fixture.id),
  );
  if (!legacyIds.size) return;
  for (const fixtureId of legacyIds) delete save.fixtures[fixtureId];
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (season) {
    season.fixtureIds = season.fixtureIds.filter((fixtureId) => !legacyIds.has(fixtureId));
  }
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
  const opponents = [
    ...(options.opponentCountries ?? []),
    ...countries.filter((country) => country !== countryId),
  ].filter((country, index, list) => country !== countryId && list.indexOf(country) === index);
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
    const opponentTeamId = ensureNationalTeam(save, opponentCountry);
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
): InternationalTournamentStanding {
  return {
    countryId,
    played: 0,
    won: 0,
    tied: 0,
    lost: 0,
    points: 0,
    tiebreak: stableNumber(`${competitionId}:tiebreak:${countryId}`),
  };
}

function applyTournamentOutcome(
  standings: Record<string, InternationalTournamentStanding>,
  competitionId: string,
  homeCountry: string,
  awayCountry: string,
  outcome: 'HOME_WIN' | 'AWAY_WIN' | 'TIE',
): void {
  const home = (standings[homeCountry] ??= emptyTournamentStanding(homeCountry, competitionId));
  const away = (standings[awayCountry] ??= emptyTournamentStanding(awayCountry, competitionId));
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
    standings[countryId] = emptyTournamentStanding(countryId, state.id);
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
      const roll = stableNumber(`${state.id}:group:${homeCountry}:${awayCountry}`) % 7;
      applyTournamentOutcome(
        standings,
        state.id,
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
  return candidates[stableNumber(`${state.id}:${stage}:opponent`) % candidates.length];
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
  const opponentTeamId = ensureNationalTeam(save, opponentCountry);
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
        : stableNumber(`${fixture.id}:knockout-tiebreak`) % 2 === 0
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

    const opponent = tournamentOpponent(state, 'Semi-Final');
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
    const opponent = tournamentOpponent(state, 'Final', semiOpponent ? [semiOpponent] : []);
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
  } else if (user.meta.form < 40) {
    selected = false;
    reason = `Dropped from the ${format} squad because international form is below 40.`;
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

function wtcPairings(countries: string[], year: number, cycle: WtcCycleState): [string, string][] {
  const unique = [...new Set(countries)].slice(0, 8);
  if (unique.length % 2 === 1) unique.pop();
  if (unique.length < 2) return [];
  const anchor = unique[0];
  const rotating = unique.slice(1);
  const shift = Math.max(0, year - cycle.startYear) % rotating.length;
  const shifted = [anchor, ...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairings: [string, string][] = [];
  for (let index = 0; index < shifted.length / 2; index += 1) {
    pairings.push([shifted[index], shifted[shifted.length - 1 - index]]);
  }
  return pairings;
}

function simulateWtcSeries(
  cycle: WtcCycleState,
  year: number,
  homeCountry: string,
  awayCountry: string,
): void {
  const seriesId = wtcSeriesId(year, homeCountry, awayCountry);
  if (cycle.processedSeriesIds.includes(seriesId)) return;
  for (let match = 1; match <= 2; match += 1) {
    const roll = stableNumber(`${seriesId}:${match}`) % 5;
    applyWtcOutcome(
      cycle,
      homeCountry,
      awayCountry,
      roll === 0 ? 'DRAW' : roll % 2 === 0 ? 'HOME_WIN' : 'AWAY_WIN',
    );
  }
  cycle.processedSeriesIds.push(seriesId);
}

function wtcSeriesId(year: number, countryA: string, countryB: string): string {
  return `wtc-series-${year}-${[countryA, countryB].sort().join('-')}`;
}

function processWtcBackgroundYear(
  save: SaveGame,
  year: number,
  countries: string[],
  controlledCountry: string,
  controlledSeriesPlayable: boolean,
): { cycle: WtcCycleState; opponent?: string } {
  const cycle = ensureWtcCycle(save, year, countries);
  let opponent: string | undefined;
  for (const [homeCountry, awayCountry] of wtcPairings(countries, year, cycle)) {
    const controlledPair = homeCountry === controlledCountry || awayCountry === controlledCountry;
    if (controlledPair) opponent = homeCountry === controlledCountry ? awayCountry : homeCountry;
    if (controlledPair && controlledSeriesPlayable) continue;
    simulateWtcSeries(cycle, year, homeCountry, awayCountry);
  }
  return { cycle, opponent };
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
    cycle.championCountryId = topTwo[stableNumber(`${cycle.id}:final`) % topTwo.length];
    save.internationalCalendar = buildIntlCalendar(year, save);
    return [];
  }

  if (save.mode === 'career') {
    const decision = internationalSelectionDecision(save, plan.id, 'TEST');
    if (!decision.selected) {
      cycle.championCountryId =
        topTwo[stableNumber(`${cycle.id}:final-unselected`) % topTwo.length];
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
          : [homeCountry, awayCountry][stableNumber(`${cycle.id}:drawn-final`) % 2];
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
  const seriesId = wtcSeriesId(currentSeasonYear(save), homeCountry, awayCountry);
  if (!cycle.processedSeriesIds.includes(seriesId)) cycle.processedSeriesIds.push(seriesId);
  const controlledCountry = controlledInternationalCountry(save);
  if (controlledCountry) {
    stageWtcFinal(save, currentSeasonYear(save), controlledCountry, {
      controlledTeamId: save.mode === 'manager' ? save.managerNationalTeamId : undefined,
      mustIncludePlayerId: save.mode === 'career' ? save.userPlayerId : undefined,
      managerPhase: save.mode === 'manager' ? 'OFF_SEASON' : undefined,
    });
  }
}

/** Generate all selected Player Career assignments for the current year. */
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
  const added: string[] = [];

  const autumn = plans[0];
  const autumnSelection = internationalSelectionDecision(save, autumn.id, autumn.format);
  if (autumnSelection.selected) {
    added.push(
      ...createWindowFixtures(save, countryId, autumn, {
        mustIncludePlayerId: save.userPlayerId,
      }),
    );
  }

  const winter = plans[1];
  const winterSelection = internationalSelectionDecision(save, winter.id, 'TEST');
  const currentBounds = wtcCycleBounds(year);
  if (year === currentBounds.endYear) {
    processWtcBackgroundYear(save, year - 1, countries, countryId, false);
  }
  const { cycle, opponent } = processWtcBackgroundYear(
    save,
    year,
    countries,
    countryId,
    winterSelection.selected,
  );
  if (winterSelection.selected && opponent) {
    added.push(
      ...createWindowFixtures(save, countryId, winter, {
        mustIncludePlayerId: save.userPlayerId,
        opponentCountries: [opponent],
        wtcCycleId: cycle.id,
      }),
    );
  }

  for (const marquee of plans.slice(2)) {
    if (marquee.kind === 'WORLD_TEST_CHAMPIONSHIP') {
      added.push(...stageWtcFinal(save, year, countryId));
    } else {
      const marqueeSelection = internationalSelectionDecision(save, marquee.id, marquee.format);
      if (marqueeSelection.selected) {
        added.push(
          ...createWindowFixtures(save, countryId, marquee, {
            mustIncludePlayerId: save.userPlayerId,
          }),
        );
      }
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
  const added: string[] = [];

  const autumn = plans[0];
  added.push(
    ...createWindowFixtures(save, countryId, autumn, {
      ...options,
      managerPhase: 'LIST_A',
    }),
  );

  const winter = plans[1];
  const currentBounds = wtcCycleBounds(year);
  if (year === currentBounds.endYear) {
    processWtcBackgroundYear(save, year - 1, countries, countryId, false);
  }
  const { cycle, opponent } = processWtcBackgroundYear(save, year, countries, countryId, true);
  if (opponent) {
    added.push(
      ...createWindowFixtures(save, countryId, winter, {
        ...options,
        managerPhase: 'FIRST_CLASS',
        opponentCountries: [opponent],
        wtcCycleId: cycle.id,
      }),
    );
  }

  for (const marquee of plans.slice(2)) {
    if (marquee.kind === 'WORLD_TEST_CHAMPIONSHIP') {
      added.push(
        ...stageWtcFinal(save, year, countryId, {
          ...options,
          managerPhase: 'OFF_SEASON',
          wtcCycleId: cycle.id,
        }),
      );
    } else {
      added.push(
        ...createWindowFixtures(save, countryId, marquee, {
          ...options,
          managerPhase: 'OFF_SEASON',
        }),
      );
    }
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

/** Mark the rest of a tour for AI simulation when international form collapses. */
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
  if (!user || user.meta.form >= 40) return [];
  const resources = ensurePlayerCareerResources(save);
  const decision = resources?.internationalSelections?.[completedFixture.competitionId];
  if (decision) {
    decision.selected = false;
    decision.reason = `Released to domestic cricket after international form fell below 40.`;
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

/** Top-N teams by ICC ranking points. */
export function topIccTeams(save: SaveGame, n = 5): { teamId: string; points: number }[] {
  const rankings = save.iccRankings ?? {};
  return Object.entries(rankings)
    .map(([teamId, points]) => ({ teamId, points }))
    .sort((left, right) => right.points - left.points)
    .slice(0, n);
}
