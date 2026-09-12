import { create } from 'zustand';
import { presentSignedPlayerContract } from './contractPresentationStore';
import { normalizeAvatarConfig } from '../avatar';
import { QA_TOOLS_ENABLED, QA_WHALE_CLUB_BUDGET, QA_WHALE_COINS } from '../config/qa';
import { ECONOMY } from '../data/gameConfig';
import { seniorProfessionalFeaturesUnlocked } from '../game/readiness';
import {
  DailyChallenge,
  Facilities,
  Fixture,
  Format,
  GameMode,
  MatchImpactSummary,
  MatchState,
  ManagerCareerLevel,
  ManagerResourceAction,
  ManagerTrainingFocus,
  ManagerTrainingIntensity,
  PersonalCoachDiscipline,
  PlayerCaptainIssue,
  SaveGame,
  StaffRole,
  Tactics,
  TicketPreset,
  Wallet,
} from '../domain/types';
import { LiveMatch } from '../engine/liveMatch';
import { computeOverall } from '../engine/rating';
import { makeRng } from '../engine/rng';
import {
  accrueNationalRep,
  applyCareerMatchReadiness,
  applyNearRecordSelectionBoost,
  careerSelectionDecision,
  checkAgeRetirement,
  closeInternationalCapSeason,
  checkPathPromotion,
  collectAcademyRevenue,
  ContractDemand,
  contractOffer,
  ContractOffer,
  declareInternationalCountry as declareInternationalCountryPure,
  ensureCareerPathLevel,
  ensurePlayerCareerResources,
  ensureUserContract,
  fundPersonalAcademy,
  holdOut,
  isCareerToManagerEligible,
  maybeNationalCaptaincy,
  negotiateContract,
  NegotiationResult,
  prepareCareerFormat,
  playerRetirementAssessment,
  PromotionResult,
  recordPathPerformance,
  recoverCareerOffSeason,
  selectCareerXI,
  setCareerRestRequest,
  signUserContract,
  tickCareerPathMatch,
  tickUserContract,
  userContractExpiring,
} from '../game/career';
import { investInStockCompany, sellStockCompany, tickStockMarket } from '../game/stockMarket';
import { synchronizeCareerPromotion } from '../game/careerTransition';
import {
  addCoins,
  addGems,
  convertPlayerGemsToCoins,
  fixtureEnergyCost,
  matchEnergyCost,
  matchReward,
  PLAYER_GEM_CONVERSION_PRESETS,
  playerGemConversionCoins,
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
  passTiersForMode,
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
  acceptDomesticClubOffer as applyAcceptDomesticClubOffer,
  acceptAuctionOffer as applyAcceptOffer,
  declineDomesticClubOffers as applyDeclineDomesticClubOffers,
  declineAuction as applyDeclineAuction,
  generateAuctionOffers,
  generateDomesticClubOffers,
} from '../game/auction';
import {
  canRetire,
  careerEpitaph,
  ChoiceResult,
  maybeQueueMatchStory,
  nextPendingEvent,
  normalizePendingStoryQueue,
  pendingEventCount,
  queueStoryForTrigger,
  releaseDeferredStoryAfterMatch,
  RenderedEvent,
  resolveStoryChoice,
  rolloverSponsors,
  storyRng,
} from '../game/careerEvents';
import {
  ensureManagerDepth,
  facilityMaintenance,
  FacilityOutcome,
  FacilityUpgradePaymentMethod,
  FreeAgentContractOutcome,
  hireStaff as hireStaffPure,
  investInStaff,
  LoanOutcome,
  MAX_FACILITY,
  loanPlayer as loanPlayerPure,
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
import {
  StadiumUpgradeOutcome,
  stadiumSeasonUpkeep,
  setClubTicketPreset,
  upgradeMatchdayExperience,
  upgradeStadiumCapacity,
} from '../game/stadiumManagement';
import { executeManagerResourceAction, ManagerResourceOutcome } from '../game/managerResources';
import { managerClubOperationsPaused, persistActiveManagerClub } from '../game/managerClubState';
import { setManagerPlayerTrainingOverride, setManagerTeamTraining } from '../game/managerTraining';
import {
  appointManagerLeader as appointManagerLeaderPure,
  ensureManagerLeadership,
  ManagerLeadershipRole,
} from '../game/leadership';
import { transferWindowClosedReason } from '../game/transferMarket';
import { checkManagerLevelPromotion, updateManagerReputation } from '../game/managerCareer';
import {
  acceptManagerJob,
  applyManagerAppointment,
  declineManagerJob,
  generateManagerJobOffer,
} from '../game/managerJobs';
import {
  advanceCup,
  cupChampionId,
  CUP_NAME,
  ensureCup,
  finishCup,
  nextUserCupTie,
} from '../game/cup';
import { PlayerTalkKind, TalkResult, talkToPlayer as talkToPlayerPure } from '../game/teamTalk';
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
  reconcilePlayedCompetitionRounds,
  simulateFixtureWithoutCareerPlayer,
  resolveNationalDutyConflict,
  seasonComplete,
  simulateInternationalFixturesWithoutUser,
  simulateUnplayedBefore,
  stagePlayoffsForUser,
  startNewSeason,
  careerTrophyParticipationRate,
  validateSeasonState,
} from '../game/season';
import {
  isInternationalFixture,
  nextInternationalFixtureId,
  prepareInternationalCalendar,
  releaseFromInternationalTourIfOutOfForm,
} from '../game/intlCalendar';
import {
  PlayerCalendarChoice,
  playerCalendarAllowsFixture,
  resolvePlayerCalendarEvent,
} from '../game/playerCalendar';
import { requestPlayerCountryMove } from '../game/playerMigration';
import {
  bookPersonalPhysio,
  buyPerformanceAnalysis,
  buyPlayerAsset,
  buyPlayerEquipment,
  CaptainResolution,
  ensureCaptainIssue,
  hirePersonalCoach,
  personalCoachTrainingMultiplier,
  PlayerLifeOutcome,
  processPlayerLifeSeason,
  publishPlayerSocialPost,
  recordPlayerLifeMatch,
  resolveCaptainIssue,
  SocialTone,
  transferPlayerBank,
} from '../game/playerLife';
import { AdvanceManagerCalendarResult, managerControlledTeamId } from '../game/managerCalendar';
import { updateRecords } from '../game/records';
import { applyMatchToStats } from '../game/stats';
import { careerPlayingTeamId, generateYouthFixtures } from '../game/youthFixtures';
import { matchDecisionAuthority } from '../game/matchAuthority';
import {
  acceptSponsorshipOffer,
  ensureSponsorshipState,
  grantPremiumSponsorToCurrentSave,
  premiumSponsorStoreUnlocked,
  rolloverSponsorship,
  settleFixtureSponsorship,
  SponsorActionResult,
} from '../game/sponsorship';
import {
  achievementGemReward,
  checkCareerStateAchievements,
  checkManagerMatchAchievements,
  checkMatchAchievements,
  checkSeasonAchievements,
  checkStreakAchievements,
  getAchievement,
} from '../game/achievements';
import {
  accountPurchases,
  analytics,
  crash,
  notifications,
  purchaseLedger,
  purchases,
} from '../services';
import { maybeRequestReview } from '../services/storeReview';
import { listAllSaves, setLastPlayed, writeSave } from '../storage/saveGames';
import { runMigrations } from '../storage/migrate';
import { synchronizeSchema14State } from '../storage/schema14';
import { synchronizeSchema15State } from '../storage/schema15';
import { synchronizeSchema16State } from '../storage/schema16';
import { synchronizeSchema17State } from '../storage/schema17';
import { synchronizeSchema18State } from '../storage/schema18';
import { synchronizeSchema19State } from '../storage/schema19';
import { synchronizeSchema20State } from '../storage/schema20';
import { synchronizeSchema21State } from '../storage/schema21';
import { synchronizeSchema24State } from '../storage/schema24';
import { synchronizeSchema25State } from '../storage/schema25';
import { synchronizeSchema26State } from '../storage/schema26';
import { synchronizeSchema27State } from '../storage/schema27';
import { synchronizeSchema28State } from '../storage/schema28';
import { synchronizeSchema29State } from '../storage/schema29';
import { synchronizeSchema32State } from '../storage/schema32';
import { synchronizeSchema33State } from '../storage/schema33';
import { synchronizeSchema35State } from '../storage/schema35';
import { synchronizeSchema40PlayerAffiliations } from '../storage/schema40';
import { synchronizeSchema42Portfolio } from '../storage/schema42';
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
  seasonPassPeriod,
  synchronizeSeasonPassState,
} from '../game/seasonPass';
import {
  autoSettleU19WorldCupAI,
  isU19WorldCupFixture,
  recordU19WorldCupMerit,
  synchronizeU19WorldCupState,
} from '../game/u19WorldCup';

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

