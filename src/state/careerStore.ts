import { create } from 'zustand';
import { ECONOMY } from '../data/gameConfig';
import { seniorProfessionalFeaturesUnlocked } from '../game/readiness';
import {
  DailyChallenge,
  Facilities,
  GameMode,
  MatchImpactSummary,
  MatchState,
  ManagerResourceAction,
  SaveGame,
  StaffRole,
  Tactics,
  Wallet,
} from '../domain/types';
import { LiveMatch } from '../engine/liveMatch';
import { makeRng } from '../engine/rng';
import {
  accrueNationalRep,
  applyCareerMatchReadiness,
  checkAgeRetirement,
  closeInternationalCapSeason,
  checkPathPromotion,
  collectAcademyRevenue,
  ContractDemand,
  contractOffer,
  ContractOffer,
  declareInternationalCountry as declareInternationalCountryPure,
  ensureCareerPathLevel,
  ensureUserContract,
  fundPersonalAcademy,
  holdOut,
  investInStocks,
  isCareerToManagerEligible,
  maybeNationalCaptaincy,
  negotiateContract,
  NegotiationResult,
  prepareCareerFormat,
  PromotionResult,
  recordPathPerformance,
  recoverCareerOffSeason,
  selectCareerXI,
  setCareerRestRequest,
  signUserContract,
  tickCareerPathMatch,
  tickStockMarket,
  tickUserContract,
  userContractExpiring,
  withdrawStocks,
} from '../game/career';
import {
  addCoins,
  addGems,
  fixtureEnergyCost,
  matchEnergyCost,
  matchReward,
  refillEnergyWithGems,
  regenEnergy,
  spendEnergy,
  vipCoinMultiplier,
} from '../game/economy';
import { LEGACY_TIERS } from '../data/legacy';
import {
  addPassXp,
  applyQuestEvent,
  claimablePassRewards,
  claimQuest as claimQuestPure,
  crateContents,
  evaluateDailyClaim,
  initQuestProgress,
  isQuestComplete,
  PASS_ITEM_LABELS,
  PASS_TIERS,
  pickDailyQuests,
  QuestDef,
  QuestMetric,
  streakReward,
  weeklyQuestsForMode,
  XP_PER_MATCH,
  XP_PER_QUEST,
  XP_PER_WEEKLY_QUEST,
  XP_PER_WIN,
} from '../game/liveops';
import {
  boardTargetFor,
  computeValue,
  ReleaseOutcome,
  releasePlayer as releaseFromSquad,
  signFreeAgent,
  SignOutcome,
  WAGE_RATE,
} from '../game/finance';
import {
  applyTraining,
  canTrainGroup,
  canTrain,
  matchImpactScore,
  matchObjective,
  matchRating,
  objectiveMet,
  sessionsDone,
  TrainGain,
  TrainGroup,
  trainingCost,
  updateFormAfterMatch,
  updateTeamMorale,
  userPerformance,
} from '../game/progression';
import { addTimeline, ensureCareerDepth } from '../game/narrative';
import {
  archiveNewspaperStory,
  buildNewspaperStory,
  buildTrophyNewspaperStory,
  markNewspaperSeen,
} from '../game/newspaper';
import { ensureRival, settleRivalrySeason } from '../game/rivalry';
import {
  acceptAuctionOffer as applyAcceptOffer,
  declineAuction as applyDeclineAuction,
  generateAuctionOffers,
} from '../game/auction';
import {
  canRetire,
  careerEpitaph,
  ChoiceResult,
  maybeQueueMatchStory,
  nextPendingEvent,
  paySponsorsForMatch,
  pendingEventCount,
  queueStoryForTrigger,
  RenderedEvent,
  resolveStoryChoice,
  rolloverSponsors,
  storyRng,
} from '../game/careerEvents';
import {
  ensureManagerDepth,
  facilityMaintenance,
  FacilityOutcome,
  FreeAgentContractOutcome,
  gateReceipts,
  hireStaff as hireStaffPure,
  investInStaff,
  LoanOutcome,
  MAX_FACILITY,
  loanPlayer as loanPlayerPure,
  medicalBonus,
  offerFreeAgentContract as offerFreeAgentContractPure,
  promoteProspect,
  PromoteOutcome,
  recallLoan as recallLoanPure,
  releaseProspect,
  renewContract,
  RenewOutcome,
  ScoutOutcome,
  scoutPlayer,
  settleManagerSeason,
  setTrainingFocus,
  staffWageBill,
  StaffOutcome,
  upgradeFacility,
} from '../game/manager';
import { executeManagerResourceAction, ManagerResourceOutcome } from '../game/managerResources';
import { transferWindowClosedReason } from '../game/transferMarket';
import { applyManagerLevelPromotion, checkManagerLevelPromotion } from '../game/managerCareer';
import { acceptManagerJob, declineManagerJob, generateManagerJobOffer } from '../game/managerJobs';
import {
  advanceCup,
  cupChampionId,
  CUP_NAME,
  ensureCup,
  finishCup,
  nextUserCupTie,
} from '../game/cup';
import {
  applyTeamTalk,
  PlayerTalkKind,
  TalkResult,
  TeamTalkTone,
  talkToPlayer as talkToPlayerPure,
} from '../game/teamTalk';
import {
  managerEventCount,
  MgrChoiceResult,
  nextManagerEvent,
  queueManagerEvent,
  RenderedMgrEvent,
  resolveManagerChoice,
} from '../game/managerEvents';
import { rollMatchInjury, tickInjuries, workloadFactor } from '../game/injuries';
import {
  advanceManagerCalendarPhase,
  applyResult,
  catchUpLeague,
  createDailyChallengeMatch,
  createLiveMatch,
  ensureCompetitionFixtures,
  finishSeason,
  nextUserFixtureId,
  playUserFixture,
  seasonComplete,
  simulateUnplayedBefore,
  stagePlayoffsForUser,
  startNewSeason,
  validateSeasonState,
} from '../game/season';
import {
  generateInternationalWindowFixtures,
  isInternationalFixture,
  nextInternationalFixtureId,
} from '../game/intlCalendar';
import {
  PlayerCalendarChoice,
  playerCalendarAllowsFixture,
  resolvePlayerCalendarEvent,
} from '../game/playerCalendar';
import { requestPlayerCountryMove } from '../game/playerMigration';
import { AdvanceManagerCalendarResult, managerControlledTeamId } from '../game/managerCalendar';
import { updateRecords } from '../game/records';
import { applyMatchToStats } from '../game/stats';
import { generateYouthFixtures } from '../game/youthFixtures';
import {
  achievementGemReward,
  checkCareerStateAchievements,
  checkMatchAchievements,
  checkStreakAchievements,
  getAchievement,
} from '../game/achievements';
import { InteractionManager } from 'react-native';
import {
  accountPurchases,
  analytics,
  notifications,
  purchaseLedger,
  purchases,
} from '../services';
import { maybeRequestReview } from '../services/storeReview';
import { setLastPlayed, writeSave } from '../storage/saveGames';
import { synchronizeSchema14State } from '../storage/schema14';
import { synchronizeSchema15State } from '../storage/schema15';
import { synchronizeSchema16State } from '../storage/schema16';
import { synchronizeSchema17State } from '../storage/schema17';
import { synchronizeSchema18State } from '../storage/schema18';
import { synchronizeSchema19State } from '../storage/schema19';
import { synchronizeSchema20State } from '../storage/schema20';
import { synchronizeSchema21State } from '../storage/schema21';
import {
  buildMatchImpactSummary,
  captureExperienceSnapshot,
  ensureCareerExperience,
} from '../game/careerExperience';
import {
  archetypeInjuryRisk,
  archetypeTrainingMultiplier,
  recordArchetypeMatch,
} from '../game/careerArchetypes';
import { ingestSaveIntoHallOfFame } from '../storage/hallOfFame';
import { useHallOfFame } from './hofStore';
import { useSettings } from './settingsStore';
import { updateSeasonPassBranding } from '../game/domesticBranding';
import { isPassExclusiveCosmetic } from '../data/cosmetics';
import {
  activateSeasonPass,
  activateSeasonPassScenario as activatePassScenario,
  claimMonthlyCosmeticDrop,
  claimSeasonPassScenarioReward as claimPassScenarioReward,
  isSeasonPassActive,
  passTrainingMultiplier,
  recordSeasonPassScenarioMatch,
  synchronizeSeasonPassState,
} from '../game/seasonPass';

interface ActiveRef {
  mode: GameMode;
  slot: number;
}

const purchaseRequestsInFlight = new Set<string>();

export interface RewardBalanceChange {
  previousCoins: number;
  newCoins: number;
  previousGems: number;
  newGems: number;
}

export interface DailyRewardClaim extends RewardBalanceChange {
  ok: boolean;
  coins: number;
  gems: number;
  streak: number;
  items: string[];
}

export interface PassRewardClaim extends RewardBalanceChange {
  coins: number;
  gems: number;
  count: number;
  items: string[];
}

export interface PlayResult {
  match: MatchState;
  fixtureId: string;
  userWon: boolean;
  tie: boolean;
  coinsAwarded: number;
  rating?: number;
  objectiveText?: string;
  objectiveMet?: boolean;
  bonus?: number;
  selected?: boolean; // false when the user was dropped and only watched
  calledUp?: boolean; // a national call-up was earned this match
  international?: boolean; // this was a national-team fixture
  capsAwarded?: number;
  /** A new injury picked up this match (drives the post-match Injury Report). */
  injury?: { playerId: string; playerName: string; matchesOut: number };
  impact?: MatchImpactSummary;
}

export interface TrainOutcome {
  ok: boolean;
  cost: number;
  gains: TrainGain[];
  reason?: string;
}

export interface SquadRecoveryPreview {
  costGems: number;
  tokenCost: number;
  averageConditionBefore: number;
  averageConditionAfter: number;
  affectedPlayers: number;
  injuredPlayers: number;
  cooldownFixtures: number;
  cooldownDays: number;
}

export interface PremiumActionOutcome {
  ok: boolean;
  reason?: string;
}

export interface SquadRecoveryOutcome extends PremiumActionOutcome {
  preview?: SquadRecoveryPreview;
}

const dayIndex = (): number => Math.floor(Date.now() / 86_400_000);
const STANDARD_RECOVERY_GEMS = 79;
const FULL_FITNESS_RECOVERY_GEMS = 149;
const STANDARD_RECOVERY_FITNESS_CAP = 95;
const STANDARD_RECOVERY_FIXTURE_COOLDOWN = 3;
const STANDARD_RECOVERY_DAY_COOLDOWN = 7;
const FULL_FITNESS_RECOVERY_FIXTURE_COOLDOWN = 5;
export const SCOUT_FULL_REVEAL_GEMS = 49;

function inventoryCount(save: SaveGame, key: string): number {
  return Math.max(0, Math.floor(save.inventory?.[key] ?? 0));
}

function setInventoryCount(save: SaveGame, key: string, value: number): void {
  save.inventory = { ...(save.inventory ?? {}), [key]: Math.max(0, Math.floor(value)) };
}

function userFixturePlayCount(save: SaveGame): number {
  if (!save.userTeamId) return 0;
  return Object.values(save.fixtures ?? {}).filter(
    (f) => f.played && (f.homeTeamId === save.userTeamId || f.awayTeamId === save.userTeamId),
  ).length;
}

function recordSaveResult(save: SaveGame, matchId: string, userWon: boolean, tie: boolean): void {
  save.flags = save.flags ?? {};
  const key = `resultCount:${matchId}`;
  if (save.flags[key]) return;
  save.flags[key] = true;
  if (tie) {
    save.careerDraws = (save.careerDraws ?? 0) + 1;
    save.winStreak = 0;
    return;
  }
  if (userWon) {
    save.careerWins = (save.careerWins ?? 0) + 1;
    save.winStreak = (save.winStreak ?? 0) + 1;
  } else {
    save.careerLosses = (save.careerLosses ?? 0) + 1;
    save.winStreak = 0;
  }
}

function recordPremiumAssistance(save: SaveGame, kind: string, transactionId?: string): void {
  save.managerStory = save.managerStory ?? {
    flags: {},
    strings: {},
    seenEventIds: [],
    pendingEventIds: [],
  };
  const key = `premiumAssist:${kind}`;
  save.managerStory.flags[key] = (save.managerStory.flags[key] ?? 0) + 1;
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  save.managerProgression = save.managerProgression ?? {
    reputation: team?.reputation ?? 0,
    currentClubId: save.userTeamId ?? '',
    premiumAssistanceHistory: [],
  };
  save.managerProgression.premiumAssistanceHistory.push({
    id: `${kind}:${transactionId ?? Date.now()}`,
    action: kind,
    createdAt: Date.now(),
    seasonId: save.currentSeasonId,
    transactionId,
  });
}

