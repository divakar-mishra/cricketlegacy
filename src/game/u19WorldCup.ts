import { COUNTRIES, getCountry } from '../data/countries';
import {
  Fixture,
  Player,
  SaveGame,
  Team,
  U19WorldCupMeritSnapshot,
  U19WorldCupState,
  U19WorldCupStatus,
} from '../domain/types';
import { makeRng } from '../engine/rng';
import { generateRoster } from '../generation/players';
import { clamp } from '../utils/math';
import { isAvailable } from './injuries';
import { autoXI } from './squad';

export const U19_WORLD_CUP_OPPORTUNITY_AGE = 18 as const;
export const U19_WORLD_CUP_MIN_APPEARANCES = 3;
export const U19_WORLD_CUP_MIN_AVERAGE_RATING = 6;
export const U19_WORLD_CUP_MIN_READINESS = 0.55;

const U19_RUNS_TARGET = 320;
const U19_WICKETS_TARGET = 16;
const TOURNAMENT_SIZE = 6;
const FIXTURE_PREFIX = 'u19-world-cup-';
const TEAM_PREFIX = 'u19-national-';

const TEAM_COLORS: [string, string][] = [
  ['#17324D', '#F2C14E'],
  ['#0F5132', '#F8F9FA'],
  ['#7A1F2B', '#F4D35E'],
  ['#243B6B', '#F2F4F7'],
  ['#5B2A86', '#F5C542'],
  ['#0B5563', '#F4E9CD'],
];

export interface U19WorldCupMeritInput {
  fixtureId: string;
  runs: number;
  wickets: number;
  rating: number;
}

export interface U19WorldCupFixturesByRound {
  quarterFinals: Fixture[];
  semiFinals: Fixture[];
  final: Fixture[];
}

export interface U19WorldCupSelectionSummary {
  status: U19WorldCupStatus;
  merit: U19WorldCupMeritSnapshot;
  reason: string;
}

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function currentYear(save: SaveGame): number {
  return save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? new Date(save.updatedAt).getUTCFullYear())
    : new Date(save.updatedAt).getUTCFullYear();
}

function userPlayer(save: SaveGame): Player | undefined {
  return save.userPlayerId ? save.players[save.userPlayerId] : undefined;
}

function emptyMerit(): U19WorldCupMeritSnapshot {
  return {
    appearanceFixtureIds: [],
    appearances: 0,
    runs: 0,
    wickets: 0,
    ratingSum: 0,
    averageRating: 0,
    readiness: 0,
    qualified: false,
  };
}

function outputFraction(user: Player, runs: number, wickets: number): number {
  const batting = clamp(runs / U19_RUNS_TARGET, 0, 1.2);
  const bowling = clamp(wickets / U19_WICKETS_TARGET, 0, 1.2);
  if (user.role === 'BOWLER') return Math.min(1, bowling);
  if (user.role === 'BATTER' || user.role === 'WK_BATTER') return Math.min(1, batting);
  return Math.min(1, Math.max(batting, bowling) * 0.7 + Math.min(batting, bowling) * 0.3);
}

function refreshMerit(merit: U19WorldCupMeritSnapshot, user?: Player): void {
  merit.appearances = Math.max(0, Math.floor(merit.appearances || 0));
  merit.runs = Math.max(0, Math.floor(merit.runs || 0));
  merit.wickets = Math.max(0, Math.floor(merit.wickets || 0));
  merit.ratingSum = Math.max(0, Number.isFinite(merit.ratingSum) ? merit.ratingSum : 0);
  merit.averageRating = merit.appearances > 0 ? merit.ratingSum / merit.appearances : 0;
  const output = user ? outputFraction(user, merit.runs, merit.wickets) : 0;
  const rating = clamp((merit.averageRating - 4) / 4, 0, 1);
  merit.readiness = clamp(0.75 * output + 0.25 * rating, 0, 1);
  merit.qualified =
    merit.appearances >= U19_WORLD_CUP_MIN_APPEARANCES &&
    merit.averageRating >= U19_WORLD_CUP_MIN_AVERAGE_RATING &&
    merit.readiness >= U19_WORLD_CUP_MIN_READINESS;
}

