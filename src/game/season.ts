import {
  Conditions,
  DailyChallenge,
  Fixture,
  Format,
  League,
  LeagueRow,
  ManagerCareerLevel,
  MatchState,
  Player,
  SaveGame,
} from '../domain/types';
import { pickStadium, Stadium } from '../data/stadiums';
import { grantRetirementCollections } from './vip';
import { approachBias } from '../engine/intent';
import { LiveMatch } from '../engine/liveMatch';
import { makeRng, weightedSample } from '../engine/rng';
import { simulateMatch, TeamSide, TeamTactics } from '../engine/simulateMatch';
import { buildDoubleRoundRobin, buildRoundRobin, DIV1_LEAGUE_ID } from '../generation/world';
import {
  applyPromotionRelegation,
  applyThreeTierPromotionRelegation,
  hasDivisions,
  hasThreeDivisions,
  syncLeaguesToDivisions,
  syncThreeTierLeagues,
} from './divisions';
import {
  boardTargetFor,
  broadcastIncome,
  evaluateBoardObjective,
  leaguePosition,
  prizeFor,
  seasonWageBill,
} from './finance';
import { refreshFreeAgents, rolloverSquads } from './lifecycle';
import { recallLoan } from './manager';
import {
  careerPlayingTeamId,
  generateYouthFixtures,
  isYouthFixture,
  nextYouthFixtureId,
  youthSeasonComplete,
} from './youthFixtures';
import {
  allowedCompetitionIds,
  applyManagerLevelPromotion,
  ensureIccFixtures,
  recordManagerFinish,
  recordManagerTitle,
  tickManagerCareerSeason,
} from './managerCareer';
import { runAiTransferWindow } from './transferMarket';
import { CONTINENTAL_PRIZE, resolveContinental } from './continental';
import { developPlayer } from './progression';
import { trainingAttributeCeiling } from './youthBalance';
import { recordTitle, updateRecords } from './records';
import { resolveXI } from './squad';
import { applyMatchToStats, resetSeasonStats } from './stats';
import { prepareCareerPlayerForMatch, tickCareerResidency, validateAgeEligibility } from './career';
import { synchronizeCareerPromotion } from './careerTransition';
import { clamp } from '../utils/math';
import { activeLeadershipForXI } from './leadership';
import { processManagerFixtureTraining } from './managerTraining';
import {
  advanceManagerCalendar as advanceManagerCalendarEngine,
  applyManagerCalendarMatchEffects,
  applyManagerPyramidRollover,
  buildManagerSeasonCalendar,
  managerCalendarEnabled,
  managerControlledTeamId,
  managerPhaseComplete,
  managerPhaseProgress,
  nextManagerUserFixtureId,
  refreshManagerNationalTeams,
} from './managerCalendar';
import {
  advanceInternationalTournament,
  prepareInternationalCalendar,
  internationalWindowFixtureIds,
  isInternationalFixture,
  nextInternationalFixtureId,
  recordWtcFixtureResult,
} from './intlCalendar';
import {
  buildPlayerSeasonCalendar,
  currentPlayerCalendarEvent,
  markPlayerCalendarMatchComplete,
  resolvePlayerCalendarEvent,
} from './playerCalendar';
import { applyPendingPlayerCountryMove } from './playerMigration';
import { isPlayerFranchiseFixture, playerAffiliationTeamId } from './playerAffiliations';
import { matchDecisionAuthority } from './matchAuthority';
import {
  gateReceiptsForFixtureIds,
  isNeutralClubFinal,
  settleFixtureGate,
  stadiumCapacity,
} from './stadiumManagement';
import { activeManagerClub } from './managerClubState';
import {
  managerClubKitSponsorIncomeForSeason,
  settleManagerEarnedSponsorshipForFixture,
} from './sponsorship';
import {
  autoSettleU19WorldCupAI,
  isU19WorldCupFixture,
  nextU19WorldCupUserFixtureId,
  progressU19WorldCupAfterResult,
  synchronizeU19WorldCupState,
  u19WorldCupBlocksPromotion,
} from './u19WorldCup';
import {
  updateInternationalPlayerRankingPeaks,
  updateInternationalTeamRankings,
} from './internationalRankings';

const DEFAULT_TACTICS = { batting: 'BALANCED', bowling: 'CONTAIN', field: 'BALANCED' } as const;
const LEGACY_PLAYOFF_IDS = { sf1: 'po-SF1', sf2: 'po-SF2', final: 'po-F' } as const;

/**
 * Knockout fixture IDs are save-wide idempotency keys, so they must not be
 * reused in a later season. Existing in-progress saves can still own the old
 * fixed IDs; new brackets are scoped to their season ID.
 */
function playoffFixtureIds(save: SaveGame): { sf1: string; sf2: string; final: string } {
  const seasonId = save.currentSeasonId ?? 'season-unknown';
  const hasCurrentLegacyBracket = Object.values(LEGACY_PLAYOFF_IDS).some(
    (id) => save.fixtures[id]?.seasonId === seasonId,
  );
  if (hasCurrentLegacyBracket) return LEGACY_PLAYOFF_IDS;
  return {
    sf1: `po-${seasonId}-SF1`,
    sf2: `po-${seasonId}-SF2`,
    final: `po-${seasonId}-F`,
  };
}

/** Transient only: prevents the virtual franchise roster from injecting the
 * protagonist while their club plays without them (bench/national duty). */
const careerPlayerSuppressed = new WeakSet<SaveGame>();

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const WEATHERS: Conditions['weather'][] = ['CLEAR', 'OVERCAST', 'HUMID'];

/** Conditions weighted by a venue's playing character (pace/spin/scoring bias). */
export function conditionsForStadium(st: Stadium, seed: number): Conditions {
  const r = makeRng((seed ^ 0x51ed270b) >>> 0);
  const pitchWeights: Record<Conditions['pitch'], number> = {
    GREEN: 1.1 * st.paceBias,
    DRY: 1,
    DUSTY: 1.1 * st.spinBias,
    FLAT: 1.1 * st.scoringBias,
    CRACKED: 0.7 * Math.max(st.paceBias, st.spinBias),
  };
  const pitch = weightedSample(pitchWeights, r) as Conditions['pitch'];
  return { pitch, weather: WEATHERS[Math.floor(r() * WEATHERS.length)] };
}

/** Choose a home venue for a fixture and derive its conditions (deterministic). */
export function venueForFixture(
  save: SaveGame,
  fx: Fixture,
  seed: number,
): { stadium: Stadium; conditions: Conditions } {
  const homeCountry = save.teams[fx.homeTeamId]?.country ?? 'india';
  const picked = pickStadium(homeCountry, makeRng((seed ^ 0xabcdef) >>> 0));
  const ownedGround =
    save.mode === 'manager' &&
    save.managerCareerLevel !== 'NATIONAL' &&
    !isNeutralClubFinal(fx) &&
    fx.homeTeamId === save.userTeamId
      ? activeManagerClub(save)?.stadium
      : undefined;
  // Manager home fixtures use the club's persistent, upgradeable ground
  // identity. Pitch characteristics still come from the deterministic local
  // venue model, while capacity/revenue comes from stadiumManagement.
  const stadium: Stadium = ownedGround
    ? {
        ...picked,
        id: `club-ground:${fx.homeTeamId}`,
        name: ownedGround.name,
        capacity: stadiumCapacity(ownedGround),
      }
    : picked;
  if (fx.managerPhase === 'LIST_A') {
    return { stadium, conditions: { pitch: 'FLAT', weather: 'CLEAR' } };
  }
  if (fx.managerPhase === 'FIRST_CLASS') {
    return { stadium, conditions: { pitch: 'GREEN', weather: 'OVERCAST' } };
  }
  if (fx.managerPhase === 'T20') {
    return { stadium, conditions: { pitch: 'DRY', weather: 'CLEAR' } };
  }
  return { stadium, conditions: conditionsForStadium(stadium, seed) };
}

/** The user's tactic (from the store) or a neutral default. */
function userTactics(save: SaveGame): TeamTactics {
  const t = save.tactics ?? DEFAULT_TACTICS;
  return { battingBias: approachBias(t.batting), bowlerPlan: t.bowling, field: t.field };
}

/** AI rival-manager personalities — each club has a distinct tactical identity. */
export type ManagerStyle = 'AGGRESSOR' | 'PRAGMATIST' | 'TACTICIAN' | 'DEFENDER';

const STYLES: ManagerStyle[] = ['AGGRESSOR', 'PRAGMATIST', 'TACTICIAN', 'DEFENDER'];

/** Deterministic per-club manager personality (stable across the save). */
export function managerStyleFor(teamId: string): ManagerStyle {
  return STYLES[hashSeed(`mgr:${teamId}`) % STYLES.length];
}

/**
 * Personality + reputation driven AI tactics so rival clubs feel distinct (an
 * Aggressor throws everything forward; a Defender shuts up shop). Field setting
 * is left unset for AI so the verified season balance is preserved; the user's
 * chosen field is what tilts their own matches.
 */
export function aiTacticsFor(team: { id: string; reputation: number }): TeamTactics {
  const strong = team.reputation >= 66;
  switch (managerStyleFor(team.id)) {
    case 'AGGRESSOR':
      return { battingBias: approachBias('AGGRESSIVE'), bowlerPlan: 'ATTACK' };
    case 'DEFENDER':
      return { battingBias: approachBias('DEFENSIVE'), bowlerPlan: 'CONTAIN' };
    case 'TACTICIAN':
      return { battingBias: approachBias(strong ? 'BALANCED' : 'DEFENSIVE'), bowlerPlan: 'VARY' };
    case 'PRAGMATIST':
    default:
      return {
        battingBias: approachBias(strong ? 'AGGRESSIVE' : 'BALANCED'),
        bowlerPlan: strong ? 'ATTACK' : 'VARY',
      };
  }
}

