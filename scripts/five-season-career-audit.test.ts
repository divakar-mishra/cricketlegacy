import fs from 'node:fs';
import path from 'node:path';

import type {
  CareerCompetitionStatScope,
  Format,
  LeagueRow,
  MatchState,
  Player,
  PlayerStats,
  Role,
  SaveGame,
  Tactics,
} from '../src/domain/types';
import type { LiveMatch } from '../src/engine/liveMatch';
import type { TrainGroup } from '../src/game/progression';

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/services/analytics', () => {
  const actual = jest.requireActual<typeof import('../src/services/analytics')>(
    '../src/services/analytics',
  );
  return { ...actual, logEvent: jest.fn() };
});

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { buildUserPlayer, createCareerSave, createManagerSave } =
  jest.requireActual<typeof import('../src/game/createGame')>('../src/game/createGame');
const { battingMean, bowlingMean, computeOverall, fieldingMean, metaMean } =
  jest.requireActual<typeof import('../src/engine/rating')>('../src/engine/rating');
const { makeRng } = jest.requireActual<typeof import('../src/engine/rng')>('../src/engine/rng');
const { addCoins } =
  jest.requireActual<typeof import('../src/game/economy')>('../src/game/economy');
const { applyTraining, canTrain, sessionsDone, trainingCost, trainingGroupsForRole } =
  jest.requireActual<typeof import('../src/game/progression')>('../src/game/progression');
const { archetypeTrainingMultiplier } = jest.requireActual<
  typeof import('../src/game/careerArchetypes')
>('../src/game/careerArchetypes');
const { expiringContracts, facilityUpgradeCost, renewContract, upgradeFacility } =
  jest.requireActual<typeof import('../src/game/manager')>('../src/game/manager');
const {
  computeValue,
  ffpBlockReason,
  optionalClubSpendBlockReason,
  playerWage,
  releasePlayer,
  signFreeAgent,
} = jest.requireActual<typeof import('../src/game/finance')>('../src/game/finance');
const { autoXI } = jest.requireActual<typeof import('../src/game/squad')>('../src/game/squad');
const {
  applyManagerPreparationToLiveMatch,
  leagueComplete,
  nextUserFixturesByCompetition,
  nextUserFixtureId,
  seasonComplete,
  standings,
} = jest.requireActual<typeof import('../src/game/season')>('../src/game/season');
const { currentPlayerCalendarEvent } = jest.requireActual<
  typeof import('../src/game/playerCalendar')
>('../src/game/playerCalendar');
const { careerSelectionDecision } =
  jest.requireActual<typeof import('../src/game/career')>('../src/game/career');
const { fixtureCompetitionStandings } = jest.requireActual<
  typeof import('../src/game/competitionTable')
>('../src/game/competitionTable');
const { managerCompetitionStandings } = jest.requireActual<
  typeof import('../src/game/managerCalendar')
>('../src/game/managerCalendar');
const { isInternationalFixture } = jest.requireActual<typeof import('../src/game/intlCalendar')>(
  '../src/game/intlCalendar',
);
const { playerAffiliationTeamId } = jest.requireActual<
  typeof import('../src/game/playerAffiliations')
>('../src/game/playerAffiliations');
const { careerPlayingTeamId } = jest.requireActual<typeof import('../src/game/youthFixtures')>(
  '../src/game/youthFixtures',
);
const { useCareer } = jest.requireActual<typeof import('../src/state/careerStore')>(
  '../src/state/careerStore',
);

const SEASONS = Math.max(1, Number(process.env.CAREER_AUDIT_SEASONS ?? 5));
const PLAYER_SEED = Number(process.env.CAREER_AUDIT_PLAYER_SEED ?? 51_005);
const MANAGER_SEED = Number(process.env.CAREER_AUDIT_MANAGER_SEED ?? 71_005);
const FULL_CAREER_AUDIT = process.env.CAREER_AUDIT_FULL === '1';
const MONETIZATION_CAREER_AUDIT = process.env.CAREER_AUDIT_MONETIZATION === '1';
const SKIP_FULL_CAREER_MANAGER = process.env.CAREER_AUDIT_SKIP_MANAGER === '1';
const DOUBLE_PLAYER_MATCH_COINS = process.env.CAREER_AUDIT_DOUBLE_MATCH_COINS === '1';
const FULL_PLAYER_RUNS_PER_ROLE = Math.max(
  1,
  Math.floor(Number(process.env.CAREER_AUDIT_PLAYER_RUNS_PER_ROLE ?? 1)),
);
const requestedPlayerRetirementAge = Number(process.env.CAREER_AUDIT_PLAYER_RETIREMENT_AGE);
const FULL_PLAYER_RETIREMENT_AGE = Number.isFinite(requestedPlayerRetirementAge)
  ? Math.max(33, Math.floor(requestedPlayerRetirementAge))
  : undefined;
const FULL_MANAGER_RUNS = Math.max(
  0,
  Math.floor(Number(process.env.CAREER_AUDIT_MANAGER_RUNS ?? 1)),
);
const FULL_CAREER_ROLES = new Set(
  (process.env.CAREER_AUDIT_ROLES ?? 'BATTER,BOWLER,ALLROUNDER')
    .split(',')
    .map((role: string) => role.trim().toUpperCase())
    .filter(Boolean),
);
const REPORT_PATH = path.resolve(
  process.env.CAREER_AUDIT_OUT ?? 'test-artifacts/five-season-career-audit.json',
);
const FULL_REPORT_PATH = path.resolve(
  process.env.CAREER_AUDIT_FULL_OUT ?? 'test-artifacts/full-career-audit.json',
);
const MONETIZATION_REPORT_PATH = path.resolve(
  process.env.CAREER_AUDIT_MONETIZATION_OUT ??
    'test-artifacts/player-monetization-career-audit.json',
);
const NEUTRAL_TACTICS: Tactics = {
  batting: 'BALANCED',
  bowling: 'CONTAIN',
  field: 'BALANCED',
};

type AuditMode = 'career' | 'manager';

interface MatchAudit {
  fixtureId: string;
  format: Format;
  competition: string;
  result: string;
  userWon: boolean;
  neutral: boolean;
  selected?: boolean;
  innings?: { teamId: string; runs: number; wickets: number; balls: number }[];
}

interface TableAudit {
  competition: string;
  rows: number;
  position?: number;
  played?: number;
  won?: number;
  lost?: number;
  tied?: number;
  noResult?: number;
}

interface FormatRange {
  innings: number;
  minimum: number;
  maximum: number;
  average: number;
}

interface TrainingAudit {
  sessions: number;
  acceleratedSessions: number;
  coinsSpent: number;
  directAttributeGain: number;
  byFocus: Partial<Record<TrainGroup, number>>;
}

interface CricketStatsAudit {
  matches: number;
  runs: number;
  balls: number;
  strikeRate: number;
  highScore: number;
  notOuts: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  bowlingAverage: number | null;
  economyRate: number | null;
  bestBowling: string;
  catches: number;
  stumpings: number;
}

interface SeasonAudit {
  season: number;
  year: number;
  levelBefore: string;
  levelAfter: string;
  ageBefore?: number;
  ageAfter?: number;
  overallBefore?: number;
  overallAfter?: number;
  walletBefore: number;
  walletAfter: number;
  walletDelta: number;
  clubBalanceBefore?: number;
  clubBalanceAfter?: number;
  clubBalanceDelta?: number;
  teamMatchesRecorded: number;
  selectedAppearances?: number;
  playerStatMatchesAdded?: number;
  training?: TrainingAudit;
  wins: number;
  losses: number;
  drawsOrNoResults: number;
  tables: TableAudit[];
  scoreRanges: Partial<Record<Format, FormatRange>>;
  matches: MatchAudit[];
}