function legacyMerit(save: SaveGame, user?: Player): U19WorldCupMeritSnapshot {
  const merit = emptyMerit();
  if (save.careerPathLevel !== 'U19') return merit;
  merit.appearances = Math.max(0, Math.floor(save.careerPathMatches ?? 0));
  merit.runs = Math.max(0, Math.floor(save.careerPathRuns ?? 0));
  merit.wickets = Math.max(0, Math.floor(save.careerPathWickets ?? 0));
  merit.ratingSum = Math.max(0, save.careerPathRatingSum ?? 0);
  merit.appearanceFixtureIds = Array.from(
    { length: merit.appearances },
    (_, index) => `legacy-u19-appearance-${index + 1}`,
  );
  refreshMerit(merit, user);
  return merit;
}

function newState(save: SaveGame): U19WorldCupState {
  const user = userPlayer(save);
  const merit = legacyMerit(save, user);
  const tooOld = (user?.age ?? U19_WORLD_CUP_OPPORTUNITY_AGE + 2) > 19;
  return {
    id: `${FIXTURE_PREFIX}${save.id}`,
    opportunityAge: U19_WORLD_CUP_OPPORTUNITY_AGE,
    status: tooOld ? 'NOT_SELECTED' : 'TRACKING',
    merit,
    controlledCountryId: user?.nationality,
    participantCountryIds: [],
    teamIds: [],
    quarterFinalFixtureIds: [],
    semiFinalFixtureIds: [],
  };
}

function normalizeState(save: SaveGame, state: U19WorldCupState): void {
  state.opportunityAge = U19_WORLD_CUP_OPPORTUNITY_AGE;
  state.merit ??= emptyMerit();
  state.merit.appearanceFixtureIds = [...new Set(state.merit.appearanceFixtureIds ?? [])];
  state.participantCountryIds = [...new Set(state.participantCountryIds ?? [])];
  state.teamIds = [...new Set(state.teamIds ?? [])];
  state.quarterFinalFixtureIds = [...new Set(state.quarterFinalFixtureIds ?? [])];
  state.semiFinalFixtureIds = [...new Set(state.semiFinalFixtureIds ?? [])];
  state.controlledCountryId ??= userPlayer(save)?.nationality;
  refreshMerit(state.merit, userPlayer(save));
}

function seededCountries(save: SaveGame, controlledCountryId: string): string[] {
  const pool = COUNTRIES.filter((country) => country.id !== controlledCountryId)
    .map((country) => ({
      country,
      tieBreak: hashSeed(`${save.id}:${currentYear(save)}:${country.id}:participant`),
    }))
    .sort(
      (left, right) =>
        right.country.strength - left.country.strength || left.tieBreak - right.tieBreak,
    )
    .slice(0, TOURNAMENT_SIZE - 1)
    .map(({ country }) => country.id);

  const participants = [controlledCountryId, ...pool];
  return participants.sort((left, right) => {
    const strengthDifference =
      (getCountry(right)?.strength ?? 1) - (getCountry(left)?.strength ?? 1);
    return (
      strengthDifference ||
      hashSeed(`${save.id}:${currentYear(save)}:${left}:seed`) -
        hashSeed(`${save.id}:${currentYear(save)}:${right}:seed`)
    );
  });
}

function shortCountryName(countryId: string): string {
  const name = getCountry(countryId)?.name ?? countryId;
  const words = name.split(/\s+/).filter(Boolean);
  return (
    words.length > 1 ? words.map((word) => word[0]).join('') : name.slice(0, 3)
  ).toUpperCase();
}

function replaceWithUser(save: SaveGame, team: Team, user: Player): void {
  if (team.playerIds.includes(user.id)) return;
  const candidates = team.playerIds
    .map((id) => save.players[id])
    .filter((player): player is Player => Boolean(player))
    .sort(
      (left, right) =>
        Number(left.role !== user.role) - Number(right.role !== user.role) ||
        left.overall - right.overall,
    );
  const victim = candidates[0];
  if (victim) {
    team.playerIds = team.playerIds.map((id) => (id === victim.id ? user.id : id));
    delete save.players[victim.id];
  } else {
    team.playerIds.push(user.id);
  }
}