export interface PassRewardClaim {
  previousCoins: number;
  newCoins: number;
  coins: number;
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

export interface BenchedAdvanceOutcome {
  ok: boolean;
  simulated: number;
  reason?: string;
  nextFixtureId?: string;
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

const dayIndex = (now: number = Date.now()): number => Math.floor(now / 86_400_000);
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

/** A completed match without a winner is neutral: a tie, Test draw or no result. */
function matchHasNeutralResult(match: MatchState): boolean {
  return Boolean(match.result && (match.result.tie || !match.result.winnerTeamId));
}

function hasRecordedSaveResult(save: SaveGame, matchId: string): boolean {
  return Boolean(save.flags?.[`resultCount:${matchId}`]);
}

function isManagerDerby(save: SaveGame, fixture: Fixture | undefined): boolean {
  if (!fixture) return false;
  const league = Object.values(save.leagues).find(
    (item) =>
      item.teamIds.includes(fixture.homeTeamId) && item.teamIds.includes(fixture.awayTeamId),
  );
  if (!league) return false;
  const homeIndex = league.teamIds.indexOf(fixture.homeTeamId);
  const awayIndex = league.teamIds.indexOf(fixture.awayTeamId);
  return (
    homeIndex >= 0 && awayIndex >= 0 && Math.floor(homeIndex / 2) === Math.floor(awayIndex / 2)
  );
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
  updateManagerReputation(save);
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
  const teamId = save.mode === 'manager' ? managerControlledTeamId(save) : save.userTeamId;
  if (!teamId) return null;
  const team = save.teams[teamId];
  const squad = (team?.playerIds ?? []).map((id) => save.players[id]).filter(Boolean);
  if (squad.length === 0) return null;
  const before =
    squad.reduce(
      (sum, p) => sum + Math.max(0, Math.min(100, p.condition ?? p.meta.fitness ?? 70)),
      0,
    ) / squad.length;
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

function finalizePlayerRetirement(save: SaveGame, year: number): { epitaph: string } | null {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!user || user.retired) return null;
  user.retired = true;
  save.flags.retired = true;
  save.flags.playerRetirementRecommended = false;
  const epitaph = careerEpitaph(save);
  addTimeline(save, {
    year,
    kind: 'RETIREMENT',
    text: `Called time on a storied career — ${epitaph}.`,
  });
  analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { retired: true, age: user.age });
  ingestHallOfFame(save);
  return { epitaph };
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

function qaUnlimitedEnergyEnabled(): boolean {
  return QA_TOOLS_ENABLED && useSettings.getState().qaUnlimitedEnergy;
}

function visibleEnergyCap(save: SaveGame): number {
  return save.entitlements.removeAds ? ECONOMY.vipEnergyMax : ECONOMY.energyMax;
}

function refillQaEnergy(save: SaveGame): boolean {
  if (!qaUnlimitedEnergyEnabled() || save.mode !== 'career') return false;
  const cap = visibleEnergyCap(save);
  const changed = save.wallet.energy !== cap;
  save.wallet = { ...save.wallet, energy: cap, energyUpdatedAt: Date.now() };
  return changed;
}

function spendSaveEnergy(save: SaveGame, amount: number): Wallet {
  if (!qaUnlimitedEnergyEnabled()) return spendEnergy(save.wallet, amount);
  return {
    ...save.wallet,
    energy: visibleEnergyCap(save),
    energyUpdatedAt: Date.now(),
  };
}

function synchronizeWeeklyQuestCycle(save: SaveGame, now: number, forceReset = false): void {
  const period = seasonPassPeriod(now);
  const passCycleId = save.pass?.seasonId ?? period.id;
  const passStartedAt = save.pass?.periodStartedAt ?? period.startsAt;
  const week = Math.max(0, Math.floor((now - passStartedAt) / (7 * 86_400_000)));
  const weekly = save.weeklyQuests;
  if (!weekly || forceReset || (weekly.passCycleId != null && weekly.passCycleId !== passCycleId)) {
    save.weeklyQuests = {
      week,
      passCycleId,
      items: initQuestProgress(weeklyQuestsForMode(save.mode)),
    };
    return;
  }
  if (weekly.passCycleId == null) {
    // Stamp legacy in-progress weeks without discarding them, and translate
    // the old global week number onto this pass's seven-day cadence.
    weekly.passCycleId = passCycleId;
    weekly.week = week;
    return;
  }
  if (weekly.week !== week) {
    save.weeklyQuests = {
      week,
      passCycleId,
      items: initQuestProgress(weeklyQuestsForMode(save.mode)),
    };
  }
}

/** Ensure the daily/weekly quest sets + season pass exist and match the current day/week/season. */
function ensureLiveops(save: SaveGame, now: number = Date.now(), forceWeeklyReset = false): void {
  const previousPassCycleId = save.pass?.seasonId;
  synchronizeSeasonPassState(save, now);
  const day = dayIndex(now);
  if (!save.quests || save.quests.day !== day) {
    save.quests = { day, items: initQuestProgress(pickDailyQuests(day, undefined, save.mode)) };
  }
  synchronizeWeeklyQuestCycle(
    save,
    now,
    forceWeeklyReset ||
      (previousPassCycleId != null && previousPassCycleId !== save.pass?.seasonId),
  );
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

export type RestorePurchasesStatus =
  | 'RESTORED'
  | 'NOTHING_TO_RESTORE'
  | 'NOTHING_APPLICABLE'
  | 'NOT_CONFIGURED'
  | 'FAILED'
  | 'NO_SAVE'
  | 'ACTIVE_SAVE_CHANGED'
  | 'PERSISTENCE_FAILED';

export interface RestorePurchasesOutcome {
  status: RestorePurchasesStatus;
  count: number;
  productIds: string[];
  error?: string;
}

interface CareerState {
  save: SaveGame | null;
  ref: ActiveRef | null;
  /** Last background/autosave failure. Cleared by the next successful write. */
  persistenceError: string | null;
  /** Transient: a specific fixture to play next (e.g. a cup tie) instead of the league queue. */
  targetFixtureId?: string;
  /** Transient: newly-unlocked achievement ids waiting for a toast. Cleared by UI after display. */
  pendingAchievementIds: string[];

  setActive: (save: SaveGame, mode: GameMode, slot: number) => void;
  playCupTie: () => boolean;
  refreshEnergy: () => void;
  /** Reconcile a UTC pass boundary or premium expiry and persist once. */
  synchronizeSeasonPassClock: (now?: number) => Promise<boolean>;
  /** Best-effort autosave. Failures are captured in state instead of becoming unhandled rejections. */
  persist: () => Promise<void>;
  /** User-visible/transactional save. Rejects when durable storage does not confirm the write. */
  persistCritical: (immediate?: boolean) => Promise<void>;
  scheduleReminders: () => void;
  playNext: () => PlayResult | null;
  /** Simulate consecutive team fixtures while the career player is not in the XI. */
  advanceWhileBenched: () => BenchedAdvanceOutcome;
  beginLiveMatch: () => { fixtureId: string; live: LiveMatch } | null;
  commitLiveMatch: (match: MatchState) => PlayResult | null;
  beginInternational: () => { live: LiveMatch } | null;
  commitInternational: (match: MatchState) => PlayResult | null;
  train: (group: TrainGroup) => Promise<TrainOutcome>;
  setTactics: (tactics: Tactics, fixtureId?: string) => void;
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
  useManagerResource: (
    action: ManagerResourceAction,
    targetPlayerId?: string,
  ) => ManagerResourceOutcome;
  upgradeFacilityLevel: (
    kind: keyof Facilities,
    paymentMethod: FacilityUpgradePaymentMethod,
  ) => FacilityOutcome;
  setTicketPreset: (format: Format, preset: TicketPreset) => boolean;
  upgradeStadium: () => StadiumUpgradeOutcome;
  upgradeMatchday: () => StadiumUpgradeOutcome;
  scout: (playerId: string) => ScoutOutcome;
  promoteYouth: (playerId: string) => PromoteOutcome;
  releaseYouth: (playerId: string) => PromoteOutcome;
  renewDeal: (playerId: string, years?: number) => RenewOutcome;
  setTrainFocus: (playerId: string, group: 'batting' | 'bowling' | 'fielding' | 'meta') => void;
  setManagerTrainingPlan: (update: {
    focus?: ManagerTrainingFocus;
    intensity?: ManagerTrainingIntensity;
  }) => boolean;
  setManagerTrainingOverride: (playerId: string, focus?: ManagerTrainingFocus) => boolean;
  appointManagerLeader: (
    role: ManagerLeadershipRole,
    playerId: string,
  ) => {
    ok: boolean;
    reason?: string;
  };
  talkToPlayer: (playerId: string, kind: PlayerTalkKind) => TalkResult;
  markFlagSeen: (key: string) => void;
  takeNewJob: (teamId: string) => void;
  simRestOfSeason: () => void;
  advanceSeason: () => void;
  advanceManagerCalendar: (maxFixtures?: number) => AdvanceManagerCalendarResult | null;
  newSeason: () => void;
  acceptAuctionOffer: (teamId: string) => { ok: boolean; reason?: string };
  declineAuction: () => void;
  acceptDomesticClubOffer: (teamId: string) => { ok: boolean; reason?: string };
  declineDomesticClubOffers: () => void;
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
  qaGrantWhaleCoins: () => Promise<{
    ok: boolean;
    balance?: number;
    savesUpdated?: number;
    playerSavesUpdated?: number;
    managerSavesUpdated?: number;
    reason?: string;
  }>;
  qaGrantClubBudget: () => Promise<{ ok: boolean; balance?: number; reason?: string }>;
  qaRefillEnergy: () => boolean;
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
  convertPlayerGems: (
    gems: number,
  ) => Promise<{ ok: boolean; gems?: number; coins?: number; reason?: string }>;
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
  restorePurchases: () => Promise<RestorePurchasesOutcome>;
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
  resolvePlayerWeek: (choice?: PlayerCalendarChoice) => {
    ok: boolean;
    reason?: string;
    outcome?: string;
  };
  declareInternationalCountry: (countryId: string) => { ok: boolean; reason?: string };
  requestDomesticCountryMove: (countryId: string) => { ok: boolean; reason?: string };
  // Personal finance
  investStocksAction: (
    companyId: string,
    coins: number,
  ) => { ok: boolean; reason?: string; coins?: number };
  withdrawStocksAction: (
    companyId: string,
    coins?: number,
  ) => { ok: boolean; reason?: string; coins?: number };
  contributeLegacy: (tierId: string) => { ok: boolean; reason?: string };
  fundAcademy: (tier: 1 | 2 | 3, name: string) => { ok: boolean; reason?: string };
  transferPlayerBank: (direction: 'DEPOSIT' | 'WITHDRAW', amount: number) => PlayerLifeOutcome;
  buyPlayerAsset: (kind: 'PROPERTY' | 'BUSINESS', assetId: string) => PlayerLifeOutcome;
  hirePersonalCoach: (discipline: PersonalCoachDiscipline) => PlayerLifeOutcome;
  buyPlayerEquipment: (equipmentId: string) => PlayerLifeOutcome;
  bookPersonalPhysio: () => PlayerLifeOutcome;
  buyPerformanceAnalysis: () => PlayerLifeOutcome;
  acceptEarnedSponsorOffer: (offerId: string) => SponsorActionResult;
  publishPlayerSocialPost: (tone: SocialTone) => PlayerLifeOutcome;
  prepareCaptainIssue: () => PlayerCaptainIssue | undefined;
  resolveCaptainIssue: (resolution: CaptainResolution) => PlayerLifeOutcome;
  importCareerBackup: (raw: string) => Promise<{ ok: boolean; reason?: string }>;
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
  acknowledgeManagerAppointment: () => void;
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

function persistenceErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The device did not confirm the save write.';
}

async function persistActiveSave(save: SaveGame, ref: ActiveRef, immediate = false): Promise<void> {
  synchronizeSchema14State(save);
  synchronizeSchema15State(save);
  synchronizeSchema18State(save);
  synchronizeSchema20State(save);
  synchronizeSchema24State(save);
  synchronizeSchema25State(save);
  synchronizeSchema26State(save);
  synchronizeSchema27State(save);
  synchronizeSchema28State(save);
  synchronizeSchema29State(save);
  synchronizeSchema32State(save);
  synchronizeSchema33State(save);
  synchronizeSchema35State(save);
  synchronizeSchema40PlayerAffiliations(save);
  synchronizeSchema42Portfolio(save);

  // Enqueue the write as soon as the state change asks for it. Deferring this
  // until after UI interactions allowed an older autosave to enter the slot
  // queue after a newer match-result write and roll the fixture back to
  // `played: false`. `writeSave` already serializes each slot, so immediate
  // enqueueing preserves mutation order without blocking callers that use the
  // normal fire-and-forget autosave path.
  void immediate;
  await writeSave(ref.mode, ref.slot, save);
  await setLastPlayed(ref.mode, ref.slot);
}

export const useCareer = create<CareerState>((set, get) => ({
  save: null,
  ref: null,
  persistenceError: null,
  pendingAchievementIds: [],
  lastPromotion: null,

  setActive: (save, mode, slot) => {
    const liveopsNow = Date.now();
    const loadedPassCycleId = save.pass?.seasonId;
    const loadedCalendarPassCycle = /^pass-\d{4}-\d{2}$/.test(loadedPassCycleId ?? '');
    validateSeasonState(save);
    save.wallet = regenEnergy(save.wallet);
    refillQaEnergy(save);
    synchronizeSchema14State(save, save.updatedAt);
    synchronizeSchema15State(save);
    synchronizeSchema16State(save);
    synchronizeSchema17State(save, liveopsNow);
    synchronizeSchema18State(save);
    synchronizeSchema19State(save);
    synchronizeSchema20State(save);
    synchronizeSchema21State(save);
    synchronizeSchema24State(save);
    synchronizeSchema25State(save);
    synchronizeSchema26State(save);
    synchronizeSchema27State(save);
    synchronizeSchema28State(save);
    synchronizeSchema29State(save);
    synchronizeSchema32State(save);
    synchronizeSchema33State(save);
    synchronizeSchema35State(save);
    synchronizeSchema40PlayerAffiliations(save);
    synchronizeSchema42Portfolio(save);
    ensureLiveops(
      save,
      liveopsNow,
      loadedCalendarPassCycle && loadedPassCycleId !== save.pass?.seasonId,
    );
    if (mode === 'career') {
      ensureCareerDepth(save);
      normalizePendingStoryQueue(save);
      ensureCareerPathLevel(save);
      ensureUserContract(save);
      // Self-heal: a youth-level career (SCHOOL/U19) must always have youth
      // fixtures for the current season, or the matchday would dead-end.
      // generateYouthFixtures is idempotent, so this is a safe no-op otherwise.
      const lvl = save.careerPathLevel;
      if (lvl === 'SCHOOL' || lvl === 'U19') generateYouthFixtures(save);
      synchronizeU19WorldCupState(save);
      autoSettleU19WorldCupAI(save);
      ensureRival(save);
    } else {
      ensureManagerDepth(save);
      ensureManagerLeadership(save);
    }
    reconcilePlayedCompetitionRounds(save);
    if (!save.managerCalendar) ensureCup(save);
    // First-ever manager press beat (the unveiling).
    if (
      mode === 'manager' &&
      !save.managerStory?.seenEventIds.length &&
      !save.managerStory?.pendingEventIds.length
    ) {
      queueManagerEvent(save, 'PRE_SEASON', storyRng(save, 1));
    }
    set({ save, ref: { mode, slot }, targetFixtureId: undefined, persistenceError: null });
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
    refillQaEnergy(save);
    ensureLiveops(save);
    if (save.mode === 'career') {
      ensureCareerDepth(save);
      // Self-heal youth fixtures so the matchday never dead-ends.
      const lvl = save.careerPathLevel;
      if (lvl === 'SCHOOL' || lvl === 'U19') generateYouthFixtures(save);
    } else {
      ensureManagerDepth(save);
      ensureManagerLeadership(save);
    }
    reconcilePlayedCompetitionRounds(save);
    set({ save: { ...save } });
  },

  synchronizeSeasonPassClock: async (now = Date.now()) => {
    const save = get().save;
    if (!save) return false;
    const period = seasonPassPeriod(now);
    const premiumActive = isSeasonPassActive(save, now);
    if (
      save.pass?.seasonId === period.id &&
      save.pass.periodStartedAt === period.startsAt &&
      save.pass.periodEndsAt === period.endsAt &&
      save.pass.premium === premiumActive &&
      (!save.entitlements.seasonPass || save.entitlements.seasonPass.premium === premiumActive)
    ) {
      return false;
    }
    const previousPassCycleId = save.pass?.seasonId;
    synchronizeSeasonPassState(save, now);
    synchronizeWeeklyQuestCycle(
      save,
      now,
      previousPassCycleId != null && previousPassCycleId !== save.pass?.seasonId,
    );
    set({ save: { ...save } });
    await get().persist();
    return true;
  },

  persist: async () => {
    const { save, ref } = get();
    if (!save || !ref) return;
    try {
      await persistActiveSave(save, ref);
      set({ persistenceError: null });
    } catch (error) {
      const message = persistenceErrorMessage(error);
      set({ persistenceError: message });
      crash.captureException(error, { context: 'save.autosave', mode: ref.mode, slot: ref.slot });
    }
  },

  persistCritical: async (immediate = false) => {
    const { save, ref } = get();
    if (!save || !ref) return;
    try {
      await persistActiveSave(save, ref, immediate);
      set({ persistenceError: null });
    } catch (error) {
      const message = persistenceErrorMessage(error);
      set({ persistenceError: message });
      crash.captureException(error, {
        context: 'save.critical',
        mode: ref.mode,
        slot: ref.slot,
      });
      throw error;
    }
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
        // Schedule against the persisted UTC month boundary, not three days
        // after whichever moment the player happens to exit the hub.
        if (save.pass?.periodEndsAt != null) {
          void notifications.scheduleSeasonEnding(save.pass.periodEndsAt);
        }
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
    const userWon = match.result?.winnerTeamId === careerPlayingTeamId(save, fixtureId);
    const tie = matchHasNeutralResult(match);
    recordSaveResult(save, match.id, userWon, tie);
    if (save.mode === 'career' && save.userPlayerId) {
      const user = userPerformance(match, save.userPlayerId);
      const selected =
        user.batted ||
        user.bowled ||
        [match.homeTeamId, match.awayTeamId].some((teamId) => {
          const team = save.teams[teamId];
          const xi = team?.xi?.length ? team.xi : team?.playerIds.slice(0, 11);
          return xi?.includes(save.userPlayerId!);
        });
      settleFixtureSponsorship(save, fixture, { selected, userWon });
    } else if (save.mode === 'manager') {
      const managedTeamId = fixture?.managerPhase
        ? managerControlledTeamId(save, fixture.managerPhase)
        : save.userTeamId;
      settleFixtureSponsorship(save, fixture, {
        selected: true,
        userWon,
        managedTeamId,
      });
    }
    const coinsAwarded = Math.round(
      matchReward(userWon, tie, undefined, save.mode === 'manager' ? 'MANAGER' : 'PLAYER') *
        vipCoinMultiplier(save.entitlements),
    );

    if (get().ref?.mode === 'career') {
      save.wallet = spendSaveEnergy(
        save,
        fixture ? fixtureEnergyCost(fixture) : matchEnergyCost(match.format),
      );
    }
    save.wallet = addCoins(save.wallet, coinsAwarded);
    set({ save: { ...save } });
    void get().persist();

    return { match, fixtureId, userWon, tie, coinsAwarded };
  },

  advanceWhileBenched: () => {
    const save = get().save;
    if (!save || save.mode !== 'career' || !save.userPlayerId) {
      return { ok: false, simulated: 0, reason: 'No active player career.' };
    }

    let simulated = 0;
    let guard = 0;
    while (guard++ < 40) {
      const fixtureId = nextUserFixtureId(save);
      const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
      if (!fixtureId || !fixture) break;
      const decision = careerSelectionDecision(save, fixture.format, fixtureId);
      if (decision.selected) break;

      // A benched appearance still belongs to a complete competition round.
      // Catch up every AI-only fixture through this round before settling the
      // user's club, otherwise only their row advances in the visible table.
      simulateUnplayedBefore(save, fixtureId);
      // Remove the protagonist from the simulated fixture roster itself. A
      // merely persisted XI can become invalid after an injury and resolveXI
      // may then rebuild it with the player included.
      const match = simulateFixtureWithoutCareerPlayer(save, fixture);
      const playingTeamId = careerPlayingTeamId(save, fixtureId);
      const userWon = match.result?.winnerTeamId === playingTeamId;
      const tie = matchHasNeutralResult(match);
      recordSaveResult(save, match.id, userWon, tie);
      // Being outside the XI never consumes energy or earns appearance-based
      // sponsorship, but the contract's retained-squad fee still pays the
      // same explicit 35% used by the ordinary completed-match settlement.
      const retainedFee = Math.round(
        matchReward(userWon, tie, undefined, 'PLAYER') *
          0.35 *
          vipCoinMultiplier(save.entitlements),
      );
      save.wallet = addCoins(save.wallet, retainedFee);
      applyCareerMatchReadiness(save, {
        fixtureId,
        format: fixture.format,
        selected: false,
      });
      tickInjuries(save);
      simulated += 1;
    }

    const nextFixtureId = nextUserFixtureId(save);
    set({ save: { ...save } });
    void get().persist();
    return simulated > 0
      ? { ok: true, simulated, nextFixtureId }
      : {
          ok: false,
          simulated: 0,
          nextFixtureId,
          reason: nextFixtureId
            ? 'You are selected for the next fixture.'
            : 'There is no team fixture to simulate.',
        };
  },

  beginLiveMatch: () => {
    const { save, ref } = get();
    if (!save) return null;
    if (save.mode === 'manager' && save.managerRetired) return null;
    // Treat the completed-result ledger as authoritative immediately, not only
    // when a save is loaded. This repairs an in-session stale `played` bit
    // before Matchday can reopen the same fixture.
    validateSeasonState(save);
    const target = get().targetFixtureId;
    let fixtureId = target;
    if (fixtureId && (!save.fixtures[fixtureId] || save.fixtures[fixtureId].played)) {
      fixtureId = undefined;
      set({ targetFixtureId: undefined });
    }
    fixtureId ??= nextUserFixtureId(save);
    if (!fixtureId || !save.fixtures[fixtureId]) return null;
    const fx = save.fixtures[fixtureId];
    const isCup = fx?.competition === 'CUP';
    const isYouth = fx?.competitionId?.startsWith('youth-') ?? false;
    const isU19WorldCup = isU19WorldCupFixture(fx);
    const isInternational = isInternationalFixture(fx);
    if (ref?.mode === 'career' && !isCup && !playerCalendarAllowsFixture(save, fixtureId)) {
      return null;
    }
    if (
      ref?.mode === 'career' &&
      save.userPlayerId &&
      !isInternational &&
      !careerSelectionDecision(save, fx.format, fixtureId).selected
    ) {
      // A benched player advances this fixture from the career hub. Never open
      // a spectator match that can look like an appearance or update form.
      selectCareerXI(save, fx.format, fixtureId);
      set({ save: { ...save }, targetFixtureId: undefined });
      void get().persist();
      return null;
    }
    // Catch up only the target competition. Youth resolves its AI-only games;
    // it still never advances the unrelated professional T20 league.
    const isPrimaryLeague = !fx.competitionId || fx.competitionId === 't20-league';
    const shouldCatchUpManagerPhase = ref?.mode === 'manager' && Boolean(fx.managerPhase);
    if (isYouth || isU19WorldCup) {
      simulateUnplayedBefore(save, fixtureId);
    } else if (
      (isPrimaryLeague ||
        fx.managerPhase ||
        ['list-a', 'first-class'].includes(fx.competitionId ?? '')) &&
      !isCup &&
      (!isInternational || shouldCatchUpManagerPhase)
    ) {
      simulateUnplayedBefore(save, fixtureId);
    }
    if (isInternational) resolveNationalDutyConflict(save, fixtureId);
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
    const scheduledFixture = save.fixtures[match.id];
    // Overlapping UI completion callbacks must not award the same fixture's
    // coins, form, progression or story twice.
    if (!scheduledFixture || scheduledFixture.played || hasRecordedSaveResult(save, match.id)) {
      if (scheduledFixture && hasRecordedSaveResult(save, match.id)) {
        scheduledFixture.played = true;
        scheduledFixture.resultMatchId ??= match.id;
      }
      return null;
    }
    const experienceBefore = captureExperienceSnapshot(save);
    applyResult(save, match);
    useSettings.getState().recordPlayedMatch();
    // If that was a cup tie, progress the knockout bracket.
    if (save.fixtures[match.id]?.competition === 'CUP') advanceCup(save);
    const resultFixture = save.fixtures[match.id];
    const isU19WorldCup = isU19WorldCupFixture(resultFixture);
    if (
      isU19WorldCup &&
      resultFixture?.winnerTeamId &&
      (!match.result?.winnerTeamId || match.result.tie)
    ) {
      match.result = {
        ...match.result,
        tie: false,
        winnerTeamId: resultFixture.winnerTeamId,
        margin: 'Won the tied knockout by the tournament tiebreak',
      };
    }
    const isInternational = isInternationalFixture(resultFixture);
    const resultUserTeamId = isInternational
      ? resultFixture.homeTeamId
      : resultFixture?.managerPhase
        ? managerControlledTeamId(save, resultFixture.managerPhase)
        : careerPlayingTeamId(save, match.id);
    const userWon = match.result?.winnerTeamId === resultUserTeamId;
    const tie = matchHasNeutralResult(match);
    recordSaveResult(save, match.id, userWon, tie);
    let coinsAwarded = matchReward(
      userWon,
      tie,
      undefined,
      ref?.mode === 'manager' ? 'MANAGER' : 'PLAYER',
    );

    let rating: number | undefined;
    let objectiveText: string | undefined;
    let metObjective: boolean | undefined;
    let bonus = 0;
    let selected: boolean | undefined;
    let calledUp = false;

    if (ref?.mode === 'career' && save.userPlayerId) {
      const player = save.players[save.userPlayerId];
      const perf = userPerformance(match, save.userPlayerId);
      const resolvedMatchXI = [...(match.homePlayerIds ?? []), ...(match.awayPlayerIds ?? [])];
      const selectedInXi = resolvedMatchXI.length
        ? resolvedMatchXI.includes(save.userPlayerId)
        : [match.homeTeamId, match.awayTeamId].some((teamId) => {
            const team = save.teams[teamId];
            const xi = team?.xi?.length ? team.xi : team?.playerIds.slice(0, 11);
            return xi?.includes(save.userPlayerId!);
          });
      selected = selectedInXi || perf.batted || perf.bowled;
      if (selected) {
        rating = matchRating(perf);
        updateFormAfterMatch(player, perf);
        const objective = matchObjective(player.role);
        objectiveText = objective.text;
        metObjective = objectiveMet(perf, objective);
        if (metObjective) bonus = objective.reward;
        // Call-up + path progression are driven by genuine output (75%) not just rating.
        const output = { runs: perf.runs, wickets: perf.wickets };
        const levelAtMatch = save.careerPathLevel ?? 'DOMESTIC';
        const canEarnSeniorCallUp =
          !isU19WorldCup && (levelAtMatch === 'DOMESTIC' || levelAtMatch === 'INTERNATIONAL');
        calledUp = canEarnSeniorCallUp
          ? accrueNationalRep(save, player, rating, output).calledUp
          : false;
        if (!isU19WorldCup || levelAtMatch === 'U19') {
          recordPathPerformance(save, output, rating);
        }
        if (resultFixture?.competitionId === 'youth-u19') {
          recordU19WorldCupMerit(save, {
            fixtureId: match.id,
            runs: perf.runs,
            wickets: perf.wickets,
            rating,
          });
        }
        // Performance-scaled match reward: a quiet game earns ~half, a
        // match-winning display up to ~1.6× — your bat and ball earn the coins.
        const impact = matchImpactScore(output, player.role);
        coinsAwarded = Math.round(coinsAwarded * (0.45 + impact * 0.9));
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
        applyNearRecordSelectionBoost(save, { runs: perf.runs, wickets: perf.wickets });
      }
      if (selected) {
        save.wallet = spendSaveEnergy(
          save,
          isInternational
            ? matchEnergyCost(match.format, 'INTERNATIONAL')
            : fixture
              ? fixtureEnergyCost(fixture)
              : matchEnergyCost(match.format),
        );
      }
      if (isInternational) {
        save.userCaps = (save.userCaps ?? 0) + 1;
        const resources = ensurePlayerCareerResources(save);
        if (resources && !resources.cappedCountry) {
          resources.cappedCountry = resources.declaredCountry;
        }
        coinsAwarded *= 2;
        maybeNationalCaptaincy(save);
      }
    }

    if (isInternational && resultFixture) {
      const releasedFixtures = releaseFromInternationalTourIfOutOfForm(save, resultFixture);
      simulateInternationalFixturesWithoutUser(save, releasedFixtures);
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
      releaseDeferredStoryAfterMatch(save);
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
      settleFixtureSponsorship(save, resultFixture, {
        selected: selected ?? false,
        userWon,
      });
    }

    // Injuries: recover ongoing knocks, then roll for the match participant(s).
    let injuredInfo: PlayResult['injury'];
    // Manager recovery/injury is already settled once inside applyResult for
    // watched, instant and background fixtures alike.
    if (ref?.mode !== 'manager') tickInjuries(save);
    if (ref?.mode === 'career' && save.userPlayerId && (selected ?? true)) {
      const u = save.players[save.userPlayerId];
      const irng = storyRng(save, (save.timeline?.length ?? 0) * 29 + 555);
      const load = workloadFactor(perf?.ballsBowled ?? 0, perf?.balls ?? 0);
      const youthProtection =
        save.careerPathLevel === 'SCHOOL' || save.careerPathLevel === 'U19' || isU19WorldCup
          ? 0.3
          : 1;
      const inj = rollMatchInjury(
        u,
        0,
        irng,
        load * archetypeInjuryRisk(save, u) * youthProtection,
      );
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
      const actualXI =
        resultUserTeamId === match.homeTeamId ? match.homePlayerIds : match.awayPlayerIds;
      const xi = actualXI?.length ? actualXI : team.xi && team.xi.length ? team.xi : team.playerIds;
      const managedInteractively = Boolean(
        save.flags?.[`teamTalk:${match.id}`] || save.flags?.[`tactics:${match.id}`],
      );
      // Update squad morale based on match result (Feature 3).
      updateTeamMorale(save, userWon, resultUserTeamId);
      if (resultUserTeamId) {
        if (managedInteractively) {
          for (const playerId of xi) {
            const player = save.players[playerId];
            if (player) player.morale = Math.min(100, Math.round((player.morale ?? 60) * 1.1));
          }
        }
        if (resultUserTeamId === save.userTeamId) {
          save.managerMatchesAtCurrentClub = (save.managerMatchesAtCurrentClub ?? 0) + 1;
          save.managerGraceMatchesRemaining = Math.max(
            0,
            (save.managerGraceMatchesRemaining ?? 0) - 1,
          );
        }
        delete save.flags?.[`teamTalk:${match.id}`];
        delete save.flags?.[`tactics:${match.id}`];
      }
      settleFixtureSponsorship(save, resultFixture, {
        selected: true,
        userWon,
        managedTeamId: resultUserTeamId,
      });
      // Press is reserved for finals and genuine streaks, with four club
      // fixtures between appearances.
      save.managerStory = save.managerStory ?? {
        flags: {},
        strings: {},
        seenEventIds: [],
        pendingEventIds: [],
      };
      const pressGap = save.managerStory.flags.matchesSincePress ?? 4;
      save.managerStory.flags.matchesSincePress = pressGap + 1;
      const managerFixture = save.fixtures[match.id];
      const knockoutLabel = managerFixture?.cupRound?.trim();
      const isFinal = knockoutLabel === 'Final' || Boolean(knockoutLabel?.endsWith(' Final'));
      const isDerby = isManagerDerby(save, managerFixture);
      const isStreakMoment = (save.winStreak ?? 0) >= 3;
      if (pressGap >= 4 && (isFinal || isDerby || isStreakMoment)) {
        const prng = storyRng(save, save.managerStory.seenEventIds.length * 53 + 17);
        if (queueManagerEvent(save, userWon ? 'POST_WIN' : 'POST_LOSS', prng)) {
          save.managerStory.flags.matchesSincePress = 0;
        }
      }
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
    } else if (ref?.mode === 'manager') {
      newAchievements = checkManagerMatchAchievements(save);
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
      if (selected && (!isU19WorldCup || save.careerPathLevel === 'U19')) {
        tickCareerPathMatch(save);
      }
      const avgRating = rating ?? 5.0;
      promotion = checkPathPromotion(save, avgRating);
      synchronizeCareerPromotion(save, promotion);
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

    if (ref?.mode === 'career' && selected && perf) {
      const playerTeamId = resultUserTeamId ?? match.homeTeamId;
      const opponentId = playerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
      const year = resultFixture
        ? (save.seasons[resultFixture.seasonId]?.year ?? 2026)
        : save.currentSeasonId
          ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
          : 2026;
      recordPlayerLifeMatch(save, {
        id: match.id,
        year,
        opponent: save.teams[opponentId]?.name ?? 'the opposition',
        competition:
          resultFixture?.cupRound ??
          resultFixture?.competitionId ??
          resultFixture?.competition ??
          'Domestic cricket',
        format: match.format,
        runs: perf.runs,
        wickets: perf.wickets,
        rating: rating ?? matchRating(perf),
        result: tie ? 'D' : userWon ? 'W' : 'L',
        international: isInternational,
      });
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
    // A team result while the protagonist is outside the XI must not replace
    // their personal "last match" or Current Form presentation.
    if (ref?.mode !== 'career' || selected) experience.lastMatchImpact = impact;
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
    validateSeasonState(save);
    prepareInternationalCalendar(save);
    const fixtureId = nextInternationalFixtureId(save);
    if (!fixtureId || !playerCalendarAllowsFixture(save, fixtureId)) return null;
    resolveNationalDutyConflict(save, fixtureId);
    const live = createLiveMatch(save, fixtureId, save.userPlayerId);
    return { live };
  },

  commitInternational: (match) => {
    const { save } = get();
    if (!save || !save.userPlayerId) return null;
    const experienceBefore = captureExperienceSnapshot(save);
    const user = save.players[save.userPlayerId];
    const country =
      save.playerCareerResources?.cappedCountry ??
      save.playerCareerResources?.declaredCountry ??
      user.nationality;
    const scheduledFixture = save.fixtures[match.id];
    // International results must obey the same exactly-once contract as club
    // fixtures. The previous path continued awarding caps, form and coins even
    // when the scheduled fixture had already been completed.
    if (!scheduledFixture || scheduledFixture.played || hasRecordedSaveResult(save, match.id)) {
      if (scheduledFixture && hasRecordedSaveResult(save, match.id)) {
        scheduledFixture.played = true;
        scheduledFixture.resultMatchId ??= match.id;
      }
      return null;
    }
    applyResult(save, match);
    const homeId = scheduledFixture?.homeTeamId ?? `national-${country}`;
    const userWon = match.result?.winnerTeamId === homeId;
    const tie = matchHasNeutralResult(match);
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
    const resources = ensurePlayerCareerResources(save);
    if (resources && !resources.cappedCountry) {
      resources.cappedCountry = resources.declaredCountry;
    }
    if (scheduledFixture) {
      const releasedFixtures = releaseFromInternationalTourIfOutOfForm(save, scheduledFixture);
      simulateInternationalFixturesWithoutUser(save, releasedFixtures);
    }
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
    applyNearRecordSelectionBoost(save, { runs: perf.runs, wickets: perf.wickets });
    save.wallet = spendSaveEnergy(save, matchEnergyCost(match.format, 'INTERNATIONAL'));
    save.wallet = addCoins(save.wallet, coinsAwarded + bonus);
    recordMatchLiveops(save, userWon, perf.runs, perf.wickets, perf.fours + perf.sixes);
    {
      releaseDeferredStoryAfterMatch(save);
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
      settleFixtureSponsorship(save, scheduledFixture, { selected: true, userWon });
    }
    if (!scheduledFixture) {
      applyMatchToStats(save, match);
      const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
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
    {
      const opponentId = homeId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
      const year = scheduledFixture
        ? (save.seasons[scheduledFixture.seasonId]?.year ?? 2026)
        : save.currentSeasonId
          ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
          : 2026;
      recordPlayerLifeMatch(save, {
        id: match.id,
        year,
        opponent: save.teams[opponentId]?.name ?? 'the opposition',
        competition:
          scheduledFixture?.cupRound ??
          scheduledFixture?.competitionId ??
          scheduledFixture?.competition ??
          'International cricket',
        format: match.format,
        runs: perf.runs,
        wickets: perf.wickets,
        rating,
        result: tie ? 'D' : userWon ? 'W' : 'L',
        international: true,
      });
    }
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
    if (!canTrain(player, group, save.careerPathLevel)) {
      return fail('No training sessions left for this discipline.');
    }
    const cost = trainingCost(sessionsDone(player), computeOverall(player), player.role);
    if (save.wallet.coins < cost) {
      return fail(`You need ${cost.toLocaleString()} coins for this session.`, cost);
    }
    const rng = makeRng((Date.now() ^ (sessionsDone(player) * 2654435761)) >>> 0);
    const acceleratorCharges = inventoryCount(save, 'training_accelerator');
    const normalTrainingMultiplier =
      archetypeTrainingMultiplier(save, player, group) *
      passTrainingMultiplier(save) *
      personalCoachTrainingMultiplier(save, group);
    const gains = applyTraining(
      player,
      group,
      rng,
      save.careerPathLevel,
      normalTrainingMultiplier * (acceleratorCharges > 0 ? 1.5 : 1),
    );
    if (gains.length === 0) {
      return fail('This focus has reached the attribute cap for your current career stage.', cost);
    }
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
      await get().persistCritical();
      return { ok: true, cost, gains };
    } catch {
      return fail('Training was applied but could not be saved. Try saving again.', cost);
    }
  },

  setTactics: (tactics, activeFixtureId) => {
    const save = get().save;
    if (!save) return;
    const fixtureId = activeFixtureId ?? nextUserFixtureId(save);
    const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
    if (activeFixtureId && (!fixture || fixture.played)) return;
    if (!matchDecisionAuthority(save, fixture).canControlTeam) return;
    save.tactics = tactics;
    if (save.mode === 'manager') {
      if (fixtureId) {
        save.flags = { ...(save.flags ?? {}), [`tactics:${fixtureId}`]: true };
      }
    }
    set({ save: { ...save } });
    void get().persist();
  },

  reorderXI: (playerIds) => {
    const save = get().save;
    if (!save) return;
    const fixtureId = nextUserFixtureId(save);
    const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
    if (!matchDecisionAuthority(save, fixture).canControlTeam) return;
    const teamId =
      save.mode === 'manager'
        ? managerControlledTeamId(save)
        : careerPlayingTeamId(save, fixtureId);
    if (!teamId || !save.teams[teamId]) return;
    save.teams[teamId].playerIds = playerIds;
    set({ save: { ...save } });
    void get().persist();
  },

  setXI: (ids) => {
    const save = get().save;
    if (!save) return;
    const fixtureId = nextUserFixtureId(save);
    const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
    if (!matchDecisionAuthority(save, fixture).canControlTeam) return;
    const teamId =
      save.mode === 'manager'
        ? managerControlledTeamId(save)
        : careerPlayingTeamId(save, fixtureId);
    if (!teamId || !save.teams[teamId]) return;
    save.teams[teamId].xi = ids;
    set({ save: { ...save } });
    void get().persist();
  },

  signPlayer: (playerId, feeOverride) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club transfers are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, recouped: 0, reason: 'Club operations are paused during national duty.' };
    }
    const res = releaseFromSquad(save, playerId);
    if (res.ok) {
      if (save.mode === 'manager') ensureManagerLeadership(save);
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  removeFreeAgent: (playerId) => {
    const save = get().save;
    if (!save?.freeAgents?.includes(playerId)) return;
    if (managerClubOperationsPaused(save)) return;
    save.freeAgents = save.freeAgents.filter((id) => id !== playerId);
    set({ save: { ...save } });
    void get().persist();
  },

  investStaff: (role) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club staff are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club staff are paused during national duty.' };
    }
    const res = hireStaffPure(save, candidateId);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  useManagerResource: (action, targetPlayerId) => {
    const save = get().save;
    if (!save) {
      return {
        ok: false,
        action,
        currency: action === 'ELITE_STAFF_SEARCH' ? 'gems' : 'coins',
        cost: 0,
        reason: 'No active save.',
      };
    }
    const result = executeManagerResourceAction(save, action, targetPlayerId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  upgradeFacilityLevel: (kind, paymentMethod) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club facilities are paused during national duty.' };
    }
    const res = upgradeFacility(save, kind, paymentMethod);
    if (res.ok) {
      if (paymentMethod === 'TOKEN') {
        recordPremiumAssistance(save, 'facility_upgrade_token');
      }
      persistActiveManagerClub(save);
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  setTicketPreset: (format, preset) => {
    const save = get().save;
    if (!save || !setClubTicketPreset(save, format, preset)) return false;
    set({ save: { ...save } });
    void get().persist();
    return true;
  },

  upgradeStadium: () => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const result = upgradeStadiumCapacity(save);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  upgradeMatchday: () => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    const result = upgradeMatchdayExperience(save);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  scout: (playerId) => {
    const save = get().save;
    if (!save) return { ok: false, cost: 0, reason: 'No active save.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club scouting is paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, reason: 'Club academy operations are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, reason: 'Club academy operations are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club contracts are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) return;
    setTrainingFocus(save, playerId, group);
    set({ save: { ...save } });
    void get().persist();
  },

  setManagerTrainingPlan: (update) => {
    const save = get().save;
    if (!save || !setManagerTeamTraining(save, update)) return false;
    set({ save: { ...save } });
    void get().persist();
    return true;
  },

  setManagerTrainingOverride: (playerId, focus) => {
    const save = get().save;
    if (!save || !setManagerPlayerTrainingOverride(save, playerId, focus)) return false;
    set({ save: { ...save } });
    void get().persist();
    return true;
  },

  appointManagerLeader: (role, playerId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const result = appointManagerLeaderPure(save, role, playerId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
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
    const result = applyManagerAppointment(save, teamId);
    if (!result.ok) return;
    ensureManagerLeadership(save);
    set({ save: { ...save }, targetFixtureId: undefined });
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
    if (!save?.managerCalendar || save.managerRetired) return null;
    const result = advanceManagerCalendarPhase(save, maxFixtures);
    set({ save: { ...save } });
    if (result.kind !== 'IN_PROGRESS') void get().persist();
    return result;
  },

  newSeason: () => {
    const { save, ref } = get();
    if (!save) return;
    if (save.mode === 'manager' && save.managerRetired) return;
    if (!seasonComplete(save)) return;
    // Capture the assignment that owned the completed season before promotion
    // changes the current level. This is the settlement boundary: the ELITE
    // season that earns a National appointment still belongs to the club,
    // while a full subsequent National season must leave that club untouched.
    const finishedManagerLevel: ManagerCareerLevel | undefined =
      save.mode === 'manager' ? (save.managerCareerLevel ?? 'CLUB') : undefined;
    const finishedNationalManagerSeason = finishedManagerLevel === 'NATIONAL';
    const finishedYear = save.currentSeasonId
      ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
      : 2026;
    const finishedLeagueName = Object.values(save.leagues)[0]?.name ?? 'League Championship';
    const trophyCountsBefore = {
      league: save.leagueTitles ?? 0,
      cup: save.cupWins ?? 0,
      continental: save.continentalTitles ?? 0,
    };
    const trophyEligible = ref?.mode === 'manager' || careerTrophyParticipationRate(save) >= 0.4;
    const finishedManagedTeamId = finishedNationalManagerSeason
      ? save.managerNationalTeamId
      : ref?.mode === 'career'
        ? (save.franchiseTeamId ?? save.userTeamId)
        : save.userTeamId;
    const userSeasonFixtures = finishedManagedTeamId
      ? Object.values(save.fixtures).filter(
          (fixture) =>
            fixture.played &&
            (fixture.homeTeamId === finishedManagedTeamId ||
              fixture.awayTeamId === finishedManagedTeamId),
        )
      : [];
    const allMatchesWon =
      userSeasonFixtures.length > 0 &&
      userSeasonFixtures.every((fixture) => fixture.winnerTeamId === finishedManagedTeamId);
    // Settle the Cup: crown a winner and credit a title if it's the user's club.
    if (!finishedNationalManagerSeason) finishCup(save);
    if (
      !finishedNationalManagerSeason &&
      cupChampionId(save) === save.userTeamId &&
      trophyEligible
    ) {
      save.cupWins = (save.cupWins ?? 0) + 1;
    }
    // Career: reflect on the finished season + tick endorsement deals before aging.
    if (ref?.mode === 'career' && save.userPlayerId) {
      const completedContract = save.players[save.userPlayerId]?.contract;
      const seasonSalary = Math.max(0, Math.round(completedContract?.wage ?? 0));
      if (seasonSalary > 0 && (completedContract?.yearsLeft ?? 0) > 0) {
        save.wallet = addCoins(save.wallet, seasonSalary);
      }
      const franchiseSalary = Math.max(0, Math.round(save.franchiseContract?.wage ?? 0));
      if (franchiseSalary > 0 && (save.franchiseContract?.yearsLeft ?? 0) > 0) {
        save.wallet = addCoins(save.wallet, franchiseSalary);
      }
      if (save.franchiseContract) {
        save.franchiseContract.yearsLeft = Math.max(0, save.franchiseContract.yearsLeft - 1);
      }
      tickUserContract(save);
      const rng = storyRng(save, (save.seasonRatings?.length ?? 0) + 41);
      // Settle the rivalry on this season's stats BEFORE they're reset.
      const rivalryLine = settleRivalrySeason(save);
      if (rivalryLine) addTimeline(save, { year: finishedYear, kind: 'STORY', text: rivalryLine });
      queueStoryForTrigger(save, 'SEASON_END', rng);
      rolloverSponsors(save);
      rolloverSponsorship(save);

      // Personal finance: collect academy revenue + fluctuate stock market.
      collectAcademyRevenue(save);
      processPlayerLifeSeason(save, finishedYear);
      tickStockMarket(save, finishedYear);

      // Age-triggered retirement uses appearances earned during this season,
      // not the player's cumulative career total.
      const capsThisSeason = closeInternationalCapSeason(save);
      const ageRetire = checkAgeRetirement(save, capsThisSeason);
      const retirementWasRecommended = Boolean(save.flags.playerRetirementRecommended);
      save.flags.playerRetirementRecommended = ageRetire;
      if (ageRetire && !retirementWasRecommended) {
        // Queue a retirement-nudge story event.
        queueStoryForTrigger(save, 'SEASON_END', rng, { runs: 0, wickets: 0, won: false });
        // Add a timeline entry.
        addTimeline(save, {
          year: finishedYear,
          kind: 'STORY',
          text: 'A decision about the final chapter now awaits.',
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
    if (ref?.mode === 'manager' && !finishedNationalManagerSeason) rolloverSponsorship(save);
    // Evaluate promotion against the completed assignment, but keep that old
    // level active until its club accounts/titles have been settled.
    let managerPromotion: ReturnType<typeof checkManagerLevelPromotion> | undefined;
    if (ref?.mode === 'manager' && !finishedNationalManagerSeason) {
      updateManagerReputation(save, { includeCompletedSeason: true });
      managerPromotion = checkManagerLevelPromotion(save);
    }

    startNewSeason(save, {
      finishedManagerLevel,
      promoteManagerTo:
        managerPromotion?.promoted && managerPromotion.to ? managerPromotion.to : undefined,
    }); // rebuilds fixtures (wipes last season's cup ties)
    if (ref?.mode === 'career' && playerRetirementAssessment(save).mandatory) {
      finalizePlayerRetirement(save, finishedYear + 1);
    }
    if (ref?.mode === 'manager') updateManagerReputation(save);
    if (managerPromotion?.promoted && managerPromotion.to) {
      // Queue a boardroom story event to announce the new role.
      const prng = storyRng(save, (save.managerStory?.seenEventIds.length ?? 0) + 999);
      queueManagerEvent(save, 'SEASON_END', prng);
    }
    const seasonAchievements = checkSeasonAchievements(save, {
      leagueWon: (save.leagueTitles ?? 0) > trophyCountsBefore.league,
      cupWon: (save.cupWins ?? 0) > trophyCountsBefore.cup,
      continentalWon: (save.continentalTitles ?? 0) > trophyCountsBefore.continental,
      allMatchesWon,
    });
    if (seasonAchievements.length) {
      const gemGain = seasonAchievements.reduce(
        (sum, id) => sum + achievementGemReward(getAchievement(id)?.tier ?? 'bronze'),
        0,
      );
      if (gemGain > 0) save.wallet = addGems(save.wallet, gemGain);
    }
    if (ref?.mode === 'career' && save.userPlayerId && !save.players[save.userPlayerId]?.retired) {
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
    // Career: independent domestic and franchise approaches for the new season.
    if (ref?.mode === 'career' && save.userPlayerId && !save.players[save.userPlayerId]?.retired) {
      recoverCareerOffSeason(save);
      ensureRival(save);
      const arng = storyRng(save, (save.timeline?.length ?? 0) + 97);
      const offers = generateAuctionOffers(save, arng);
      save.auctionOffers = offers.length ? offers : undefined;
      const domesticRng = storyRng(save, (save.timeline?.length ?? 0) + 149);
      const domesticOffers = generateDomesticClubOffers(save, domesticRng);
      save.domesticClubOffers = domesticOffers.length ? domesticOffers : undefined;
    }
    // Manager: wages/upkeep, youth intake and contracts. Gate receipts were
    // already credited by the canonical per-fixture result pipeline.
    if (ref?.mode === 'manager' && save.userTeamId && !finishedNationalManagerSeason) {
      const rng = storyRng(save, (save.currentSeasonId?.length ?? 0) + 71);
      const team = save.teams[save.userTeamId];
      const staffWages = staffWageBill(save);
      const stadium = save.managerClubs?.[save.userTeamId]?.stadium;
      const upkeep = facilityMaintenance(save) + (stadium ? stadiumSeasonUpkeep(stadium) : 0);
      settleManagerSeason(save, rng, { finishedManagerLevel, finishedYear });
      if (save.lastSeasonSettlement) {
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
    set({
      save: { ...save },
      pendingAchievementIds: seasonAchievements.length
        ? [...get().pendingAchievementIds, ...seasonAchievements]
        : get().pendingAchievementIds,
    });
    void get().persist();
  },

  acceptAuctionOffer: (teamId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No save.' };
    const agreedOffer = save.auctionOffers?.find(o => o.teamId === teamId);
    const res = applyAcceptOffer(save, teamId);
    if (res.ok) {
      if (agreedOffer && save.franchiseContract) presentSignedPlayerContract(save, teamId, {
        wage: save.franchiseContract.wage, years: save.franchiseContract.yearsLeft,
        signingBonus: agreedOffer.signingBonus,
      });
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

  acceptDomesticClubOffer: (teamId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No save.' };
    const agreedOffer = save.domesticClubOffers?.find(o => o.teamId === teamId);
    const result = applyAcceptDomesticClubOffer(save, teamId);
    if (result.ok) {
      const contract = save.userPlayerId ? save.players[save.userPlayerId]?.contract : undefined;
      if (agreedOffer && contract) presentSignedPlayerContract(save, teamId, {
        wage: contract.wage, years: contract.yearsLeft, signingBonus: agreedOffer.signingBonus,
      });
      analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { domesticMove: true });
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  declineDomesticClubOffers: () => {
    const save = get().save;
    if (!save) return;
    applyDeclineDomesticClubOffers(save);
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
    const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
    const retirement = finalizePlayerRetirement(save, year);
    if (!retirement) return null;
    set({ save: { ...save } });
    void get().persist();
    return retirement;
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
    presentSignedPlayerContract(save, save.userTeamId, offer);
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
    const reward = streakReward(newStreak, save.mode);
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
    if (save.mode === 'manager') updateManagerReputation(save);
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

  qaGrantWhaleCoins: async () => {
    if (!QA_TOOLS_ENABLED) return { ok: false, reason: 'QA tools are unavailable.' };
    const activeSave = get().save;
    const activeRef = get().ref;

    try {
      const savesBySlot = new Map(
        (await listAllSaves()).map((entry) => [`${entry.mode}:${entry.slot}`, entry] as const),
      );

      // The active store can be newer than its last AsyncStorage write. Use it
      // for that slot so a QA grant can never roll recent gameplay backwards.
      if (activeSave && activeRef) {
        savesBySlot.set(`${activeRef.mode}:${activeRef.slot}`, {
          mode: activeRef.mode,
          slot: activeRef.slot,
          save: activeSave,
        });
      }

      const entries = [...savesBySlot.values()];
      if (entries.length === 0) return { ok: false, reason: 'No Player or Manager saves found.' };

      const previousWallets = new Map(
        entries.map((entry) => [`${entry.mode}:${entry.slot}`, entry.save.wallet] as const),
      );
      for (const entry of entries) {
        entry.save.wallet = addCoins(entry.save.wallet, QA_WHALE_COINS);
      }
      if (activeSave) set({ save: { ...activeSave } });

      const written: typeof entries = [];
      try {
        for (const entry of entries) {
          await writeSave(entry.mode, entry.slot, entry.save);
          written.push(entry);
        }
        if (activeRef) await setLastPlayed(activeRef.mode, activeRef.slot);
      } catch {
        for (const entry of entries) {
          const previousWallet = previousWallets.get(`${entry.mode}:${entry.slot}`);
          if (previousWallet) entry.save.wallet = previousWallet;
        }
        if (activeSave) set({ save: { ...activeSave } });
        await Promise.allSettled(
          written.map((entry) => writeSave(entry.mode, entry.slot, entry.save)),
        );
        return { ok: false, reason: 'The device did not save every QA coin balance.' };
      }

      return {
        ok: true,
        balance: activeSave?.wallet.coins,
        savesUpdated: entries.length,
        playerSavesUpdated: entries.filter((entry) => entry.mode === 'career').length,
        managerSavesUpdated: entries.filter((entry) => entry.mode === 'manager').length,
      };
    } catch {
      return { ok: false, reason: 'The device could not load the saved careers.' };
    }
  },

  qaGrantClubBudget: async () => {
    if (!QA_TOOLS_ENABLED) return { ok: false, reason: 'QA tools are unavailable.' };
    const save = get().save;
    if (!save || save.mode !== 'manager' || !save.userTeamId) {
      return { ok: false, reason: 'Open a domestic Manager Career first.' };
    }
    if (save.managerCareerLevel === 'NATIONAL') {
      return { ok: false, reason: 'Club finances are paused during national duty.' };
    }
    const team = save.teams[save.userTeamId];
    if (!team) return { ok: false, reason: 'The managed club could not be found.' };
    const previousBudget = team.budget;
    team.budget = Math.max(0, Math.round(team.budget + QA_WHALE_CLUB_BUDGET));
    if (save.finances) save.finances.transferBudget = team.budget;
    const club = persistActiveManagerClub(save);
    if (club) club.finances.transferBudget = team.budget;
    set({ save: { ...save } });
    try {
      await get().persistCritical(true);
      return { ok: true, balance: team.budget };
    } catch {
      team.budget = previousBudget;
      if (save.finances) save.finances.transferBudget = previousBudget;
      const restoredClub = persistActiveManagerClub(save);
      if (restoredClub) restoredClub.finances.transferBudget = previousBudget;
      set({ save: { ...save } });
      return { ok: false, reason: 'The device did not save the QA club budget.' };
    }
  },

  qaRefillEnergy: () => {
    if (!QA_TOOLS_ENABLED) return false;
    const save = get().save;
    if (!save || save.mode !== 'career') return false;
    refillQaEnergy(save);
    set({ save: { ...save } });
    void get().persist();
    return true;
  },

  claimPass: () => {
    const save = get().save;
    if (!save) {
      return {
        coins: 0,
        count: 0,
        previousCoins: 0,
        newCoins: 0,
        items: [],
      };
    }
    ensureLiveops(save);
    const previousCoins = save.wallet.coins;
    const claimable = claimablePassRewards(save.pass!);
    let coins = 0;
    let count = 0;
    const items: string[] = [];
    for (const c of claimable) {
      const tier = passTiersForMode(save.mode).find((t) => t.tier === c.tier);
      if (!tier) continue;
      const reward = c.premium ? tier.premiumReward : tier.freeReward;
      count += 1;
      coins += reward.coins ?? 0;
      const track = c.premium ? 'Premium' : 'Free';
      const rewardParts: string[] = [];
      if (reward.coins) rewardParts.push(`🪙 +${reward.coins} Coins`);
      // Legacy crates still open immediately. New pass cosmetics are durable
      // inventory items that can be equipped in the Premium Clubhouse.
      if (reward.item) {
        if (reward.item.startsWith('crate_')) {
          const loot = crateContents(reward.item);
          coins += loot.coins;
          rewardParts.push(`🪙 +${loot.coins} Coins`);
        }
        rewardParts.push(`🎁 1x ${PASS_ITEM_LABELS[reward.item] ?? 'Pass item'}`);
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
    set({ save: { ...save } });
    void get().persist();
    return {
      coins,
      count,
      previousCoins,
      newCoins: save.wallet.coins,
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
    if (!save) return { ok: false, coins: 0, reason: 'No active save.' };
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

  convertPlayerGems: async (gems) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'Gem exchange is available only in Player Career.' };
    }
    const spend = Math.max(0, Math.floor(gems));
    if (!(PLAYER_GEM_CONVERSION_PRESETS as readonly number[]).includes(spend)) {
      return { ok: false, reason: 'Choose one of the available exchange amounts.' };
    }
    if (save.wallet.gems < spend) {
      return { ok: false, reason: `You need ${spend} gems for this exchange.` };
    }
    const previousWallet = { ...save.wallet };
    const nextWallet = convertPlayerGemsToCoins(save.wallet, spend);
    if (!nextWallet) return { ok: false, reason: 'The exchange could not be completed.' };
    const coins = playerGemConversionCoins(spend);
    save.wallet = nextWallet;
    set({ save: { ...save } });
    try {
      await get().persistCritical();
      return { ok: true, gems: spend, coins };
    } catch {
      save.wallet = previousWallet;
      set({ save: { ...save } });
      return { ok: false, reason: 'The exchange was not saved. No gems were spent.' };
    }
  },

  applySquadRecovery: (payment, transactionId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active manager squad.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, reason: 'Club recovery is paused during national duty.' };
    }
    const teamId = save.mode === 'manager' ? managerControlledTeamId(save) : save.userTeamId;
    if (!teamId || !save.teams[teamId]) {
      return { ok: false, reason: 'No active manager squad.' };
    }
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

    const team = save.teams[teamId];
    for (const id of team.playerIds) {
      const p = save.players[id];
      if (!p || p.injury) continue;
      const currentFitness = Math.max(0, Math.min(100, p.meta.fitness ?? 70));
      const currentCondition = Math.max(0, Math.min(100, p.condition ?? p.meta.fitness ?? 70));
      p.meta.fitness = fullFitness ? 100 : Math.min(100, currentFitness + 20);
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club scouting is paused during national duty.' };
    }
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
      scoutedYear: save.seasons[save.currentSeasonId ?? '']?.year ?? new Date().getFullYear(),
      recommended: player.overall >= 68 && player.meta.form >= 42,
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
    save.cosmetics = {
      ...selection,
      avatarConfig: selection.avatarConfig
        ? normalizeAvatarConfig({
            ...selection.avatarConfig,
            ...(selection.profileFrame ? { frameId: selection.profileFrame } : {}),
          })
        : undefined,
    };
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
      'scout_full_reveal',
      'facility_upgrade_token',
      'recovery_pack',
      'manager_legend_pack',
      'manager_save_sponsor',
    ]);
    const careerOnlyProducts = new Set([
      'contract_boost',
      'form_recovery',
      'training_accelerator',
      'bundle_legend',
      'player_save_sponsor',
    ]);
    if (managerOnlyProducts.has(productId) && currentSave.mode !== 'manager') {
      return { ok: false, error: 'manager_save_required' };
    }
    if (
      (productId === 'transfer_budget_sm' || productId === 'manager_legend_pack') &&
      managerClubOperationsPaused(currentSave)
    ) {
      return { ok: false, error: 'club_operations_paused' };
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
    if (
      (productId === 'player_save_sponsor' || productId === 'manager_save_sponsor') &&
      currentSave.sponsorship?.premium
    ) {
      return { ok: false, error: 'already_owned_for_save' };
    }
    if (purchases.isSaveSponsorProduct(productId) && !premiumSponsorStoreUnlocked(currentSave)) {
      return { ok: false, error: 'sponsorship_not_unlocked' };
    }
    if (purchases.isSaveSponsorProduct(productId) && !purchases.isSaveSponsorCheckoutReady()) {
      return { ok: false, error: 'save_sponsor_checkout_not_ready' };
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
    const seasonLimitedBudgetProduct = productId === 'transfer_budget_sm';
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
    if (save.id !== currentSave.id) return { ok: false, error: 'active_save_changed' };
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
        await get().persistCritical(true);
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
    if (productId === 'player_save_sponsor' || productId === 'manager_save_sponsor') {
      const sponsorGrant = grantPremiumSponsorToCurrentSave(
        save,
        productId,
        ledgerEntry.purchaseToken,
      );
      if (!sponsorGrant.ok) return { ok: false, error: 'premium_sponsor_grant_failed' };
    }
    // First-purchase bonus: DOUBLE the gems on the player's first-ever
    // gem-bearing purchase (this is the store's advertised "2× gems"). Only
    // consumed when a gem bonus is actually granted, so buying a gem-less item
    // first (e.g. Remove Ads) doesn't silently waste the bonus.
    if (
      !save.flags?.['promo:first_gem_pack_bonus'] &&
      (productId === 'gems_medium' || productId === 'gems_large')
    ) {
      const bonusGems = grant.gems ?? 0;
      if (bonusGems > 0) {
        save.wallet = addGems(save.wallet, bonusGems); // extra 1× on top of the base grant
        save.flags = { ...(save.flags ?? {}), 'promo:first_gem_pack_bonus': true };
      }
    }
    set({ save: { ...save } });
    try {
      await get().persistCritical(true);
      if (productId === 'starter_pack') {
        await accountPurchases.markStarterPackPurchased(ledgerEntry.purchaseToken);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'persistence_failed' };
    }
  },

  restorePurchases: async () => {
    const activeSave = get().save;
    if (!activeSave) {
      return { status: 'NO_SAVE', count: 0, productIds: [] };
    }
    const activeSaveId = activeSave.id;
    const providerResult = await purchases.restore();
    if (providerResult.status !== 'RESTORED') {
      return {
        status: providerResult.status,
        count: 0,
        productIds: [],
        error: providerResult.error,
      };
    }
    const save = get().save;
    if (!save || save.id !== activeSaveId) {
      return { status: 'ACTIVE_SAVE_CHANGED', count: 0, productIds: [] };
    }
    const restoredProductIds: string[] = [];
    for (const r of providerResult.purchases) {
      if (!r.ok) continue;
      if (r.productId === 'remove_ads') {
        save.entitlements.removeAds = true;
        restoredProductIds.push(r.productId);
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
        restoredProductIds.push(r.productId);
      }
      if (
        r.productId === 'manager_legend_pack' &&
        save.mode === 'manager' &&
        !managerClubOperationsPaused(save)
      ) {
        applyManagerLegendBacking(save);
        restoredProductIds.push(r.productId);
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
        restoredProductIds.push(r.productId);
      }
    }
    const productIds = Array.from(new Set(restoredProductIds));
    if (productIds.length === 0) {
      return { status: 'NOTHING_APPLICABLE', count: 0, productIds: [] };
    }
    set({ save: { ...save } });
    try {
      await get().persistCritical(true);
    } catch {
      return {
        status: 'PERSISTENCE_FAILED',
        count: 0,
        productIds: [],
        error: 'persistence_failed',
      };
    }
    return { status: 'RESTORED', count: productIds.length, productIds };
  },

  clearPendingAchievements: () => set({ pendingAchievementIds: [] }),
  clear: () => set({ save: null, ref: null, pendingAchievementIds: [], persistenceError: null }),

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
    if (
      !save ||
      ref?.mode !== 'career' ||
      !save.userPlayerId ||
      hasRecordedSaveResult(save, match.id)
    ) {
      return null;
    }
    const experienceBefore = captureExperienceSnapshot(save);
    const challenge = save.activeDailyChallenge;
    const userWon = match.result?.winnerTeamId === match.homeTeamId;
    const tie = matchHasNeutralResult(match);
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
    refillQaEnergy(save);
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
      save.wallet = addGems(save.wallet, 10);
      reward = { gems: 10, title: '7-Day VIP Streak!' };
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
  investStocksAction: (companyId, coins) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = investInStockCompany(save, companyId, coins);
    if (res.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return res;
  },

  withdrawStocksAction: (companyId, coins) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const result = sellStockCompany(save, companyId, coins);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
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

  transferPlayerBank: (direction, amount) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = transferPlayerBank(save, direction, amount);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  buyPlayerAsset: (kind, assetId) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = buyPlayerAsset(save, kind, assetId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  hirePersonalCoach: (discipline) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = hirePersonalCoach(save, discipline);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  buyPlayerEquipment: (equipmentId) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = buyPlayerEquipment(save, equipmentId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  bookPersonalPhysio: () => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = bookPersonalPhysio(save);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  buyPerformanceAnalysis: () => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = buyPerformanceAnalysis(save, nextUserFixtureId(save));
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  acceptEarnedSponsorOffer: (offerId) => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    if (managerClubOperationsPaused(save)) {
      return { ok: false, reason: 'Club sponsorship is paused during national duty.' };
    }
    const result = acceptSponsorshipOffer(save, offerId);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  publishPlayerSocialPost: (tone) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = publishPlayerSocialPost(save, tone);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  prepareCaptainIssue: () => {
    const save = get().save;
    if (!save || save.mode !== 'career') return undefined;
    const issue = ensureCaptainIssue(save);
    if (issue) {
      set({ save: { ...save } });
      void get().persist();
    }
    return issue;
  },

  resolveCaptainIssue: (resolution) => {
    const save = get().save;
    if (!save || save.mode !== 'career') {
      return { ok: false, reason: 'No active player career.' };
    }
    const result = resolveCaptainIssue(save, resolution);
    if (result.ok) {
      set({ save: { ...save } });
      void get().persist();
    }
    return result;
  },

  importCareerBackup: async (raw) => {
    const current = get().save;
    const ref = get().ref;
    if (!current || !ref || ref.mode !== 'career') {
      return { ok: false, reason: 'Open a Player Career slot before importing.' };
    }
    const payload = raw.trim();
    if (payload.length < 20 || payload.length > 8_000_000) {
      return { ok: false, reason: 'That transfer code is empty or too large.' };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return { ok: false, reason: 'The transfer code is not valid JSON.' };
    }
    const imported = runMigrations(parsed);
    if (
      !imported ||
      imported.mode !== 'career' ||
      !imported.userPlayerId ||
      !imported.players?.[imported.userPlayerId] ||
      !imported.currentSeasonId ||
      !imported.seasons?.[imported.currentSeasonId]
    ) {
      return { ok: false, reason: 'This is not a valid Player Career backup.' };
    }
    // Purchases remain account-authoritative. A pasted save can restore career
    // progress, but it cannot manufacture store entitlements.
    imported.entitlements = current.entitlements;
    imported.firstPurchaseDone = current.firstPurchaseDone;
    // A permanent sponsor is a verified, non-restorable purchase tied to one
    // save. Transfer JSON cannot clone or move it into another save identity.
    const preservedPremium =
      imported.id === current.id && current.sponsorship?.premium?.boundSaveId === current.id
        ? current.sponsorship.premium
        : undefined;
    if (preservedPremium) ensureSponsorshipState(imported).premium = preservedPremium;
    else if (imported.sponsorship) imported.sponsorship.premium = undefined;
    imported.updatedAt = Date.now();
    validateSeasonState(imported);
    get().setActive(imported, 'career', ref.slot);
    try {
      await get().persistCritical(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'The career was read but could not be saved to this slot.' };
    }
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club loans are paused during national duty.' };
    }
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
    if (managerClubOperationsPaused(save)) return false;
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
    if (managerClubOperationsPaused(save)) {
      return { ok: false, cost: 0, reason: 'Club contracts are paused during national duty.' };
    }
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
      text: `Signed a new ${signedOffer.years}-year deal worth ${signedOffer.wage.toLocaleString()} coins per season.`,
    });
    set({ save: { ...save } });
    void get().persist();
    presentSignedPlayerContract(save, save.userTeamId, signedOffer);
    return { ok: true, bonus, offer: signedOffer };
  },

  // ── Manager headhunt ──────────────────────────────────────────────────────
  acceptManagerJobOffer: () => {
    const save = get().save;
    if (!save) return { ok: false, reason: 'No active save.' };
    const res = acceptManagerJob(save);
    if (res.ok) {
      ensureManagerLeadership(save);
      analytics.logEvent(analytics.EVT.SEASON_ROLLOVER, { managerJobMove: true });
      set({ save: { ...save }, targetFixtureId: undefined });
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

  acknowledgeManagerAppointment: () => {
    const save = get().save;
    if (!save?.managerAppointmentPending) return;
    save.managerAppointmentPending = undefined;
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