export function teamSide(
  save: SaveGame,
  teamId: string,
  controlledTeamId = save.userTeamId,
  format?: Format,
  managerPrepared = false,
): TeamSide {
  const team = save.teams[teamId];
  const isFranchiseMatch =
    save.mode === 'career' &&
    format === 'T20' &&
    Boolean(save.franchiseTeamId) &&
    controlledTeamId === save.franchiseTeamId &&
    !team.isNationalTeam;
  let rosterIds = team.playerIds;
  // A player can hold separate domestic and franchise contracts, so their
  // persistent domestic roster entry must never leak into a background match
  // controlled by the other affiliation. This also protects older saves whose
  // previous club still retains a stale roster entry after a move.
  if (
    save.mode === 'career' &&
    save.userPlayerId &&
    !team.isNationalTeam &&
    teamId !== controlledTeamId
  ) {
    rosterIds = rosterIds.filter((id) => id !== save.userPlayerId);
  }
  if (isFranchiseMatch && save.userPlayerId) {
    if (teamId === save.franchiseTeamId && !careerPlayerSuppressed.has(save)) {
      rosterIds = [...new Set([...rosterIds, save.userPlayerId])];
    } else {
      rosterIds = rosterIds.filter((id) => id !== save.userPlayerId);
    }
  }
  const squad = rosterIds.map((id) => save.players[id]).filter(Boolean);
  // No forced inclusion: the persisted XI (merit-selected in career, manual in
  // manager) decides who plays — so an out-of-form career player can be dropped.
  const resolvedPlayers = resolveXI(squad, team.xi);
  const players = resolvedPlayers.map((player) => {
    const careerPlayer = format ? prepareCareerPlayerForMatch(save, player, format) : player;
    return prepareManagerPlayerForMatch(
      save,
      careerPlayer,
      teamId === controlledTeamId,
      managerPrepared,
    );
  });
  const tactics = teamId === controlledTeamId ? userTactics(save) : aiTacticsFor(team);
  const leadership =
    save.mode === 'manager'
      ? activeLeadershipForXI(
          save,
          teamId,
          resolvedPlayers.map((player) => player.id),
        )
      : undefined;
  return { teamId, players, tactics, leadershipBonus: leadership?.bonus };
}

function scaleMatchValue(value: number, multiplier: number): number {
  return Math.round(clamp(value * multiplier, 1, 99));
}

/**
 * Temporary manager match modifier. It makes condition and morale actionable
 * without permanently rewriting player ratings in the save.
 */
export function prepareManagerPlayerForMatch(
  save: SaveGame,
  player: Player,
  controlled: boolean,
  managerPrepared: boolean,
): Player {
  if (save.mode !== 'manager') return player;
  // Retained in the public signature for old saves/tests. Neither flag grants
  // a hidden rating modifier; preparation matters through its real systems.
  void controlled;
  void managerPrepared;
  const condition = clamp(player.condition ?? 100, 0, 100);
  const morale = clamp(player.morale ?? 60, 0, 100);
  const conditionMultiplier = Math.max(0.88, 1 - Math.max(0, 70 - condition) * 0.003);
  const moraleMultiplier = 1 + clamp((morale - 50) * 0.001, -0.03, 0.03);
  // Preparation already has real effects through chosen tactics, team talks,
  // morale and condition. Merely confirming the preparation screen must not
  // grant a hidden all-attribute boost.
  const multiplier = conditionMultiplier * moraleMultiplier;
  if (multiplier === 1) return player;
  const scaleRecord = <T extends object>(values: T): T =>
    Object.fromEntries(
      Object.entries(values as Record<string, number>).map(([key, value]) => [
        key,
        scaleMatchValue(value, multiplier),
      ]),
    ) as T;
  return {
    ...player,
    batting: scaleRecord(player.batting),
    bowling: scaleRecord(player.bowling),
    fielding: scaleRecord(player.fielding),
    meta: scaleRecord(player.meta),
    overall: scaleMatchValue(player.overall, multiplier),
  };
}

function managerPreparedForFixture(save: SaveGame, fixtureId: string): boolean {
  return Boolean(
    save.mode === 'manager' &&
    (save.flags?.[`teamTalk:${fixtureId}`] || save.flags?.[`tactics:${fixtureId}`]),
  );
}

export function fixtureList(save: SaveGame): Fixture[] {
  return Object.values(save.fixtures);
}

function leagueForFixture(save: SaveGame, fx: Fixture): League | undefined {
  const candidates = Object.values(save.leagues).filter(
    (league) => league.teamIds.includes(fx.homeTeamId) && league.teamIds.includes(fx.awayTeamId),
  );
  return (
    candidates.find(
      (league) => fx.divisionTier == null || league.divisionTier === fx.divisionTier,
    ) ?? candidates[0]
  );
}

const runRate = (runs: number, balls: number): number => (balls > 0 ? runs / (balls / 6) : 0);

export type ResolvedMatchResult =
  | { kind: 'HOME_WIN'; winnerTeamId: string }
  | { kind: 'AWAY_WIN'; winnerTeamId: string }
  | { kind: 'TIE' }
  | { kind: 'NO_RESULT' };

export function resolveMatchResult(match: MatchState, fx: Fixture): ResolvedMatchResult {
  const res = match.result;
  if (!res) return { kind: 'NO_RESULT' };
  if (res.tie) return { kind: 'TIE' };
  if (res.winnerTeamId === fx.homeTeamId) return { kind: 'HOME_WIN', winnerTeamId: fx.homeTeamId };
  if (res.winnerTeamId === fx.awayTeamId) return { kind: 'AWAY_WIN', winnerTeamId: fx.awayTeamId };
  return { kind: 'NO_RESULT' };
}

function controlledTeamForFixture(
  save: SaveGame,
  fx: Fixture,
  fixtureId: string,
): string | undefined {
  if (fx.managerPhase) return managerControlledTeamId(save, fx.managerPhase);
  if (isInternationalFixture(fx)) return fx.homeTeamId;
  return careerPlayingTeamId(save, fixtureId);
}

function normalizeLeagueRow(row: LeagueRow): void {
  row.played = Math.max(0, Math.round(row.played || 0));
  row.won = Math.max(0, Math.round(row.won || 0));
  row.lost = Math.max(0, Math.round(row.lost || 0));
  row.tied = Math.max(0, Math.round(row.tied || 0));
  row.noResult = Math.max(0, Math.round(row.noResult || 0));
  const parts = row.won + row.lost + row.tied + row.noResult;
  if (row.played !== parts) row.played = parts;
  row.points = Math.max(0, Math.round(row.points || 0));
  if (!Number.isFinite(row.netRunRate)) row.netRunRate = 0;
}

function updateTable(league: League, match: MatchState, fx: Fixture): void {
  const h = league.table.find((r) => r.teamId === fx.homeTeamId);
  const a = league.table.find((r) => r.teamId === fx.awayTeamId);
  if (!h || !a) return;

  normalizeLeagueRow(h);
  normalizeLeagueRow(a);
  const prev: Record<string, number> = { [h.teamId]: h.played, [a.teamId]: a.played };
  h.played++;
  a.played++;

  const resolved = resolveMatchResult(match, fx);
  if (resolved.kind === 'TIE') {
    h.tied++;
    a.tied++;
    h.points++;
    a.points++;
  } else if (resolved.kind === 'NO_RESULT') {
    h.noResult++;
    a.noResult++;
    h.points++;
    a.points++;
  } else if (resolved.kind === 'HOME_WIN') {
    h.won++;
    a.lost++;
    h.points += 2;
  } else {
    a.won++;
    h.lost++;
    a.points += 2;
  }

  if (match.innings.length === 2) {
    for (const row of [h, a]) {
      const forInn = match.innings.find((i) => i.battingTeamId === row.teamId);
      const againstInn = match.innings.find((i) => i.battingTeamId !== row.teamId);
      if (!forInn || !againstInn) continue;
      const matchNrr =
        runRate(forInn.runs, forInn.balls) - runRate(againstInn.runs, againstInn.balls);
      const played = prev[row.teamId];
      row.netRunRate = (row.netRunRate * played + matchNrr) / (played + 1);
    }
  }
}

export function runFixture(save: SaveGame, fixtureId: string): MatchState {
  const fx = save.fixtures[fixtureId];
  if (!fx) throw new Error(`Unknown fixture: ${fixtureId}`);
  if (fx.played) throw new Error(`Fixture already completed: ${fixtureId}`);
  const controlledTeamId = controlledTeamForFixture(save, fx, fixtureId);
  const seed = hashSeed(`${save.id}:${fixtureId}`);
  const { stadium, conditions } = venueForFixture(save, fx, seed);
  const managerPrepared = managerPreparedForFixture(save, fixtureId);
  fx.stadiumId = stadium.id;
  fx.venue = stadium.name;
  return simulateMatch({
    id: fixtureId,
    seed,
    format: fx.format,
    conditions,
    home: teamSide(save, fx.homeTeamId, controlledTeamId, fx.format, managerPrepared),
    away: teamSide(save, fx.awayTeamId, controlledTeamId, fx.format, managerPrepared),
    difficulty: save.difficulty,
    difficultyBalanceProfile: save.mode === 'manager' ? 'MANAGER' : 'PLAYER',
    userTeamId: controlledTeamId,
    rain: true, // season auto-sim can be rain-affected (DLS)
    focusPlayerId: save.mode === 'career' ? save.userPlayerId : undefined,
  });
}

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function playerCompetitionMonth(
  competitionId: 'list-a' | 'first-class' | 't20-league',
  round: number,
): number {
  if (competitionId === 'list-a') return Math.min(11, 9 + Math.floor((round - 1) / 3));
  if (competitionId === 'first-class') {
    return [12, 1, 1, 2, 2, 3, 3][Math.max(0, Math.min(6, round - 1))];
  }
  return Math.min(5, 3 + Math.floor((round - 1) / 5));
}