function ensureNationalTeam(
  save: SaveGame,
  countryId: string,
  controlledCountryId: string,
  colorIndex: number,
): string {
  const teamId = `${TEAM_PREFIX}${countryId}`;
  let team = save.teams[teamId];
  if (!team) {
    const country = getCountry(countryId);
    const quality = 42 + (country?.strength ?? 1) * 5;
    const rng = makeRng(hashSeed(`${save.id}:${teamId}:squad`));
    const squad = generateRoster({ nationality: countryId, quality, idPrefix: teamId, rng });
    for (const player of squad) {
      player.age = 16 + Math.floor(rng() * 4);
      save.players[player.id] = player;
    }
    const colors = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
    team = {
      id: teamId,
      name: `${country?.name ?? countryId} Under-19`,
      shortName: shortCountryName(countryId),
      country: countryId,
      primaryColor: colors[0],
      secondaryColor: colors[1],
      playerIds: squad.map((player) => player.id),
      budget: 0,
      reputation: quality,
      isNationalTeam: true,
    };
    save.teams[teamId] = team;
  }

  const user = userPlayer(save);
  const controlled = countryId === controlledCountryId;
  if (controlled && user) replaceWithUser(save, team, user);
  const squad = team.playerIds
    .map((playerId) => save.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const forceUserId = controlled && user && isAvailable(user) ? user.id : undefined;
  team.xi = autoXI(squad, forceUserId).map((player) => player.id);
  return teamId;
}

function seasonForTournament(save: SaveGame, state: U19WorldCupState): string | undefined {
  const existingId = state.quarterFinalFixtureIds
    .map((fixtureId) => save.fixtures[fixtureId]?.seasonId)
    .find(Boolean);
  return existingId ?? save.currentSeasonId;
}

function appendFixtureToSeason(save: SaveGame, fixture: Fixture): void {
  const season = save.seasons[fixture.seasonId];
  if (season && !season.fixtureIds.includes(fixture.id)) season.fixtureIds.push(fixture.id);
}

function stageFixture(
  save: SaveGame,
  state: U19WorldCupState,
  input: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    round: number;
    label: string;
    calendarWeek: number;
  },
): Fixture | undefined {
  const existing = save.fixtures[input.id];
  if (existing) {
    appendFixtureToSeason(save, existing);
    return existing;
  }
  const seasonId = seasonForTournament(save, state);
  if (!seasonId) return undefined;
  const fixture: Fixture = {
    id: input.id,
    seasonId,
    format: 'ODI',
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    venue: input.label,
    round: input.round,
    played: false,
    playoff: true,
    competition: 'U19_WORLDCUP',
    competitionId: `u19-world-cup-${state.opportunityYear ?? currentYear(save)}`,
    cupRound: input.label,
    calendarMonth: 6,
    calendarWeek: input.calendarWeek,
  };
  save.fixtures[fixture.id] = fixture;
  appendFixtureToSeason(save, fixture);
  return fixture;
}

function fixtureWinner(save: SaveGame, fixture: Fixture): string {
  if (fixture.winnerTeamId === fixture.homeTeamId || fixture.winnerTeamId === fixture.awayTeamId) {
    return fixture.winnerTeamId;
  }
  const home = save.teams[fixture.homeTeamId];
  const away = save.teams[fixture.awayTeamId];
  const average = (team?: Team): number => {
    if (!team) return 0;
    const xi = (team.xi?.length ? team.xi : team.playerIds)
      .map((id) => save.players[id]?.overall)
      .filter((rating): rating is number => typeof rating === 'number');
    return xi.length
      ? xi.reduce((total, rating) => total + rating, 0) / xi.length
      : team.reputation;
  };
  const rng = makeRng(hashSeed(`${save.id}:${fixture.id}:knockout-result`));
  const homeScore = average(home) + rng() * 14;
  const awayScore = average(away) + rng() * 14;
  return homeScore >= awayScore ? fixture.homeTeamId : fixture.awayTeamId;
}

function normalizeKnockoutResult(save: SaveGame, fixture: Fixture): string {
  const winner = fixtureWinner(save, fixture);
  fixture.played = true;
  fixture.winnerTeamId = winner;
  fixture.resultKind = winner === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
  return winner;
}

function openingFixtureIds(state: U19WorldCupState): [string, string] {
  return [`${state.id}-qf1`, `${state.id}-qf2`];
}

function semiFinalFixtureIds(state: U19WorldCupState): [string, string] {
  return [`${state.id}-sf1`, `${state.id}-sf2`];
}

function finalFixtureId(state: U19WorldCupState): string {
  return `${state.id}-final`;
}