function applyManagerLegendBacking(save: SaveGame): void {
  const alreadyOwned = inventoryCount(save, 'manager_legend_backing') > 0;
  save.inventory = {
    ...(save.inventory ?? {}),
    manager_legend_backing: 1,
    manager_legend_office_theme: 1,
  };
  if (save.mode !== 'manager' || !save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  save.boardConfidence = Math.max(save.boardConfidence ?? 60, 82);
  if (team && !alreadyOwned) {
    team.reputation = Math.min(95, Math.max(team.reputation, team.reputation + 3));
  }
  save.managerProgression = save.managerProgression ?? {
    reputation: team?.reputation ?? 0,
    currentClubId: save.userTeamId,
    premiumAssistanceHistory: [],
  };
  save.managerProgression.reputation = Math.max(
    save.managerProgression.reputation,
    team?.reputation ?? save.managerProgression.reputation,
  );
  if (!alreadyOwned) {
    recordPremiumAssistance(save, 'manager_legend_backing');
  }
}

function squadRecoveryPreview(save: SaveGame, fullFitness = false): SquadRecoveryPreview | null {
  if (!save.userTeamId) return null;
  const team = save.teams[save.userTeamId];
  const squad = (team?.playerIds ?? []).map((id) => save.players[id]).filter(Boolean);
  if (squad.length === 0) return null;
  const before =
    squad.reduce(
      (sum, p) => sum + Math.max(0, Math.min(100, p.condition ?? p.meta.fitness ?? 70)),
      0,
    ) /
    squad.length;
  let affected = 0;
  let injured = 0;
  const after =
    squad.reduce((sum, p) => {
      const current = Math.max(0, Math.min(100, p.condition ?? p.meta.fitness ?? 70));
      if (p.injury) {
        injured += 1;
        return sum + current;
      }
      affected += 1;
      const next = fullFitness ? 100 : Math.min(STANDARD_RECOVERY_FITNESS_CAP, current + 20);
      return sum + next;
    }, 0) / squad.length;
  return {
    costGems: fullFitness ? FULL_FITNESS_RECOVERY_GEMS : STANDARD_RECOVERY_GEMS,
    tokenCost: fullFitness ? 0 : 1,
    averageConditionBefore: Math.round(before),
    averageConditionAfter: Math.round(after),
    affectedPlayers: affected,
    injuredPlayers: injured,
    cooldownFixtures: fullFitness
      ? FULL_FITNESS_RECOVERY_FIXTURE_COOLDOWN
      : STANDARD_RECOVERY_FIXTURE_COOLDOWN,
    cooldownDays: fullFitness ? 0 : STANDARD_RECOVERY_DAY_COOLDOWN,
  };
}

/** Merge the save's current standing into the durable all-time Hall of Fame. */
function ingestHallOfFame(save: SaveGame): void {
  void ingestSaveIntoHallOfFame(save)
    .then(() => useHallOfFame.getState().load())
    .catch(() => {
      /* Hall of Fame is best-effort — never block gameplay on it. */
    });
}

/** Schedule an "energy full" reminder (no-op without permission/native module). */
function scheduleEnergyNotif(wallet: Wallet): void {
  try {
    if (!useSettings.getState().notifications) return;
    const missing = ECONOMY.energyMax - wallet.energy;
    if (missing <= 0) return;
    void notifications.scheduleEnergyFull(missing * ECONOMY.energyRegenMinutes * 60);
  } catch {
    /* notifications are best-effort */
  }
}

/** Ensure the daily/weekly quest sets + season pass exist and match the current day/week/season. */
function ensureLiveops(save: SaveGame): void {
  const day = dayIndex();
  if (!save.quests || save.quests.day !== day) {
    save.quests = { day, items: initQuestProgress(pickDailyQuests(day, undefined, save.mode)) };
  }
  const week = Math.floor(day / 7);
  if (!save.weeklyQuests || save.weeklyQuests.week !== week) {
    save.weeklyQuests = { week, items: initQuestProgress(weeklyQuestsForMode(save.mode)) };
  }
  synchronizeSeasonPassState(save);
}

function questDefs(save: SaveGame): QuestDef[] {
  return pickDailyQuests(save.quests?.day ?? dayIndex(), undefined, save.mode);
}

function foldMetrics(
  items: { id: string; progress: number; claimed: boolean }[],
  defs: QuestDef[],
  won: boolean,
  runs: number,
  wickets: number,
  boundaries: number,
): { id: string; progress: number; claimed: boolean }[] {
  let next = applyQuestEvent(items, defs, 'PLAY_MATCH', 1);
  if (won) next = applyQuestEvent(next, defs, 'WIN_MATCH', 1);
  if (runs > 0) next = applyQuestEvent(next, defs, 'SCORE_RUNS', runs);
  if (wickets > 0) next = applyQuestEvent(next, defs, 'TAKE_WICKETS', wickets);
  if (boundaries > 0) next = applyQuestEvent(next, defs, 'HIT_BOUNDARIES', boundaries);
  return next;
}

/** Fold a completed match into daily + weekly quest progress + pass XP (mutates save). */
function recordMatchLiveops(
  save: SaveGame,
  won: boolean,
  runs: number,
  wickets: number,
  boundaries: number,
): void {
  ensureLiveops(save);
  save.quests!.items = foldMetrics(
    save.quests!.items,
    questDefs(save),
    won,
    runs,
    wickets,
    boundaries,
  );
  save.weeklyQuests!.items = foldMetrics(
    save.weeklyQuests!.items,
    weeklyQuestsForMode(save.mode),
    won,
    runs,
    wickets,
    boundaries,
  );
  save.pass = addPassXp(save.pass!, XP_PER_MATCH + (won ? XP_PER_WIN : 0));
  recordSeasonPassScenarioMatch(save, { won, runs, wickets });
}

function completeArmedDailyChallenge(
  save: SaveGame,
  challenge: DailyChallenge,
  perf: ReturnType<typeof userPerformance> | null,
): boolean {
  const completed = save.dailyChallengeCompleted ?? {};
  if (completed[challenge.dateKey] || !perf?.batted) return false;
  const success = perf.runs >= challenge.targetRuns && perf.balls <= challenge.targetBalls;
  if (!success) return false;
  completed[challenge.dateKey] = true;
  save.dailyChallengeCompleted = completed;
  save.wallet = addCoins(save.wallet, challenge.rewardCoins);
  if (challenge.rewardGems > 0) save.wallet = addGems(save.wallet, challenge.rewardGems);
  analytics.logEvent(analytics.EVT.QUEST_COMPLETE, { daily_challenge: challenge.dateKey });
  return true;
}

function recordMetricLiveops(save: SaveGame, metric: QuestMetric, amount: number): void {
  ensureLiveops(save);
  save.quests!.items = applyQuestEvent(save.quests!.items, questDefs(save), metric, amount);
  save.weeklyQuests!.items = applyQuestEvent(
    save.weeklyQuests!.items,
    weeklyQuestsForMode(save.mode),
    metric,
    amount,
  );
}

interface CareerState {
  save: SaveGame | null;
  ref: ActiveRef | null;
  /** Transient: a specific fixture to play next (e.g. a cup tie) instead of the league queue. */
  targetFixtureId?: string;
  /** Transient: newly-unlocked achievement ids waiting for a toast. Cleared by UI after display. */
  pendingAchievementIds: string[];

  setActive: (save: SaveGame, mode: GameMode, slot: number) => void;
  playCupTie: () => boolean;
  refreshEnergy: () => void;
  persist: () => Promise<void>;
  scheduleReminders: () => void;
  playNext: () => PlayResult | null;
  beginLiveMatch: () => { fixtureId: string; live: LiveMatch } | null;
  commitLiveMatch: (match: MatchState) => PlayResult | null;
  beginInternational: () => { live: LiveMatch } | null;
  commitInternational: (match: MatchState) => PlayResult | null;
  train: (group: TrainGroup) => Promise<TrainOutcome>;
  setTactics: (tactics: Tactics) => void;
  reorderXI: (playerIds: string[]) => void;
  setXI: (ids: string[]) => void;
  signPlayer: (playerId: string, feeOverride?: number) => SignOutcome;
  releasePlayer: (playerId: string) => ReleaseOutcome;
  /** Remove a free agent from the market (e.g. a rival club signed them). */
  removeFreeAgent: (playerId: string) => void;
  /** Spend gems to instantly clear a player's injury (defaults to the user player). */
  recoverInjuryNow: (playerId?: string, gemCost?: number) => { ok: boolean; reason?: string };
  /** Persist the equipped player cosmetics, spending gems to unlock any new premium picks. */
  saveCosmetics: (
    selection: import('../domain/types').PlayerCosmetics,
    selectionCosts: Record<string, number>,
  ) => { ok: boolean; spent: number; reason?: string };
  // Manager depth
  investStaff: (role: StaffRole) => StaffOutcome;
  hireStaff: (candidateId: string) => StaffOutcome;
  useManagerResource: (action: ManagerResourceAction) => ManagerResourceOutcome;
  upgradeFacilityLevel: (kind: keyof Facilities) => FacilityOutcome;
  scout: (playerId: string) => ScoutOutcome;
  promoteYouth: (playerId: string) => PromoteOutcome;
  releaseYouth: (playerId: string) => PromoteOutcome;
  renewDeal: (playerId: string, years?: number) => RenewOutcome;
  setTrainFocus: (playerId: string, group: 'batting' | 'bowling' | 'fielding' | 'meta') => void;
  giveTeamTalk: (tone: TeamTalkTone) => TalkResult;
  talkToPlayer: (playerId: string, kind: PlayerTalkKind) => TalkResult;
  markFlagSeen: (key: string) => void;
  takeNewJob: (teamId: string) => void;
  simRestOfSeason: () => void;
  advanceSeason: () => void;
  advanceManagerCalendar: (maxFixtures?: number) => AdvanceManagerCalendarResult | null;
  newSeason: () => void;
  acceptAuctionOffer: (teamId: string) => { ok: boolean; reason?: string };
  declineAuction: () => void;
  claimDaily: () => DailyRewardClaim;
  pendingStory: () => RenderedEvent | null;
  storyCount: () => number;
  resolveStory: (eventId: string, choiceId: string) => ChoiceResult;
  retire: () => { epitaph: string } | null;
  contractStatus: () => { expiring: boolean; offer: ContractOffer } | null;
  renewUserContract: () => { ok: boolean; bonus: number };
  pendingPress: () => RenderedMgrEvent | null;
  pressCount: () => number;
  resolvePress: (eventId: string, choiceId: string) => MgrChoiceResult;
  claimQuestReward: (id: string) => { ok: boolean; coins: number; gems: number };
  claimWeeklyReward: (id: string) => { ok: boolean; coins: number; gems: number };
  grantAdReward: (coins: number, transactionId: string) => { ok: boolean; reason?: string };
  grantAdEnergy: (energy: number, transactionId: string) => { ok: boolean; reason?: string };
  claimPass: () => PassRewardClaim;
  claimMonthlyPassDrop: () => {
    ok: boolean;
    item?: string;
    items?: string[];
    rewardItem?: string;
    reason?: string;
  };
  activatePassScenario: (scenarioId: string) => { ok: boolean; reason?: string };
  claimPassScenario: (scenarioId: string) => {
    ok: boolean;
    coins: number;
    gems: number;
    reason?: string;
  };
  savePassPresentation: (input: {
    stadiumTheme?: string;
    officeTheme?: string;
    profileFrame?: string;
  }) => { ok: boolean; reason?: string };
  saveSeasonPassBranding: (input: {
    teamNames: Record<string, string>;
    leagueNames: Record<string, string>;
  }) => { ok: boolean; reason?: string };
  dismissStarterPack: () => void;
  refillEnergy: () => { ok: boolean };
  applySquadRecovery: (
    payment: 'token' | 'gems' | 'full_fitness',
    transactionId?: string,
  ) => SquadRecoveryOutcome;
  useFullScoutReveal: (
    playerId: string,
    payment: 'token' | 'gems',
    transactionId?: string,
  ) => ScoutOutcome;
  purchaseProduct: (productId: string) => Promise<{ ok: boolean; error?: string }>;
  restorePurchases: () => Promise<number>;
  /** Called by UI after achievement toasts are shown. */
  clearPendingAchievements: () => void;
  clear: () => void;
  // Inbox
  addInboxMessage: (msg: import('../domain/types').InboxMessage) => void;
  markInboxRead: (id: string) => void;
  deleteInboxMessage: (id: string) => void;
  clearInbox: () => void;
  // Daily Challenge
  startDailyChallenge: (challenge: import('../domain/types').DailyChallenge) => void;
  claimDailyChallenge: (challenge: import('../domain/types').DailyChallenge) => {
    ok: boolean;
    reason?: string;
  };
  /** Begin a standalone Daily Challenge match honouring its format + pitch. */
  beginDailyChallengeMatch: () => { live: LiveMatch } | null;
  /** Commit a Daily Challenge match: evaluate the target + grant the reward. */
  commitDailyChallengeMatch: (match: MatchState) => PlayResult | null;
  // VIP Energy + streak
  refreshEnergyWithVip: () => void;
  tickVipStreak: () => { days: number; reward: { gems?: number; title?: string } | null };
  // Rival overtake check
  checkRivalOvertake: () => void;
  // Career pathway
  lastPromotion: PromotionResult | null;
  clearPromotion: () => void;
  setCareerRestNext: (rest: boolean) => { ok: boolean; reason?: string };
  markNewspaperSeen: (storyId: string) => void;
  resolvePlayerWeek: (
    choice?: PlayerCalendarChoice,
  ) => { ok: boolean; reason?: string; outcome?: string };
  declareInternationalCountry: (countryId: string) => { ok: boolean; reason?: string };
  requestDomesticCountryMove: (countryId: string) => { ok: boolean; reason?: string };
  // Personal finance
  investStocksAction: (coins: number) => { ok: boolean; reason?: string };
  withdrawStocksAction: () => number;
  contributeLegacy: (tierId: string) => { ok: boolean; reason?: string };
  fundAcademy: (tier: 1 | 2 | 3, name: string) => { ok: boolean; reason?: string };
  // Career-to-manager transition
  transitionToManager: () => boolean;
  // Contract negotiation (career mode)
  negotiateContractDemand: (demand: ContractDemand) => NegotiationResult;
  holdOutForBetter: () => ContractOffer;
  signNegotiatedContract: (offer: ContractOffer) => {
    ok: boolean;
    bonus: number;
    offer?: ContractOffer;
  };
  // Manager headhunt (job offers from bigger clubs)
  acceptManagerJobOffer: () => { ok: boolean; reason?: string };
  declineManagerJobOffer: () => void;
  // Loan system (Feature 1)
  loanPlayer: (playerId: string, seasons?: number) => LoanOutcome;
  recallLoan: (playerId: string) => boolean;
  offerFreeAgentContract: (playerId: string, years?: number) => FreeAgentContractOutcome;
  // Competition picker (Feature 4)
  setTargetFixture: (fixtureId: string | undefined) => void;
  ensureCompetitionFixtures: (competitionId: 'list-a' | 'first-class') => string[];
}

function claimRewardTransaction(save: SaveGame, transactionId: string): boolean {
  const id = transactionId.trim();
  if (!id) return false;
  save.flags = save.flags ?? {};
  const key = `rewardTx:${id}`;
  if (save.flags[key]) return false;
  save.flags[key] = true;
  return true;
}

export const useCareer = create<CareerState>((set, get) => ({
  save: null,
  ref: null,
  pendingAchievementIds: [],
  lastPromotion: null,

  setActive: (save, mode, slot) => {
    validateSeasonState(save);
    save.wallet = regenEnergy(save.wallet);
    synchronizeSchema14State(save, save.updatedAt);
    synchronizeSchema15State(save);
    synchronizeSchema16State(save);
    synchronizeSchema17State(save, Date.now());
    synchronizeSchema18State(save);
    synchronizeSchema19State(save);
    synchronizeSchema20State(save);
    synchronizeSchema21State(save);
    ensureLiveops(save);
    if (mode === 'career') {
      ensureCareerDepth(save);
      ensureCareerPathLevel(save);
      ensureUserContract(save);
      ensureRival(save);
      // Self-heal: a youth-level career (SCHOOL/U19) must always have youth
      // fixtures for the current season, or the matchday would dead-end.
      // generateYouthFixtures is idempotent, so this is a safe no-op otherwise.
      const lvl = save.careerPathLevel;
      if (lvl === 'SCHOOL' || lvl === 'U19') generateYouthFixtures(save);
    } else ensureManagerDepth(save);
    if (!save.managerCalendar) ensureCup(save);
    // First-ever manager press beat (the unveiling).
    if (
      mode === 'manager' &&
      !save.managerStory?.seenEventIds.length &&
      !save.managerStory?.pendingEventIds.length
    ) {
      queueManagerEvent(save, 'PRE_SEASON', storyRng(save, 1));
    }
    set({ save, ref: { mode, slot }, targetFixtureId: undefined });
    const loadedSaveId = save.id;
    void purchases.getEntitlementSnapshot('season_pass').then((snapshot) => {
      const current = get().save;
      if (!current || current.id !== loadedSaveId || snapshot.status === 'UNAVAILABLE') return;
      if (snapshot.status === 'ACTIVE') {
        activateSeasonPass(current, {
          now: snapshot.entitlement.lastVerifiedAt,
          expiresAt: snapshot.entitlement.expiresAt,
          periodStartedAt: snapshot.entitlement.periodStartedAt,
          lastVerifiedAt: snapshot.entitlement.lastVerifiedAt,
          provider: 'REVENUECAT',
          willRenew: snapshot.entitlement.willRenew,
        });
      } else if (
        current.entitlements.seasonPass?.provider === 'REVENUECAT' ||
        current.entitlements.seasonPass?.provider === 'GOOGLE_PLAY'
      ) {
        current.entitlements.seasonPass.premium = false;
        synchronizeSeasonPassState(current);
      }
      set({ save: { ...current } });
      void get().persist();
    });
  },

  pendingPress: () => {
    const save = get().save;
    return save ? nextManagerEvent(save) : null;
  },

  pressCount: () => {
    const save = get().save;
    return save ? managerEventCount(save) : 0;
  },

  resolvePress: (eventId, choiceId) => {
    const save = get().save;
    if (!save) return { ok: false };
    const res = resolveManagerChoice(save, eventId, choiceId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  playCupTie: () => {
    const save = get().save;
    if (!save) return false;
    advanceCup(save);
    const id = nextUserCupTie(save);
    set({ save: { ...save }, targetFixtureId: id });
    return Boolean(id);
  },

  refreshEnergy: () => {
    const save = get().save;
    if (!save) return;
    save.wallet = regenEnergy(save.wallet);
    ensureLiveops(save);
    if (save.mode === 'career') {
      ensureCareerDepth(save);
      // Self-heal youth fixtures so the matchday never dead-ends.
      const lvl = save.careerPathLevel;
      if (lvl === 'SCHOOL' || lvl === 'U19') generateYouthFixtures(save);
    } else ensureManagerDepth(save);
    set({ save: { ...save } });
  },

  persist: async () => {
    const { save, ref } = get();
    if (!save || !ref) return;
    synchronizeSchema14State(save);
    synchronizeSchema15State(save);
    synchronizeSchema18State(save);
    synchronizeSchema20State(save);
    // Defer write until after JS animations complete AND the call stack unwinds.
    // This prevents AsyncStorage writes from competing with the JS thread mid-animation.
    await new Promise<void>((resolve, reject) => {
      InteractionManager.runAfterInteractions(() => {
        // Additional yield via setTimeout so animation callbacks finish first.
        setTimeout(async () => {
          try {
            await writeSave(ref.mode, ref.slot, save);
            await setLastPlayed(ref.mode, ref.slot);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 32); // ~2 frames of headroom
      });
    });
  },

  /** Schedule re-engagement reminders (daily/streak/match-ready/season). Best-effort. */
  scheduleReminders: () => {
    try {
      if (!useSettings.getState().notifications) return;
      void notifications.scheduleDailyReminder();
      void notifications.scheduleStreakRisk();
      const save = get().save;
      if (save) {
        // "Match ready" only when there's a fixture and enough energy to play it.
        const fixtureId = nextUserFixtureId(save);
        const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
        const hasFixture = Boolean(fixture);
        const canAfford =
          save.mode !== 'career' ||
          save.wallet.energy >= (fixture ? fixtureEnergyCost(fixture) : ECONOMY.energyPerMatch);
        if (hasFixture && canAfford) void notifications.scheduleMatchReady();
        // "Event ending" when a battle pass is active with rewards still to earn.
        if (save.pass && save.pass.xp >= 0) void notifications.scheduleSeasonEnding();
      }
    } catch {
      /* notifications are best-effort */
    }
  },

  playNext: () => {
    const save = get().save;
    if (!save) return null;
    const fixtureId = nextUserFixtureId(save);
    if (!fixtureId) return null;
    const fixture = save.fixtures[fixtureId];

    const match = playUserFixture(save, fixtureId);
    const userWon = match.result?.winnerTeamId === save.userTeamId;
    const tie = Boolean(match.result?.tie);
    recordSaveResult(save, match.id, userWon, tie);
    const coinsAwarded = Math.round(
      matchReward(userWon, tie) * vipCoinMultiplier(save.entitlements),
    );

    if (get().ref?.mode === 'career') {
      save.wallet = spendEnergy(
        save.wallet,
        fixture ? fixtureEnergyCost(fixture) : matchEnergyCost(match.format),
      );
    }
    save.wallet = addCoins(save.wallet, coinsAwarded);
    set({ save: { ...save } });
    void get().persist();

    return { match, fixtureId, userWon, tie, coinsAwarded };
  },

  beginLiveMatch: () => {
    const { save, ref } = get();
    if (!save) return null;
    const target = get().targetFixtureId;
    const fixtureId = target ?? nextUserFixtureId(save);
    if (!fixtureId || !save.fixtures[fixtureId]) return null;
    const fx = save.fixtures[fixtureId];
    const isCup = fx?.competition === 'CUP';
    const isYouth = fx?.competitionId?.startsWith('youth-') ?? false;
    const isInternational = isInternationalFixture(fx);
    if (
      ref?.mode === 'career' &&
      !isCup &&
      !playerCalendarAllowsFixture(save, fixtureId)
    ) {
      return null;
    }
    // Only the primary T20 league keeps a chronological table, so only catch up
    // when playing a T20-league fixture. Playing List A / First-Class / Cup /
    // youth / international fixtures must NOT auto-simulate the T20 season.
    const isPrimaryLeague = !fx.competitionId || fx.competitionId === 't20-league';
    if (
      (isPrimaryLeague || fx.managerPhase || ['list-a', 'first-class'].includes(fx.competitionId ?? '')) &&
      !isCup &&
      !isYouth &&
      !isInternational
    ) {
      simulateUnplayedBefore(save, fixtureId);
    }
    let interactiveBatterId: string | undefined;
    if (ref?.mode === 'career' && save.userPlayerId) {
      if (isInternational) {
        interactiveBatterId = save.userPlayerId;
      } else {
        // Merit-based XI: the user only plays interactively if they're selected.
        const selected = selectCareerXI(save, fx.format, fixtureId);
        interactiveBatterId = selected ? save.userPlayerId : undefined;
      }
    }
    const live = createLiveMatch(save, fixtureId, interactiveBatterId);
    set({ save: { ...save }, targetFixtureId: undefined });
    void get().persist();
    analytics.logEvent(analytics.EVT.MATCH_START, {
      format: fx.format,
      competition: fx.competition ?? 'league',
      mode: ref?.mode ?? 'career',
    });
    return { fixtureId, live };
  },

  commitLiveMatch: (match) => {
    const { save, ref } = get();
    if (!save) return null;
    const experienceBefore = captureExperienceSnapshot(save);
    applyResult(save, match);
    useSettings.getState().recordPlayedMatch();
    // If that was a cup tie, progress the knockout bracket.
    if (save.fixtures[match.id]?.competition === 'CUP') advanceCup(save);
    const resultFixture = save.fixtures[match.id];
    const isInternational = isInternationalFixture(resultFixture);
    const resultUserTeamId = isInternational
      ? resultFixture.homeTeamId
      : resultFixture?.managerPhase
        ? managerControlledTeamId(save, resultFixture.managerPhase)
        : save.userTeamId;
    const userWon = match.result?.winnerTeamId === resultUserTeamId;
    const tie = Boolean(match.result?.tie);
    recordSaveResult(save, match.id, userWon, tie);
    let coinsAwarded = matchReward(userWon, tie);

    let rating: number | undefined;
    let objectiveText: string | undefined;
    let metObjective: boolean | undefined;
    let bonus = 0;
    let selected: boolean | undefined;
    let calledUp = false;

    if (ref?.mode === 'career' && save.userPlayerId) {
      const player = save.players[save.userPlayerId];
      const perf = userPerformance(match, save.userPlayerId);
      selected = perf.batted || perf.bowled;
      if (selected) {
        rating = matchRating(perf);
        updateFormAfterMatch(player, perf);
        const objective = matchObjective(player.role);
        objectiveText = objective.text;
        metObjective = objectiveMet(perf, objective);
        if (metObjective) bonus = objective.reward;
        // Call-up + path progression are driven by genuine output (75%) not just rating.
        const output = { runs: perf.runs, wickets: perf.wickets };
        calledUp = accrueNationalRep(save, player, rating, output).calledUp;
        recordPathPerformance(save, output, rating);
        // Performance-scaled match reward: a quiet game earns ~half, a
        // match-winning display up to ~1.6× — your bat and ball earn the coins.
        const impact = matchImpactScore(output, player.role);
        coinsAwarded = Math.round(coinsAwarded * (0.5 + impact * 1.1));
      } else {
        // Left out of the XI — a fraction of the appearance fee only.
        coinsAwarded = Math.round(coinsAwarded * 0.35);
      }
      const fixture = save.fixtures[match.id];
      applyCareerMatchReadiness(save, {
        fixtureId: match.id,
        format: match.format,
        selected,
        rating,
        ballsFaced: perf.balls,
        ballsBowled: perf.ballsBowled,
      });
      if (selected) {
        save.wallet = spendEnergy(
          save.wallet,
          isInternational
            ? matchEnergyCost(match.format, 'INTERNATIONAL')
            : fixture
              ? fixtureEnergyCost(fixture)
              : matchEnergyCost(match.format),
        );
      }
      if (isInternational) {
        save.userCaps = (save.userCaps ?? 0) + 1;
        coinsAwarded *= 2;
        maybeNationalCaptaincy(save);
      }
    }

    // Live-ops: fold the match into daily quests + season-pass XP.
    const perf = save.userPlayerId ? userPerformance(match, save.userPlayerId) : null;
    recordMatchLiveops(
      save,
      userWon,
      perf?.runs ?? 0,
      perf?.wickets ?? 0,
      (perf?.fours ?? 0) + (perf?.sixes ?? 0),
    );
    if (ref?.mode === 'career' && save.activeDailyChallenge) {
      completeArmedDailyChallenge(save, save.activeDailyChallenge, perf);
      save.activeDailyChallenge = undefined;
    }

    // Narrative: surface a story beat + pay endorsements.
    if (ref?.mode === 'career' && save.userPlayerId) {
      const potm = match.result?.playerOfMatchId === save.userPlayerId;
      const r = perf?.runs ?? 0;
      const w = perf?.wickets ?? 0;
      const milestone = potm
        ? 'POTM'
        : r >= 100
          ? 'HUNDRED'
          : w >= 5
            ? 'FIVEFER'
            : r >= 50
              ? 'FIFTY'
              : undefined;
      const rng = storyRng(
        save,
        (save.story?.seenEventIds.length ?? 0) * 131 + (save.timeline?.length ?? 0) + 7,
      );
      if (calledUp) queueStoryForTrigger(save, 'CALLUP', rng);
      maybeQueueMatchStory(
        save,
        {
          rating: rating ?? 0,
          runs: r,
          wickets: w,
          won: userWon,
          selected: selected ?? true,
          milestone,
        },
        rng,
      );
      paySponsorsForMatch(save);
    }

    // Injuries: recover ongoing knocks, then roll for the match participant(s).
    let injuredInfo: PlayResult['injury'];
    tickInjuries(save);
    if (ref?.mode === 'career' && save.userPlayerId && (selected ?? true)) {
      const u = save.players[save.userPlayerId];
      const irng = storyRng(save, (save.timeline?.length ?? 0) * 29 + 555);
      const load = workloadFactor(perf?.ballsBowled ?? 0, perf?.balls ?? 0);
      const inj = rollMatchInjury(u, 0, irng, load * archetypeInjuryRisk(save, u));
      if (inj) {
        u.injury = inj;
        queueStoryForTrigger(save, 'INJURY', irng);
        injuredInfo = {
          playerId: save.userPlayerId,
          playerName: u.name,
          matchesOut: inj.matchesOut,
        };
      }
      recordArchetypeMatch(save, {
        selected: selected ?? true,
        rating: rating ?? 5,
        runs: perf?.runs ?? 0,
        wickets: perf?.wickets ?? 0,
        wasInjured: Boolean(inj),
      });
    } else if (ref?.mode === 'manager' && resultUserTeamId) {
      const team = save.teams[resultUserTeamId];
      const xi = team.xi && team.xi.length ? team.xi : team.playerIds;
      if (xi.length) {
        const irng = storyRng(save, xi.length * 13 + 222);
        const pick = save.players[xi[Math.floor(irng() * xi.length)]];
        if (pick && !pick.isUserPlayer) {
          const inj = rollMatchInjury(pick, medicalBonus(save), irng);
          if (inj) {
            pick.injury = inj;
            injuredInfo = { playerId: pick.id, playerName: pick.name, matchesOut: inj.matchesOut };
          }
        }
      }
      // Update squad morale based on match result (Feature 3).
      if (resultUserTeamId === save.userTeamId) updateTeamMorale(save, userWon);
      // Press conference — a POST_WIN/POST_LOSS beat, or occasional media day.
      const prng = storyRng(save, (save.managerStory?.seenEventIds.length ?? 0) * 53 + 17);
      if (prng() < 0.55) queueManagerEvent(save, userWon ? 'POST_WIN' : 'POST_LOSS', prng);
      else if (prng() < 0.5) queueManagerEvent(save, 'MEDIA', prng);
    }

    // VIP (permanent removeAds) holders earn +20% match coins — applied to the
    // performance-scaled reward so the displayed / ad-doubled amounts all agree.
    coinsAwarded = Math.round(coinsAwarded * vipCoinMultiplier(save.entitlements));
    save.wallet = addCoins(save.wallet, coinsAwarded + bonus);

    // ── Achievement checks ──────────────────────────────────────────────
    let newAchievements: string[] = [];
    if (ref?.mode === 'career' && save.userPlayerId) {
      const perf2 = userPerformance(match, save.userPlayerId);
      const potm2 = match.result?.playerOfMatchId === save.userPlayerId;
      newAchievements = [
        ...checkMatchAchievements(save, {
          userRuns: perf2.runs,
          userWickets: perf2.wickets,
          userFours: perf2.fours,
          userSixes: perf2.sixes,
          userBalls: perf2.balls,
          userBallsBowled: perf2.ballsBowled ?? 0,
          won: userWon,
          potm: potm2,
          userBatted: perf2.batted,
          userBowled: perf2.bowled,
        }),
        ...checkCareerStateAchievements(save),
      ];
    }

    // Achievements are the primary gem faucet — award scarce gems per tier.
    if (newAchievements.length) {
      const gemGain = newAchievements.reduce(
        (sum, id) => sum + achievementGemReward(getAchievement(id)?.tier ?? 'bronze'),
        0,
      );
      if (gemGain > 0) save.wallet = addGems(save.wallet, gemGain);
    }

    // ── Career path promotion check ────────────────────────────────────
    let promotion: PromotionResult = { promoted: false };
    if (ref?.mode === 'career' && save.userPlayerId) {
      if (selected) tickCareerPathMatch(save);
      const avgRating = rating ?? 5.0;
      promotion = checkPathPromotion(save, avgRating);
    }

    // ── Career-to-manager eligibility check ──────────────────────────────
    if (ref?.mode === 'career' && save.userPlayerId && !save.careerToManagerEligible) {
      const user = save.players[save.userPlayerId];
      const cs = user?.careerStats;
      if (cs) {
        save.careerToManagerEligible = isCareerToManagerEligible({
          runs: cs.runs,
          wickets: cs.wickets,
          caps: save.userCaps ?? 0,
          seasons: save.careerSeasons ?? 0,
        });
      }
    }

    analytics.logEvent(analytics.EVT.MATCH_END, { won: userWon, tie, mode: ref?.mode ?? 'career' });
    scheduleEnergyNotif(save.wallet);
    ingestHallOfFame(save);
    if (userWon) void maybeRequestReview(save.careerWins ?? 0);
    const experience = ensureCareerExperience(save);
    if (experience.starterPackUnlockedAt == null) {
      experience.starterPackUnlockedAt = Date.now();
    }
    const impact = buildMatchImpactSummary(save, match, experienceBefore, {
      won: userWon,
      tie,
      selected,
      rating,
    });
    experience.lastMatchImpact = impact;
    if (ref?.mode === 'career' && perf) {
      const newspaper = buildNewspaperStory(
        save,
        match,
        {
          selected: selected ?? false,
          runs: perf.runs,
          balls: perf.balls,
          wickets: perf.wickets,
          calledUp,
        },
        impact,
      );
      if (newspaper) archiveNewspaperStory(save, newspaper);
    }
    set({
      save: { ...save },
      pendingAchievementIds: newAchievements.length ? newAchievements : get().pendingAchievementIds,
      lastPromotion: promotion.promoted ? promotion : null,
    });
    void get().persist();
    return {
      match,
      fixtureId: match.id,
      userWon,
      tie,
      coinsAwarded,
      rating,
      objectiveText,
      objectiveMet: metObjective,
      bonus,
      selected,
      calledUp,
      injury: injuredInfo,
      impact,
    };
  },

  beginInternational: () => {
    const { save } = get();
    if (!save || !save.userPlayerId || !save.capped) return null;
    generateInternationalWindowFixtures(save);
    const fixtureId = nextInternationalFixtureId(save);
    if (!fixtureId || !playerCalendarAllowsFixture(save, fixtureId)) return null;
    const live = createLiveMatch(save, fixtureId, save.userPlayerId);
    return { live };
  },

  commitInternational: (match) => {
    const { save } = get();
    if (!save || !save.userPlayerId) return null;
    const experienceBefore = captureExperienceSnapshot(save);
    const user = save.players[save.userPlayerId];
    const country = save.playerCareerResources?.cappedCountry ?? user.nationality;
    const scheduledFixture = save.fixtures[match.id];
    if (scheduledFixture && !scheduledFixture.played) applyResult(save, match);
    const homeId = scheduledFixture?.homeTeamId ?? `national-${country}`;
    const userWon = match.result?.winnerTeamId === homeId;
    const tie = Boolean(match.result?.tie);
    recordSaveResult(save, match.id, userWon, tie);
    const perf = userPerformance(match, save.userPlayerId);
    const rating = matchRating(perf);
    updateFormAfterMatch(user, perf);
    recordArchetypeMatch(save, {
      selected: true,
      rating,
      runs: perf.runs,
      wickets: perf.wickets,
      wasInjured: false,
    });

    save.userCaps = (save.userCaps ?? 0) + 1;
    if (maybeNationalCaptaincy(save)) {
      const capYear = save.currentSeasonId
        ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
        : 2026;
      addTimeline(save, {
        year: capYear,
        kind: 'CAPTAINCY',
        text: `Named captain of the national side.`,
      });
      user.awards = [...(user.awards ?? []), 'National Captain'];
    }
    // Internationals pay double; VIP holders get a further +20%.
    const coinsAwarded = Math.round(
      matchReward(userWon, tie) * 2 * vipCoinMultiplier(save.entitlements),
    );
    let bonus = 0;
    if (rating >= 7.5) {
      bonus = 250;
      user.awards = [...(user.awards ?? []), `Intl Player of the Match (cap ${save.userCaps})`];
    }
    applyCareerMatchReadiness(save, {
      fixtureId: match.id,
      format: match.format,
      selected: true,
      rating,
      ballsFaced: perf.balls,
      ballsBowled: perf.ballsBowled,
    });
    save.wallet = spendEnergy(save.wallet, matchEnergyCost(match.format, 'INTERNATIONAL'));
    save.wallet = addCoins(save.wallet, coinsAwarded + bonus);
    recordMatchLiveops(save, userWon, perf.runs, perf.wickets, perf.fours + perf.sixes);
    {
      const potm = rating >= 7.5;
      const milestone = potm
        ? 'POTM'
        : perf.runs >= 100
          ? 'HUNDRED'
          : perf.wickets >= 5
            ? 'FIVEFER'
            : perf.runs >= 50
              ? 'FIFTY'
              : undefined;
      const rng = storyRng(save, (save.userCaps ?? 0) * 97 + 3);
      maybeQueueMatchStory(
        save,
        { rating, runs: perf.runs, wickets: perf.wickets, won: userWon, selected: true, milestone },
        rng,
      );
      paySponsorsForMatch(save);
    }
    if (!scheduledFixture) {
      applyMatchToStats(save, match);
      const year = save.currentSeasonId
        ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
        : 2026;
      updateRecords(save, match, year);
    }
    save.nationalRep = Math.min(100, (save.nationalRep ?? 0) + 5);
    scheduleEnergyNotif(save.wallet);
    ingestHallOfFame(save);
    const experience = ensureCareerExperience(save);
    experience.starterPackUnlockedAt ??= Date.now();
    const impact = buildMatchImpactSummary(save, match, experienceBefore, {
      won: userWon,
      tie,
      selected: true,
      rating,
    });
    experience.lastMatchImpact = impact;
    const newspaper = buildNewspaperStory(
      save,
      match,
      {
        selected: true,
        runs: perf.runs,
        balls: perf.balls,
        wickets: perf.wickets,
      },
      impact,
    );
    if (newspaper) archiveNewspaperStory(save, newspaper);
    set({ save: { ...save } });
    void get().persist();
    return {
      match,
      fixtureId: match.id,
      userWon,
      tie,
      coinsAwarded,
      rating,
      bonus,
      selected: true,
      international: true,
      capsAwarded: 1,
      impact,
    };
  },

  train: async (group) => {
    const { save, ref } = get();
    const fail = (reason: string, cost = 0): TrainOutcome => ({
      ok: false,
      cost,
      gains: [],
      reason,
    });
    if (!save || ref?.mode !== 'career' || !save.userPlayerId) return fail('No active career.');
    const player = save.players[save.userPlayerId];
    if (!canTrainGroup(player, group)) return fail('This training is not available for your role.');
    if (!canTrain(player, group)) return fail('No training sessions left for this discipline.');
    const cost = trainingCost(sessionsDone(player, group));
    if (save.wallet.coins < cost) return fail('Not enough coins.', cost);
    const rng = makeRng((Date.now() ^ (sessionsDone(player, group) * 2654435761)) >>> 0);
    const acceleratorCharges = inventoryCount(save, 'training_accelerator');
    const gains = applyTraining(
      player,
      group,
      rng,
      save.careerPathLevel,
      acceleratorCharges > 0
        ? 3
        : archetypeTrainingMultiplier(save, player, group) * passTrainingMultiplier(save),
    );
    if (gains.length === 0) return fail('This training is not available for your role.', cost);
    if (acceleratorCharges > 0) {
      setInventoryCount(save, 'training_accelerator', acceleratorCharges - 1);
    }
    const nextFixtureId = nextUserFixtureId(save);
    const nextFixture = nextFixtureId ? save.fixtures[nextFixtureId] : undefined;
    if (nextFixture) prepareCareerFormat(save, nextFixture.format);
    save.wallet = addCoins(save.wallet, -cost);
    recordMetricLiveops(save, 'TRAIN', 1);
    set({ save: { ...save } });
    try {
      await get().persist();
      return { ok: true, cost, gains };
    } catch {
      return fail('Training was applied but could not be saved. Try saving again.', cost);
    }
  },

  setTactics: (tactics) => {
    const save = get().save;
    if (!save) return;
    save.tactics = tactics;
    set({ save: { ...save } });
    void get().persist();
  },

  reorderXI: (playerIds) => {
    const save = get().save;
    if (!save || !save.userTeamId) return;
    save.teams[save.userTeamId].playerIds = playerIds;
    set({ save: { ...save } });
    void get().persist();
  },

  setXI: (ids) => {
    const save = get().save;
    if (!save || !save.userTeamId) return;
    save.teams[save.userTeamId].xi = ids;
    set({ save: { ...save } });
    void get().persist();
  },

  signPlayer: (playerId, feeOverride) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const closedReason = transferWindowClosedReason(save);
    if (closedReason) return { ok: false, cost: 0, reason: closedReason };
    const res = signFreeAgent(save, playerId, feeOverride);
    if (res.ok) {
      recordMetricLiveops(save, 'SIGN_PLAYER', 1);
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  releasePlayer: (playerId) => {
    const save = get().save;
    if (!save) return { ok: false, recouped: 0, reason: 'No active save.' };
    const res = releaseFromSquad(save, playerId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  removeFreeAgent: (playerId) => {
    const save = get().save;
    if (!save?.freeAgents?.includes(playerId)) return;
    save.freeAgents = save.freeAgents.filter((id) => id !== playerId);
    set({ save: { ...save } });
    void get().persist();
  },

  investStaff: (role) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const res = investInStaff(save, role);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  hireStaff: (candidateId) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const res = hireStaffPure(save, candidateId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  useManagerResource: (action) => {
    const save = get().save;
    if (!save) {
      return {
        ok: false,
        action,
        currency: action === 'MATCH_ANALYSIS' ? 'coins' : 'gems',
        cost: 0,
        reason: 'No active save.',
      };
    }
    const result = executeManagerResourceAction(save, action);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  upgradeFacilityLevel: (kind) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const upgradeTokens = inventoryCount(save, 'facility_upgrade_token');
    if (upgradeTokens > 0) {
      if (!save.userTeamId || !save.facilities) {
        return { ok: false, cost: 0, reason: 'No club.' };
      }
      const level = save.facilities[kind];
      if (level >= MAX_FACILITY) {
        return { ok: false, cost: 0, reason: 'Max level.' };
      }
      save.facilities[kind] = level + 1;
      setInventoryCount(save, 'facility_upgrade_token', upgradeTokens - 1);
      recordPremiumAssistance(save, 'facility_upgrade_token');
      set({ save: { ...save } });
      void get().persist();
      return { ok: true, cost: 0, level: level + 1 };
    }
    const res = upgradeFacility(save, kind);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  scout: (playerId) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const rng = storyRng(save, (save.scoutReports?.length ?? 0) * 37 + playerId.length + 1);
    const res = scoutPlayer(save, playerId, rng);
    if (res.ok) {
      analytics.logEvent(analytics.EVT.SIGN_PLAYER, { scouted: playerId });
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  promoteYouth: (playerId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = promoteProspect(save, playerId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  releaseYouth: (playerId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = releaseProspect(save, playerId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  renewDeal: (playerId, years) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const res = renewContract(save, playerId, years);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  setTrainFocus: (playerId, group) => {
    const save = get().save;
    if (!save) return;
    setTrainingFocus(save, playerId, group);
    set({ save: { ...save } });
    void get().persist();
  },

  giveTeamTalk: (tone) => {
    const save = get().save;
    if (!save) return { ok: false, text: 'No active save.' };
    const fixtureId = nextUserFixtureId(save);
    if (!fixtureId) return { ok: false, text: 'No upcoming match for a team talk.' };
    const flagKey = `teamTalk:${fixtureId}`;
    if (save.flags?.[flagKey])
      return { ok: false, text: 'Team talk already given for this match.' };
    const rng = storyRng(save, (save.timeline?.length ?? 0) * 7 + tone.length + 3);
    const res = applyTeamTalk(save, tone, rng);
    if (res.ok) {
      save.flags = { ...(save.flags ?? {}), [flagKey]: true };
      (save.experience ??= {}).pendingTeamTalk = {
        tone,
        formDelta: res.formDelta ?? 0,
        volatility: res.volatility ?? 0,
        result: res.text,
      };
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  talkToPlayer: (playerId, kind) => {
    const save = get().save;
    if (!save) return { ok: false, text: 'No active save.' };
    const res = talkToPlayerPure(save, playerId, kind);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  /** Persist a one-time boolean flag (e.g. an unlock/onboarding acknowledgement). */
  markFlagSeen: (key) => {
    const save = get().save;
    if (!save || save.flags?.[key]) return;
    save.flags = { ...(save.flags ?? {}), [key]: true };
    set({ save: { ...save } });
    void get().persist();
  },

  takeNewJob: (teamId) => {
    const save = get().save;
    if (!save || !save.teams[teamId]) return;
    if (save.managerCalendar) {
      const allowed =
        save.userDivision === 1
          ? save.divisions?.tier1
          : save.userDivision === 2
            ? save.divisions?.tier2
            : save.divisions?.tier3;
      if (!allowed?.includes(teamId)) return;
    }
    if (save.userTeamId && save.teams[save.userTeamId])
      save.teams[save.userTeamId].isUserTeam = false;
    save.userTeamId = teamId;
    const team = save.teams[teamId];
    team.isUserTeam = true;
    save.flags.sacked = false;
    const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
    save.boardObjective = { year, targetPosition: boardTargetFor(team.reputation) };
    set({ save: { ...save } });
    void get().persist();
  },

  simRestOfSeason: () => {
    const save = get().save;
    if (!save) return;
    if (save.managerCalendar) {
      advanceManagerCalendarPhase(save);
      set({ save: { ...save } });
      void get().persist();
      return;
    }
    finishSeason(save);
    finishCup(save);
    set({ save: { ...save } });
    void get().persist();
  },

  advanceSeason: () => {
    const save = get().save;
    if (!save) return;
    if (save.managerCalendar) {
      get().advanceManagerCalendar();
      return;
    }
    // Catch the league up, then progress the knockout bracket. If the user
    // reaches a semi/final they'll play it live; otherwise sim the rest so a
    // champion is crowned.
    catchUpLeague(save);
    stagePlayoffsForUser(save);
    if (!nextUserFixtureId(save)) finishSeason(save);
    set({ save: { ...save } });
    void get().persist();
  },

  advanceManagerCalendar: (maxFixtures) => {
    const save = get().save;
    if (!save?.managerCalendar) return null;
    const result = advanceManagerCalendarPhase(save, maxFixtures);
    set({ save: { ...save } });
    if (result.kind !== 'IN_PROGRESS') void get().persist();
    return result;
  },

  newSeason: () => {
    const { save, ref } = get();
    if (!save) return;
    if (!seasonComplete(save)) return;
    const finishedYear = save.currentSeasonId
      ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
      : 2026;
    const finishedLeagueName = Object.values(save.leagues)[0]?.name ?? 'League Championship';
    const trophyCountsBefore = {
      league: save.leagueTitles ?? 0,
      cup: save.cupWins ?? 0,
      continental: save.continentalTitles ?? 0,
    };
    // Settle the Cup: crown a winner and credit a title if it's the user's club.
    finishCup(save);
    if (cupChampionId(save) === save.userTeamId) save.cupWins = (save.cupWins ?? 0) + 1;
    // Career: reflect on the finished season + tick endorsement deals before aging.
    if (ref?.mode === 'career' && save.userPlayerId) {
      tickUserContract(save);
      const rng = storyRng(save, (save.seasonRatings?.length ?? 0) + 41);
      // Settle the rivalry on this season's stats BEFORE they're reset.
      const rivalryLine = settleRivalrySeason(save);
      if (rivalryLine) addTimeline(save, { year: finishedYear, kind: 'STORY', text: rivalryLine });
      queueStoryForTrigger(save, 'SEASON_END', rng);
      rolloverSponsors(save);

      // Personal finance: collect academy revenue + fluctuate stock market.
      collectAcademyRevenue(save);
      const seasonWins = Object.values(save.fixtures).filter(
        (f) => f.played && f.winnerTeamId === save.userTeamId,
      ).length;
      const totalPlayed = Object.values(save.fixtures).filter((f) => f.played).length;
      const winRate = totalPlayed > 0 ? seasonWins / totalPlayed : 0.5;
      tickStockMarket(save, winRate);

      // Age-triggered retirement uses appearances earned during this season,
      // not the player's cumulative career total.
      const capsThisSeason = closeInternationalCapSeason(save);
      const ageRetire = checkAgeRetirement(save, capsThisSeason);
      if (ageRetire) {
        // Queue a retirement-nudge story event.
        queueStoryForTrigger(save, 'SEASON_END', rng, { runs: 0, wickets: 0, won: false });
        // Add a timeline entry.
        addTimeline(save, {
          year: finishedYear,
          kind: 'STORY',
          text: "The selectors haven't called in two seasons. Your final chapter awaits.",
        });
      }

      // Career-to-manager eligibility refresh each season.
      const user = save.players[save.userPlayerId];
      const cs = user?.careerStats;
      if (cs && !save.careerToManagerEligible) {
        save.careerToManagerEligible = isCareerToManagerEligible({
          runs: cs.runs,
          wickets: cs.wickets,
          caps: save.userCaps ?? 0,
          seasons: save.careerSeasons ?? 0,
        });
      }
    }
    // Manager: check if they've earned promotion to the next career level.
    if (ref?.mode === 'manager') {
      const promo = checkManagerLevelPromotion(save);
      if (promo.promoted && promo.to) {
        applyManagerLevelPromotion(save, promo.to);
        // Queue a boardroom story event to announce the new role.
        const prng = storyRng(save, (save.managerStory?.seenEventIds.length ?? 0) + 999);
        queueManagerEvent(save, 'SEASON_END', prng);
      }
    }

    startNewSeason(save); // rebuilds fixtures (wipes last season's cup ties)
    if (ref?.mode === 'career' && save.userPlayerId) {
      const earnedTrophies = [
        (save.leagueTitles ?? 0) > trophyCountsBefore.league ? finishedLeagueName : undefined,
        (save.cupWins ?? 0) > trophyCountsBefore.cup ? CUP_NAME : undefined,
        (save.continentalTitles ?? 0) > trophyCountsBefore.continental
          ? 'Continental Cup'
          : undefined,
      ].filter((name): name is string => Boolean(name));
      const alreadyCovered = new Set(
        (save.experience?.mediaScrapbook ?? [])
          .filter((story) => story.season === finishedYear && story.kind === 'TROPHY')
          .flatMap((story) => story.trophyNames ?? []),
      );
      const missingTrophies = earnedTrophies.filter((name) => !alreadyCovered.has(name));
      const trophyStory = buildTrophyNewspaperStory(save, {
        year: finishedYear,
        trophyNames: missingTrophies,
        sourceId: `season-${finishedYear}`,
      });
      if (trophyStory) archiveNewspaperStory(save, trophyStory);
    }
    // Career: pick a fresh rival + take franchise bids for the new season.
    if (ref?.mode === 'career' && save.userPlayerId) {
      recoverCareerOffSeason(save);
      ensureRival(save);
      const arng = storyRng(save, (save.timeline?.length ?? 0) + 97);
      const offers = generateAuctionOffers(save, arng);
      save.auctionOffers = offers.length ? offers : undefined;
    }
    // Manager: staff wages + upkeep + gate receipts, youth intake, contract expiries.
    if (ref?.mode === 'manager' && save.userTeamId) {
      const rng = storyRng(save, (save.currentSeasonId?.length ?? 0) + 71);
      const team = save.teams[save.userTeamId];
      const gate = gateReceipts(team.reputation) * 7;
      const staffWages = staffWageBill(save);
      const upkeep = facilityMaintenance(save);
      settleManagerSeason(save, rng);
      if (save.lastSeasonSettlement) {
        save.lastSeasonSettlement.gateReceipts = gate;
        save.lastSeasonSettlement.staffWages = staffWages;
        save.lastSeasonSettlement.facilityUpkeep = upkeep;
        save.lastSeasonSettlement.newBudget = team.budget;
      }
      queueManagerEvent(save, 'SEASON_END', rng); // boardroom review
      // A strong season can attract a headhunt from a bigger, richer club.
      const jobRng = storyRng(save, (save.managerCareerSeasons ?? 0) * 47 + 233);
      generateManagerJobOffer(save, jobRng);
    }
    if (!save.managerCalendar) ensureCup(save); // manager calendar has its own format playoffs
    ingestHallOfFame(save);
    set({ save: { ...save } });
    void get().persist();
  },

  acceptAuctionOffer: (teamId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No save.' };
    const res = applyAcceptOffer(save, teamId);
    if (res.ok) {
      analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { auctionMove: true });
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  declineAuction: () => {
    const save = get().save;
    if (!save) return;
    applyDeclineAuction(save);
    set({ save: { ...save } });
    void get().persist();
  },

  pendingStory: () => {
    const save = get().save;
    return save ? nextPendingEvent(save) : null;
  },

  storyCount: () => {
    const save = get().save;
    return save ? pendingEventCount(save) : 0;
  },

  resolveStory: (eventId, choiceId) => {
    const save = get().save;
    if (!save) return { ok: false };
    const rng = storyRng(save, (save.story?.seenEventIds.length ?? 0) * 17 + choiceId.length + 1);
    const res = resolveStoryChoice(save, eventId, choiceId, rng);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  retire: () => {
    const { save, ref } = get();
    if (!save || ref?.mode !== 'career' || !save.userPlayerId) return null;
    const user = save.players[save.userPlayerId];
    if (!user || !canRetire(user)) return null;
    user.retired = true;
    save.flags.retired = true;
    const epitaph = careerEpitaph(save);
    const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
    addTimeline(save, {
      year,
      kind: 'RETIREMENT',
      text: `Called time on a storied career — ${epitaph}.`,
    });
    analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { retired: true });
    ingestHallOfFame(save);
    set({ save: { ...save } });
    void get().persist();
    return { epitaph };
  },

  contractStatus: () => {
    const save = get().save;
    if (!save || save.mode !== 'career' || !save.userPlayerId) return null;
    if (!seniorProfessionalFeaturesUnlocked(save)) return null;
    return { expiring: userContractExpiring(save), offer: contractOffer(save) };
  },

  renewUserContract: () => {
    const { save, ref } = get();
    if (!save || ref?.mode !== 'career' || !save.userPlayerId) return { ok: false, bonus: 0 };
    if (!seniorProfessionalFeaturesUnlocked(save)) return { ok: false, bonus: 0 };
    const baseOffer = contractOffer(save);
    const boostTokens = inventoryCount(save, 'contract_boost_token');
    const offer =
      boostTokens > 0
        ? {
            ...baseOffer,
            wage: Math.round(baseOffer.wage * 1.25),
            signingBonus: Math.round(baseOffer.signingBonus * 1.25),
          }
        : baseOffer;
    const bonus = signUserContract(save, offer);
    if (boostTokens > 0) setInventoryCount(save, 'contract_boost_token', boostTokens - 1);
    if (bonus > 0) save.wallet = addCoins(save.wallet, bonus);
    const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
    addTimeline(save, {
      year,
      kind: 'TRANSFER',
      text: `Signed a new ${offer.years}-year contract.`,
    });
    analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { contractRenewed: true });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, bonus };
  },

  claimDaily: () => {
    const save = get().save;
    if (!save) {
      return {
        ok: false,
        coins: 0,
        gems: 0,
        streak: 0,
        previousCoins: 0,
        newCoins: 0,
        previousGems: 0,
        newGems: 0,
        items: [],
      };
    }
    const previousCoins = save.wallet.coins;
    const previousGems = save.wallet.gems;
    const day = dayIndex();
    const prev =
      save.lastDailyClaim != null
        ? { lastClaimDay: save.lastDailyClaim, streak: save.dailyStreak ?? 0 }
        : undefined;
    const { canClaim, newStreak } = evaluateDailyClaim(prev, day);
    if (!canClaim) {
      return {
        ok: false,
        coins: 0,
        gems: 0,
        streak: save.dailyStreak ?? 0,
        previousCoins,
        newCoins: previousCoins,
        previousGems,
        newGems: previousGems,
        items: [],
      };
    }
    const reward = streakReward(newStreak);
    save.lastDailyClaim = day;
    save.dailyStreak = newStreak;
    save.wallet = addCoins(save.wallet, reward.coins);
    if (reward.gems > 0) save.wallet = addGems(save.wallet, reward.gems);
    analytics.logEvent(analytics.EVT.DAILY_CLAIM, { streak: newStreak });
    const streakAchievements = checkStreakAchievements(save, newStreak);
    let streakGems = 0;
    if (streakAchievements.length) {
      streakGems = streakAchievements.reduce(
        (sum, id) => sum + achievementGemReward(getAchievement(id)?.tier ?? 'bronze'),
        0,
      );
      if (streakGems > 0) save.wallet = addGems(save.wallet, streakGems);
    }
    set({
      save: { ...save },
      ...(streakAchievements.length ? { pendingAchievementIds: streakAchievements } : {}),
    });
    void get().persist();
    const gems = reward.gems + streakGems;
    const items = [`Coins x ${reward.coins}`];
    if (gems > 0) items.push(`Gems x ${gems}`);
    return {
      ok: true,
      coins: reward.coins,
      gems,
      streak: newStreak,
      previousCoins,
      newCoins: save.wallet.coins,
      previousGems,
      newGems: save.wallet.gems,
      items,
    };
  },

  claimQuestReward: (id) => {
    const save = get().save;
    if (!save) return { ok: false, coins: 0, gems: 0 };
    ensureLiveops(save);
    const defs = questDefs(save);
    const def = defs.find((d) => d.id === id);
    const prog = save.quests!.items.find((p) => p.id === id);
    if (!def || !prog || prog.claimed || !isQuestComplete(prog, def))
      return { ok: false, coins: 0, gems: 0 };
    save.quests!.items = claimQuestPure(save.quests!.items, defs, id);
    save.wallet = addCoins(save.wallet, def.rewardCoins);
    if (def.rewardGems) save.wallet = addGems(save.wallet, def.rewardGems);
    save.pass = addPassXp(save.pass!, XP_PER_QUEST);
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, coins: def.rewardCoins, gems: def.rewardGems ?? 0 };
  },

  claimWeeklyReward: (id) => {
    const save = get().save;
    if (!save) return { ok: false, coins: 0, gems: 0 };
    ensureLiveops(save);
    const weeklyDefs = weeklyQuestsForMode(save.mode);
    const def = weeklyDefs.find((d) => d.id === id);
    const prog = save.weeklyQuests!.items.find((p) => p.id === id);
    if (!def || !prog || prog.claimed || !isQuestComplete(prog, def))
      return { ok: false, coins: 0, gems: 0 };
    save.weeklyQuests!.items = claimQuestPure(save.weeklyQuests!.items, weeklyDefs, id);
    save.wallet = addCoins(save.wallet, def.rewardCoins);
    if (def.rewardGems) save.wallet = addGems(save.wallet, def.rewardGems);
    save.pass = addPassXp(save.pass!, XP_PER_WEEKLY_QUEST);
    analytics.logEvent(analytics.EVT.QUEST_COMPLETE, { id, weekly: true });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, coins: def.rewardCoins, gems: def.rewardGems ?? 0 };
  },

  grantAdReward: (coins, transactionId) => {
    const save = get().save;
    if (!save || coins <= 0) return { ok: false, reason: 'Invalid ad reward.' };
    if (!claimRewardTransaction(save, transactionId)) {
      return { ok: false, reason: 'Ad reward transaction already applied.' };
    }
    save.wallet = addCoins(save.wallet, coins);
    analytics.logEvent(analytics.EVT.AD_WATCHED, { coins });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  grantAdEnergy: (energy, transactionId) => {
    const save = get().save;
    if (!save || energy <= 0) return { ok: false, reason: 'Invalid ad energy reward.' };
    if (!claimRewardTransaction(save, transactionId)) {
      return { ok: false, reason: 'Ad energy transaction already applied.' };
    }
    save.wallet = {
      ...save.wallet,
      energy: Math.min(ECONOMY.energyMax, save.wallet.energy + energy),
      energyUpdatedAt: Date.now(),
    };
    analytics.logEvent(analytics.EVT.AD_WATCHED, { energy });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  claimPass: () => {
    const save = get().save;
    if (!save) {
      return {
        coins: 0,
        gems: 0,
        count: 0,
        previousCoins: 0,
        newCoins: 0,
        previousGems: 0,
        newGems: 0,
        items: [],
      };
    }
    ensureLiveops(save);
    const previousCoins = save.wallet.coins;
    const previousGems = save.wallet.gems;
    const claimable = claimablePassRewards(save.pass!);
    let coins = 0;
    let gems = 0;
    const items: string[] = [];
    for (const c of claimable) {
      const tier = PASS_TIERS.find((t) => t.tier === c.tier);
      if (!tier) continue;
      const reward = c.premium ? tier.premiumReward : tier.freeReward;
      coins += reward.coins ?? 0;
      gems += reward.gems ?? 0;
      const track = c.premium ? 'Premium' : 'Free';
      const rewardParts: string[] = [];
      if (reward.coins) rewardParts.push(`Coins x ${reward.coins}`);
      if (reward.gems) rewardParts.push(`Gems x ${reward.gems}`);
      // Legacy crates still open immediately. New pass cosmetics are durable
      // inventory items that can be equipped in the Premium Clubhouse.
      if (reward.item) {
        if (reward.item.startsWith('crate_')) {
          const loot = crateContents(reward.item);
          coins += loot.coins;
          gems += loot.gems;
          rewardParts.push(`Coins x ${loot.coins}`);
          if (loot.gems) rewardParts.push(`Gems x ${loot.gems}`);
        }
        rewardParts.push(PASS_ITEM_LABELS[reward.item] ?? reward.item);
        save.inventory = {
          ...(save.inventory ?? {}),
          [reward.item]: Math.max(1, save.inventory?.[reward.item] ?? 0),
        };
      }
      if (rewardParts.length) items.push(`Tier ${c.tier} ${track}: ${rewardParts.join(', ')}`);
      if (c.premium) save.pass!.claimedPremium = [...save.pass!.claimedPremium, c.tier];
      else save.pass!.claimedFree = [...save.pass!.claimedFree, c.tier];
    }
    if (coins > 0) save.wallet = addCoins(save.wallet, coins);
    if (gems > 0) save.wallet = addGems(save.wallet, gems);
    set({ save: { ...save } });
    void get().persist();
    return {
      coins,
      gems,
      count: claimable.length,
      previousCoins,
      newCoins: save.wallet.coins,
      previousGems,
      newGems: save.wallet.gems,
      items,
    };
  },

  claimMonthlyPassDrop: () => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const result = claimMonthlyCosmeticDrop(save);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  activatePassScenario: (scenarioId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const result = activatePassScenario(save, scenarioId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  claimPassScenario: (scenarioId) => {
    const save = get().save;
    if (!save) return { ok: false, coins: 0, gems: 0, reason: 'No active save.' };
    const result = claimPassScenarioReward(save, scenarioId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  savePassPresentation: (input) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    synchronizeSeasonPassState(save);
    const experience = save.seasonPassExperience!;
    const owns = (id: string) =>
      id.endsWith('_classic') || id === 'frame_none' || (save.inventory?.[id] ?? 0) > 0;
    if (input.stadiumTheme && !owns(input.stadiumTheme.replace('stadium_', 'pass_stadium_'))) {
      return { ok: false, reason: 'Claim this stadium theme first.' };
    }
    if (input.officeTheme && !owns(input.officeTheme.replace('office_', 'pass_office_'))) {
      return { ok: false, reason: 'Claim this office theme first.' };
    }
    if (input.profileFrame && !owns(input.profileFrame.replace('frame_', 'pass_frame_'))) {
      return { ok: false, reason: 'Claim this profile frame first.' };
    }
    if (input.stadiumTheme) experience.selectedStadiumTheme = input.stadiumTheme;
    if (input.officeTheme) experience.selectedOfficeTheme = input.officeTheme;
    if (input.profileFrame) experience.selectedProfileFrame = input.profileFrame;
    save.cosmetics = {
      ...(save.cosmetics ?? { avatar: 'avatar_custom', kit: 'kit_white', celebration: 'cel_wave' }),
      stadiumTheme: experience.selectedStadiumTheme,
      officeTheme: experience.selectedOfficeTheme,
      profileFrame: experience.selectedProfileFrame,
    };
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  saveSeasonPassBranding: (input) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const result = updateSeasonPassBranding(save, input);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  dismissStarterPack: () => {
    const save = get().save;
    if (!save) return;
    save.experience ??= {};
    save.experience.starterPackDismissedAt ??= Date.now();
    set({ save: { ...save } });
    void get().persist();
  },

  refillEnergy: () => {
    const save = get().save;
    if (!save) return { ok: false };
    const next = refillEnergyWithGems(save.wallet);
    if (!next) return { ok: false };
    save.wallet = next;
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  applySquadRecovery: (payment, transactionId) => {
    const save = get().save;
    if (!save || !save.userTeamId) return { ok: false, reason: 'No active manager squad.' };
    const fullFitness = payment === 'full_fitness';
    const preview = squadRecoveryPreview(save, fullFitness);
    if (!preview) return { ok: false, reason: 'No squad available.' };
    const txId = transactionId ?? `squad-recovery:${payment}:${save.id}:${Date.now()}`;
    const txFlag = `premiumTx:${txId}`;
    if (save.flags?.[txFlag])
      return { ok: false, reason: 'Recovery transaction already applied.', preview };

    const played = userFixturePlayCount(save);
    const now = Date.now();
    const nextFixture = inventoryCount(save, 'squad_recovery_next_fixture');
    const nextAt = inventoryCount(save, 'squad_recovery_next_at');
    const onCooldown = nextFixture > 0 && played < nextFixture && nextAt > 0 && now < nextAt;
    if (!fullFitness && onCooldown)
      return { ok: false, reason: 'Squad recovery is still cooling down.', preview };
    const nextFullFitnessFixture = inventoryCount(save, 'full_fitness_recovery_next_fixture');
    if (fullFitness && nextFullFitnessFixture > 0 && played < nextFullFitnessFixture) {
      return { ok: false, reason: 'Full Fitness Recovery is still cooling down.', preview };
    }

    if (fullFitness) {
      if (save.wallet.gems < FULL_FITNESS_RECOVERY_GEMS)
        return { ok: false, reason: 'Not enough gems.', preview };
      save.wallet = addGems(save.wallet, -FULL_FITNESS_RECOVERY_GEMS);
    } else if (payment === 'token') {
      const tokens = inventoryCount(save, 'squad_recovery_token');
      if (tokens <= 0) return { ok: false, reason: 'No Squad Recovery token available.', preview };
      setInventoryCount(save, 'squad_recovery_token', tokens - 1);
    } else {
      if (save.wallet.gems < STANDARD_RECOVERY_GEMS)
        return { ok: false, reason: 'Not enough gems.', preview };
      save.wallet = addGems(save.wallet, -STANDARD_RECOVERY_GEMS);
    }

    const team = save.teams[save.userTeamId];
    for (const id of team.playerIds) {
      const p = save.players[id];
      if (!p || p.injury) continue;
      const currentFitness = Math.max(0, Math.min(100, p.meta.fitness ?? 70));
      const currentCondition = Math.max(
        0,
        Math.min(100, p.condition ?? p.meta.fitness ?? 70),
      );
      p.meta.fitness = fullFitness
        ? 100
        : Math.min(100, currentFitness + 20);
      p.condition = fullFitness
        ? 100
        : Math.min(STANDARD_RECOVERY_FITNESS_CAP, currentCondition + 20);
      p.morale = Math.min(100, (p.morale ?? 70) + 15);
    }
    if (fullFitness) {
      setInventoryCount(
        save,
        'full_fitness_recovery_next_fixture',
        played + FULL_FITNESS_RECOVERY_FIXTURE_COOLDOWN,
      );
    } else {
      setInventoryCount(
        save,
        'squad_recovery_next_fixture',
        played + STANDARD_RECOVERY_FIXTURE_COOLDOWN,
      );
      setInventoryCount(
        save,
        'squad_recovery_next_at',
        now + STANDARD_RECOVERY_DAY_COOLDOWN * 86_400_000,
      );
    }
    save.flags = { ...(save.flags ?? {}), [txFlag]: true };
    recordPremiumAssistance(save, fullFitness ? 'full_fitness_recovery' : 'squad_recovery');
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, preview };
  },

  useFullScoutReveal: (playerId, payment, transactionId) => {
    const save = get().save;
    if (!save || !save.userTeamId) return { ok: false, cost: 0, reason: 'No active manager club.' };
    const player = save.players[playerId];
    if (!player) return { ok: false, cost: 0, reason: 'Unknown player.' };
    const txId = transactionId ?? `full-scout:${payment}:${save.id}:${playerId}:${Date.now()}`;
    const txFlag = `premiumTx:${txId}`;
    if (save.flags?.[txFlag])
      return { ok: false, cost: 0, reason: 'Scout reveal already applied.' };

    if (payment === 'token') {
      const tokens = inventoryCount(save, 'scout_full_reveal_token');
      if (tokens <= 0)
        return { ok: false, cost: 0, reason: 'No Full Scout Intelligence token available.' };
      setInventoryCount(save, 'scout_full_reveal_token', tokens - 1);
    } else {
      if (save.wallet.gems < SCOUT_FULL_REVEAL_GEMS)
        return { ok: false, cost: SCOUT_FULL_REVEAL_GEMS, reason: 'Not enough gems.' };
      save.wallet = addGems(save.wallet, -SCOUT_FULL_REVEAL_GEMS);
    }

    const report = {
      playerId,
      knownOverall: player.overall,
      uncertainty: 0,
      potentialBand:
        player.potential >= 84
          ? 'Generational'
          : player.potential >= 74
            ? 'Star'
            : player.potential >= 64
              ? 'Solid'
              : 'Fringe',
      scoutedYear: save.seasons[save.currentSeasonId ?? '']?.year ?? new Date().getFullYear(),
      recommended: player.potential >= 70,
    };
    save.scoutReports = [
      ...(save.scoutReports ?? []).filter((r) => r.playerId !== playerId),
      report,
    ];
    save.inventory = {
      ...(save.inventory ?? {}),
      [`scoutIntel:${playerId}:form`]: player.meta.form ?? 50,
      [`scoutIntel:${playerId}:fitness`]: player.meta.fitness ?? 70,
      [`scoutIntel:${playerId}:injury`]: player.injury ? 1 : 0,
      [`scoutIntel:${playerId}:expectedWage`]:
        player.contract?.wage ?? Math.round(computeValue(player) * WAGE_RATE),
      [`scoutIntel:${playerId}:valuation`]: computeValue(player),
    };
    save.flags = { ...(save.flags ?? {}), [txFlag]: true };
    recordPremiumAssistance(save, 'full_scout_intelligence');
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, cost: payment === 'gems' ? SCOUT_FULL_REVEAL_GEMS : 0, report };
  },

  recoverInjuryNow: (playerId, gemCost) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const id = playerId ?? save.userPlayerId;
    if (!id) return { ok: false, reason: 'No player selected.' };
    const player = save.players[id];
    if (!player) return { ok: false, reason: 'Player not found.' };
    if (!player.injury) return { ok: false, reason: 'Player is already fit.' };
    const cost = gemCost ?? Math.max(10, Math.min(50, player.injury.matchesOut * 8));
    if (save.wallet.gems < cost) return { ok: false, reason: 'Not enough gems.' };
    save.wallet = addGems(save.wallet, -cost);
    player.injury = undefined;
    player.meta.fitness = Math.max(player.meta.fitness ?? 60, 85);
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  saveCosmetics: (selection, selectionCosts) => {
    const save = get().save;
    if (!save) return { ok: false, spent: 0, reason: 'No active save.' };
    const owned = (id: string) => (save.inventory?.[id] ?? 0) > 0;
    const lockedPassItem = [selection.avatar, selection.kit, selection.celebration].find(
      (id) => isPassExclusiveCosmetic(id) && !owned(id),
    );
    if (lockedPassItem) {
      return { ok: false, spent: 0, reason: 'Claim this Season Pass cosmetic first.' };
    }
    // Only premium picks (cost > 0) that aren't already owned cost gems.
    const toUnlock = [selection.avatar, selection.kit, selection.celebration].filter(
      (id) => (selectionCosts[id] ?? 0) > 0 && !owned(id),
    );
    const spend = toUnlock.reduce((sum, id) => sum + (selectionCosts[id] ?? 0), 0);
    if (spend > save.wallet.gems) return { ok: false, spent: 0, reason: 'Not enough gems.' };
    if (spend > 0) save.wallet = addGems(save.wallet, -spend);
    if (toUnlock.length) {
      const inv = { ...(save.inventory ?? {}) };
      for (const id of toUnlock) inv[id] = (inv[id] ?? 0) + 1;
      save.inventory = inv;
    }
    save.cosmetics = { ...selection };
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, spent: spend };
  },

  purchaseProduct: async (productId) => {
    analytics.logEvent(analytics.EVT.PURCHASE_INITIATED, { productId });
    const currentSave = get().save;
    if (!currentSave) return { ok: false, error: 'no_save' };
    const managerOnlyProducts = new Set([
      'transfer_budget_sm',
      'transfer_budget_lg',
      'scout_full_reveal',
      'facility_upgrade_token',
      'recovery_pack',
      'manager_legend_pack',
    ]);
    const careerOnlyProducts = new Set([
      'contract_boost',
      'form_recovery',
      'training_accelerator',
      'legend_status',
    ]);
    if (managerOnlyProducts.has(productId) && currentSave.mode !== 'manager') {
      return { ok: false, error: 'manager_save_required' };
    }
    if (careerOnlyProducts.has(productId) && currentSave.mode !== 'career') {
      return { ok: false, error: 'player_career_required' };
    }
    if (productId === 'starter_pack') {
      if (await accountPurchases.hasStarterPackPurchase()) {
        return { ok: false, error: 'already_owned' };
      }
      const unlockedAt = currentSave.experience?.starterPackUnlockedAt;
      const expiresAt = (unlockedAt ?? 0) + purchases.STARTER_PACK_OFFER_HOURS * 60 * 60 * 1000;
      if (!unlockedAt) return { ok: false, error: 'complete_first_match' };
      if (Date.now() >= expiresAt || currentSave.firstPurchaseDone) {
        return { ok: false, error: 'offer_expired' };
      }
    }
    if (
      productId === 'training_accelerator' &&
      inventoryCount(currentSave, 'training_accelerator') + 3 >
        purchases.MAX_TRAINING_ACCELERATOR_CHARGES
    ) {
      return { ok: false, error: 'accelerator_cap_reached' };
    }
    if (productId === 'season_pass' && useSettings.getState().playedMatchesAllModes < 2) {
      return { ok: false, error: 'play_two_matches_first' };
    }
    if (productId === 'season_pass' && isSeasonPassActive(currentSave)) {
      return { ok: false, error: 'already_active' };
    }
    if (productId === 'remove_ads' && currentSave.entitlements.removeAds) {
      return { ok: false, error: 'already_owned' };
    }
    if (
      productId === 'manager_legend_pack' &&
      inventoryCount(currentSave, 'manager_legend_backing') > 0
    ) {
      return { ok: false, error: 'already_owned' };
    }
    if (
      productId === 'bundle_legend' &&
      (inventoryCount(currentSave, 'player_legend_bundle_owned') > 0 ||
        (inventoryCount(currentSave, 'avatar_legend_frame') > 0 &&
          inventoryCount(currentSave, 'kit_all_colors') > 0 &&
          currentSave.entitlements.removeAds))
    ) {
      return { ok: false, error: 'already_owned' };
    }
    if (productId === 'contract_boost' && inventoryCount(currentSave, 'contract_boost_token') > 0) {
      return { ok: false, error: 'contract_boost_already_stored' };
    }
    if (productId === 'form_recovery' && currentSave.userPlayerId) {
      const player = currentSave.players[currentSave.userPlayerId];
      if (player && player.meta.form >= 70 && player.meta.confidence >= 65) {
        return { ok: false, error: 'no_recovery_needed' };
      }
    }
    if (
      productId === 'facility_upgrade_token' &&
      currentSave.facilities &&
      Object.values(currentSave.facilities).every((level) => level >= MAX_FACILITY)
    ) {
      return { ok: false, error: 'facilities_maxed' };
    }
    const seasonLimitedBudgetProduct =
      productId === 'transfer_budget_sm' || productId === 'transfer_budget_lg';
    const budgetSeasonFlag = seasonLimitedBudgetProduct
      ? `budgetBoost:${productId}:${currentSave.currentSeasonId ?? 'season'}`
      : null;
    if (budgetSeasonFlag && currentSave.flags?.[budgetSeasonFlag]) {
      return { ok: false, error: 'season_limit_reached' };
    }
    const purchaseRequestKey =
      productId === 'starter_pack' ? 'account:starter_pack' : `${currentSave.id}:${productId}`;
    if (purchaseRequestsInFlight.has(purchaseRequestKey)) {
      return { ok: false, error: 'purchase_in_progress' };
    }
    purchaseRequestsInFlight.add(purchaseRequestKey);
    let res: Awaited<ReturnType<typeof purchases.purchase>>;
    try {
      res = await purchases.purchase(productId);
    } finally {
      purchaseRequestsInFlight.delete(purchaseRequestKey);
    }
    if (!res.ok) return { ok: false, error: res.error };
    if (res.productId !== productId) return { ok: false, error: 'product_mismatch' };
    const save = get().save;
    if (!save) return { ok: false, error: 'no_save' };
    if (!res.purchaseToken?.trim()) return { ok: false, error: 'missing_transaction_id' };
    const ledgerEntry = purchaseLedger.createLedgerEntry({
      result: { ...res, purchaseToken: res.purchaseToken.trim() },
      userId: save.id,
    });
    if (!purchaseLedger.canGrantLedgerEntry(ledgerEntry)) {
      return { ok: false, error: `purchase_${ledgerEntry.purchaseState.toLowerCase()}` };
    }
    const tokenFlag = purchaseLedger.ledgerFlagKey(ledgerEntry.purchaseToken);
    if (save.flags?.[tokenFlag]) {
      try {
        await get().persist();
        if (productId === 'starter_pack') {
          await accountPurchases.markStarterPackPurchased(ledgerEntry.purchaseToken);
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'persistence_failed' };
      }
    }
    const grant = purchases.GRANTS[productId] ?? {};
    save.wallet = purchases.applyGrantToWallet(save.wallet, grant);
    save.flags = { ...(save.flags ?? {}), [tokenFlag]: true };
    save.firstPurchaseDone = true;
    if (grant.entitlement?.removeAds) save.entitlements.removeAds = true;
    if (productId === 'starter_pack') {
      // Deliver the advertised "Remove Ads (7 days)" as a real timed grant.
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      save.entitlements.removeAdsUntil = Math.max(
        save.entitlements.removeAdsUntil ?? 0,
        Date.now() + SEVEN_DAYS_MS,
      );
    }
    if (productId === 'season_pass') {
      if (!res.entitlement) return { ok: false, error: 'season_pass_entitlement_inactive' };
      activateSeasonPass(save, {
        now: res.entitlement.lastVerifiedAt,
        expiresAt: res.entitlement.expiresAt,
        periodStartedAt: res.entitlement.periodStartedAt,
        lastVerifiedAt: res.entitlement.lastVerifiedAt,
        provider: res.verificationState === 'LOCAL_MOCK' ? 'LOCAL_MOCK' : 'REVENUECAT',
        willRenew: res.entitlement.willRenew,
      });
    }
    analytics.logEvent(analytics.EVT.PURCHASE, { productId });
    // Legend Bundle: also grant removeAds + VIP energy cap
    if (productId === 'bundle_legend') {
      save.entitlements.removeAds = true;
      save.vipEnergyBonusActive = true;
      save.inventory = {
        ...(save.inventory ?? {}),
        avatar_legend_frame: 1,
        kit_all_colors: 1,
        player_legend_bundle_owned: 1,
      };
    }

    // ── Manager-specific IAP ──────────────────────────────────────────────
    if (productId === 'transfer_budget_sm' && save.userTeamId) {
      save.teams[save.userTeamId].budget += 500_000;
      if (save.finances) save.finances.transferBudget += 500_000;
      save.flags = { ...(save.flags ?? {}), [budgetSeasonFlag!]: true };
      recordPremiumAssistance(save, 'transfer_budget_sm');
    }
    if (productId === 'transfer_budget_lg' && save.userTeamId) {
      save.teams[save.userTeamId].budget += 2_000_000;
      if (save.finances) save.finances.transferBudget += 2_000_000;
      save.flags = { ...(save.flags ?? {}), [budgetSeasonFlag!]: true };
      recordPremiumAssistance(save, 'transfer_budget_lg');
    }
    if (productId === 'recovery_pack') {
      setInventoryCount(
        save,
        'squad_recovery_token',
        inventoryCount(save, 'squad_recovery_token') + 1,
      );
    }
    if (productId === 'manager_legend_pack') {
      applyManagerLegendBacking(save);
      setInventoryCount(
        save,
        'scout_full_reveal_token',
        inventoryCount(save, 'scout_full_reveal_token') + 2,
      );
      setInventoryCount(
        save,
        'facility_upgrade_token',
        inventoryCount(save, 'facility_upgrade_token') + 1,
      );
      setInventoryCount(
        save,
        'squad_recovery_token',
        inventoryCount(save, 'squad_recovery_token') + 1,
      );
    }
    if (productId === 'scout_full_reveal') {
      setInventoryCount(
        save,
        'scout_full_reveal_token',
        inventoryCount(save, 'scout_full_reveal_token') + 1,
      );
    }
    if (productId === 'facility_upgrade_token') {
      save.inventory = {
        ...(save.inventory ?? {}),
        facility_upgrade_token: (save.inventory?.facility_upgrade_token ?? 0) + 1,
      };
    }

    // ── Career-player specific IAP ────────────────────────────────────────
    if (productId === 'contract_boost' && save.userPlayerId) {
      setInventoryCount(
        save,
        'contract_boost_token',
        inventoryCount(save, 'contract_boost_token') + 1,
      );
    }
    if (productId === 'form_recovery' && save.userPlayerId) {
      const user = save.players[save.userPlayerId];
      if (user) {
        user.meta.form = Math.max(user.meta.form, 70);
        user.meta.confidence = Math.max(user.meta.confidence, 65);
      }
    }
    if (productId === 'training_accelerator' && save.userPlayerId) {
      save.inventory = {
        ...(save.inventory ?? {}),
        training_accelerator: (save.inventory?.training_accelerator ?? 0) + 3,
      };
    }
    if (productId === 'legend_status') {
      // Cosmetic/presentation prestige only. Earned stats,
      // selection, trophies and Hall-of-Fame qualification remain gameplay-derived.
      save.inventory = {
        ...(save.inventory ?? {}),
        avatar_legend_frame: 1,
        legend_edition_owned: 1,
      };
    }

    // First-purchase bonus: DOUBLE the gems on the player's first-ever
    // gem-bearing purchase (this is the store's advertised "2× gems"). Only
    // consumed when a gem bonus is actually granted, so buying a gem-less item
    // first (e.g. Remove Ads) doesn't silently waste the bonus.
    if (
      !save.flags?.['promo:first_gem_pack_bonus'] &&
      (productId === 'gems_small' || productId === 'gems_medium' || productId === 'gems_large')
    ) {
      const bonusGems = grant.gems ?? 0;
      if (bonusGems > 0) {
        save.wallet = addGems(save.wallet, bonusGems); // extra 1× on top of the base grant
        save.flags = { ...(save.flags ?? {}), 'promo:first_gem_pack_bonus': true };
      }
    }
    set({ save: { ...save } });
    try {
      await get().persist();
      if (productId === 'starter_pack') {
        await accountPurchases.markStarterPackPurchased(ledgerEntry.purchaseToken);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'persistence_failed' };
    }
  },

  restorePurchases: async () => {
    const results = await purchases.restore();
    const save = get().save;
    if (!save) return 0;
    let restored = 0;
    for (const r of results) {
      if (!r.ok) continue;
      const grant = purchases.GRANTS[r.productId];
      if (grant?.entitlement?.removeAds && r.productId !== 'bundle_legend') {
        save.entitlements.removeAds = true;
        restored++;
      }
      if (r.productId === 'bundle_legend' && save.mode === 'career') {
        save.entitlements.removeAds = true;
        save.vipEnergyBonusActive = true;
        save.inventory = {
          ...(save.inventory ?? {}),
          avatar_legend_frame: 1,
          kit_all_colors: 1,
          player_legend_bundle_owned: 1,
        };
        restored++;
      }
      if (r.productId === 'manager_legend_pack' && save.mode === 'manager') {
        applyManagerLegendBacking(save);
        restored++;
      }
      if (r.productId === 'season_pass' && r.entitlement) {
        activateSeasonPass(save, {
          now: r.entitlement.lastVerifiedAt,
          expiresAt: r.entitlement.expiresAt,
          periodStartedAt: r.entitlement.periodStartedAt,
          lastVerifiedAt: r.entitlement.lastVerifiedAt,
          provider: 'REVENUECAT',
          willRenew: r.entitlement.willRenew,
        });
        restored++;
      }
    }
    if (restored > 0) {
      set({ save: { ...save } });
      void get().persist();
    }
    return restored;
  },

  clearPendingAchievements: () => set({ pendingAchievementIds: [] }),
  clear: () => set({ save: null, ref: null, pendingAchievementIds: [] }),

  // ── In-game inbox ────────────────────────────────────────────────────────
  addInboxMessage: (msg) => {
    const save = get().save;
    if (!save) return;
    const inbox = save.inbox ?? [];
    // Cap inbox at 50 messages; drop oldest read messages first.
    const pruned =
      inbox.length >= 50
        ? [
            ...inbox.filter((m) => !m.read).slice(0, 25),
            ...inbox.filter((m) => m.read).slice(0, 24),
          ]
        : inbox;
    save.inbox = [msg, ...pruned];
    set({ save: { ...save } });
    void get().persist();
  },

  markInboxRead: (id) => {
    const save = get().save;
    if (!save) return;
    const inbox = (save.inbox ?? []).map((m) => (m.id === id ? { ...m, read: true } : m));
    save.inbox = inbox;
    set({ save: { ...save } });
    void get().persist();
  },

  deleteInboxMessage: (id) => {
    const save = get().save;
    if (!save) return;
    save.inbox = (save.inbox ?? []).filter((m) => m.id !== id);
    set({ save: { ...save } });
    void get().persist();
  },

  clearInbox: () => {
    const save = get().save;
    if (!save) return;
    save.inbox = [];
    set({ save: { ...save } });
    void get().persist();
  },

  // ── Daily Challenge ──────────────────────────────────────────────────────
  startDailyChallenge: (challenge) => {
    const save = get().save;
    if (!save) return;
    if (save.dailyChallengeCompleted?.[challenge.dateKey]) return;
    save.activeDailyChallenge = challenge;
    set({ save: { ...save } });
    void get().persist();
  },

  beginDailyChallengeMatch: () => {
    const { save, ref } = get();
    if (!save || ref?.mode !== 'career' || !save.userPlayerId) return null;
    const challenge = save.activeDailyChallenge;
    if (!challenge) return null;
    const live = createDailyChallengeMatch(save, challenge);
    return live ? { live } : null;
  },

  commitDailyChallengeMatch: (match) => {
    const { save, ref } = get();
    if (!save || ref?.mode !== 'career' || !save.userPlayerId) return null;
    const experienceBefore = captureExperienceSnapshot(save);
    const challenge = save.activeDailyChallenge;
    const userWon = match.result?.winnerTeamId === save.userTeamId;
    const tie = Boolean(match.result?.tie);
    recordSaveResult(save, match.id, userWon, tie);
    const perf = userPerformance(match, save.userPlayerId);
    recordArchetypeMatch(save, {
      selected: perf.batted || perf.bowled,
      rating: matchRating(perf),
      runs: perf.runs,
      wickets: perf.wickets,
      wasInjured: false,
    });
    useSettings.getState().recordPlayedMatch();
    // The challenge reward (coins + gems) is granted inside completeArmedDailyChallenge.
    let coinsAwarded = 0;
    if (challenge) {
      const success = completeArmedDailyChallenge(save, challenge, perf);
      if (success) coinsAwarded = challenge.rewardCoins;
      save.activeDailyChallenge = undefined;
    }
    // Count the innings toward quests + season-pass XP like any other match.
    recordMatchLiveops(save, userWon, perf.runs, perf.wickets, perf.fours + perf.sixes);
    ingestHallOfFame(save);
    const experience = ensureCareerExperience(save);
    experience.starterPackUnlockedAt ??= Date.now();
    const impact = buildMatchImpactSummary(save, match, experienceBefore, {
      won: userWon,
      tie,
      selected: perf.batted || perf.bowled,
      rating: matchRating(perf),
    });
    experience.lastMatchImpact = impact;
    set({ save: { ...save } });
    void get().persist();
    return {
      match,
      fixtureId: match.id,
      userWon,
      tie,
      coinsAwarded,
      rating: matchRating(perf),
      selected: perf.batted || perf.bowled,
      impact,
    };
  },

  claimDailyChallenge: (challenge) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    if (save.dailyChallengeCompleted?.[challenge.dateKey]) {
      return { ok: false, reason: 'Challenge reward already claimed.' };
    }
    return {
      ok: false,
      reason: 'Daily Challenge rewards are granted only when the armed match result is committed.',
    };
  },

  // ── VIP Energy overflow ──────────────────────────────────────────────────
  refreshEnergyWithVip: () => {
    const save = get().save;
    if (!save) return;
    const isVip = save.entitlements.removeAds;
    // VIP (permanent removeAds) holders regenerate up to the higher 60 cap;
    // everyone else to the standard 36. Regen never reduces existing energy.
    const cap = isVip ? ECONOMY.vipEnergyMax : ECONOMY.energyMax;
    save.wallet = regenEnergy(save.wallet, Date.now(), cap);
    save.vipEnergyBonusActive = isVip;
    set({ save: { ...save } });
  },

  // ── VIP Streak mechanic ──────────────────────────────────────────────────
  tickVipStreak: () => {
    const save = get().save;
    if (!save || !save.entitlements.removeAds) return { days: 0, reward: null };
    const today = dayIndex();
    const lastDay = save.vipStreakLastDay ?? 0;
    if (lastDay === today) return { days: save.vipStreakDays ?? 0, reward: null };
    const days = lastDay === today - 1 ? (save.vipStreakDays ?? 0) + 1 : 1;
    save.vipStreakDays = days;
    save.vipStreakLastDay = today;
    let reward: { gems?: number; title?: string } | null = null;
    if (days === 7) {
      save.wallet = addGems(save.wallet, 30);
      reward = { gems: 30, title: '7-Day VIP Streak!' };
    } else if (days === 30) {
      // Grant exclusive avatar frame flag
      save.inventory = { ...(save.inventory ?? {}), avatar_legend_vip: 1 };
      reward = { title: 'VIP Legend Frame unlocked!' };
    }
    set({ save: { ...save } });
    void get().persist();
    return { days, reward };
  },

  // ── Career pathway ──────────────────────────────────────────────────────
  clearPromotion: () => set({ lastPromotion: null }),

  setCareerRestNext: (rest) => {
    const save = get().save;
    if (!save || save.mode !== 'career') return { ok: false, reason: 'No active career.' };
    const fixtureId = nextUserFixtureId(save);
    if (!fixtureId) return { ok: false, reason: 'No fixture is available.' };
    setCareerRestRequest(save, fixtureId, rest);
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  markNewspaperSeen: (storyId) => {
    const save = get().save;
    if (!save) return;
    markNewspaperSeen(save, storyId);
    set({ save: { ...save } });
    void get().persist();
  },

  resolvePlayerWeek: (choice) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = resolvePlayerCalendarEvent(save, choice);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return {
      ok: result.ok,
      reason: result.reason,
      outcome: result.event?.outcome,
    };
  },

  declareInternationalCountry: (countryId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active player career.' };
    const result = declareInternationalCountryPure(save, countryId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  requestDomesticCountryMove: (countryId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active player career.' };
    const result = requestPlayerCountryMove(save, countryId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  // ── Personal finance ────────────────────────────────────────────────────
  investStocksAction: (coins) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = investInStocks(save, coins);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  withdrawStocksAction: () => {
    const save = get().save;
    if (!save) return 0;
    const amount = withdrawStocks(save);
    if (amount > 0) {
      set({ save: { ...save } });
      void get().persist();
    }
    return amount;
  },

  contributeLegacy: (tierId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const tier = LEGACY_TIERS.find((t) => t.id === tierId);
    if (!tier) return { ok: false, reason: 'Unknown contribution.' };
    if ((save.inventory?.[tierId] ?? 0) > 0) return { ok: false, reason: 'Already funded.' };
    if (save.wallet.coins < tier.coinCost) return { ok: false, reason: 'Not enough coins.' };
    save.wallet = addCoins(save.wallet, -tier.coinCost);
    save.inventory = { ...(save.inventory ?? {}), [tierId]: 1 };
    save.legacyPoints = (save.legacyPoints ?? 0) + tier.points;
    analytics.logEvent(analytics.EVT.LEGACY_CONTRIBUTION, { id: tierId, coin_cost: tier.coinCost });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true };
  },

  fundAcademy: (tier, name) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = fundPersonalAcademy(save, tier, name);
    if (res.ok) {
      const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
      addTimeline(save, {
        year,
        kind: 'STORY',
        text: `Founded the ${name} cricket academy — shaping the next generation.`,
      });
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  // ── Career-to-manager transition ─────────────────────────────────────────
  transitionToManager: () => {
    const save = get().save;
    if (!save || !save.careerToManagerEligible || save.mode !== 'career') return false;
    if (!save.flags) save.flags = {};
    (save.flags as Record<string, boolean>).transitionedToManager = true;
    set({ save: { ...save } });
    void get().persist();
    return true;
  },

  // ── Loan system (Feature 1) ───────────────────────────────────────────────
  loanPlayer: (playerId, seasons = 1) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const closedReason = transferWindowClosedReason(save);
    if (closedReason) return { ok: false, cost: 0, reason: closedReason };
    const res = loanPlayerPure(save, playerId, seasons);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  recallLoan: (playerId) => {
    const save = get().save;
    if (!save) return false;
    const ok = recallLoanPure(save, playerId);
    if (ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return ok;
  },

  offerFreeAgentContract: (playerId, years = 2) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const closedReason = transferWindowClosedReason(save);
    if (closedReason) return { ok: false, cost: 0, reason: closedReason };
    const res = offerFreeAgentContractPure(save, playerId, years);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  // ── Contract negotiation (career mode) ───────────────────────────────────
  negotiateContractDemand: (demand) => {
    const save = get().save;
    if (!save)
      return {
        clubAccepted: false,
        finalOffer: { wage: 0, years: 1, signingBonus: 0 },
        text: 'No save.',
      };
    const rng = storyRng(save, (save.story?.seenEventIds.length ?? 0) * 31 + 7);
    const result = negotiateContract(save, demand, rng);
    set({ save: { ...save } });
    void get().persist();
    return result;
  },

  holdOutForBetter: () => {
    const save = get().save;
    if (!save) return { wage: 0, years: 1, signingBonus: 0 };
    const improved = holdOut(save);
    set({ save: { ...save } });
    void get().persist();
    return improved;
  },

  signNegotiatedContract: (offer) => {
    const save = get().save;
    if (!save) return { ok: false, bonus: 0 };
    const boostTokens = inventoryCount(save, 'contract_boost_token');
    const signedOffer =
      boostTokens > 0
        ? {
            ...offer,
            wage: Math.round(offer.wage * 1.25),
            signingBonus: Math.round(offer.signingBonus * 1.25),
          }
        : offer;
    const bonus = signUserContract(save, signedOffer);
    if (boostTokens > 0) {
      setInventoryCount(save, 'contract_boost_token', boostTokens - 1);
    }
    if (bonus > 0) save.wallet = addCoins(save.wallet, bonus);
    const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
    addTimeline(save, {
      year,
      kind: 'TRANSFER',
      text: `Signed a new ${signedOffer.years}-year deal — ₹${Math.round(signedOffer.wage / 52000)}k/week.`,
    });
    set({ save: { ...save } });
    void get().persist();
    return { ok: true, bonus, offer: signedOffer };
  },

  // ── Manager headhunt ──────────────────────────────────────────────────────
  acceptManagerJobOffer: () => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = acceptManagerJob(save);
    if (res.ok) {
      analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { managerJobMove: true });
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  declineManagerJobOffer: () => {
    const save = get().save;
    if (!save) return;
    declineManagerJob(save);
    set({ save: { ...save } });
    void get().persist();
  },

  // ── Competition picker (Feature 4) ────────────────────────────────────────
  setTargetFixture: (fixtureId) => {
    set({ targetFixtureId: fixtureId });
  },

  ensureCompetitionFixtures: (competitionId) => {
    const save = get().save;
    if (!save) return [];
    const ids = ensureCompetitionFixtures(save, competitionId);
    if (ids.length > 0) {
      set({ save: { ...save } });
      void get().persist();
    }
    return ids;
  },

  // ── Rival overtake notification ──────────────────────────────────────────
  checkRivalOvertake: () => {
    const save = get().save;
    if (!save || !save.rivalPlayerId || !save.userPlayerId) return;
    const user = save.players[save.userPlayerId];
    const rival = save.players[save.rivalPlayerId];
    if (!user || !rival) return;
    const userRuns = user.careerStats?.runs ?? 0;
    const rivalRuns = rival.careerStats?.runs ?? 0;
    const prevUserRuns = (save as any)._lastCheckedUserRuns ?? 0;
    const prevRivalRuns = (save as any)._lastCheckedRivalRuns ?? 0;
    // If rival has just overtaken user in runs, add inbox message
    if (rivalRuns > userRuns && prevRivalRuns <= prevUserRuns) {
      const msg = {
        id: `rival_overtake_${Date.now()}`,
        kind: 'RIVAL_OVERTOOK' as const,
        title: `${rival.name} just overtook you!`,
        body: `${rival.name} now has ${rivalRuns} career runs — you have ${userRuns}. Don't let them pull ahead.`,
        timestamp: Date.now(),
        read: false,
        actionScreen: 'Records',
      };
      get().addInboxMessage(msg);
    }
    (save as any)._lastCheckedUserRuns = userRuns;
    (save as any)._lastCheckedRivalRuns = rivalRuns;
  },
}));