function playerLeagueTiers(save: SaveGame): { league: League; tier: 1 | 2 | 3 }[] {
  return Object.values(save.leagues)
    .filter((league) => league.teamIds.length > 0)
    .map((league, index) => ({
      league,
      tier: league.divisionTier ?? ((index + 1) as 1 | 2 | 3),
    }))
    .filter((item) => item.tier >= 1 && item.tier <= 3);
}

function buildPlayerT20Fixtures(
  save: SaveGame,
  seasonId: string,
  year: number,
): Record<string, Fixture> {
  if (!hasThreeDivisions(save)) {
    const league = save.leagues[DIV1_LEAGUE_ID] ?? Object.values(save.leagues)[0];
    return buildRoundRobin(
      league.teamIds,
      seasonId,
      league.format,
      save.teams,
      `fx-${year}`,
      't20-league',
    );
  }

  const fixtures: Record<string, Fixture> = {};
  for (const { league, tier } of playerLeagueTiers(save)) {
    const tierFixtures = buildDoubleRoundRobin(
      league.teamIds,
      seasonId,
      league.format,
      save.teams,
      `fx-t20-${year}-t${tier}`,
      't20-league',
    );
    for (const fixture of Object.values(tierFixtures)) {
      fixture.divisionTier = tier;
      fixtures[fixture.id] = fixture;
    }
  }
  return fixtures;
}

/** True when the fixture contributes to the main league table (T20 round-robin). */
function isLeagueTableFixture(fx: Fixture): boolean {
  if (fx.competition && fx.competition !== 'LEAGUE') return false;
  // Only T20-league or untagged (old saves) fixtures update the standings.
  return !fx.competitionId || fx.competitionId === 't20-league';
}

/**
 * Calendar months walked as a season progresses. Chosen so the transfer window
 * (Jan/Jun/Jul/Dec — see transferMarket.TRANSFER_WINDOW_MONTHS) is OPEN pre-season
 * (Jul) and again in a mid/late window (Dec–Jan), and CLOSED while the league is
 * in full swing (Aug–Nov). This is what actually drives the window open/closed.
 */
export const SEASON_MONTH_TRACK = [7, 8, 9, 10, 11, 12, 1, 2];

/** Map the user team's league progress onto the season calendar month. */
export function seasonProgressMonth(save: SaveGame): number {
  const userTeam =
    save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  if (!userTeam) return SEASON_MONTH_TRACK[0];
  const league = fixtureList(save).filter(
    (fx) =>
      isLeagueTableFixture(fx) &&
      !fx.playoff &&
      (fx.homeTeamId === userTeam || fx.awayTeamId === userTeam),
  );
  const total = league.length;
  if (total === 0) return SEASON_MONTH_TRACK[0];
  const played = league.filter((fx) => fx.played).length;
  const idx = Math.min(
    SEASON_MONTH_TRACK.length - 1,
    Math.floor((played / total) * SEASON_MONTH_TRACK.length),
  );
  return SEASON_MONTH_TRACK[idx];
}

/** Advance the in-game calendar month from season progress (drives transfer windows). */
export function updateCalendarMonth(save: SaveGame): void {
  if (managerCalendarEnabled(save)) return;
  save.currentMonth = seasonProgressMonth(save);
}

/**
 * Auto-heal a loaded save's season/calendar state so old saves and edge cases
 * cannot dead-end or show impossible values. Idempotent and defensive: safe to
 * run on every load. Mutates and returns the same save for convenience.
 */
export function validateSeasonState(save: SaveGame): SaveGame {
  if (!save.flags) save.flags = {};

  // A few older builds could persist the completed-result ledger while leaving
  // the fixture's `played` bit stale. That combination reopened the same match
  // forever. The ledger is written only after a genuine completed result, so it
  // is safe to use as the recovery authority.
  for (const [flag, recorded] of Object.entries(save.flags)) {
    if (!recorded || !flag.startsWith('resultCount:')) continue;
    const fixtureId = flag.slice('resultCount:'.length);
    const fixture = save.fixtures?.[fixtureId];
    if (!fixture || fixture.played) continue;
    fixture.played = true;
    fixture.resultMatchId ??= fixtureId;
  }

  // currentSeasonId must point at a real season.
  if (save.currentSeasonId && !save.seasons?.[save.currentSeasonId]) {
    const ids = Object.keys(save.seasons ?? {});
    if (ids.length) save.currentSeasonId = ids[ids.length - 1];
  }

  // Calendar month must be a real month; otherwise derive it from progress.
  if (
    save.currentMonth == null ||
    !Number.isFinite(save.currentMonth) ||
    save.currentMonth < 1 ||
    save.currentMonth > 12
  ) {
    save.currentMonth = seasonProgressMonth(save);
  }

  // Wallet can never be negative / fractional after a bad migration.
  if (save.wallet) {
    save.wallet.coins = Math.max(0, Math.round(save.wallet.coins || 0));
    save.wallet.gems = Math.max(0, Math.round(save.wallet.gems || 0));
    save.wallet.energy = Math.max(0, Math.floor(save.wallet.energy || 0));
  }

  for (const league of Object.values(save.leagues ?? {})) {
    for (const row of league.table ?? []) normalizeLeagueRow(row);
  }

  // Drop fixtures that reference teams no longer in the save (prevents crashes).
  if (save.fixtures) {
    for (const id of Object.keys(save.fixtures)) {
      const fx = save.fixtures[id];
      if (!save.teams?.[fx.homeTeamId] || !save.teams?.[fx.awayTeamId]) {
        delete save.fixtures[id];
      }
    }
  }

  return save;
}

export function applyResult(save: SaveGame, match: MatchState): void {
  const fx = save.fixtures[match.id];
  if (!fx || fx.played) return;
  const u19WorldCupStatusBefore = save.u19WorldCup?.status;
  const resolved = resolveMatchResult(match, fx);
  fx.played = true;
  fx.resultMatchId = match.id;
  fx.resultKind = resolved.kind;
  fx.winnerTeamId =
    resolved.kind === 'HOME_WIN' || resolved.kind === 'AWAY_WIN'
      ? resolved.winnerTeamId
      : undefined;
  updateInternationalTeamRankings(save, fx);
  // Every Manager result path, including legacy calendar auto-sims, settles
  // club-owned earned sponsorship here. Weekly premium remains in the caller
  // that knows which club the user actively managed for this fixture.
  settleManagerEarnedSponsorshipForFixture(save, fx);
  settleFixtureGate(save, fx);
  recordWtcFixtureResult(save, fx);
  advanceInternationalTournament(save, fx);
  if (isU19WorldCupFixture(fx)) {
    const state = progressU19WorldCupAfterResult(save, fx.id);
    if (u19WorldCupStatusBefore !== 'CHAMPION' && state?.status === 'CHAMPION') {
      recordTitle(save, 'U19 World Cup', currentYear(save));
      const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
      if (user && !user.awards?.includes('U19 World Cup Champion')) {
        user.awards = [...(user.awards ?? []), 'U19 World Cup Champion'];
      }
    }
  }
  if (managerCalendarEnabled(save)) {
    // Over-rate discipline is judged from the XI and attributes that entered
    // the match. Post-match recovery/development is settled immediately after.
    applyManagerCalendarMatchEffects(save, fx, match);
    processManagerFixtureTraining(save, fx, match);
  }
  if (!fx.playoff && fx.competition !== 'CUP' && isLeagueTableFixture(fx)) {
    const league = leagueForFixture(save, fx);
    if (league) updateTable(league, match, fx);
  }
  applyMatchToStats(save, match);
  updateInternationalPlayerRankingPeaks(save, fx);
  updateRecords(save, match, currentYear(save));

  // Progress the knockout bracket: stage the semis once the league is done,
  // then the final once both semis are decided.
  ensurePlayoffs(save);
  if (fx.playoff && fx.id === playoffFixtureIds(save).final) {
    save.championTeamId = match.result?.winnerTeamId ?? standings(save)[0]?.teamId;
  }

  // Player fixtures carry their real competition month; legacy leagues derive it.
  if (save.mode === 'career' && fx.calendarMonth) save.currentMonth = fx.calendarMonth;
  else updateCalendarMonth(save);
  if (save.mode === 'career') markPlayerCalendarMatchComplete(save, fx.id);
}