function ensureOpeningRound(save: SaveGame, state: U19WorldCupState): void {
  if (state.participantCountryIds.length !== TOURNAMENT_SIZE) return;
  const seeds = state.participantCountryIds.map((countryId) => `${TEAM_PREFIX}${countryId}`);
  const [qf1Id, qf2Id] = openingFixtureIds(state);
  stageFixture(save, state, {
    id: qf1Id,
    homeTeamId: seeds[2],
    awayTeamId: seeds[5],
    round: 1,
    label: 'U19 World Cup Quarter-Final 1',
    calendarWeek: 1,
  });
  stageFixture(save, state, {
    id: qf2Id,
    homeTeamId: seeds[3],
    awayTeamId: seeds[4],
    round: 1,
    label: 'U19 World Cup Quarter-Final 2',
    calendarWeek: 1,
  });
  state.quarterFinalFixtureIds = [qf1Id, qf2Id];
}

function ensureLaterRounds(save: SaveGame, state: U19WorldCupState): void {
  const qfs = state.quarterFinalFixtureIds.map((id) => save.fixtures[id]);
  if (qfs.length !== 2 || qfs.some((fixture) => !fixture?.played)) return;
  const qfWinners = qfs.map((fixture) => normalizeKnockoutResult(save, fixture!));
  const seeds = state.participantCountryIds.map((countryId) => `${TEAM_PREFIX}${countryId}`);
  const [sf1Id, sf2Id] = semiFinalFixtureIds(state);
  stageFixture(save, state, {
    id: sf1Id,
    homeTeamId: seeds[0],
    awayTeamId: qfWinners[1],
    round: 2,
    label: 'U19 World Cup Semi-Final 1',
    calendarWeek: 2,
  });
  stageFixture(save, state, {
    id: sf2Id,
    homeTeamId: seeds[1],
    awayTeamId: qfWinners[0],
    round: 2,
    label: 'U19 World Cup Semi-Final 2',
    calendarWeek: 2,
  });
  state.semiFinalFixtureIds = [sf1Id, sf2Id];

  const semis = state.semiFinalFixtureIds.map((id) => save.fixtures[id]);
  if (semis.some((fixture) => !fixture?.played)) return;
  const finalists = semis.map((fixture) => normalizeKnockoutResult(save, fixture!));
  const id = finalFixtureId(state);
  stageFixture(save, state, {
    id,
    homeTeamId: finalists[0],
    awayTeamId: finalists[1],
    round: 3,
    label: 'U19 World Cup Final',
    calendarWeek: 4,
  });
  state.finalFixtureId = id;
}

function controlledLostFixture(state: U19WorldCupState, fixture: Fixture): boolean {
  const controlled = state.controlledTeamId;
  return Boolean(
    controlled &&
    (fixture.homeTeamId === controlled || fixture.awayTeamId === controlled) &&
    fixture.played &&
    fixture.winnerTeamId !== controlled,
  );
}

function refreshTournamentStatus(save: SaveGame, state: U19WorldCupState): void {
  if (!state.controlledTeamId || state.status === 'NOT_SELECTED') return;
  for (const fixtureId of state.quarterFinalFixtureIds) {
    const fixture = save.fixtures[fixtureId];
    if (fixture && controlledLostFixture(state, fixture)) {
      state.status = 'ELIMINATED';
      state.eliminatedAt = 'QUARTER_FINAL';
    }
  }
  for (const fixtureId of state.semiFinalFixtureIds) {
    const fixture = save.fixtures[fixtureId];
    if (fixture && controlledLostFixture(state, fixture)) {
      state.status = 'ELIMINATED';
      state.eliminatedAt = 'SEMI_FINAL';
    }
  }
  const final = state.finalFixtureId ? save.fixtures[state.finalFixtureId] : undefined;
  if (!final?.played) return;
  state.championTeamId = normalizeKnockoutResult(save, final);
  if (state.championTeamId === state.controlledTeamId) {
    state.status = 'CHAMPION';
    state.eliminatedAt = undefined;
  } else if (
    final.homeTeamId === state.controlledTeamId ||
    final.awayTeamId === state.controlledTeamId
  ) {
    state.status = 'RUNNER_UP';
    state.eliminatedAt = 'FINAL';
  }
}