interface ModeAudit {
  mode: AuditMode;
  role?: Role;
  seed: number;
  seasonsRequested: number;
  seasonsCompleted: number;
  startingYear: number;
  endingYear: number;
  startingAge?: number;
  endingAge?: number;
  startingOverall?: number;
  endingOverall?: number;
  endingDisciplines?: {
    batting: number;
    bowling: number;
    fielding: number;
    mentalPhysical: number;
  };
  startingWallet: number;
  endingWallet: number;
  startingGems: number;
  endingGems: number;
  internationalCaps?: number;
  internationalRankingPeaks?: SaveGame['internationalPlayerRankingPeaks'];
  capped?: boolean;
  awards?: string[];
  startingClubBalance?: number;
  endingClubBalance?: number;
  promotions: number;
  bestLeaguePosition?: number;
  managerState?: {
    careerLevel: string;
    reputation: number;
    currentClubId?: string;
    currentClubName?: string;
    currentClubReputation?: number;
    nationalTeamId?: string;
    boardConfidence: number;
    clubsWithPersistedState: number;
    facilities?: { training: number; medical: number; academy: number };
    stadium?: {
      name: string;
      capacityLevel: number;
      experienceLevel: number;
      fanBase: number;
      attendanceEntries: number;
      averageAttendance: number;
      averageOccupancy: number;
      totalNetGateReceipts: number;
    };
    lastSeasonSettlement?: SaveGame['lastSeasonSettlement'];
  };
  retired: boolean;
  training?: TrainingAudit;
  titles: {
    league: number;
    /** The standalone National Knockout Cup is a Manager-only competition. */
    cup?: number;
    continental: number;
    world: string[];
  };
  careerRecord: { wins: number; losses: number; drawsOrNoResults: number; winRate: number };
  careerStats?: CricketStatsAudit;
  finalCompetitionStats?: Partial<Record<CareerCompetitionStatScope, CricketStatsAudit>>;
  seasons: SeasonAudit[];
  warnings: string[];
  errors: string[];
}

interface AuditReport {
  generatedAt: string;
  config: {
    seasons: number;
    playerSeed: number;
    managerSeed: number;
    difficulty: 'NORMAL';
    spending: 'NONE';
    matchMode: 'INSTANT_SIM';
  };
  player: ModeAudit;
  manager: ModeAudit;
  status: 'PASS' | 'FAIL';
}

type MonetizationTier =
  'FREE' | 'STARTER_PACK' | 'ONE_ACCELERATOR' | 'LARGE_COIN_PACK' | 'PLAYER_LEGEND' | 'WHALE_5K';

interface MonetizationProfile {
  id: MonetizationTier;
  label: string;
  referenceSpendInr: number;
  paidCoins: number;
  paidGems: number;
  acceleratorCharges: number;
  vip: boolean;
  basket: string[];
}

interface MonetizationRoleResult {
  role: Role;
  audit: ModeAudit;
  ageAtOverall: Record<'70' | '80' | '85' | '90' | '95', number | null>;
  paidCoinsRemainingAtRetirement: number;
}

interface MonetizationTierResult {
  profile: MonetizationProfile;
  roles: MonetizationRoleResult[];
}

const MONETIZATION_PROFILES: readonly MonetizationProfile[] = [
  {
    id: 'FREE',
    label: 'Engaged free optimiser',
    referenceSpendInr: 0,
    paidCoins: 0,
    paidGems: 0,
    acceleratorCharges: 0,
    vip: false,
    basket: [],
  },
  {
    id: 'STARTER_PACK',
    label: 'Starter Pack buyer',
    referenceSpendInr: 99,
    paidCoins: 3_000,
    paidGems: 50,
    acceleratorCharges: 0,
    vip: false,
    basket: ['1x Starter Pack'],
  },
  {
    id: 'ONE_ACCELERATOR',
    label: 'One Training Accelerator buyer',
    referenceSpendInr: 149,
    paidCoins: 0,
    paidGems: 0,
    acceleratorCharges: 3,
    vip: false,
    basket: ['1x Training Accelerator'],
  },
  {
    id: 'LARGE_COIN_PACK',
    label: 'Large Coin Pack buyer',
    referenceSpendInr: 499,
    paidCoins: 20_000,
    paidGems: 0,
    acceleratorCharges: 0,
    vip: false,
    basket: ['1x Sack of Coins'],
  },
  {
    id: 'PLAYER_LEGEND',
    label: 'Player Legend buyer',
    referenceSpendInr: 999,
    paidCoins: 40_000,
    paidGems: 1_200,
    acceleratorCharges: 0,
    vip: true,
    basket: ['1x Player Legend Edition'],
  },
  {
    id: 'WHALE_5K',
    label: 'Approximately INR 4,500 whale basket',
    referenceSpendInr: 4_487,
    paidCoins: 143_000,
    paidGems: 1_250,
    acceleratorCharges: 18,
    vip: true,
    basket: [
      '1x Starter Pack',
      '1x Player Legend Edition',
      '5x Sack of Coins',
      '6x Training Accelerator',
    ],
  },
];

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

function currentYear(save: SaveGame): number {
  return save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
}

function resultLedgerIds(save: SaveGame): Set<string> {
  return new Set(
    Object.entries(save.flags ?? {})
      .filter(([key, value]) => key.startsWith('resultCount:') && value)
      .map(([key]) => key.slice('resultCount:'.length)),
  );
}

function newSetValues(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((value) => !before.has(value));
}

function resetStore(): void {
  useCareer.setState({
    save: null,
    ref: null,
    targetFixtureId: undefined,
    pendingAchievementIds: [],
    lastPromotion: null,
    persistenceError: null,
    persist: originalPersist,
    persistCritical: originalPersistCritical,
  });
}

function createPlayerAuditSave(role: Role = 'ALLROUNDER', seed = PLAYER_SEED): SaveGame {
  // Mirrors legal Grade A creation allocations. Specialists spend 150 points
  // in their visible discipline/mental attributes; the All-Rounder spends 230.
  const batter = role === 'BATTER';
  const bowler = role === 'BOWLER';
  const player = buildUserPlayer({
    name: `${role === 'ALLROUNDER' ? 'All-Rounder' : role === 'BATTER' ? 'Batter' : 'Bowler'} Audit`,
    nationality: 'india',
    role,
    battingStyle: 'RHB',
    bowlingStyle: bowler || role === 'ALLROUNDER' ? 'PACE' : undefined,
    batting: {
      technique: batter ? 50 : role === 'ALLROUNDER' ? 55 : 35,
      timing: batter || role === 'ALLROUNDER' ? 50 : 35,
      power: batter || role === 'ALLROUNDER' ? 50 : 35,
      footwork: batter || role === 'ALLROUNDER' ? 50 : 35,
      temperament: batter || role === 'ALLROUNDER' ? 50 : 35,
      running: batter || role === 'ALLROUNDER' ? 50 : 35,
    },
    bowling: {
      paceOrSpin: bowler ? 55 : role === 'ALLROUNDER' ? 50 : 35,
      accuracy: bowler ? 55 : role === 'ALLROUNDER' ? 50 : 35,
      movement: bowler ? 55 : role === 'ALLROUNDER' ? 50 : 35,
      variations: bowler || role === 'ALLROUNDER' ? 50 : 35,
      stamina: bowler || role === 'ALLROUNDER' ? 50 : 35,
    },
    fielding: { catching: 35, throwing: 35, agility: 35, keeping: 35 },
    meta: { fitness: 50, confidence: 50, aggression: 50, discipline: 50 },
    age: 16,
    attrScale: 0.52,
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    format: 'T20',
    seed,
    now: 1_700_000_000_000 + seed,
    archetype: 'SPECIALIST',
  });
  save.id = `career-audit-${role.toLowerCase()}-${seed}`;
  return save;
}

function createManagerAuditSave(seed = MANAGER_SEED): SaveGame {
  const save = createManagerSave({
    teamId: 'mumbai_sharks',
    country: 'india',
    difficulty: 'NORMAL',
    format: 'T20',
    seed,
    now: 1_700_000_000_000 + seed,
  });
  save.id = `manager-audit-${seed}`;
  return save;
}

function chooseNeutralToss(live: LiveMatch): void {
  if (live.tossDecision.userCanCall) live.setTossCall('HEADS');
  if (live.tossDecision.userMayChoose) live.setTossChoice('BAT');
}