export function nextUserFixtureId(save: SaveGame): string | undefined {
  const t = save.userTeamId;
  if (!t) return undefined;
  if (managerCalendarEnabled(save)) return nextManagerUserFixtureId(save);

  // Youth players (SCHOOL / U19) only interact with dedicated youth fixtures.
  // The professional league auto-sims in the background.
  const level = save.mode === 'career' ? (save.careerPathLevel ?? 'DOMESTIC') : 'DOMESTIC';
  if (level === 'SCHOOL' || level === 'U19') {
    synchronizeU19WorldCupState(save);
    let calendarEvent = currentPlayerCalendarEvent(save);
    // Repair a stale cursor from an older build. Completed or deleted fixtures
    // can never be handed back as the next playable match.
    for (let guard = 0; guard < 4 && calendarEvent?.kind === 'MATCH'; guard += 1) {
      const fixture = calendarEvent.fixtureId ? save.fixtures[calendarEvent.fixtureId] : undefined;
      if (fixture && !fixture.played) break;
      calendarEvent.completed = true;
      calendarEvent.outcome = fixture?.played ? 'Fixture completed.' : 'Fixture unavailable.';
      calendarEvent = currentPlayerCalendarEvent(save);
    }
    if (calendarEvent?.kind === 'MATCH' && calendarEvent.fixtureId) {
      return calendarEvent.fixtureId;
    }
    if (calendarEvent) return undefined;
    return nextU19WorldCupUserFixtureId(save) ?? nextYouthFixtureId(save);
  }

  // Senior players follow the domestic calendar: List A, First-Class, then T20.
  if (save.mode === 'career') {
    ensureCompetitionFixtures(save, 'list-a');
    ensureCompetitionFixtures(save, 'first-class');
    if (save.capped) prepareInternationalCalendar(save);
    let calendarEvent = currentPlayerCalendarEvent(save);
    for (let guard = 0; guard < 8 && calendarEvent?.kind === 'MATCH'; guard += 1) {
      const fixture = calendarEvent.fixtureId ? save.fixtures[calendarEvent.fixtureId] : undefined;
      if (fixture && !fixture.played) break;
      calendarEvent.completed = true;
      calendarEvent.outcome = fixture?.played ? 'Fixture completed.' : 'Fixture unavailable.';
      calendarEvent = currentPlayerCalendarEvent(save);
    }
    if (calendarEvent?.kind === 'MATCH' && calendarEvent.fixtureId) {
      return calendarEvent.fixtureId;
    }
    if (calendarEvent) return undefined;
  }

  // Legacy/manager saves without calendar metadata use the T20 circuit.
  const NON_LEAGUE: import('../domain/types').Competition[] = [
    'CUP',
    'U19_WORLDCUP',
    'BILATERAL_SERIES',
    'INTL_TOURNAMENT',
  ];
  const t20TeamId = playerAffiliationTeamId(save, 't20-league') ?? t;
  const domestic = fixtureList(save).find(
    (fx) =>
      !fx.played &&
      !NON_LEAGUE.includes(fx.competition as import('../domain/types').Competition) &&
      (!fx.competitionId || fx.competitionId === 't20-league') &&
      (fx.homeTeamId === t20TeamId || fx.awayTeamId === t20TeamId),
  )?.id;
  if (domestic) return domestic;

  if (save.mode === 'career' && save.capped) {
    prepareInternationalCalendar(save);
    const final = save.fixtures[playoffFixtureIds(save).final];
    if (leagueComplete(save) && final?.played) return nextInternationalFixtureId(save);
  }
  return undefined;
}

/**
 * Lazily generate fixtures for a non-T20 competition (Feature 4).
 * Called when the user first picks List-A or First-Class from the hub.
 * Returns the generated fixture ids, or [] if already generated.
 */
export function ensureCompetitionFixtures(
  save: SaveGame,
  competitionId: 'list-a' | 'first-class',
): string[] {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (!season?.competitions) return [];
  const comp = season.competitions.find((c) => c.id === competitionId);
  if (!comp) return [];
  if (managerCalendarEnabled(save)) return comp.fixtureIds;

  const seasonId = save.currentSeasonId ?? season.id;
  const year = season.year;

  const isOdi = competitionId === 'list-a';
  const fmt: Format = isOdi ? 'ODI' : 'TEST';
  const prefix = isOdi ? `fx-odi-${year}` : `fx-fc-${year}`;
  const planned = playerLeagueTiers(save).flatMap(({ league, tier }) =>
    Object.values(
      buildRoundRobin(
        league.teamIds,
        seasonId,
        fmt,
        save.teams,
        `${prefix}-t${tier}`,
        competitionId,
      ),
    ).map((fixture) => ({ ...fixture, divisionTier: tier })),
  );
  const matchupKey = (fixture: Fixture) =>
    [fixture.homeTeamId, fixture.awayTeamId].sort().join(':');
  const existingByMatchup = new Map(
    comp.fixtureIds
      .map((id) => save.fixtures[id])
      .filter((fixture): fixture is Fixture => Boolean(fixture))
      .map((fixture) => [matchupKey(fixture), fixture]),
  );

  const fixtureIds = planned.map((fixture) => {
    const existing = existingByMatchup.get(matchupKey(fixture));
    if (existing) {
      existing.round = fixture.round;
      existing.calendarMonth = playerCompetitionMonth(competitionId, fixture.round);
      existing.divisionTier = fixture.divisionTier;
      return existing.id;
    }

    let id = fixture.id;
    if (save.fixtures[id]) id = `${fixture.id}-full`;
    save.fixtures[id] = {
      ...fixture,
      id,
      calendarMonth: playerCompetitionMonth(competitionId, fixture.round),
    };
    return id;
  });

  comp.fixtureIds = fixtureIds;
  season.fixtureIds = [...new Set([...season.fixtureIds, ...fixtureIds])];
  return fixtureIds;
}

/** Returns the next unplayed fixture for the user's team per domestic competition (Feature 4).
 *  Lazily generates ODI/FC fixtures on first call.
 *  Career mode gates competitions by pathway level:
 *    SCHOOL/U19  → T20 only  (youth-level play)
 *    DOMESTIC    → T20 + List-A (ODI)
 *    INTERNATIONAL → all three formats
 *  Manager mode has all competitions unlocked immediately. */
export function nextUserFixturesByCompetition(
  save: SaveGame,
): { competitionId: string; name: string; format: Format; fixtureId: string }[] {
  const t = save.userTeamId;
  if (!t) return [];
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (!season?.competitions?.length) return [];

  if (managerCalendarEnabled(save)) {
    const fixtureId = nextManagerUserFixtureId(save);
    if (save.managerCareerLevel === 'NATIONAL' && fixtureId) {
      const fixture = save.fixtures[fixtureId];
      const competition = season.competitions.find((item) => item.id === fixture.competitionId);
      return [
        {
          competitionId: fixture.competitionId ?? 'international',
          name: competition?.name ?? fixture.venue.split(' - ')[0],
          format: fixture.format,
          fixtureId,
        },
      ];
    }
    const current = managerPhaseProgress(save);
    const competitionId =
      current.phase === 'LIST_A'
        ? 'list-a'
        : current.phase === 'FIRST_CLASS'
          ? 'first-class'
          : current.phase === 'T20'
            ? 't20-league'
            : undefined;
    if (!competitionId || !current.unlocked) return [];
    const competition = season.competitions.find((item) => item.id === competitionId);
    return competition && fixtureId
      ? [
          {
            competitionId,
            name: competition.name,
            format: competition.format,
            fixtureId,
          },
        ]
      : [];
  }

  // Determine which competitions are unlocked for this save.
  let allowed: Set<string>;
  if (save.mode === 'manager') {
    // Manager mode: gate domestic competitions by managerCareerLevel.
    allowed = allowedCompetitionIds(save.managerCareerLevel ?? 'CLUB');
  } else {
    // Career mode: gate by careerPathLevel.
    const level = save.careerPathLevel ?? 'DOMESTIC';
    allowed = new Set(
      level === 'SCHOOL' || level === 'U19'
        ? ['t20-league']
        : ['t20-league', 'list-a', 'first-class'],
    );
  }

  // Lazily generate ODI and FC fixtures.
  if (allowed.has('list-a')) ensureCompetitionFixtures(save, 'list-a');
  if (allowed.has('first-class')) ensureCompetitionFixtures(save, 'first-class');

  const results: { competitionId: string; name: string; format: Format; fixtureId: string }[] = [];

  for (const comp of season.competitions) {
    if (!allowed.has(comp.id)) continue; // locked by career level
    const competitionTeamId = playerAffiliationTeamId(save, comp.id) ?? t;
    const next = comp.fixtureIds
      .map((id) => save.fixtures[id])
      .find(
        (fx) =>
          fx &&
          !fx.played &&
          (fx.homeTeamId === competitionTeamId || fx.awayTeamId === competitionTeamId),
      );
    if (next) {
      results.push({
        competitionId: comp.id,
        name: comp.name,
        format: comp.format,
        fixtureId: next.id,
      });
    }
  }
  if (save.mode === 'career') {
    const level = save.careerPathLevel ?? 'DOMESTIC';
    if (level === 'DOMESTIC' || level === 'INTERNATIONAL') {
      const active = ['list-a', 'first-class', 't20-league']
        .map((competitionId) => results.find((item) => item.competitionId === competitionId))
        .find(Boolean);
      return active ? [active] : [];
    }
  }
  return results;
}