function prepareTournament(save: SaveGame, state: U19WorldCupState): void {
  const controlledCountryId = state.controlledCountryId ?? userPlayer(save)?.nationality;
  if (!controlledCountryId) return;
  state.controlledCountryId = controlledCountryId;
  state.opportunityYear ??= currentYear(save);
  if (state.participantCountryIds.length !== TOURNAMENT_SIZE) {
    state.participantCountryIds = seededCountries(save, controlledCountryId);
  }
  state.teamIds = state.participantCountryIds.map((countryId, index) =>
    ensureNationalTeam(save, countryId, controlledCountryId, index),
  );
  state.controlledTeamId = `${TEAM_PREFIX}${controlledCountryId}`;
  ensureOpeningRound(save, state);
  ensureLaterRounds(save, state);
}

function beginTournament(save: SaveGame, state: U19WorldCupState): void {
  state.status = 'SELECTED';
  state.opportunityYear = currentYear(save);
  prepareTournament(save, state);
  autoSettleU19WorldCupAI(save);
}

/**
 * Initialise and advance the one-time opportunity. Strong merit starts the
 * tournament at age 18; insufficient merit remains live for all of age 18 and
 * receives one final evaluation on entering age 19.
 */
export function synchronizeU19WorldCupState(save: SaveGame): U19WorldCupState | undefined {
  if (save.mode !== 'career' || !save.userPlayerId || !userPlayer(save)) return undefined;
  save.u19WorldCup ??= newState(save);
  const state = save.u19WorldCup;
  normalizeState(save, state);

  if (state.status === 'SELECTED' || state.status === 'ELIMINATED') {
    prepareTournament(save, state);
    autoSettleU19WorldCupAI(save);
    return state;
  }
  if (state.status !== 'TRACKING') return state;

  const user = userPlayer(save)!;
  if (user.age < U19_WORLD_CUP_OPPORTUNITY_AGE) return state;
  state.opportunityYear ??= currentYear(save);
  if (state.merit.qualified && user.age <= 19) {
    beginTournament(save, state);
    return state;
  }
  if (user.age <= U19_WORLD_CUP_OPPORTUNITY_AGE) return state;

  // Age 19 is the final legacy/fallback evaluation. The state becomes terminal
  // afterwards, so no later season can manufacture a second opportunity.
  state.status = 'NOT_SELECTED';
  state.opportunityYear ??= currentYear(save);
  return state;
}

/** Record one actual U19 appearance once, before ordinary promotion counters reset. */
export function recordU19WorldCupMerit(
  save: SaveGame,
  performance: U19WorldCupMeritInput,
): U19WorldCupMeritSnapshot | undefined {
  const state = synchronizeU19WorldCupState(save);
  const user = userPlayer(save);
  if (!state || !user || state.status !== 'TRACKING') return state?.merit;
  const fixture = save.fixtures[performance.fixtureId];
  if (
    !fixture ||
    fixture.competitionId !== 'youth-u19' ||
    state.merit.appearanceFixtureIds.includes(performance.fixtureId)
  ) {
    return state.merit;
  }
  state.merit.appearanceFixtureIds.push(performance.fixtureId);
  state.merit.appearances += 1;
  state.merit.runs += Math.max(0, Math.floor(performance.runs));
  state.merit.wickets += Math.max(0, Math.floor(performance.wickets));
  state.merit.ratingSum += clamp(performance.rating, 0, 10);
  refreshMerit(state.merit, user);
  // A qualifying age-18 performance should make selection immediate.
  synchronizeU19WorldCupState(save);
  return state.merit;
}

export function isU19WorldCupFixture(
  fixtureOrId: Pick<Fixture, 'id' | 'competition'> | string | undefined,
): boolean {
  if (!fixtureOrId) return false;
  if (typeof fixtureOrId === 'string') return fixtureOrId.startsWith(FIXTURE_PREFIX);
  return fixtureOrId.competition === 'U19_WORLDCUP' || fixtureOrId.id.startsWith(FIXTURE_PREFIX);
}

export function getU19WorldCupState(save: SaveGame): U19WorldCupState | undefined {
  return save.u19WorldCup;
}