function validateMatch(match: MatchState, mode: AuditMode, errors: string[]): void {
  const prefix = `${mode}:${match.id}`;
  if (!match.result) errors.push(`${prefix} completed without a match result.`);
  const winner = match.result?.winnerTeamId;
  if (winner && winner !== match.homeTeamId && winner !== match.awayTeamId) {
    errors.push(`${prefix} recorded a winner that did not play in the fixture.`);
  }
  if (match.homePlayerIds && new Set(match.homePlayerIds).size !== match.homePlayerIds.length) {
    errors.push(`${prefix} contains duplicate players in the home XI.`);
  }
  if (match.awayPlayerIds && new Set(match.awayPlayerIds).size !== match.awayPlayerIds.length) {
    errors.push(`${prefix} contains duplicate players in the away XI.`);
  }
  for (const [index, innings] of match.innings.entries()) {
    if (!Number.isFinite(innings.runs) || innings.runs < 0) {
      errors.push(`${prefix} innings ${index + 1} has invalid runs (${innings.runs}).`);
    }
    if (!Number.isFinite(innings.wickets) || innings.wickets < 0 || innings.wickets > 10) {
      errors.push(`${prefix} innings ${index + 1} has invalid wickets (${innings.wickets}).`);
    }
    if (!Number.isFinite(innings.balls) || innings.balls < 0) {
      errors.push(`${prefix} innings ${index + 1} has invalid balls (${innings.balls}).`);
    }
  }
}

function matchAuditFromState(
  save: SaveGame,
  fixtureId: string,
  mode: AuditMode,
  selected?: boolean,
  match?: MatchState,
): MatchAudit {
  const fixture = save.fixtures[fixtureId];
  const controlledTeamId =
    mode === 'manager'
      ? save.userTeamId
      : fixture
        ? careerPlayingTeamId(save, fixtureId)
        : save.userTeamId;
  const neutral = fixture?.resultKind === 'TIE' || fixture?.resultKind === 'NO_RESULT';
  return {
    fixtureId,
    format: fixture?.format ?? match?.format ?? 'T20',
    competition:
      fixture?.competitionId ??
      fixture?.competition ??
      (fixture?.cupRound ? fixture.cupRound : 'unknown'),
    result: fixture?.resultKind ?? match?.result?.margin ?? 'UNKNOWN',
    userWon: Boolean(controlledTeamId && fixture?.winnerTeamId === controlledTeamId),
    neutral,
    selected,
    innings: match?.innings.map((innings) => ({
      teamId: innings.battingTeamId,
      runs: innings.runs,
      wickets: innings.wickets,
      balls: innings.balls,
    })),
  };
}

function completeLiveFixture(
  mode: AuditMode,
  errors: string[],
): { fixtureId: string; selected?: boolean; coinsAwarded?: number; match: MatchState } | null {
  const state = useCareer.getState();
  const started = state.beginLiveMatch();
  if (!started) return null;
  const { fixtureId, live } = started;
  chooseNeutralToss(live);

  if (mode === 'manager') {
    state.setTactics(NEUTRAL_TACTICS, fixtureId);
    live.setTactics({ battingBias: 0, bowlerPlan: 'CONTAIN', field: 'BALANCED' });
    const active = useCareer.getState().save;
    if (!active || !applyManagerPreparationToLiveMatch(active, fixtureId, live)) {
      errors.push(`manager:${fixtureId} could not confirm neutral match preparation.`);
    }
  }

  let ballGuard = 0;
  try {
    while (!live.matchDone && ballGuard++ < 20_000) live.nextBall();
  } catch (error) {
    const active = useCareer.getState().save;
    const fixture = active?.fixtures[fixtureId];
    const rosterSummary = fixture
      ? [fixture.homeTeamId, fixture.awayTeamId]
          .map((teamId) => {
            const team = active?.teams[teamId];
            const existing = (team?.playerIds ?? []).filter((id) => Boolean(active?.players[id]));
            return `${teamId}:${existing.length}/${team?.playerIds.length ?? 0}`;
          })
          .join(', ')
      : 'fixture missing';
    throw new Error(
      `${mode}:${fixtureId} crashed at delivery ${ballGuard}; ` +
        `season=${active?.currentSeasonId ?? 'none'}; ` +
        `managerLevel=${active?.managerCareerLevel ?? 'n/a'}; rosters=${rosterSummary}`,
      { cause: error },
    );
  }
  if (!live.matchDone) {
    errors.push(`${mode}:${fixtureId} exceeded the 20,000-delivery match guard.`);
    return null;
  }

  const match = live.finalizeMatch();
  validateMatch(match, mode, errors);
  const committed = useCareer.getState().commitLiveMatch(match);
  if (!committed) {
    errors.push(`${mode}:${fixtureId} was simulated but rejected by canonical finalization.`);
    return { fixtureId, match };
  }
  const active = useCareer.getState().save;
  const fixture = active?.fixtures[fixtureId];
  const recorded = Boolean(active?.flags?.[`resultCount:${fixtureId}`]);
  // A merit promotion can rebuild the youth world immediately after the
  // completed match. In that case the durable result ledger survives while the
  // old pathway fixture is intentionally removed from the active season.
  if (
    (!fixture && !recorded) ||
    (fixture && (!fixture.played || fixture.resultMatchId !== fixtureId))
  ) {
    errors.push(`${mode}:${fixtureId} did not persist its played/result authority fields.`);
  }
  return {
    fixtureId,
    selected: committed.selected,
    coinsAwarded: committed.coinsAwarded,
    match,
  };
}

function validateRows(
  label: string,
  rows: LeagueRow[],
  highlightTeamId: string | undefined,
  errors: string[],
): TableAudit {
  for (const row of rows) {
    const classified = row.won + row.lost + row.tied + row.noResult;
    if (row.played !== classified) {
      errors.push(
        `${label}:${row.teamId} table mismatch: P${row.played} but W/L/T/NR total ${classified}.`,
      );
    }
    if ([row.played, row.won, row.lost, row.tied, row.noResult, row.points].some((v) => v < 0)) {
      errors.push(`${label}:${row.teamId} contains a negative table value.`);
    }
  }
  const index = highlightTeamId ? rows.findIndex((row) => row.teamId === highlightTeamId) : -1;
  const highlighted = index >= 0 ? rows[index] : undefined;
  if (highlightTeamId && rows.length > 0 && !highlighted) {
    errors.push(`${label} does not contain the controlled team ${highlightTeamId}.`);
  }
  return {
    competition: label,
    rows: rows.length,
    position: highlighted ? index + 1 : undefined,
    played: highlighted?.played,
    won: highlighted?.won,
    lost: highlighted?.lost,
    tied: highlighted?.tied,
    noResult: highlighted?.noResult,
  };
}

function playerTables(save: SaveGame, errors: string[]): TableAudit[] {
  const competitionIds = [
    ...new Set(
      Object.values(save.fixtures)
        .filter(
          (fixture) =>
            fixture.seasonId === save.currentSeasonId &&
            !fixture.playoff &&
            fixture.competition !== 'CUP' &&
            !isInternationalFixture(fixture) &&
            fixture.competitionId,
        )
        .map((fixture) => fixture.competitionId!),
    ),
  ].sort();
  return competitionIds.map((competitionId) => {
    const rows =
      competitionId === 't20-league'
        ? standings(save)
        : fixtureCompetitionStandings(save, competitionId);
    const highlightTeamId = competitionId.startsWith('youth-')
      ? save.careerPathTeamId
      : playerAffiliationTeamId(save, competitionId);
    return validateRows(`player:${competitionId}`, rows, highlightTeamId, errors);
  });
}

function managerTables(save: SaveGame, errors: string[]): TableAudit[] {
  if (save.managerCareerLevel === 'NATIONAL') return [];
  const tier = (save.userDivision ?? 3) as 1 | 2 | 3;
  return (['LIST_A', 'FIRST_CLASS', 'T20'] as const).map((phase) =>
    validateRows(
      `manager:${phase}`,
      managerCompetitionStandings(save, phase, tier),
      save.userTeamId,
      errors,
    ),
  );
}

function scoreRanges(matches: MatchAudit[]): Partial<Record<Format, FormatRange>> {
  const byFormat = new Map<Format, number[]>();
  for (const match of matches) {
    const values = byFormat.get(match.format) ?? [];
    values.push(...(match.innings ?? []).map((innings) => innings.runs));
    byFormat.set(match.format, values);
  }
  return Object.fromEntries(
    [...byFormat.entries()].map(([format, values]) => [
      format,
      {
        innings: values.length,
        minimum: Math.min(...values),
        maximum: Math.max(...values),
        average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
      },
    ]),
  );
}

function progressSignature(save: SaveGame): string {
  const played = Object.values(save.fixtures).filter((fixture) => fixture.played).length;
  const playerEvent = save.playerCalendar?.events[save.playerCalendar.cursor];
  return [
    save.currentSeasonId,
    played,
    resultLedgerIds(save).size,
    save.playerCalendar?.cursor ?? '-',
    playerEvent?.id ?? '-',
    playerEvent?.completed ? 'complete' : 'pending',
    save.managerCalendar?.phase ?? '-',
    save.managerCalendar?.lastSummary?.phase ?? '-',
  ].join('|');
}