export function rebuildDomesticSeasonForUserTeam(save: SaveGame): void {
  if (!save.currentSeasonId || !save.userTeamId) return;
  const season = save.seasons[save.currentSeasonId];
  const league = save.leagues[DIV1_LEAGUE_ID] ?? Object.values(save.leagues)[0];
  if (!season || !league) return;

  if (!league.teamIds.includes(save.userTeamId)) {
    league.teamIds = [...league.teamIds, save.userTeamId];
  }

  for (const id of Object.keys(save.fixtures)) {
    const fx = save.fixtures[id];
    if (fx.competition === 'CUP' || isU19WorldCupFixture(fx)) continue;
    delete save.fixtures[id];
  }

  const year = season.year;
  const fixtures = buildPlayerT20Fixtures(save, save.currentSeasonId, year);
  for (const fixture of Object.values(fixtures)) {
    fixture.calendarMonth = playerCompetitionMonth('t20-league', fixture.round);
  }
  save.fixtures = { ...save.fixtures, ...fixtures };
  // Fresh season → reset the calendar so the pre-season transfer window is open.
  updateCalendarMonth(save);

  const t20FixtureIds = Object.keys(fixtures);
  for (const domesticLeague of Object.values(save.leagues)) {
    domesticLeague.table = domesticLeague.teamIds.map((teamId) => ({
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

  const currentU19WorldCupFixtureIds = Object.values(save.fixtures)
    .filter((fixture) => fixture.seasonId === save.currentSeasonId && isU19WorldCupFixture(fixture))
    .map((fixture) => fixture.id);
  season.fixtureIds = [...t20FixtureIds, ...currentU19WorldCupFixtureIds];
  season.currentRound = 1;
  if (season.competitions) {
    season.competitions = season.competitions.map((comp) =>
      comp.id === 't20-league'
        ? { ...comp, leagueId: league.id, format: league.format, fixtureIds: t20FixtureIds }
        : { ...comp, fixtureIds: [] },
    );
  }
  save.championTeamId = undefined;
}

/** Build a live, ball-by-ball match for a fixture (interactive when a batter id is given). */
export function createLiveMatch(
  save: SaveGame,
  fixtureId: string,
  interactiveBatterId?: string,
): LiveMatch {
  const fx = save.fixtures[fixtureId];
  if (!fx) throw new Error(`Unknown fixture: ${fixtureId}`);
  if (fx.played) throw new Error(`Fixture already completed: ${fixtureId}`);
  const controlledTeamId = controlledTeamForFixture(save, fx, fixtureId);
  const seed = hashSeed(`${save.id}:${fixtureId}:live`);
  const t = save.tactics ?? DEFAULT_TACTICS;
  const authority = matchDecisionAuthority(save, fx);
  const { stadium, conditions } = venueForFixture(save, fx, seed);
  const managerPrepared = managerPreparedForFixture(save, fixtureId);
  fx.stadiumId = stadium.id;
  fx.venue = stadium.name;
  return new LiveMatch({
    id: fixtureId,
    seed,
    format: fx.format,
    conditions,
    home: teamSide(save, fx.homeTeamId, controlledTeamId, fx.format, managerPrepared),
    away: teamSide(save, fx.awayTeamId, controlledTeamId, fx.format, managerPrepared),
    difficulty: save.difficulty,
    difficultyBalanceProfile: save.mode === 'manager' ? 'MANAGER' : 'PLAYER',
    userTeamId: controlledTeamId,
    tossControllerTeamId: authority.canControlTeam ? controlledTeamId : null,
    interactiveBatterId,
    tactics: authority.canControlTeam
      ? { battingBias: approachBias(t.batting), bowlingPlan: t.bowling, field: t.field }
      : undefined,
  });
}

/**
 * Refresh the active manager LiveMatch from the save after Matchday
 * preparation is confirmed. The side is always derived again from permanent
 * save ratings, so repeated confirmation cannot stack the temporary modifier.
 */
export function applyManagerPreparationToLiveMatch(
  save: SaveGame,
  fixtureId: string,
  live: LiveMatch,
): boolean {
  const fx = save.fixtures[fixtureId];
  if (
    save.mode !== 'manager' ||
    !fx ||
    fx.played ||
    live.id !== fixtureId ||
    !managerPreparedForFixture(save, fixtureId)
  ) {
    return false;
  }

  const controlledTeamId = controlledTeamForFixture(save, fx, fixtureId);
  if (!controlledTeamId || live.controlledTeamId !== controlledTeamId) return false;

  const preparedSide = teamSide(save, controlledTeamId, controlledTeamId, fx.format, true);
  return live.replaceControlledTeamBeforeStart(preparedSide);
}

/**
 * Build a standalone Daily Challenge match. Unlike {@link createLiveMatch} this
 * is NOT tied to a league fixture — it plays the challenge's own format on its
 * own pitch condition (user's XI vs a random opponent) and never touches the
 * season/table. The store commits it separately for the challenge reward only.
 */
export function createDailyChallengeMatch(
  save: SaveGame,
  challenge: DailyChallenge,
): LiveMatch | null {
  const controlledTeamId = careerPlayingTeamId(save);
  if (!controlledTeamId) return null;
  const seed = hashSeed(`${save.id}:daily:${challenge.dateKey}`);
  const rng = makeRng(seed);
  const others = Object.keys(save.teams).filter(
    (id) => id !== controlledTeamId && !id.startsWith('career-path-'),
  );
  const oppId = others.length ? others[Math.floor(rng() * others.length)] : controlledTeamId;
  const conditions: Conditions = {
    pitch: challenge.pitchCondition,
    weather: WEATHERS[Math.floor(rng() * WEATHERS.length)],
  };
  const t = save.tactics ?? DEFAULT_TACTICS;
  const authority = matchDecisionAuthority(save);
  return new LiveMatch({
    id: `daily-${challenge.dateKey}`,
    seed,
    format: challenge.format,
    conditions,
    home: teamSide(save, controlledTeamId, controlledTeamId, challenge.format),
    away: teamSide(save, oppId, controlledTeamId, challenge.format),
    difficulty: save.difficulty,
    userTeamId: controlledTeamId,
    tossControllerTeamId: authority.canControlTeam ? controlledTeamId : null,
    interactiveBatterId: save.userPlayerId,
    tactics: authority.canControlTeam
      ? { battingBias: approachBias(t.batting), bowlingPlan: t.bowling, field: t.field }
      : undefined,
  });
}

/** Simulate all AI T20-league fixtures scheduled before the target (keeps the table chronological).
 *  Youth fixtures are separate and use their own round-aware catch-up path. */
function simulateBackgroundFixture(save: SaveGame, fixture: Fixture): void {
  if (save.mode === 'career' && save.userPlayerId) {
    // Background catch-up is never a protagonist appearance. Remove the
    // career player defensively even when an old contract or calendar leaves
    // their ID on an AI club roster.
    simulateFixtureWithoutCareerPlayer(save, fixture);
    return;
  }
  applyResult(save, runFixture(save, fixture.id));
}

export function simulateUnplayedBefore(save: SaveGame, fixtureId: string): void {
  const target = save.fixtures[fixtureId];
  const controlledTeamId = target
    ? controlledTeamForFixture(save, target, fixtureId)
    : save.userTeamId;
  const isControlledFixture = (fixture: Fixture) =>
    Boolean(
      controlledTeamId &&
      (fixture.homeTeamId === controlledTeamId || fixture.awayTeamId === controlledTeamId),
    );
  if (isU19WorldCupFixture(target)) {
    autoSettleU19WorldCupAI(save);
    return;
  }
  if (target && isYouthFixture(target)) {
    // Youth is a real competition, not eight isolated exhibitions. Resolve
    // every AI-only fixture through this round so the table and season rival
    // advance alongside the player's team. Never auto-play a user fixture.
    const controlledTeamId = careerPlayingTeamId(save, fixtureId);
    for (const fixture of fixtureList(save)
      .filter(
        (candidate) =>
          candidate.id !== fixtureId &&
          !candidate.played &&
          candidate.competitionId === target.competitionId &&
          candidate.seasonId === target.seasonId &&
          candidate.round <= target.round &&
          candidate.homeTeamId !== controlledTeamId &&
          candidate.awayTeamId !== controlledTeamId,
      )
      .sort((left, right) => left.round - right.round || left.id.localeCompare(right.id))) {
      simulateBackgroundFixture(save, fixture);
    }
    return;
  }

  const targetRound = target?.round ?? Number.MAX_SAFE_INTEGER;
  if (target?.managerPhase && managerCalendarEnabled(save)) {
    for (const fx of fixtureList(save)
      .filter(
        (fixture) =>
          fixture.id !== fixtureId &&
          !fixture.played &&
          !isControlledFixture(fixture) &&
          fixture.managerPhase === target.managerPhase &&
          fixture.round <= targetRound,
      )
      .sort(
        (a, b) =>
          a.round - b.round ||
          (a.divisionTier ?? 9) - (b.divisionTier ?? 9) ||
          a.id.localeCompare(b.id),
      )) {
      simulateBackgroundFixture(save, fx);
    }
    return;
  }
  if (
    target?.competitionId &&
    ['list-a', 'first-class', 't20-league'].includes(target.competitionId)
  ) {
    for (const fx of fixtureList(save)
      .filter(
        (fixture) =>
          fixture.id !== fixtureId &&
          !fixture.played &&
          !isControlledFixture(fixture) &&
          fixture.competitionId === target.competitionId &&
          fixture.round <= targetRound,
      )
      .sort(
        (a, b) =>
          a.round - b.round ||
          (a.divisionTier ?? 9) - (b.divisionTier ?? 9) ||
          a.id.localeCompare(b.id),
      )) {
      simulateBackgroundFixture(save, fx);
    }
    return;
  }
  for (const fx of fixtureList(save)) {
    if (fx.id === fixtureId || fx.round > targetRound) continue;
    if (fx.competition === 'CUP') continue;
    if (!isLeagueTableFixture(fx)) continue;
    if (isYouthFixture(fx)) continue; // youth fixtures are player-controlled only
    if (isControlledFixture(fx)) continue;
    if (!fx.played) simulateBackgroundFixture(save, fx);
  }
}

/**
 * Repair saves produced by older bench/national-duty paths that completed the
 * user's fixture without completing the other matches in that round. Only
 * unplayed AI fixtures are simulated, so the repair is safe to repeat.
 */
export function reconcilePlayedCompetitionRounds(save: SaveGame): number {
  if (save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') return 0;
  if (!save.userTeamId && !save.careerPathTeamId && !save.franchiseTeamId) return 0;

  const latestByCompetition = new Map<string, Fixture>();
  for (const fixture of fixtureList(save)) {
    const controlledTeamId = isYouthFixture(fixture)
      ? (save.careerPathTeamId ?? save.userTeamId)
      : isPlayerFranchiseFixture(fixture)
        ? (save.franchiseTeamId ?? save.userTeamId)
        : save.userTeamId;
    if (
      !fixture.played ||
      fixture.playoff ||
      fixture.competition === 'CUP' ||
      (save.currentSeasonId && fixture.seasonId !== save.currentSeasonId) ||
      (fixture.homeTeamId !== controlledTeamId && fixture.awayTeamId !== controlledTeamId)
    ) {
      continue;
    }
    const competitionKey = fixture.competitionId ?? 't20-league';
    const current = latestByCompetition.get(competitionKey);
    if (!current || fixture.round > current.round) latestByCompetition.set(competitionKey, fixture);
  }

  const playedBefore = fixtureList(save).filter((fixture) => fixture.played).length;
  for (const fixture of latestByCompetition.values()) {
    simulateUnplayedBefore(save, fixture.id);
  }
  const playedAfter = fixtureList(save).filter((fixture) => fixture.played).length;
  return Math.max(0, playedAfter - playedBefore);
}

function fixtureCalendarWeek(fixture: Fixture): number {
  return fixture.calendarWeek ?? ((fixture.round - 1) % 4) + 1;
}

function fixtureMonthOrder(month?: number): number {
  if (!month) return 99;
  return month >= 9 ? month - 9 : month + 3;
}

export function simulateFixtureWithoutCareerPlayer(save: SaveGame, fixture: Fixture): MatchState {
  if (!save.userPlayerId) {
    const match = runFixture(save, fixture.id);
    applyResult(save, match);
    return match;
  }
  const fixtureRosterIds = new Set(
    [fixture.homeTeamId, fixture.awayTeamId].flatMap(
      (teamId) => save.teams[teamId]?.playerIds ?? [],
    ),
  );
  const touchedTeamIds = [fixture.homeTeamId, fixture.awayTeamId].filter((teamId) =>
    save.teams[teamId]?.playerIds.includes(save.userPlayerId!),
  );
  const snapshots = touchedTeamIds.map((teamId) => {
    const team = save.teams[teamId];
    const playerIds = [...team.playerIds];
    const xi = team.xi ? [...team.xi] : undefined;
    const contracted = playerIds
      .filter((playerId) => playerId !== save.userPlayerId)
      .map((playerId) => save.players[playerId])
      .filter((player): player is Player => Boolean(player && !player.retired));
    const replacements = Object.values(save.players).filter(
      (player) =>
        player.id !== save.userPlayerId &&
        !player.retired &&
        player.nationality === team.country &&
        !fixtureRosterIds.has(player.id),
    );
    const eligible = [...contracted, ...replacements].slice(0, 16);
    team.playerIds = eligible.map((player) => player.id);
    team.xi = resolveXI(eligible).map((player) => player.id);
    return { teamId, playerIds, xi };
  });
  let match: MatchState;
  careerPlayerSuppressed.add(save);
  try {
    match = runFixture(save, fixture.id);
    applyResult(save, match);
  } finally {
    careerPlayerSuppressed.delete(save);
    for (const snapshot of snapshots) {
      const team = save.teams[snapshot.teamId];
      team.playerIds = snapshot.playerIds;
      team.xi = snapshot.xi;
    }
  }
  return match!;
}

/**
 * National duty wins a same-week clash. The domestic club still plays, with
 * the user's scorecard status persisted as away on national duty.
 */
export function resolveNationalDutyConflict(
  save: SaveGame,
  internationalFixtureId: string,
): string | undefined {
  const international = save.fixtures[internationalFixtureId];
  if (
    save.mode !== 'career' ||
    !save.userPlayerId ||
    !save.userTeamId ||
    !international ||
    !isInternationalFixture(international)
  ) {
    return undefined;
  }
  const conflict = fixtureList(save).find(
    (fixture) =>
      !fixture.played &&
      !isInternationalFixture(fixture) &&
      fixture.competition !== 'CUP' &&
      ['list-a', 'first-class', 't20-league'].includes(fixture.competitionId ?? '') &&
      (() => {
        const teamId = careerPlayingTeamId(save, fixture.id);
        return fixture.homeTeamId === teamId || fixture.awayTeamId === teamId;
      })() &&
      fixture.calendarMonth === international.calendarMonth &&
      fixtureCalendarWeek(fixture) === fixtureCalendarWeek(international),
  );
  if (!conflict) return undefined;
  conflict.nationalDutyPlayerIds = [
    ...new Set([...(conflict.nationalDutyPlayerIds ?? []), save.userPlayerId]),
  ];
  // National duty removes the player, not the rest of the domestic round.
  // Resolve the other clubs first so every standings row advances together.
  simulateUnplayedBefore(save, conflict.id);
  simulateFixtureWithoutCareerPlayer(save, conflict);
  const calendarItem = save.playerCalendar?.events.find((item) => item.fixtureId === conflict.id);
  if (calendarItem) {
    calendarItem.completed = true;
    calendarItem.outcome = 'Away on National Duty. Your domestic club played without you.';
  }
  const messageId = `national-duty-${international.id}-${conflict.id}`;
  const conflictTeamId = careerPlayingTeamId(save, conflict.id);
  const inbox = save.inbox ?? [];
  if (!inbox.some((message) => message.id === messageId)) {
    save.inbox = [
      {
        id: messageId,
        kind: 'GENERAL' as const,
        title: 'Away on National Duty',
        body: `${save.teams[conflictTeamId ?? '']?.name ?? 'Your club'} played its scheduled match while you represented your country.`,
        timestamp: Date.now(),
        read: false,
      },
      ...inbox,
    ].slice(0, 100);
  }
  return conflict.id;
}

/** AI-complete the rest of an international assignment after a selection drop. */
export function simulateInternationalFixturesWithoutUser(
  save: SaveGame,
  fixtureIds: string[],
): void {
  for (const fixture of fixtureIds
    .map((fixtureId) => save.fixtures[fixtureId])
    .filter((fixture): fixture is Fixture => Boolean(fixture && !fixture.played))
    .sort(
      (left, right) =>
        fixtureMonthOrder(left.calendarMonth) - fixtureMonthOrder(right.calendarMonth) ||
        fixtureCalendarWeek(left) - fixtureCalendarWeek(right) ||
        left.round - right.round,
    )) {
    simulateFixtureWithoutCareerPlayer(save, fixture);
  }
}

/** Play (and return) the user's match, after catching the rest of the schedule up. */
export function playUserFixture(save: SaveGame, fixtureId: string): MatchState {
  simulateUnplayedBefore(save, fixtureId);
  const match = runFixture(save, fixtureId);
  applyResult(save, match);
  const fixture = save.fixtures[fixtureId];
  if (
    isU19WorldCupFixture(fixture) &&
    fixture.winnerTeamId &&
    (!match.result?.winnerTeamId || match.result.tie)
  ) {
    match.result = {
      ...match.result,
      tie: false,
      winnerTeamId: fixture.winnerTeamId,
      margin: 'Won the tied knockout by the tournament tiebreak',
    };
  }
  return match;
}

export function standings(save: SaveGame, leagueId?: string): LeagueRow[] {
  const requestedLeague = leagueId ? save.leagues[leagueId] : undefined;
  const tableTeamId =
    save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  const league =
    (!leagueId && tableTeamId
      ? Object.values(save.leagues).find((candidate) => candidate.teamIds.includes(tableTeamId))
      : undefined) ??
    requestedLeague ??
    Object.values(save.leagues)[0];
  if (!league) return [];
  const previousNrr = new Map(league.table.map((row) => [row.teamId, row.netRunRate]));
  const rows = new Map<string, LeagueRow>(
    league.teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        netRunRate: previousNrr.get(teamId) ?? 0,
      },
    ]),
  );
  for (const fixture of fixtureList(save)) {
    if (
      !fixture.played ||
      fixture.playoff ||
      fixture.competition === 'CUP' ||
      !isLeagueTableFixture(fixture)
    ) {
      continue;
    }
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    if (
      fixture.winnerTeamId === fixture.homeTeamId ||
      (!fixture.winnerTeamId && fixture.resultKind === 'HOME_WIN')
    ) {
      home.won += 1;
      away.lost += 1;
      home.points += 2;
    } else if (
      fixture.winnerTeamId === fixture.awayTeamId ||
      (!fixture.winnerTeamId && fixture.resultKind === 'AWAY_WIN')
    ) {
      away.won += 1;
      home.lost += 1;
      away.points += 2;
    } else if (fixture.resultKind === 'TIE') {
      home.tied += 1;
      away.tied += 1;
      home.points += 1;
      away.points += 1;
    } else {
      home.noResult += 1;
      away.noResult += 1;
      home.points += 1;
      away.points += 1;
    }
  }
  league.table = [...rows.values()];
  return [...league.table].sort(
    (a, b) => b.points - a.points || b.netRunRate - a.netRunRate || b.won - a.won,
  );
}

function leagueFormat(save: SaveGame): Format {
  return Object.values(save.leagues)[0].format;
}

/** True once every non-playoff T20-league fixture has been played. */
export function leagueComplete(save: SaveGame): boolean {
  return fixtureList(save)
    .filter((f) => !f.playoff && f.competition !== 'CUP' && isLeagueTableFixture(f))
    .every((f) => f.played);
}

/**
 * Materialise the knockout bracket once the league finishes: a top-4 playoff
 * (SF1: 1v4, SF2: 2v3, then the Final between the winners). With fewer than
 * four teams it degrades to a single Final between the top two.
 */
export function ensurePlayoffs(save: SaveGame): void {
  if (managerCalendarEnabled(save)) return;
  if (!leagueComplete(save)) return;
  const table = standings(save);
  if (table.length < 2) return;
  const fmt = leagueFormat(save);
  const seasonId = save.currentSeasonId ?? '';
  const playoffIds = playoffFixtureIds(save);
  const stage = (
    id: string,
    homeTeamId: string,
    awayTeamId: string,
    round: number,
    venue: string,
  ): void => {
    if (save.fixtures[id]) return;
    save.fixtures[id] = {
      id,
      seasonId,
      format: fmt,
      homeTeamId,
      awayTeamId,
      venue,
      round,
      played: false,
      playoff: true,
      competition: 'PLAYOFF',
      competitionId: 't20-league',
    };
  };

  if (table.length < 4) {
    stage(playoffIds.final, table[0].teamId, table[1].teamId, 999, 'Final');
    return;
  }

  stage(playoffIds.sf1, table[0].teamId, table[3].teamId, 997, 'Semi-Final 1');
  stage(playoffIds.sf2, table[1].teamId, table[2].teamId, 998, 'Semi-Final 2');
  const sf1 = save.fixtures[playoffIds.sf1];
  const sf2 = save.fixtures[playoffIds.sf2];
  if (sf1?.played && sf2?.played && !save.fixtures[playoffIds.final]) {
    stage(
      playoffIds.final,
      playoffWinner(save, playoffIds.sf1, table),
      playoffWinner(save, playoffIds.sf2, table),
      999,
      'Final',
    );
  }
}

/** The advancing team from a knockout tie (higher league seed on a tie/no-result). */
function playoffWinner(save: SaveGame, fxId: string, table: LeagueRow[]): string {
  const fx = save.fixtures[fxId];
  if (fx?.winnerTeamId) return fx.winnerTeamId;
  const seed = (id: string): number => {
    const i = table.findIndex((r) => r.teamId === id);
    return i < 0 ? 999 : i;
  };
  return seed(fx.homeTeamId) <= seed(fx.awayTeamId) ? fx.homeTeamId : fx.awayTeamId;
}

/**
 * Auto-play knockout matches that DON'T involve the user so the bracket
 * progresses to the user's next live fixture (e.g. sim the other semi so the
 * user can then play the final). Stops as soon as the user has a match to play.
 */
export function stagePlayoffsForUser(save: SaveGame): void {
  const t = save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  ensurePlayoffs(save);
  let guard = 0;
  while (guard++ < 30) {
    if (t && nextUserFixtureId(save)) return;
    const fx = fixtureList(save).find(
      (f) =>
        f.playoff &&
        !isU19WorldCupFixture(f) &&
        !f.played &&
        f.homeTeamId !== t &&
        f.awayTeamId !== t,
    );
    if (!fx) return;
    applyResult(save, runFixture(save, fx.id));
    ensurePlayoffs(save);
  }
}

export function seasonChampionId(save: SaveGame): string | undefined {
  if (managerCalendarEnabled(save) && save.managerCalendar?.lastSummary?.phase === 'T20') {
    return save.managerCalendar.lastSummary.championTeamIds[save.userDivision ?? 3];
  }
  if (save.championTeamId) return save.championTeamId;
  return standings(save)[0]?.teamId;
}

export function advanceManagerCalendarPhase(
  save: SaveGame,
  maxFixtures?: number,
): ReturnType<typeof advanceManagerCalendarEngine> {
  return advanceManagerCalendarEngine(
    save,
    (fixtureId) => {
      applyResult(save, runFixture(save, fixtureId));
    },
    maxFixtures,
  );
}

/** Play every remaining T20-league fixture (creates the Grand Final when done). */
export function catchUpLeague(save: SaveGame): void {
  let guard = 0;
  while (guard++ < 500) {
    const fx = fixtureList(save).find(
      (f) => !f.played && !f.playoff && f.competition !== 'CUP' && isLeagueTableFixture(f),
    );
    if (!fx) break;
    applyResult(save, runFixture(save, fx.id));
  }
}

/** Play every remaining domestic fixture and playoff (the Cup finishes separately). */
export function finishSeason(save: SaveGame): void {
  const level = save.careerPathLevel ?? 'DOMESTIC';
  const fullCareerCalendar = save.mode === 'career' && level !== 'SCHOOL' && level !== 'U19';
  if (save.mode === 'career' && save.capped) prepareInternationalCalendar(save);
  if (fullCareerCalendar) {
    ensureCompetitionFixtures(save, 'list-a');
    ensureCompetitionFixtures(save, 'first-class');
  }
  synchronizeU19WorldCupState(save);
  autoSettleU19WorldCupAI(save);
  let guard = 0;
  while (guard++ < 500) {
    const fx = fixtureList(save).find(
      (f) =>
        !f.played &&
        f.competition !== 'CUP' &&
        !isU19WorldCupFixture(f) &&
        (fullCareerCalendar || isLeagueTableFixture(f) || f.playoff),
    );
    if (!fx) break;
    applyResult(save, runFixture(save, fx.id));
  }
  if (save.mode === 'career') {
    let calendarGuard = 0;
    while (calendarGuard++ < 80) {
      const item = currentPlayerCalendarEvent(save);
      if (!item || item.kind === 'MATCH') break;
      resolvePlayerCalendarEvent(save);
    }
  }
}

export function seasonComplete(save: SaveGame): boolean {
  if (managerCalendarEnabled(save)) {
    return save.managerCalendar?.phase === 'OFF_SEASON' && managerPhaseComplete(save);
  }
  synchronizeU19WorldCupState(save);
  autoSettleU19WorldCupAI(save);
  if (u19WorldCupBlocksPromotion(save) || nextU19WorldCupUserFixtureId(save)) return false;
  // Youth players' season ends when their youth fixtures are all done —
  // they don't participate in the professional league playoff.
  const level = save.mode === 'career' ? (save.careerPathLevel ?? 'DOMESTIC') : 'DOMESTIC';
  if (level === 'SCHOOL' || level === 'U19') {
    return youthSeasonComplete(save) && !currentPlayerCalendarEvent(save);
  }
  if (save.mode === 'career' && save.capped) prepareInternationalCalendar(save);

  if (save.mode === 'career' && nextUserFixturesByCompetition(save).length > 0) {
    return false;
  }
  if (save.mode === 'career' && currentPlayerCalendarEvent(save)) return false;

  if (!leagueComplete(save)) return false;
  const final = save.fixtures[playoffFixtureIds(save).final];
  if (!final?.played) return false;
  return internationalWindowFixtureIds(save).every((id) => save.fixtures[id]?.played);
}

export interface StartNewSeasonOptions {
  /** Assignment that owned the season being closed, before any promotion. */
  finishedManagerLevel?: ManagerCareerLevel;
  /** Promotion earned by that finished season; applied after club settlement. */
  promoteManagerTo?: ManagerCareerLevel;
}

export function startNewSeason(save: SaveGame, options: StartNewSeasonOptions = {}): void {
  if (save.mode === 'manager' && save.managerRetired) return;
  const finishedSeason = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const finishedSeasonId = save.currentSeasonId;
  const finishedYear = finishedSeason?.year ?? 2026;
  const finishedManagerLevel =
    options.finishedManagerLevel ?? save.managerCareerLevel ?? ('CLUB' as ManagerCareerLevel);
  const finishedNationalManagerSeason =
    save.mode === 'manager' && finishedManagerLevel === 'NATIONAL';
  const seasonGateReceipts =
    save.mode === 'manager' && !finishedNationalManagerSeason
      ? gateReceiptsForFixtureIds(save, finishedSeason?.fixtureIds ?? [])
      : 0;
  const seasonKitSponsorIncome =
    save.mode === 'manager' && !finishedNationalManagerSeason && save.userTeamId
      ? managerClubKitSponsorIncomeForSeason(save, save.userTeamId, finishedSeasonId)
      : 0;
  const resultTeamId =
    save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  const finalTable = resultTeamId && !finishedNationalManagerSeason ? standings(save) : [];
  const finalPosition =
    resultTeamId && !finishedNationalManagerSeason ? leaguePosition(finalTable, resultTeamId) : 0;
  const userTeam = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  // Gate and kit-partner receipts are credited at each fixture. Remove those
  // already-posted amounts from the report baseline so every displayed line
  // reconciles exactly to the final club balance without crediting them twice.
  const previousBudget = (userTeam?.budget ?? 0) - seasonGateReceipts - seasonKitSponsorIncome;
  let leaguePrize = 0;
  let continentalPrize = 0;
  let seasonBroadcastIncome = 0;
  let playerWages = 0;
  const trophyEligible = save.mode === 'manager' || careerTrophyParticipationRate(save) >= 0.4;

  // Settle the finished season: record the champion and award prize money.
  if (save.currentSeasonId) {
    // Completing a year is manager-owned career progress, including a full
    // National-team year. Club trophies and prize money are handled only when
    // the finished assignment was domestic.
    save.careerSeasons = (save.careerSeasons ?? 0) + 1;
  }
  if (save.currentSeasonId && !finishedNationalManagerSeason) {
    const champ = seasonChampionId(save);
    if (champ && champ === resultTeamId && trophyEligible) {
      recordTitle(save, save.teams[champ]?.name ?? 'Champions', finishedYear);
    }
    // Cross-career Hall of Fame: count a completed season, and a league title.
    if (champ && champ === resultTeamId && trophyEligible) {
      save.leagueTitles = (save.leagueTitles ?? 0) + 1;
      // Record a title for manager career progression too.
      if (save.mode === 'manager' && save.managerCareerLevel === finishedManagerLevel) {
        recordManagerTitle(save);
      }
    }

    // Continental Cup — the top four contest a second trophy.
    const contQuals = finalTable.slice(0, 4).map((r) => r.teamId);
    const contRng = makeRng(hashSeed(`${save.id}:cont:${finishedYear}`));
    const cont = resolveContinental(save, contQuals, contRng, trophyEligible);
    if (cont.championId && cont.userWon && trophyEligible) {
      recordTitle(
        save,
        `${save.teams[cont.championId]?.name ?? 'Champions'} (Continental)`,
        finishedYear,
      );
    }
    if (cont.userWon && save.userTeamId) {
      continentalPrize = CONTINENTAL_PRIZE;
      save.teams[save.userTeamId].budget += continentalPrize;
    }
  }
  if (save.userTeamId && !finishedNationalManagerSeason) {
    const team = save.teams[save.userTeamId];
    const pos = finalPosition;
    if (pos > 0) {
      leaguePrize = prizeFor(pos);
      team.budget += leaguePrize;
    }
    if (pos > 0) save.bestLeaguePos = save.bestLeaguePos ? Math.min(save.bestLeaguePos, pos) : pos;
    // Manager career: a top-2 finish counts toward the next promotion.
    if (save.mode === 'manager' && save.managerCareerLevel === finishedManagerLevel && pos > 0) {
      recordManagerFinish(save, pos);
    }

    // Board verdict on the finished season + job security.
    const outcome = evaluateBoardObjective(pos, save.boardObjective);
    if (save.boardObjective) save.boardObjective.met = outcome.met;
    team.reputation = Math.max(40, Math.min(95, team.reputation + (outcome.met ? 1 : -1)));
    save.flags.sacked = outcome.sacked && Math.max(0, save.managerGraceMatchesRemaining ?? 0) === 0;

    // Season finances: automatic broadcast rights minus the wage bill. Chosen
    // kit sponsors have already paid through completed fixture settlements.
    const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
    seasonBroadcastIncome = broadcastIncome(team.reputation);
    playerWages = seasonWageBill(squad);
    team.budget += seasonBroadcastIncome - playerWages;
    save.lastSeasonSettlement = {
      year: finishedYear,
      leaguePosition: pos,
      leaguePrize,
      continentalPrize,
      sponsorIncome: seasonBroadcastIncome,
      broadcastIncome: seasonBroadcastIncome,
      kitSponsorIncome: seasonKitSponsorIncome,
      playerWages,
      gateReceipts: seasonGateReceipts,
      staffWages: 0,
      facilityUpkeep: 0,
      previousBudget,
      newBudget: team.budget,
    };
    if (save.mode === 'manager' && save.finances) {
      save.finances.lastGateReceipts = seasonGateReceipts;
    }
  }

  // Recall any loaned players whose deal has expired this season.
  if (save.userTeamId && !finishedNationalManagerSeason) {
    const team = save.teams[save.userTeamId];
    const currentYear2 = save.currentSeasonId
      ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
      : 2026;
    for (const playerId of [...team.playerIds]) {
      const p = save.players[playerId];
      if (p?.loanedFrom && (p.loanEnd ?? 0) <= currentYear2) {
        recallLoan(save, playerId);
      }
    }
  }

  const currentSeason = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const year = (currentSeason?.year ?? 2026) + 1;
  const seasonId = `season-${year}`;

  const isManagerCalendar = managerCalendarEnabled(save);
  if (save.mode === 'career') tickCareerResidency(save);

  // The manager calendar resolves all three completed T20 divisions exactly.
  // Legacy saves and player careers retain the original two-tier rollover.
  if (isManagerCalendar) {
    if (!finishedNationalManagerSeason) applyManagerPyramidRollover(save);
  } else if (save.mode === 'career' && hasThreeDivisions(save)) {
    const orders = Object.fromEntries(
      playerLeagueTiers(save).map(({ league, tier }) => [
        tier,
        standings(save, league.id).map((row) => row.teamId),
      ]),
    ) as Record<1 | 2 | 3, string[]>;
    const report = applyThreeTierPromotionRelegation(save, orders);
    syncThreeTierLeagues(save);
    save.promotionNews = report.promoted.length || report.relegated.length ? report : undefined;
    if (report.userMoved === 'PROMOTED') save.promotions = (save.promotions ?? 0) + 1;
  } else if (hasDivisions(save)) {
    const finishedOrder = standings(save).map((r) => r.teamId);
    const prRng = makeRng(hashSeed(`${save.id}:promrel:${year}`));
    const report = applyPromotionRelegation(save, finishedOrder, prRng);
    syncLeaguesToDivisions(save);
    save.promotionNews = report.promoted.length || report.relegated.length ? report : undefined;
    if (report.userMoved === 'PROMOTED') save.promotions = (save.promotions ?? 0) + 1;
  } else {
    save.promotionNews = undefined;
  }

  if (save.mode === 'career') {
    applyPendingPlayerCountryMove(save, seasonId, year);
  }

  // Keep the old level active through all title, table and club settlement
  // bookkeeping. The earned appointment only owns the calendar being built.
  if (save.mode === 'manager' && options.promoteManagerTo) {
    applyManagerLevelPromotion(save, options.promoteManagerTo);
  }

  if (isManagerCalendar) {
    save.currentSeasonId = seasonId;
    save.seasons[seasonId] = {
      id: seasonId,
      year,
      leagueIds: Object.keys(save.leagues),
      fixtureIds: [],
      currentRound: 1,
      competitions: [],
    };
    buildManagerSeasonCalendar(save, year, 'LIST_A', {
      preserveLeagueTables: finishedNationalManagerSeason,
    });
    save.managerWonTierOneFirstClass = false;
  } else {
    const league = save.leagues[DIV1_LEAGUE_ID] ?? Object.values(save.leagues)[0];
    const fixtures = buildPlayerT20Fixtures(save, seasonId, year);
    for (const fixture of Object.values(fixtures)) {
      fixture.calendarMonth = playerCompetitionMonth('t20-league', fixture.round);
    }
    const t20FixtureIds = Object.keys(fixtures);

    const u19WorldCupHistory = Object.fromEntries(
      Object.entries(save.fixtures).filter(([, fixture]) => isU19WorldCupFixture(fixture)),
    );
    save.fixtures = { ...fixtures, ...u19WorldCupHistory };
    for (const domesticLeague of Object.values(save.leagues)) {
      domesticLeague.table = domesticLeague.teamIds.map((teamId) => ({
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

    const t20LeagueName = league.name;
    const competitions: import('../domain/types').SeasonCompetition[] = [
      {
        id: 't20-league',
        name: t20LeagueName,
        format: league.format,
        leagueId: league.id,
        fixtureIds: t20FixtureIds,
      },
      {
        id: 'list-a',
        name: 'List A (50-Over)',
        format: 'ODI',
        leagueId: league.id,
        fixtureIds: [],
      },
      {
        id: 'first-class',
        name: 'First-Class (4-Day)',
        format: 'TEST',
        leagueId: league.id,
        fixtureIds: [],
      },
    ];

    save.seasons[seasonId] = {
      id: seasonId,
      year,
      leagueIds: Object.keys(save.leagues),
      fixtureIds: Object.keys(fixtures),
      currentRound: 1,
      competitions,
    };
    save.currentSeasonId = seasonId;
  }

  // Age & develop the whole world.
  const devRng = makeRng(hashSeed(`${save.id}:dev:${year}`));
  const retainedClubPlayerIds = new Set(
    finishedNationalManagerSeason && save.userTeamId
      ? (save.teams[save.userTeamId]?.playerIds ?? [])
      : [],
  );
  for (const p of Object.values(save.players)) {
    if (retainedClubPlayerIds.has(p.id)) continue;
    const stageCeiling =
      save.mode === 'career' && p.id === save.userPlayerId
        ? trainingAttributeCeiling(save.careerPathLevel)
        : 99;
    const isPlayableCareerPlayer = save.mode === 'career' && p.id === save.userPlayerId;
    developPlayer(p, devRng, stageCeiling, !isPlayableCareerPlayer);
    p.trainingSessionsThisSeason = 0;
    p.trainingGroupSessionsThisSeason = {};
  }
  if (save.mode === 'career') {
    const before = save.careerPathLevel;
    const after = validateAgeEligibility(save);
    if (before && after && before !== after) {
      synchronizeCareerPromotion(save, { promoted: true, from: before, to: after });
    }
  }

  // Retire veterans, promote youth, and refresh the transfer market.
  rolloverSquads(save, year, devRng, {
    preserveTeamIds:
      finishedNationalManagerSeason && save.userTeamId ? new Set([save.userTeamId]) : undefined,
  });
  if (!finishedNationalManagerSeason) {
    refreshFreeAgents(save, year, devRng);
    // A living market: rival clubs sign free agents and sell fringe players back.
    runAiTransferWindow(save, devRng);
  }
  if (isManagerCalendar) refreshManagerNationalTeams(save);

  resetSeasonStats(save, { preservePlayerIds: retainedClubPlayerIds });
  save.championTeamId = undefined;

  // Set the board's expectation for the new season.
  if (save.userTeamId && !finishedNationalManagerSeason) {
    save.boardObjective = {
      year,
      targetPosition: boardTargetFor(save.teams[save.userTeamId].reputation),
    };
  }

  // Youth players (career mode) get a fresh set of youth fixtures each season.
  const levelAfter = save.careerPathLevel ?? 'DOMESTIC';
  if (save.mode === 'career' && (levelAfter === 'SCHOOL' || levelAfter === 'U19')) {
    generateYouthFixtures(save);
  }
  if (save.mode === 'career') {
    if (save.capped) prepareInternationalCalendar(save);
    const level = save.careerPathLevel ?? 'DOMESTIC';
    if (level !== 'SCHOOL' && level !== 'U19') {
      ensureCompetitionFixtures(save, 'list-a');
      ensureCompetitionFixtures(save, 'first-class');
    }
    synchronizeU19WorldCupState(save);
    autoSettleU19WorldCupAI(save);
    buildPlayerSeasonCalendar(save);
  }

  // Manager career: tick seasons counter + generate ICC fixtures for NATIONAL managers.
  if (save.mode === 'manager') {
    // A completed season belongs to the level that owned it. Promotion resets
    // the new level to zero; do not immediately credit the upcoming season.
    if (save.managerCareerLevel === finishedManagerLevel) tickManagerCareerSeason(save);
    if (!save.managerCalendar) ensureIccFixtures(save);
    save.managerAge = Math.min(60, Math.max(35, save.managerAge ?? 35) + 1);
    if (save.managerAge >= 60) save.managerRetired = true;
    if (save.managerRetired) grantRetirementCollections(save);
  }
}

/** Share of the user's club matches in which the career player actually appeared. */
export function careerTrophyParticipationRate(save: SaveGame): number {
  if (save.mode !== 'career' || !save.userPlayerId || !save.userTeamId) return 0;
  if (save.careerPathLevel === 'SCHOOL' || save.careerPathLevel === 'U19') return 0;
  const clubMatches = Object.values(save.fixtures).filter((fixture) => {
    if (!fixture.played) return false;
    const teamId = isPlayerFranchiseFixture(fixture)
      ? (save.franchiseTeamId ?? save.userTeamId)
      : save.userTeamId;
    return fixture.homeTeamId === teamId || fixture.awayTeamId === teamId;
  }).length;
  if (clubMatches === 0) return 0;
  const appearances = save.players[save.userPlayerId]?.seasonStats?.matches ?? 0;
  return Math.min(1, appearances / clubMatches);
}