export function getU19WorldCupFixturesByRound(save: SaveGame): U19WorldCupFixturesByRound {
  const state = save.u19WorldCup;
  const fixtures = (ids: string[]): Fixture[] =>
    ids.map((id) => save.fixtures[id]).filter((fixture): fixture is Fixture => Boolean(fixture));
  return {
    quarterFinals: fixtures(state?.quarterFinalFixtureIds ?? []),
    semiFinals: fixtures(state?.semiFinalFixtureIds ?? []),
    final: fixtures(state?.finalFixtureId ? [state.finalFixtureId] : []),
  };
}

export function u19WorldCupControlledTeamId(save: SaveGame): string | undefined {
  return save.u19WorldCup?.controlledTeamId;
}

export function nextU19WorldCupUserFixture(save: SaveGame): Fixture | undefined {
  const controlledTeamId = u19WorldCupControlledTeamId(save);
  if (!controlledTeamId || save.u19WorldCup?.status !== 'SELECTED') return undefined;
  const rounds = getU19WorldCupFixturesByRound(save);
  return [...rounds.quarterFinals, ...rounds.semiFinals, ...rounds.final]
    .filter(
      (fixture) =>
        !fixture.played &&
        (fixture.homeTeamId === controlledTeamId || fixture.awayTeamId === controlledTeamId),
    )
    .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id))[0];
}

export function nextU19WorldCupUserFixtureId(save: SaveGame): string | undefined {
  return nextU19WorldCupUserFixture(save)?.id;
}

/**
 * Settle every non-user tie in deterministic order and stage the next round.
 * This never simulates a fixture involving the controlled country.
 */
export function autoSettleU19WorldCupAI(save: SaveGame): void {
  const state = save.u19WorldCup;
  if (!state?.controlledTeamId || state.status === 'NOT_SELECTED') return;
  let guard = 0;
  while (guard++ < 20) {
    ensureLaterRounds(save, state);
    const rounds = getU19WorldCupFixturesByRound(save);
    const nextAI = [...rounds.quarterFinals, ...rounds.semiFinals, ...rounds.final]
      .filter(
        (fixture) =>
          !fixture.played &&
          fixture.homeTeamId !== state.controlledTeamId &&
          fixture.awayTeamId !== state.controlledTeamId,
      )
      .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id))[0];
    if (!nextAI) break;
    normalizeKnockoutResult(save, nextAI);
  }
  ensureLaterRounds(save, state);
  refreshTournamentStatus(save, state);
}

/** Normalize an actual result, advance its feeders, and settle remaining AI ties. */
export function progressU19WorldCupAfterResult(
  save: SaveGame,
  fixtureId: string,
): U19WorldCupState | undefined {
  const state = save.u19WorldCup;
  const fixture = save.fixtures[fixtureId];
  if (!state || !fixture || !isU19WorldCupFixture(fixture)) return state;
  normalizeKnockoutResult(save, fixture);
  refreshTournamentStatus(save, state);
  ensureLaterRounds(save, state);
  autoSettleU19WorldCupAI(save);
  refreshTournamentStatus(save, state);
  return state;
}

export function isU19WorldCupTournamentComplete(save: SaveGame): boolean {
  const state = save.u19WorldCup;
  if (!state?.finalFixtureId) return false;
  return Boolean(save.fixtures[state.finalFixtureId]?.played && state.championTeamId);
}

/** A selected player finishes this short tournament before a domestic handover. */
export function u19WorldCupBlocksPromotion(save: SaveGame): boolean {
  return save.u19WorldCup?.status === 'SELECTED' && !isU19WorldCupTournamentComplete(save);
}

export function u19WorldCupSelectionStatus(save: SaveGame): U19WorldCupSelectionSummary {
  const state = save.u19WorldCup;
  if (!state) {
    return {
      status: 'TRACKING',
      merit: emptyMerit(),
      reason: 'U19 selection has not opened yet.',
    };
  }
  const reason: Record<U19WorldCupStatus, string> = {
    TRACKING: state.merit.qualified
      ? 'Merit secured. Selection opens at age 18.'
      : 'Earn 3 U19 appearances, a 6.0 rating and 55% readiness.',
    SELECTED: 'Selected for the U19 World Cup.',
    NOT_SELECTED: 'The U19 World Cup selection window has closed.',
    ELIMINATED: 'Your U19 World Cup run has ended.',
    RUNNER_UP: 'U19 World Cup runners-up.',
    CHAMPION: 'U19 World Cup champions.',
  };
  return { status: state.status, merit: state.merit, reason: reason[state.status] };
}