function emptyTrainingAudit(): TrainingAudit {
  return {
    sessions: 0,
    acceleratedSessions: 0,
    coinsSpent: 0,
    directAttributeGain: 0,
    byFocus: {},
  };
}

function auditStats(stats: PlayerStats): CricketStatsAudit {
  return {
    matches: stats.matches,
    runs: stats.runs,
    balls: stats.balls,
    strikeRate: Number((stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0).toFixed(2)),
    highScore: stats.highScore,
    notOuts: stats.notOuts,
    fifties: stats.fifties,
    hundreds: stats.hundreds,
    fours: stats.fours,
    sixes: stats.sixes,
    wickets: stats.wickets,
    ballsBowled: stats.ballsBowled,
    runsConceded: stats.runsConceded,
    bowlingAverage:
      stats.wickets > 0 ? Number((stats.runsConceded / stats.wickets).toFixed(2)) : null,
    economyRate:
      stats.ballsBowled > 0
        ? Number(((stats.runsConceded * 6) / stats.ballsBowled).toFixed(2))
        : null,
    bestBowling: stats.bestBowling,
    catches: stats.catches,
    stumpings: stats.stumpings,
  };
}

function trainingDelta(after: TrainingAudit, before: TrainingAudit): TrainingAudit {
  const focuses = new Set([...Object.keys(after.byFocus), ...Object.keys(before.byFocus)]);
  return {
    sessions: after.sessions - before.sessions,
    acceleratedSessions: after.acceleratedSessions - before.acceleratedSessions,
    coinsSpent: after.coinsSpent - before.coinsSpent,
    directAttributeGain: after.directAttributeGain - before.directAttributeGain,
    byFocus: Object.fromEntries(
      [...focuses].map((focus) => [
        focus,
        (after.byFocus[focus as TrainGroup] ?? 0) - (before.byFocus[focus as TrainGroup] ?? 0),
      ]),
    ),
  };
}

/** Spend only earned Wallet Coins through the real training caps, prices and gains. */
function buyAffordableTraining(
  save: SaveGame,
  seed: number,
  audit: TrainingAudit,
  accelerator?: { remaining: number },
): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  const player = save.players[save.userPlayerId];
  const priorities = trainingGroupsForRole(player.role);
  const unavailable = new Set<TrainGroup>();
  for (let guard = 0; guard < 30; guard += 1) {
    const candidates = priorities
      .filter((group) => !unavailable.has(group) && canTrain(player, group, save.careerPathLevel))
      .sort((a, b) => {
        const sessionDifference = sessionsDone(player, a) - sessionsDone(player, b);
        return sessionDifference || priorities.indexOf(a) - priorities.indexOf(b);
      });
    const group = candidates[0];
    if (!group) return;
    const cost = trainingCost(sessionsDone(player), computeOverall(player), player.role);
    if (save.wallet.coins < cost) return;
    const rng = makeRng((seed ^ Math.imul(audit.sessions + 1, 0x9e3779b1)) >>> 0);
    const accelerated = (accelerator?.remaining ?? 0) > 0;
    const normalTrainingMultiplier = archetypeTrainingMultiplier(save, player, group);
    const gains = applyTraining(
      player,
      group,
      rng,
      save.careerPathLevel,
      normalTrainingMultiplier * (accelerated ? 1.5 : 1),
    );
    if (gains.length === 0) {
      unavailable.add(group);
      continue;
    }
    save.wallet = addCoins(save.wallet, -cost);
    audit.sessions += 1;
    if (accelerated && accelerator) {
      accelerator.remaining -= 1;
      audit.acceleratedSessions += 1;
    }
    audit.coinsSpent += cost;
    audit.directAttributeGain += gains.reduce((sum, gain) => sum + gain.to - gain.from, 0);
    audit.byFocus[group] = (audit.byFocus[group] ?? 0) + 1;
  }
}

/** Keep the full-career Manager audit representative of an engaged free user. */
function setBestManagerXI(save: SaveGame): void {
  if (save.mode !== 'manager' || !save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  if (!team) return;
  const squad = team.playerIds
    .map((playerId) => save.players[playerId])
    .filter((player): player is Player => Boolean(player && !player.retired));
  team.xi = autoXI(squad).map((player) => player.id);
}

/**
 * Exercise the real Manager sinks instead of letting a no-action audit hoard
 * 25 seasons of gate receipts while every contract expires. It renews the
 * current squad, makes at most two clear free-agent upgrades and buys one
 * affordable facility level per off-season while respecting the club's
 * itemised operating reserve.
 */
function manageManagerOffSeason(save: SaveGame): void {
  if (save.mode !== 'manager' || !save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  if (!team) return;

  for (const player of expiringContracts(save).sort((a, b) => b.overall - a.overall)) {
    renewContract(save, player.id, 3);
  }

  for (let move = 0; move < 2; move += 1) {
    const target = (save.freeAgents ?? [])
      .map((playerId) => save.players[playerId])
      .filter((player): player is Player => Boolean(player && !player.retired))
      .filter(
        (player) =>
          optionalClubSpendBlockReason(save, computeValue(player), playerWage(player)) === null &&
          ffpBlockReason(save, player) === null,
      )
      .sort((a, b) => b.overall - a.overall)[0];
    if (!target) break;
    const weakest = team.playerIds
      .map((playerId) => save.players[playerId])
      .filter((player): player is Player => Boolean(player))
      .sort((a, b) => a.overall - b.overall)[0];
    if (!weakest || target.overall < weakest.overall + 3) break;
    if (team.playerIds.length >= 22 && !releasePlayer(save, weakest.id).ok) break;
    if (!signFreeAgent(save, target.id).ok) break;
  }

  const facility = (['training', 'medical', 'academy'] as const)
    .filter((kind) => (save.facilities?.[kind] ?? 5) < 5)
    .sort((a, b) => (save.facilities?.[a] ?? 5) - (save.facilities?.[b] ?? 5))[0];
  if (facility && save.facilities) {
    const cost = facilityUpgradeCost(save.facilities[facility] + 1);
    if (team.budget - cost >= 400_000) {
      upgradeFacility(save, facility, 'CLUB_BUDGET');
    }
  }
  setBestManagerXI(save);
}

function worldTitles(save: SaveGame): string[] {
  const won = new Set<string>();
  const controlledCountry = save.userPlayerId
    ? save.players[save.userPlayerId]?.nationality
    : save.managerNationalTeamId
      ? save.teams[save.managerNationalTeamId]?.country
      : undefined;
  if (save.u19WorldCup?.status === 'CHAMPION') won.add('U19 World Cup');
  for (const tournament of Object.values(save.internationalTournaments ?? {})) {
    if (
      tournament.championCountryId &&
      tournament.championCountryId === tournament.controlledCountryId
    ) {
      won.add(tournament.name);
    }
  }
  for (const cycle of Object.values(save.wtcCycles ?? {})) {
    if (controlledCountry && cycle.championCountryId === controlledCountry) {
      won.add(`World Test Championship ${cycle.endYear}`);
    }
  }
  return [...won].sort();
}

interface RunModeOptions {
  seasons?: number;
  buyTraining?: boolean;
  manageManager?: boolean;
  playerRetirementAge?: number;
  retireWhenRecommended?: boolean;
  acceleratorCharges?: number;
  /** Simulates completing the optional post-match coin-doubling ad every time it is offered. */
  doubleMatchCoins?: boolean;
}

function runMode(
  mode: AuditMode,
  save: SaveGame,
  seed: number,
  options: RunModeOptions = {},
): ModeAudit {
  const seasonsRequested = options.seasons ?? SEASONS;
  resetStore();
  useCareer.getState().setActive(save, mode, 1);
  useCareer.setState({
    persist: jest.fn(async () => undefined),
    persistCritical: jest.fn(async () => undefined),
  });

  const activeStart = useCareer.getState().save!;
  const playerId = activeStart.userPlayerId;
  const startingAge = playerId
    ? activeStart.players[playerId]?.age
    : mode === 'manager'
      ? activeStart.managerAge
      : undefined;
  const startingOverall = playerId ? computeOverall(activeStart.players[playerId]) : undefined;
  const startingYear = currentYear(activeStart);
  const startingWallet = activeStart.wallet.coins;
  const startingGems = activeStart.wallet.gems;
  const startingClubBalance =
    mode === 'manager' && activeStart.userTeamId
      ? activeStart.teams[activeStart.userTeamId]?.budget
      : undefined;
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenResultIds = resultLedgerIds(activeStart);
  const seasons: SeasonAudit[] = [];
  const training = emptyTrainingAudit();
  const accelerator = { remaining: Math.max(0, options.acceleratorCharges ?? 0) };

  for (let seasonNumber = 1; seasonNumber <= seasonsRequested; seasonNumber += 1) {
    const opening = useCareer.getState().save!;
    const year = currentYear(opening);
    const levelBefore =
      mode === 'career'
        ? (opening.careerPathLevel ?? 'DOMESTIC')
        : (opening.managerCareerLevel ?? 'CLUB');
    const ageBefore = playerId
      ? opening.players[playerId]?.age
      : mode === 'manager'
        ? opening.managerAge
        : undefined;
    const overallBefore = playerId ? computeOverall(opening.players[playerId]) : undefined;
    const walletBefore = opening.wallet.coins;
    const clubBalanceBefore =
      mode === 'manager' && opening.userTeamId
        ? opening.teams[opening.userTeamId]?.budget
        : undefined;
    const careerRecordBefore = {
      wins: opening.careerWins ?? 0,
      losses: opening.careerLosses ?? 0,
      draws: opening.careerDraws ?? 0,
    };
    const statMatchesBefore = playerId
      ? (opening.players[playerId]?.careerStats?.matches ?? 0)
      : undefined;
    const ledgerBefore = resultLedgerIds(opening);
    const trainingBefore: TrainingAudit = {
      ...training,
      byFocus: { ...training.byFocus },
    };
    const liveMatches = new Map<string, MatchState>();
    const selectedByFixture = new Map<string, boolean | undefined>();

    let actionGuard = 0;
    while (!seasonComplete(useCareer.getState().save!) && actionGuard++ < 1_500) {
      if (options.buyTraining) {
        buyAffordableTraining(
          useCareer.getState().save!,
          seed + seasonNumber * 10_007,
          training,
          accelerator,
        );
      }
      if (mode === 'manager' && options.manageManager) {
        setBestManagerXI(useCareer.getState().save!);
      }
      const before = useCareer.getState().save!;
      const beforeSignature = progressSignature(before);
      const beforeLedger = resultLedgerIds(before);
      const fixtureId = nextUserFixtureId(before);

      if (fixtureId) {
        if (beforeLedger.has(fixtureId) && !before.fixtures[fixtureId]?.played) {
          errors.push(
            `${mode}:${fixtureId} reuses an earlier season's completed-result ID while the current fixture is still unplayed.`,
          );
          break;
        }
        const calendarBefore = mode === 'career' ? currentPlayerCalendarEvent(before) : undefined;
        const completed = completeLiveFixture(mode, errors);
        if (completed) {
          liveMatches.set(completed.fixtureId, completed.match);
          selectedByFixture.set(completed.fixtureId, completed.selected);
          if (mode === 'career' && options.doubleMatchCoins && (completed.coinsAwarded ?? 0) > 0) {
            const granted = useCareer
              .getState()
              .grantAdReward(completed.coinsAwarded!, `match-double:${completed.fixtureId}`);
            if (!granted.ok) {
              errors.push(
                `player:${completed.fixtureId} could not apply its rewarded-ad coin double (${granted.reason ?? 'unknown reason'}).`,
              );
            }
          }
        } else if (mode === 'career') {
          const outcome = useCareer.getState().advanceWhileBenched();
          if (!outcome.ok) {
            const blocked = useCareer.getState().save!;
            const calendarAfter = currentPlayerCalendarEvent(blocked);
            const fixture = blocked.fixtures[fixtureId];
            const decision = fixture
              ? careerSelectionDecision(blocked, fixture.format, fixtureId)
              : undefined;
            errors.push(
              `player:${fixtureId} could neither start Matchday nor advance as benched (${outcome.reason ?? 'unknown reason'}). ` +
                `Before=${calendarBefore?.id ?? 'none'}/${calendarBefore?.kind ?? 'none'}/${calendarBefore?.fixtureId ?? 'none'}; ` +
                `after=${calendarAfter?.id ?? 'none'}/${calendarAfter?.kind ?? 'none'}/${calendarAfter?.fixtureId ?? 'none'}; ` +
                `fixture=${fixture ? `${fixture.played ? 'played' : 'unplayed'}:${fixture.homeTeamId}v${fixture.awayTeamId}` : 'missing'}; ` +
                `selection=${decision ? `${decision.selected}:${Math.round(decision.userScore)}-${Math.round(decision.rivalScore)}` : 'unknown'}.`,
            );
            break;
          }
        } else {
          errors.push(`manager:${fixtureId} could not open its required Matchday.`);
          break;
        }
      } else if (mode === 'career') {
        const calendarEvent = currentPlayerCalendarEvent(before);
        if (calendarEvent) {
          const choice =
            calendarEvent.kind === 'TRAINING'
              ? 'SKILL'
              : calendarEvent.kind === 'EXAM'
                ? 'STUDY'
                : calendarEvent.kind === 'NCA_CAMP'
                  ? 'ATTEND'
                  : undefined;
          const outcome = useCareer.getState().resolvePlayerWeek(choice);
          if (!outcome.ok) {
            errors.push(
              `player:${calendarEvent.id} could not resolve (${outcome.reason ?? 'unknown reason'}).`,
            );
            break;
          }
        } else {
          // This is the same hub action that catches up AI fixtures and stages
          // any late knockout before the season-complete state appears.
          useCareer.getState().advanceSeason();
        }
      } else {
        const outcome = useCareer.getState().advanceManagerCalendar();
        if (!outcome) {
          errors.push(`manager:${year} calendar returned no progress outcome.`);
          break;
        }
      }

      const after = useCareer.getState().save!;
      const addedIds = newSetValues(beforeLedger, resultLedgerIds(after));
      for (const id of addedIds) {
        if (seenResultIds.has(id)) errors.push(`${mode}:${id} was registered more than once.`);
        seenResultIds.add(id);
      }
      if (progressSignature(after) === beforeSignature) {
        const unplayedByCompetition = Object.values(after.fixtures)
          .filter((fixture) => !fixture.played)
          .reduce<Record<string, number>>((counts, fixture) => {
            const key = fixture.competitionId ?? fixture.competition ?? 'unknown';
            counts[key] = (counts[key] ?? 0) + 1;
            return counts;
          }, {});
        const calendar = after.playerCalendar;
        errors.push(
          `${mode}:${year} made no progress with next fixture ${fixtureId ?? 'none'} (dead end). ` +
            `month=${after.currentMonth ?? 'none'} level=${after.careerPathLevel ?? after.managerCareerLevel ?? 'none'} ` +
            `capped=${Boolean(after.capped)} leagueComplete=${leagueComplete(after)} ` +
            `calendar=${calendar ? `${calendar.year}:${calendar.cursor}/${calendar.events.length}` : 'none'} ` +
            `event=${currentPlayerCalendarEvent(after)?.id ?? 'none'} ` +
            `userCompetitionFixtures=${nextUserFixturesByCompetition(after).length} ` +
            `unplayed=${JSON.stringify(unplayedByCompetition)}.`,
        );
        break;
      }
    }

    if (options.buyTraining) {
      buyAffordableTraining(
        useCareer.getState().save!,
        seed + seasonNumber * 10_007,
        training,
        accelerator,
      );
    }
    const completed = useCareer.getState().save!;
    if (actionGuard >= 1_500)
      errors.push(`${mode}:${year} exceeded the 1,500-action season guard.`);
    if (!seasonComplete(completed)) {
      errors.push(`${mode}:${year} did not reach the canonical season-complete state.`);
      break;
    }

    const ledgerAfter = resultLedgerIds(completed);
    const seasonResultIds = newSetValues(ledgerBefore, ledgerAfter);
    const matches = seasonResultIds.map((fixtureId) =>
      matchAuditFromState(
        completed,
        fixtureId,
        mode,
        selectedByFixture.get(fixtureId) ?? (mode === 'career' ? false : undefined),
        liveMatches.get(fixtureId),
      ),
    );
    const selectedAppearances =
      mode === 'career' ? [...selectedByFixture.values()].filter(Boolean).length : undefined;
    const playerStatMatchesAdded =
      playerId && statMatchesBefore != null
        ? (completed.players[playerId]?.careerStats?.matches ?? 0) - statMatchesBefore
        : undefined;
    const wins = (completed.careerWins ?? 0) - careerRecordBefore.wins;
    const losses = (completed.careerLosses ?? 0) - careerRecordBefore.losses;
    const draws = (completed.careerDraws ?? 0) - careerRecordBefore.draws;

    if (wins + losses + draws !== seasonResultIds.length) {
      errors.push(
        `${mode}:${year} career W/L/D added ${wins + losses + draws} for ${seasonResultIds.length} recorded fixtures.`,
      );
    }
    if (mode === 'career' && playerStatMatchesAdded !== selectedAppearances) {
      errors.push(
        `player:${year} added ${playerStatMatchesAdded} appearances but canonical selection completed ${selectedAppearances} matches.`,
      );
    }
    if (completed.wallet.coins < 0 || !Number.isFinite(completed.wallet.coins)) {
      errors.push(`${mode}:${year} ended with an invalid Wallet Coin balance.`);
    }

    const clubBalanceAfter =
      mode === 'manager' && completed.userTeamId
        ? completed.teams[completed.userTeamId]?.budget
        : undefined;
    const tables =
      mode === 'career' ? playerTables(completed, errors) : managerTables(completed, errors);
    const levelAtCompletion =
      mode === 'career'
        ? (completed.careerPathLevel ?? 'DOMESTIC')
        : (completed.managerCareerLevel ?? 'CLUB');

    if (mode === 'manager' && options.manageManager) manageManagerOffSeason(completed);
    useCareer.getState().newSeason();
    const rolled = useCareer.getState().save!;
    const expectedYear = year + 1;
    if (currentYear(rolled) !== expectedYear) {
      errors.push(`${mode}:${year} rolled into ${currentYear(rolled)} instead of ${expectedYear}.`);
    }
    const ageAfter = playerId
      ? rolled.players[playerId]?.age
      : mode === 'manager'
        ? rolled.managerAge
        : undefined;
    if (mode === 'career' && ageBefore != null && ageAfter !== ageBefore + 1) {
      errors.push(`player:${year} age moved from ${ageBefore} to ${ageAfter} instead of +1.`);
    }
    if (mode === 'manager' && ageBefore != null && ageAfter !== Math.min(60, ageBefore + 1)) {
      errors.push(`manager:${year} age moved from ${ageBefore} to ${ageAfter} instead of +1.`);
    }
    if (
      mode === 'career' &&
      options.playerRetirementAge != null &&
      ageAfter != null &&
      ageAfter >= options.playerRetirementAge &&
      !rolled.players[playerId!]?.retired
    ) {
      const retirement = useCareer.getState().retire();
      if (!retirement) {
        errors.push(
          `player:${year} reached audit retirement age ${ageAfter} but retirement failed.`,
        );
      }
    } else if (
      mode === 'career' &&
      options.retireWhenRecommended &&
      rolled.flags.playerRetirementRecommended &&
      !rolled.players[playerId!]?.retired
    ) {
      const retirement = useCareer.getState().retire();
      if (!retirement) {
        errors.push(`player:${year} accepted its retirement recommendation but retirement failed.`);
      }
    }

    seasons.push({
      season: seasonNumber,
      year,
      levelBefore,
      levelAfter:
        mode === 'career'
          ? (rolled.careerPathLevel ?? levelAtCompletion)
          : (rolled.managerCareerLevel ?? levelAtCompletion),
      ageBefore,
      ageAfter,
      overallBefore,
      overallAfter: playerId ? computeOverall(rolled.players[playerId]) : undefined,
      walletBefore,
      walletAfter: rolled.wallet.coins,
      walletDelta: rolled.wallet.coins - walletBefore,
      clubBalanceBefore,
      clubBalanceAfter,
      clubBalanceDelta:
        clubBalanceBefore != null && clubBalanceAfter != null
          ? clubBalanceAfter - clubBalanceBefore
          : undefined,
      teamMatchesRecorded: seasonResultIds.length,
      selectedAppearances,
      playerStatMatchesAdded,
      training: mode === 'career' ? trainingDelta(training, trainingBefore) : undefined,
      wins,
      losses,
      drawsOrNoResults: draws,
      tables,
      scoreRanges: scoreRanges(matches),
      matches,
    });

    const afterRollover = useCareer.getState().save!;
    if (
      (mode === 'career' && Boolean(playerId && afterRollover.players[playerId]?.retired)) ||
      (mode === 'manager' && Boolean(afterRollover.managerRetired))
    ) {
      break;
    }
  }

  const finalSave = useCareer.getState().save!;
  const finalPlayer = playerId ? finalSave.players[playerId] : undefined;
  const totalResults =
    (finalSave.careerWins ?? 0) + (finalSave.careerLosses ?? 0) + (finalSave.careerDraws ?? 0);
  const finalCompetitionStats = finalPlayer?.competitionStats
    ? Object.fromEntries(
        Object.entries(finalPlayer.competitionStats).map(([scope, stats]) => [
          scope,
          stats ? auditStats(stats) : undefined,
        ]),
      )
    : undefined;
  const finalManagerClub =
    mode === 'manager' && finalSave.userTeamId
      ? finalSave.managerClubs?.[finalSave.userTeamId]
      : undefined;
  const attendanceHistory = finalManagerClub?.stadium.attendanceHistory ?? [];
  const averageAttendance =
    attendanceHistory.length > 0
      ? attendanceHistory.reduce((sum, entry) => sum + entry.attendance, 0) /
        attendanceHistory.length
      : 0;
  const averageOccupancy =
    attendanceHistory.length > 0
      ? attendanceHistory.reduce(
          (sum, entry) => sum + entry.attendance / Math.max(1, entry.capacity),
          0,
        ) / attendanceHistory.length
      : 0;

  if (mode === 'manager' && (finalSave.careerLosses ?? 0) === 0 && totalResults > 0) {
    warnings.push(
      'Manager completed the audit without a loss on Normal difficulty; review balance.',
    );
  }
  if (mode === 'career' && (finalPlayer?.careerStats?.matches ?? 0) === 0) {
    warnings.push('Player completed five seasons without a recorded appearance.');
  }
  if (mode === 'career' && finalPlayer) {
    let longestNoAppearanceRun = 0;
    let currentNoAppearanceRun = 0;
    for (const season of seasons) {
      currentNoAppearanceRun =
        (season.selectedAppearances ?? 0) === 0 ? currentNoAppearanceRun + 1 : 0;
      longestNoAppearanceRun = Math.max(longestNoAppearanceRun, currentNoAppearanceRun);
    }
    if (longestNoAppearanceRun >= 2) {
      warnings.push(
        `Player had ${longestNoAppearanceRun} consecutive complete seasons without an appearance.`,
      );
    }
    if (options.buyTraining && computeOverall(finalPlayer) < 78) {
      warnings.push(
        `Spending every affordable earned coin on training produced only ${computeOverall(finalPlayer)} OVR.`,
      );
    }
    if (finalPlayer.role === 'BOWLER') {
      const domesticScopes: CareerCompetitionStatScope[] = [
        'DOMESTIC_T20',
        'LIST_A',
        'FIRST_CLASS',
      ];
      const domesticMatches = domesticScopes.reduce(
        (sum, scope) => sum + (finalPlayer.competitionStats?.[scope]?.matches ?? 0),
        0,
      );
      const domesticBallsBowled = domesticScopes.reduce(
        (sum, scope) => sum + (finalPlayer.competitionStats?.[scope]?.ballsBowled ?? 0),
        0,
      );
      if (domesticMatches > 0 && domesticBallsBowled === 0) {
        warnings.push(
          `Specialist bowler made ${domesticMatches} senior domestic appearances without bowling a ball.`,
        );
      }
    }
    if (!finalSave.capped && (finalPlayer.careerStats?.matches ?? 0) >= 100) {
      warnings.push(
        'Player retired after 100+ appearances without earning a senior international cap.',
      );
    }
  }
  if (mode === 'manager') {
    const perfectSeasons = seasons.filter(
      (season) => season.teamMatchesRecorded >= 10 && season.losses === 0,
    );
    if (perfectSeasons.length > 0) {
      warnings.push(
        `Manager completed ${perfectSeasons.length} season(s) of 10+ matches without a loss (${perfectSeasons.map((season) => season.year).join(', ')}); review this seed as a balance outlier.`,
      );
    }
    let longestWinlessRun = 0;
    let currentWinlessRun = 0;
    for (const season of seasons) {
      currentWinlessRun = season.wins === 0 ? currentWinlessRun + 1 : 0;
      longestWinlessRun = Math.max(longestWinlessRun, currentWinlessRun);
    }
    if (longestWinlessRun >= 2) {
      warnings.push(`Manager had ${longestWinlessRun} consecutive winless seasons on Normal.`);
    }
    if (totalResults >= 100 && (finalSave.careerWins ?? 0) / totalResults < 0.2) {
      warnings.push('Manager career win rate fell below 20% on Normal difficulty.');
    }
  }

  return {
    mode,
    seed,
    role: finalPlayer?.role,
    seasonsRequested,
    seasonsCompleted: seasons.length,
    startingYear,
    endingYear: currentYear(finalSave),
    startingAge,
    endingAge: finalPlayer?.age ?? (mode === 'manager' ? finalSave.managerAge : undefined),
    startingOverall,
    endingOverall: finalPlayer ? computeOverall(finalPlayer) : undefined,
    endingDisciplines: finalPlayer
      ? {
          batting: Number(battingMean(finalPlayer).toFixed(1)),
          bowling: Number(bowlingMean(finalPlayer).toFixed(1)),
          fielding: Number(fieldingMean(finalPlayer).toFixed(1)),
          mentalPhysical: Number(metaMean(finalPlayer).toFixed(1)),
        }
      : undefined,
    startingWallet,
    endingWallet: finalSave.wallet.coins,
    startingGems,
    endingGems: finalSave.wallet.gems,
    internationalCaps: finalSave.userCaps,
    internationalRankingPeaks: finalSave.internationalPlayerRankingPeaks
      ? JSON.parse(JSON.stringify(finalSave.internationalPlayerRankingPeaks))
      : undefined,
    capped: finalSave.capped,
    awards: finalPlayer?.awards ? [...finalPlayer.awards] : undefined,
    startingClubBalance,
    endingClubBalance:
      mode === 'manager' && finalSave.userTeamId
        ? finalSave.teams[finalSave.userTeamId]?.budget
        : undefined,
    promotions: finalSave.promotions ?? 0,
    bestLeaguePosition: finalSave.bestLeaguePos,
    managerState:
      mode === 'manager'
        ? {
            careerLevel: finalSave.managerCareerLevel ?? 'CLUB',
            reputation: finalSave.managerProgression?.reputation ?? 0,
            currentClubId: finalSave.userTeamId,
            currentClubName: finalSave.userTeamId
              ? finalSave.teams[finalSave.userTeamId]?.name
              : undefined,
            currentClubReputation: finalSave.userTeamId
              ? finalSave.teams[finalSave.userTeamId]?.reputation
              : undefined,
            nationalTeamId: finalSave.managerNationalTeamId,
            boardConfidence: finalSave.boardConfidence ?? 0,
            clubsWithPersistedState: Object.keys(finalSave.managerClubs ?? {}).length,
            facilities: finalManagerClub
              ? { ...finalManagerClub.facilities }
              : finalSave.facilities
                ? { ...finalSave.facilities }
                : undefined,
            stadium: finalManagerClub
              ? {
                  name: finalManagerClub.stadium.name,
                  capacityLevel: finalManagerClub.stadium.capacityLevel,
                  experienceLevel: finalManagerClub.stadium.experienceLevel,
                  fanBase: finalManagerClub.stadium.fanBase,
                  attendanceEntries: attendanceHistory.length,
                  averageAttendance: Math.round(averageAttendance),
                  averageOccupancy: Number(averageOccupancy.toFixed(3)),
                  totalNetGateReceipts: attendanceHistory.reduce(
                    (sum, entry) => sum + entry.netReceipts,
                    0,
                  ),
                }
              : undefined,
            lastSeasonSettlement: finalSave.lastSeasonSettlement
              ? { ...finalSave.lastSeasonSettlement }
              : undefined,
          }
        : undefined,
    retired: mode === 'career' ? Boolean(finalPlayer?.retired) : Boolean(finalSave.managerRetired),
    training: mode === 'career' ? training : undefined,
    titles: {
      league: finalSave.leagueTitles ?? 0,
      ...(mode === 'manager' ? { cup: finalSave.cupWins ?? 0 } : {}),
      continental: finalSave.continentalTitles ?? 0,
      world: worldTitles(finalSave),
    },
    careerRecord: {
      wins: finalSave.careerWins ?? 0,
      losses: finalSave.careerLosses ?? 0,
      drawsOrNoResults: finalSave.careerDraws ?? 0,
      winRate: Number(
        (totalResults > 0 ? (finalSave.careerWins ?? 0) / totalResults : 0).toFixed(3),
      ),
    },
    careerStats: finalPlayer?.careerStats ? auditStats(finalPlayer.careerStats) : undefined,
    finalCompetitionStats,
    seasons,
    warnings,
    errors,
  };
}

function printModeSummary(audit: ModeAudit): void {
  console.log(
    `\n${audit.mode === 'career' ? 'PLAYER' : 'MANAGER'} — ${audit.seasonsCompleted} seasons`,
  );
  for (const season of audit.seasons) {
    const record = `${season.wins}W ${season.losses}L ${season.drawsOrNoResults}D/NR`;
    const selection =
      season.selectedAppearances == null ? '' : ` · ${season.selectedAppearances} appearances`;
    const age = season.ageAfter == null ? '' : ` · age ${season.ageAfter}`;
    console.log(
      `${season.year}: ${season.levelBefore} → ${season.levelAfter} · ${record}${selection}${age} · wallet ${season.walletDelta >= 0 ? '+' : ''}${season.walletDelta.toLocaleString()}`,
    );
  }
  console.log(
    `Record: ${audit.careerRecord.wins}W ${audit.careerRecord.losses}L ${audit.careerRecord.drawsOrNoResults}D/NR (${Math.round(audit.careerRecord.winRate * 100)}% wins)`,
  );
  if (audit.warnings.length) console.warn(`Warnings: ${audit.warnings.join(' | ')}`);
  if (audit.errors.length) console.error(`Errors: ${audit.errors.join(' | ')}`);
}

function applyMonetizationProfile(save: SaveGame, profile: MonetizationProfile): SaveGame {
  save.wallet = {
    ...save.wallet,
    coins: save.wallet.coins + profile.paidCoins,
    gems: save.wallet.gems + profile.paidGems,
  };
  if (profile.vip) {
    save.entitlements = { ...save.entitlements, removeAds: true };
    save.vipEnergyBonusActive = true;
  }
  return save;
}

function ageAtOverall(audit: ModeAudit, target: number): number | null {
  if ((audit.startingOverall ?? 0) >= target) return audit.startingAge ?? null;
  return audit.seasons.find((season) => (season.overallAfter ?? 0) >= target)?.ageAfter ?? null;
}

function monetizationRoleResult(
  profile: MonetizationProfile,
  role: Role,
  seed: number,
): MonetizationRoleResult {
  const audit = runMode(
    'career',
    applyMonetizationProfile(createPlayerAuditSave(role, seed), profile),
    seed,
    {
      seasons: 40,
      buyTraining: true,
      retireWhenRecommended: true,
      acceleratorCharges: profile.acceleratorCharges,
    },
  );
  return {
    role,
    audit,
    ageAtOverall: {
      '70': ageAtOverall(audit, 70),
      '80': ageAtOverall(audit, 80),
      '85': ageAtOverall(audit, 85),
      '90': ageAtOverall(audit, 90),
      '95': ageAtOverall(audit, 95),
    },
    paidCoinsRemainingAtRetirement: Math.min(profile.paidCoins, audit.endingWallet),
  };
}

const CAREER_AUDIT_TIMEOUT_MS = Math.max(
  180_000,
  Number(
    process.env.CAREER_AUDIT_TIMEOUT_MS ??
      (FULL_CAREER_AUDIT || MONETIZATION_CAREER_AUDIT ? 1_800_000 : 180_000),
  ),
);

jest.setTimeout(CAREER_AUDIT_TIMEOUT_MS);

const baselineAuditTest = FULL_CAREER_AUDIT || MONETIZATION_CAREER_AUDIT ? test.skip : test;
const fullCareerAuditTest = FULL_CAREER_AUDIT && !MONETIZATION_CAREER_AUDIT ? test : test.skip;
const monetizationCareerAuditTest = MONETIZATION_CAREER_AUDIT ? test : test.skip;

baselineAuditTest(
  'runs five complete Player and Manager seasons through canonical instant-sim settlement',
  () => {
    const player = runMode('career', createPlayerAuditSave(), PLAYER_SEED);
    const manager = runMode('manager', createManagerAuditSave(), MANAGER_SEED);
    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      config: {
        seasons: SEASONS,
        playerSeed: PLAYER_SEED,
        managerSeed: MANAGER_SEED,
        difficulty: 'NORMAL',
        spending: 'NONE',
        matchMode: 'INSTANT_SIM',
      },
      player,
      manager,
      status: player.errors.length === 0 && manager.errors.length === 0 ? 'PASS' : 'FAIL',
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    printModeSummary(player);
    printModeSummary(manager);
    console.log(`\nReport: ${REPORT_PATH}`);

    expect(player.seasonsCompleted).toBe(SEASONS);
    expect(manager.seasonsCompleted).toBe(SEASONS);
    expect(player.errors).toEqual([]);
    expect(manager.errors).toEqual([]);
  },
);

fullCareerAuditTest(
  'runs Batter, Bowler, All-Rounder and Manager careers to canonical retirement',
  () => {
    const playerRuns = [
      { role: 'BATTER' as const, seed: 81_001 },
      { role: 'BOWLER' as const, seed: 82_002 },
      { role: 'ALLROUNDER' as const, seed: 83_003 },
    ]
      .filter(({ role }) => FULL_CAREER_ROLES.has(role))
      .flatMap(({ role, seed: baseSeed }) =>
        Array.from({ length: FULL_PLAYER_RUNS_PER_ROLE }, (_, runIndex) => {
          const seed = baseSeed + runIndex * 10_003;
          return runMode('career', createPlayerAuditSave(role, seed), seed, {
            seasons: 40,
            buyTraining: true,
            playerRetirementAge: FULL_PLAYER_RETIREMENT_AGE,
            retireWhenRecommended: FULL_PLAYER_RETIREMENT_AGE == null,
            doubleMatchCoins: DOUBLE_PLAYER_MATCH_COINS,
          });
        }),
      );
    const managerRuns = SKIP_FULL_CAREER_MANAGER
      ? []
      : Array.from({ length: FULL_MANAGER_RUNS }, (_, runIndex) => {
          const seed = MANAGER_SEED + runIndex * 10_003;
          return runMode('manager', createManagerAuditSave(seed), seed, {
            seasons: 25,
            manageManager: true,
          });
        });
    const allAudits = [...playerRuns, ...managerRuns];
    const status = allAudits.every((audit) => audit.errors.length === 0 && audit.retired)
      ? 'PASS'
      : 'FAIL';
    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        difficulty: 'NORMAL',
        playerStartAge: 16,
        playerRetirementPolicy:
          FULL_PLAYER_RETIREMENT_AGE == null
            ? 'OPTIONAL_33_RECOMMENDED_35_TO_38_MAXIMUM_40'
            : `AUDIT_FIXED_AT_${FULL_PLAYER_RETIREMENT_AGE}`,
        managerStartAge: 35,
        managerRetirementAge: 60,
        playerRunsPerRole: FULL_PLAYER_RUNS_PER_ROLE,
        managerRuns: managerRuns.length,
        spending:
          'PLAYER_EARNED_WALLET_COINS_ON_TRAINING_AND_MANAGER_CLUB_BALANCE_ON_RETENTION_UPGRADES',
        iapOrAds: DOUBLE_PLAYER_MATCH_COINS ? 'REWARDED_MATCH_COIN_DOUBLE' : false,
        matchMode: 'INSTANT_SIM',
      },
      players: playerRuns,
      managers: managerRuns,
      manager: managerRuns[0] ?? null,
      status,
    };

    fs.mkdirSync(path.dirname(FULL_REPORT_PATH), { recursive: true });
    fs.writeFileSync(FULL_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    for (const player of playerRuns) {
      printModeSummary(player);
      const stats = player.finalCompetitionStats;
      console.log(
        `${player.role}: OVR ${player.startingOverall} -> ${player.endingOverall} · training ${player.training?.sessions ?? 0} sessions / ${(player.training?.coinsSpent ?? 0).toLocaleString()} coins · ` +
          `runs ${Object.values(stats ?? {})
            .reduce((sum, item) => sum + (item?.runs ?? 0), 0)
            .toLocaleString()} · wickets ${Object.values(stats ?? {})
            .reduce((sum, item) => sum + (item?.wickets ?? 0), 0)
            .toLocaleString()} · world titles ${player.titles.world.join(', ') || 'none'}`,
      );
    }
    for (const manager of managerRuns) {
      printModeSummary(manager);
      console.log(
        `MANAGER seed ${manager.seed}: age ${manager.startingAge} -> ${manager.endingAge} · titles ${manager.titles.league} league / ${manager.titles.cup} cup / ${manager.titles.continental} continental · world titles ${manager.titles.world.join(', ') || 'none'}`,
      );
    }
    console.log(`\nReport: ${FULL_REPORT_PATH}`);

    expect(playerRuns.map((audit) => audit.errors)).toEqual(playerRuns.map(() => []));
    expect(playerRuns.every((audit) => audit.retired)).toBe(true);
    expect(managerRuns.map((audit) => audit.errors)).toEqual(managerRuns.map(() => []));
    expect(managerRuns.every((audit) => audit.seasonsCompleted === 25)).toBe(true);
    expect(managerRuns.every((audit) => audit.endingAge === 60)).toBe(true);
    expect(managerRuns.every((audit) => audit.retired)).toBe(true);
  },
);

monetizationCareerAuditTest(
  'compares current Player IAP tiers across Batter, Bowler and All-Rounder careers',
  () => {
    const roleSeeds: readonly { role: Role; seed: number }[] = [
      { role: 'BATTER', seed: 81_001 },
      { role: 'BOWLER', seed: 82_002 },
      { role: 'ALLROUNDER', seed: 83_003 },
    ];
    const tiers: MonetizationTierResult[] = MONETIZATION_PROFILES.map((profile) => ({
      profile,
      roles: roleSeeds.map(({ role, seed }) => monetizationRoleResult(profile, role, seed)),
    }));
    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        difficulty: 'NORMAL',
        playerStartAge: 16,
        playerRetirementPolicy: 'OPTIONAL_33_RECOMMENDED_35_TO_38_MAXIMUM_40',
        matchMode: 'INSTANT_SIM',
        trainingBehavior:
          'BUY_EVERY_AFFORDABLE_SESSION_AND_SPEND_NOTHING_ON_OPTIONAL_OFF_FIELD_SYSTEMS',
        priceBasis: 'CURRENT_REFERENCE_INR_CATALOG',
        note: 'The whale tier is a fixed comparison basket, not a new runtime product or price.',
      },
      tiers,
      status: tiers.every((tier) =>
        tier.roles.every((result) => result.audit.errors.length === 0 && result.audit.retired),
      )
        ? 'PASS'
        : 'FAIL',
    };

    fs.mkdirSync(path.dirname(MONETIZATION_REPORT_PATH), { recursive: true });
    fs.writeFileSync(MONETIZATION_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    for (const tier of tiers) {
      console.log(`\n${tier.profile.id} — INR ${tier.profile.referenceSpendInr}`);
      for (const result of tier.roles) {
        const stats = result.audit.careerStats;
        console.log(
          `${result.role}: OVR ${result.audit.endingOverall} · age 80/90/95 ${result.ageAtOverall['80'] ?? '-'} / ${result.ageAtOverall['90'] ?? '-'} / ${result.ageAtOverall['95'] ?? '-'} · ` +
            `training ${result.audit.training?.sessions ?? 0} (${result.audit.training?.acceleratedSessions ?? 0} accelerated) · ` +
            `wallet ${result.audit.endingWallet.toLocaleString()} · ${stats?.runs.toLocaleString() ?? 0} runs / ${stats?.wickets.toLocaleString() ?? 0} wickets`,
        );
      }
    }
    console.log(`\nReport: ${MONETIZATION_REPORT_PATH}`);

    expect(report.status).toBe('PASS');
  },
);

afterAll(() => {
  resetStore();
});
