/**
 * Canonical game data model — implements PART 2 of docs/AI_BUILD_SPEC.md.
 *
 * This is the single source of truth for the match engine, content generation,
 * economy and (progressively) the UI. Any change to a persisted shape must bump
 * `SaveGame.schemaVersion` and add a migration (see src/storage).
 */

import type { AvatarConfig } from '../avatar/types';

// ---------- Core enums ----------
export type Format = 'T20' | 'ODI' | 'TEST' | 'HUNDRED' | 'T10';
export type Role = 'BATTER' | 'BOWLER' | 'ALLROUNDER' | 'WK_BATTER';
export type BattingStyle = 'RHB' | 'LHB';
export type BowlingStyle =
  'PACE' | 'MEDIUM' | 'OFF_SPIN' | 'LEG_SPIN' | 'LEFT_ARM_SPIN' | 'LEFT_ARM_PACE';
export type GameMode = 'career' | 'manager';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'PRO';
export type DomesticTier = 1 | 2 | 3;

// ---------- Attributes (0..100) ----------
export interface BattingAttrs {
  technique: number;
  timing: number;
  power: number;
  footwork: number;
  temperament: number;
  running: number;
}
export interface BowlingAttrs {
  paceOrSpin: number;
  accuracy: number;
  movement: number;
  variations: number;
  stamina: number;
}
export interface FieldingAttrs {
  catching: number;
  throwing: number;
  agility: number;
  keeping: number;
}
export interface MentalPhysical {
  fitness: number;
  form: number;
  confidence: number;
  aggression: number;
  discipline: number;
}

/** A playing contract (wage in club-budget units, plus remaining length). */
export interface Contract {
  wage: number;
  yearsLeft: number;
  releaseClause?: number;
}

/** Active injury; the player is unavailable until `matchesOut` reaches 0. */
export interface Injury {
  type: string;
  matchesOut: number;
  severity: 'KNOCK' | 'STRAIN' | 'SERIOUS';
}

export interface Player {
  id: string;
  name: string;
  nationality: string; // country id from data/countries.ts
  age: number;
  role: Role;
  battingStyle: BattingStyle;
  bowlingStyle?: BowlingStyle;
  batting: BattingAttrs;
  bowling: BowlingAttrs;
  fielding: FieldingAttrs;
  meta: MentalPhysical;
  potential: number; // hidden ceiling 0..100
  traits: string[]; // e.g. 'DEATH_SPECIALIST'
  overall: number; // derived, see engine/rating.ts (PART 3.1)
  isUserPlayer?: boolean; // career mode protagonist
  contractId?: string;
  seasonStats?: PlayerStats;
  careerStats?: PlayerStats;
  // ---- Career progression (optional; older saves default at runtime) ----
  trainingSessionsThisSeason?: number;
  trainingGroupSessionsThisSeason?: Partial<
    Record<
      'batting' | 'bowling' | 'fielding' | 'wicketkeeping' | 'fitness' | 'mental' | 'meta',
      number
    >
  >;
  awards?: string[];
  retired?: boolean;
  // ---- Depth (optional; default at runtime) ----
  morale?: number; // 0..100 happiness/mental state
  injury?: Injury; // undefined = fit
  contract?: Contract; // wage + years remaining
  hidden?: boolean; // youth prospect not yet promoted / undiscovered
  // ---- Loan system (Feature 1) ----
  loanedFrom?: string; // parent club id when on loan
  loanEnd?: number; // season year when loan expires
  // ---- Morale system (Feature 3) ----
  lastTalkDay?: number; // season-day index of most recent per-player talk (cooldown)
  // ---- Multi-format stats (Feature 4) ----
  formatStats?: Partial<Record<Format, PlayerStats>>; // per-format career stats
  seasonFormatStats?: Partial<Record<Format, PlayerStats>>; // current-season format totals
  domesticStats?: PlayerStats;
  internationalStats?: PlayerStats;
  /** Exact cricket-level/format records (separate from legacy combined Format totals). */
  competitionStats?: Partial<Record<CareerCompetitionStatScope, PlayerStats>>;
  // ---- Manager transfer premium actions ----
  buyoutEligible?: boolean;
  buyNowClubPrice?: number;
  buyoutGemFee?: number;
  buyoutWindowStatus?: 'OPEN' | 'BIDDING_STARTED' | 'CLOSED';
  buyoutExcludedReason?: string;
  retained?: boolean;
  marquee?: boolean;
  legendary?: boolean;
  /** Current match-readiness, separate from the permanent fitness attribute. */
  condition?: number; // 0..100; manager off-season restores this to 100
}

export type CareerCompetitionStatScope =
  | 'GRADE_A'
  | 'U19'
  | 'U19_WORLD_CUP'
  | 'DOMESTIC_T20'
  | 'LIST_A'
  | 'FIRST_CLASS'
  | 'HUNDRED'
  | 'T10'
  | 'T20I'
  | 'ODI'
  | 'TEST';

export interface PlayerStats {
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highScore: number;
  notOuts: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  bestBowling: string;
  catches: number;
  stumpings: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  country: string;
  primaryColor: string;
  secondaryColor: string;
  isUserTeam?: boolean;
  playerIds: string[]; // full squad (roster)
  xi?: string[]; // selected playing XI (11 ids, in batting order); auto-picked when absent
  budget: number;
  reputation: number;
  isNationalTeam?: boolean;
}

/** Which competition a fixture belongs to (a season can run several at once). */
export type Competition =
  'LEAGUE' | 'CUP' | 'PLAYOFF' | 'U19_WORLDCUP' | 'BILATERAL_SERIES' | 'INTL_TOURNAMENT';

export interface Fixture {
  id: string;
  seasonId: string;
  format: Format;
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  round: number;
  played: boolean;
  resultMatchId?: string;
  resultKind?: 'HOME_WIN' | 'AWAY_WIN' | 'TIE' | 'NO_RESULT';
  playoff?: boolean; // knockout (semi-final / final) — does not affect the league table
  winnerTeamId?: string; // recorded on completion (undefined on tie/draw), used to seed the bracket
  stadiumId?: string; // home venue (feeds pitch/scoring bias)
  competition?: Competition; // defaults to LEAGUE when absent
  cupRound?: string; // human label for cup ties (e.g. 'Quarter-Final')
  // ---- Multi-format domestic calendar (Feature 4) ----
  competitionId?: string; // links to SeasonCompetition.id ('t20-league', 'list-a', 'first-class')
  calendarMonth?: number; // 1-12 in-game month this match is played
  calendarWeek?: number; // 1-4, used to resolve domestic/international clashes
  divisionTier?: DomesticTier;
  managerPhase?: ManagerCalendarPhase;
  homePointsPenalty?: number;
  awayPointsPenalty?: number;
  /** Domestic players unavailable because an international fixture has priority. */
  nationalDutyPlayerIds?: string[];
  /** Rolling WTC cycle this Test contributes points to. */
  wtcCycleId?: string;
  wtcPointsRecorded?: boolean;
}

export interface League {
  id: string;
  name: string;
  format: Format;
  teamIds: string[];
  table: LeagueRow[];
  divisionTier?: DomesticTier;
}
export interface LeagueRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
}

/** A named competition within a season (multi-format domestic calendar). */
export interface SeasonCompetition {
  id: string; // e.g. 't20-league', 'list-a', 'first-class'
  name: string; // e.g. 'Premier T20 League'
  format: Format;
  leagueId: string;
  fixtureIds: string[];
}

export interface Season {
  id: string;
  year: number;
  leagueIds: string[];
  fixtureIds: string[];
  currentRound: number;
  /** Multi-format competitions for this season (Feature 4). Absent on old saves. */
  competitions?: SeasonCompetition[];
}

// ---------- Match (engine I/O) ----------
export type BallOutcome = 'DOT' | '1' | '2' | '3' | '4' | '6' | 'W' | 'WD' | 'NB' | 'BYE' | 'LB';

export interface Dismissal {
  type: 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED' | 'HIT_WICKET';
  bowlerId?: string;
  fielderId?: string;
}

export interface BallEvent {
  over: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  outcome: BallOutcome;
  runs: number;
  isWicket: boolean;
  dismissal?: Dismissal;
  commentary: string;
  // ---- Rich descriptors (not persisted; power commentary + wagon wheel) ----
  delivery?: string; // bowler's chosen ball (engine/deliveries.ts DeliveryType)
  shot?: string; // batter's stroke (engine/shots.ts ShotType)
  shotAngleDeg?: number; // physical wagon-wheel angle in degrees (−1 = no shot)
}

export interface BatterCard {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: Dismissal;
  battedOrder: number;
}

export interface BowlerCard {
  playerId: string;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface Innings {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  events: BallEvent[];
  batting: BatterCard[];
  bowling: BowlerCard[];
  target?: number;
}

export interface Conditions {
  pitch: 'GREEN' | 'DRY' | 'DUSTY' | 'FLAT' | 'CRACKED';
  weather: 'CLEAR' | 'OVERCAST' | 'HUMID';
}

export interface MatchResult {
  winnerTeamId?: string;
  margin: string;
  playerOfMatchId?: string;
  tie?: boolean;
}

export interface MatchState {
  id: string;
  seed: number;
  format: Format;
  conditions: Conditions;
  homeTeamId: string;
  awayTeamId: string;
  /** Actual resolved XIs used by the engine; optional for legacy match states. */
  homePlayerIds?: string[];
  awayPlayerIds?: string[];
  innings: Innings[];
  result?: MatchResult;
  /** User-decision evidence captured by the interactive match UI. */
  decisionImpacts?: MatchDecisionImpact[];
}

// ---------- Economy / Save ----------
export interface Wallet {
  coins: number;
  gems: number;
  /** Optional-activity capacity. Kept as `energy` for save compatibility; all
   *  player-facing copy and new code treats it as Training Focus. */
  energy: number;
  energyUpdatedAt: number;
}

export interface PremiumWalletState {
  accountCoins: number;
  gems: number;
  updatedAt: number;
  version: number;
}

export interface PremiumInventoryState {
  facilityUpgradeTokens: number;
  squadRecoveryTokens: number;
  scoutFullRevealTokens: number;
  contractBoostTokens: number;
  formRecoveryTokens: number;
  trainingAcceleratorCharges: number;
  otherConsumableCharges: Record<string, number>;
}

export interface StoredMoney {
  amountMinor: string;
  currencyCode: string;
}

export interface ClubFinanceTransaction {
  id: string;
  kind: 'TRANSFER' | 'WAGE' | 'BOARD_INVESTMENT' | 'FACILITY' | 'SCOUTING' | 'OTHER';
  amount: StoredMoney;
  createdAt: number;
  note: string;
  purchaseToken?: string;
}

export interface CanonicalClubFinance {
  clubBalance: StoredMoney;
  transferBudget: StoredMoney;
  wageBudget: StoredMoney;
  committedTransferSpend: StoredMoney;
  committedWages: StoredMoney;
  seasonId: string;
  financialHistory: ClubFinanceTransaction[];
}

export interface PlayerCareerResources {
  trainingFocus: number;
  trainingFocusCap: number;
  playerCondition: number;
  form: number;
  confidence: number;
  coachTrust: number;
  adaptability: number;
  whiteBallTempo: number;
  redBallMemory: number;
  specialization: 'ALL_FORMATS' | 'WHITE_BALL' | 'T20_ONLY';
  birthCountry: string;
  domesticCountry: string;
  cappedCountry?: string;
  declaredCountry: string;
  eligibleCountries: string[];
  residencySeasons: Record<string, number>;
  lastFormat?: Format;
  consecutiveMatches: number;
  /** Consecutive healthy fixtures spent outside the XI. */
  consecutiveBenches?: number;
  formatAppearances: Partial<Record<Format, number>>;
  requestedRestFixtureId?: string;
  /** Match appearances guaranteed by exceptional recent performance. */
  selectionGuaranteeMatches?: number;
  /** Remaining fixtures receiving a temporary selection-score bonus. */
  selectionBoostMatches?: number;
  selectionBoostAmount?: number;
  lastSelection?: {
    fixtureId?: string;
    format: Format;
    selected: boolean;
    userScore: number;
    rivalScore: number;
    reason: string;
  };
  internationalSelections?: Record<string, InternationalSelectionDecision>;
}

export interface InternationalSelectionDecision {
  assignmentId: string;
  format: Format;
  year: number;
  selected: boolean;
  userScore: number;
  threshold: number;
  reason: string;
}

export type InternationalRankingFormat = 'TEST' | 'ODI' | 'T20';
export type InternationalPlayerRankingKind = 'BATTING' | 'BOWLING' | 'ALL_ROUNDER';

export interface InternationalPlayerRankingPeak {
  bestRank: number;
  ratingAtBestRank: number;
  bestRankSeasonId: string;
  bestRankYear: number;
  bestRankAge: number;
  bestRating: number;
  rankAtBestRating: number;
  bestRatingSeasonId: string;
  bestRatingYear: number;
  bestRatingAge: number;
}

export type InternationalPlayerRankingPeaks = Partial<
  Record<
    InternationalRankingFormat,
    Partial<Record<InternationalPlayerRankingKind, InternationalPlayerRankingPeak>>
  >
>;

export type PlayerCalendarEventKind =
  | 'TRAINING'
  | 'EXAM'
  | 'NCA_CAMP'
  | 'SELECTION'
  | 'MATCH'
  | 'RECOVERY'
  | 'INTERNATIONAL'
  | 'TRANSFER_WINDOW';

export interface PlayerCalendarEvent {
  id: string;
  year: number;
  month: number;
  week: number;
  kind: PlayerCalendarEventKind;
  title: string;
  detail: string;
  format?: Format;
  fixtureId?: string;
  /** National tour/tournament reviewed when an INTERNATIONAL event is reached. */
  assignmentId?: string;
  completed: boolean;
  outcome?: string;
}

export interface PlayerCalendarState {
  year: number;
  events: PlayerCalendarEvent[];
  cursor: number;
}

export interface PremiumAssistanceRecord {
  id: string;
  action: string;
  createdAt: number;
  seasonId?: string;
  playerId?: string;
  transactionId?: string;
}

export interface ManagerProgressionState {
  reputation: number;
  currentClubId: string;
  premiumAssistanceHistory: PremiumAssistanceRecord[];
  /** Headline annual salary on the manager's current contract. */
  contractSalary?: number;
  /** Prevents duplicate salary grants when a rollover is retried. */
  lastSalaryPaidYear?: number;
  lastSalaryCoinPayout?: number;
}

export interface AuctionAssistantState {
  playerId: string;
  transactionId: string;
  maxClubBid: number;
  estimatedInterest: number;
  valuationLow: number;
  valuationHigh: number;
  configuredAt: number;
}

export interface Entitlements {
  /** Permanent ad removal + VIP perks (60 energy cap, +20% match coins). */
  removeAds: boolean;
  /** Epoch millis until which ads are suppressed by a *timed* grant (e.g. the
   *  Starter Pack's 7-day trial). Does NOT grant the permanent VIP perks. */
  removeAdsUntil?: number;
  vipUntil?: number;
  seasonPass?: {
    productId: string;
    premium: boolean;
    tier: number;
    /** Provider-authoritative subscription period. Premium access ends here. */
    periodStartedAt: number;
    expiresAt: number;
    lastVerifiedAt: number;
    provider: 'GOOGLE_PLAY' | 'REVENUECAT' | 'LOCAL_MOCK' | 'LEGACY_MIGRATION';
    willRenew?: boolean;
  };
}

/** Manager tactics for the user's team (fed into the live match engine). */
export interface Tactics {
  batting: 'DEFENSIVE' | 'BALANCED' | 'AGGRESSIVE';
  bowling: 'ATTACK' | 'CONTAIN' | 'VARY';
  /** Field aggression — attacking fields catch more but leak boundaries. */
  field?: 'CATCHING' | 'ATTACKING' | 'BALANCED' | 'DEFENSIVE' | 'SWEEPER';
}

/** Board expectation for the season (evaluated on rollover). */
export interface BoardObjective {
  year: number;
  targetPosition: number; // finish at or above this league position
  met?: boolean; // set once the season is evaluated
}

/** All-time records / Hall of Fame (name snapshots so they survive retirement). */
export interface RecordEntry {
  name: string;
  detail: string;
  year: number;
}
export interface Records {
  highestScore?: { name: string; runs: number; year: number };
  bestBowling?: { name: string; wickets: number; runs: number; year: number };
  centuries: RecordEntry[];
  fiveWicketHauls: RecordEntry[];
  titles: RecordEntry[];
}

/* =========================================================================
 * CAREER NARRATIVE & LIFE — persisted, career mode.
 * ========================================================================= */

/** A relationship with a named character (coach, captain, rival, agent, …). */
export interface Relationship {
  id: string; // stable key, e.g. 'coach' | 'captain' | 'rival' | 'agent' | 'mentor'
  name: string;
  role: string; // display role, e.g. 'Head Coach'
  level: number; // -100 (bitter rivalry) .. +100 (close ally)
}

/** An endorsement / sponsorship deal that pays out and carries expectations. */
export interface Sponsor {
  id: string;
  brand: string;
  tier: 'LOCAL' | 'NATIONAL' | 'GLOBAL';
  perMatchCoins: number;
  signingBonus: number;
  seasonsLeft: number;
  minForm?: number; // must stay above this form or risk the deal
  requiresIntegrity?: boolean; // dropped if the player's image is tarnished
  /** Fixture ledger for this separate off-shirt campaign. */
  paidFixtureIds?: string[];
  /** Lifetime Wallet Coins paid by this campaign. */
  totalPaid?: number;
}

export type SponsorFormatScope = 'ALL_FORMATS' | 'WHITE_BALL' | 'RED_BALL' | 'T20_ONLY' | 'RESULTS';
export type SponsorPaymentDestination = 'WALLET_COINS' | 'CLUB_BALANCE';
export type PlayerSponsorStature = 'DOMESTIC' | 'FRANCHISE' | 'INTERNATIONAL' | 'ICON';
export type ManagerSponsorStature = 'CLUB' | 'STATE' | 'ELITE';
export type CanonicalSponsorBrandId = 'boundary_works' | 'pulse_xi' | 'longform' | 'legacy_crown';

/** One of the three guaranteed kit-partner choices offered to a career. */
export interface SponsorshipOffer {
  id: string;
  mode: GameMode;
  /** Brand content is supplied separately from the economy contract. */
  brandId?: string;
  brandName?: string;
  label: string;
  scope: SponsorFormatScope;
  fixtureQuota: number;
  appearancePayout: number;
  winBonus: number;
  signingBonus: number;
  termSeasonRollovers: number;
  paymentDestination: SponsorPaymentDestination;
  /** The accepted rate remains fixed even if stature changes later. */
  signedStature: PlayerSponsorStature | ManagerSponsorStature;
}

export interface SponsorshipContract extends SponsorshipOffer {
  acceptedSeasonId: string;
  acceptedAt: number;
  paidFixtureIds: string[];
  paidFixtures: number;
  paidWins: number;
  seasonRollovers: number;
  totalPaid: number;
  status: 'ACTIVE' | 'QUOTA_REACHED' | 'TERM_ENDED';
  /** Manager deal owner. The contract stays with this club after a job switch. */
  boundTeamId?: string;
  /** Existing saves keep one highest-paying legacy deal until its old expiry. */
  legacySponsorId?: string;
}

/** Permanent stipend purchase deliberately belongs to one save, never an account. */
export interface PremiumSponsorGrant {
  productId: 'player_save_sponsor' | 'manager_save_sponsor';
  /** Code-native presentation identity; never baked into a portrait asset. */
  brandId?: CanonicalSponsorBrandId;
  brandName?: string;
  boundSaveId: string;
  grantedAt: number;
  purchaseToken: string;
  paidUtcWeekIds: string[];
  paidFixtureIds: string[];
  totalPaid: number;
}

/** Save-owned Player sponsorship plus the one-save permanent sponsor grant. */
export interface SponsorshipState {
  /** First verified selected-XI senior domestic appearance; gates Player offers. */
  seniorDomesticDebutFixtureId?: string;
  offerSeasonId?: string;
  offers: SponsorshipOffer[];
  activeEarned?: SponsorshipContract;
  history: SponsorshipContract[];
  acceptedOfferSeasonIds: string[];
  /** Earned-contract cash credited during the current in-game season. */
  earnedThisSeason: number;
  earnedSeasonId?: string;
  /** Premium stipend cash credited during the same season (Manager reporting only). */
  premiumThisSeason?: number;
  /** Snapshot retained across rollover so season accounts can reconcile fixture income. */
  lastKitSponsorIncome?: number;
  lastKitSponsorSeasonId?: string;
  premium?: PremiumSponsorGrant;
  legacySponsorMigrationComplete: boolean;
}

/** Earned Manager kit partnerships belong to a club, not to the manager/save. */
export interface ManagerClubSponsorshipState {
  offerSeasonId?: string;
  offers: SponsorshipOffer[];
  activeEarned?: SponsorshipContract;
  history: SponsorshipContract[];
  acceptedOfferSeasonIds: string[];
  /** Earned-contract cash credited to this club during the current season. */
  earnedThisSeason: number;
  /** Save-owned premium stipend cash credited to this club during the current season. */
  premiumThisSeason: number;
  earnedSeasonId?: string;
  /** Snapshot retained across rollover for this club's season accounts. */
  lastKitSponsorIncome?: number;
  lastKitSponsorSeasonId?: string;
}

/** A single entry in the career journal / timeline. */
export interface TimelineEntry {
  year: number;
  day?: number;
  kind:
    | 'DEBUT'
    | 'MILESTONE'
    | 'AWARD'
    | 'TRANSFER'
    | 'STORY'
    | 'INJURY'
    | 'CAPTAINCY'
    | 'CALLUP'
    | 'RETIREMENT';
  text: string;
}

/** A club bid on the user player, used by separate domestic and T20 offer lists. */
export interface AuctionOffer {
  teamId: string;
  fee: number; // headline franchise fee (prestige signal)
  signingBonus: number; // coins paid to the player on accepting
  wagePromise: number; // seasonal wage written into the accepted contract
}

/** Narrative engine state (seen/queued events + arbitrary numeric/string flags). */
export interface StoryState {
  flags: Record<string, number>;
  strings?: Record<string, string>;
  seenEventIds: string[];
  pendingEventIds: string[];
  lastEventDay?: number;
}

/* =========================================================================
 * MANAGER DEPTH — persisted, manager mode.
 * ========================================================================= */

/**
 * Manager career pathway (manager mode only).
 *   CLUB     = domestic club, T20 only (default new manager start)
 *   STATE    = higher-profile domestic, all 3 formats; player-legend managers start here
 *   NATIONAL = manages the national team in ICC events
 */
export type ManagerCareerLevel = 'CLUB' | 'STATE' | 'ELITE' | 'NATIONAL';

export type ManagerCalendarPhase = 'LIST_A' | 'FIRST_CLASS' | 'T20' | 'OFF_SEASON';

export interface ManagerPhaseSummary {
  phase: ManagerCalendarPhase;
  year: number;
  championTeamIds: Partial<Record<DomesticTier, string>>;
  userPosition?: number;
  userMatches: number;
  userWins: number;
  walletCoins: number;
  salaryCoins?: number;
  overRatePenalties: number;
}

export interface ManagerCalendarState {
  year: number;
  phase: ManagerCalendarPhase;
  phaseStartedAtMonth: number;
  lastSummary?: ManagerPhaseSummary;
  /** Set after the June-August recovery and development pass has run. */
  offSeasonPrepared?: boolean;
  backgroundCoinsThisPhase?: number;
}

export type StaffRole =
  | 'HEAD_COACH'
  | 'BATTING_COACH'
  | 'BOWLING_COACH'
  | 'FIELDING_COACH'
  | 'FITNESS_COACH'
  | 'PHYSIO'
  | 'SCOUT'
  | 'MARKETING_DIRECTOR';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  quality: number; // 1..100
  wage: number; // per-season club-budget cost
  specialty?: string;
  contractYears?: number;
}

/** Upgradeable facility levels (1..5). Feed training, injury recovery, youth. */
export interface Facilities {
  training: number;
  medical: number;
  academy: number;
}

/** A scout's read on a player — noisy until fully scouted. */
export interface ScoutReport {
  playerId: string;
  knownOverall: number; // observed (noisy) rating
  uncertainty: number; // 0..1 — shrinks as scouting progresses
  scoutedYear: number;
  /** Recommendation based on current first-team value, never hidden potential. */
  recommended: boolean;
}

/** Youth academy state — an annual intake of prospects. */
export interface AcademyState {
  prospectIds: string[]; // players held out of the senior roster
  nextIntakeYear: number;
  intakeGraded?: boolean;
}

/** Manager-side club finances (richer than the single team.budget number). */
export interface ClubFinances {
  transferBudget: number; // cash available for fees
  wageBudgetPerSeason: number; // sustainable wage ceiling
  lastSponsorIncome?: number;
  lastGateReceipts?: number;
  lastWageBill?: number;
}

export type TicketPreset = 'LOW' | 'STANDARD' | 'PREMIUM';
export type ManagerTrainingFocus =
  'BALANCED' | 'BATTING' | 'BOWLING' | 'FIELDING' | 'FITNESS' | 'RECOVERY';
export type ManagerTrainingIntensity = 'LIGHT' | 'NORMAL' | 'HIGH';

export interface ManagerTrainingPlan {
  teamFocus: ManagerTrainingFocus;
  intensity: ManagerTrainingIntensity;
  playerOverrides: Record<string, ManagerTrainingFocus>;
  /** Exact fixture ids already settled, preventing replay/reload gains. */
  processedFixtureIds: string[];
  /** Fractional per-attribute development carried until a full point is earned. */
  developmentProgress: Record<string, Record<string, number>>;
  /** Regular-season development blocks used this club season (max 28). */
  developmentBlocks: number;
  seasonYear: number;
}

export interface StadiumAttendanceEntry {
  fixtureId: string;
  attendance: number;
  capacity: number;
  ticketPreset: TicketPreset;
  ticketPrice: number;
  grossReceipts: number;
  netReceipts: number;
  settledAt: number;
}

export interface ClubStadiumState {
  name: string;
  capacityLevel: number;
  experienceLevel: number;
  fanBase: number;
  /** Baseline used to enforce the per-season fan-growth cap. */
  fanSeasonStart?: number;
  /** Calendar season associated with fanSeasonStart. */
  fanSeasonYear?: number;
  ticketPresets: Record<Format, TicketPreset>;
  attendanceHistory: StadiumAttendanceEntry[];
  /** Fixture-ledger ids already credited to the club budget. */
  settledFixtureIds: string[];
}

/** Club assets persist by team id and never travel with a manager appointment. */
export interface ManagerClubState {
  teamId: string;
  staff: StaffMember[];
  staffCandidates: StaffMember[];
  facilities: Facilities;
  academy: AcademyState;
  scoutReports: ScoutReport[];
  finances: ClubFinances;
  trainingPlan: ManagerTrainingPlan;
  stadium: ClubStadiumState;
  /** Club-owned earned sponsor contract, offers and income ledger. */
  sponsorship: ManagerClubSponsorshipState;
  captainId?: string;
  viceCaptainId?: string;
}

// ---------- In-game notification inbox ----------

export type InboxMessageKind =
  | 'CALLUP'
  | 'CONTRACT_EXPIRY'
  | 'AUCTION_OFFER'
  | 'INJURY'
  | 'BOARD_OBJECTIVE'
  | 'ACHIEVEMENT'
  | 'RIVAL_OVERTOOK'
  | 'HOF_ENTRY'
  | 'SEASON_AWARDS'
  | 'GENERAL';

export interface InboxMessage {
  id: string;
  kind: InboxMessageKind;
  title: string;
  body: string;
  timestamp: number; // ms since epoch
  read: boolean;
  /** Optional action — a screen name the user can tap-through to. */
  actionScreen?: string;
}

// ---------- Daily Challenge ----------

export interface DailyChallenge {
  /** YYYYMMDD formatted string so same challenge fires for everyone. */
  dateKey: string;
  title: string;
  description: string;
  format: Format;
  targetRuns: number;
  targetBalls: number;
  pitchCondition: 'GREEN' | 'DRY' | 'DUSTY' | 'FLAT' | 'CRACKED';
  rewardCoins: number;
  rewardGems: number;
  /** Reward tier label shown in UI. */
  rewardTier: 'BRONZE' | 'SILVER' | 'GOLD';
  completed?: boolean;
  userScore?: number;
  completedAt?: number;
}

/**
 * The player's active level in the career pathway.
 * SCHOOL  = persisted key for Grade A cricket (career begins at age 16)
 * U19     = Under-19 state/national youth (before domestic contract)
 * DOMESTIC = Domestic professional (before international call-up)
 * INTERNATIONAL = Capped player (can be dropped back to DOMESTIC)
 */
export type CareerPathLevel = 'SCHOOL' | 'U19' | 'DOMESTIC' | 'INTERNATIONAL';

export type StockSector =
  | 'TECHNOLOGY'
  | 'INFRASTRUCTURE'
  | 'MINING'
  | 'ENERGY'
  | 'CONSUMER'
  | 'MANUFACTURING'
  | 'LOGISTICS'
  | 'HEALTHCARE';

export type StockRisk = 'STABLE' | 'BALANCED' | 'VOLATILE';

export interface StockCompany {
  id: string;
  name: string;
  sector: StockSector;
  risk: StockRisk;
}

export interface StockHolding {
  companyId: string;
  /** Coins paid for the portion still held. */
  costBasis: number;
  currentValue: number;
  totalWithdrawn: number;
  history: number[];
  lastReturnPct?: number;
  /** Legacy anonymous market positions are preserved but cannot receive new money. */
  sellOnly?: boolean;
}

export interface StockPortfolio {
  holdings: Record<string, StockHolding>;
  totalWithdrawn: number;
  lastReturns: Partial<Record<string, number>>;
  lastUpdatedYear?: number;
  /** One-time protective refund paid during removal of the fictional token market. */
  legacyTokenRefundCoins?: number;
  legacyTokenRefunded: boolean;
}

/** @deprecated Schema-41 anonymous investment migrated to StockPortfolio. */
export interface StockInvestment {
  /** Legacy coins originally invested in the anonymous market. */
  invested: number;
  /** Final anonymous-market value preserved during migration. */
  currentValue: number;
  /** Total dividends/withdrawals taken out so far. */
  totalWithdrawn: number;
  /** Last 8 season-end values for sparkline chart (oldest → newest). */
  history?: number[];
}

/** A personal cricket academy the player has founded. */
export interface PersonalAcademy {
  name: string;
  /** 1 = small local school, 2 = regional, 3 = elite national */
  tier: 1 | 2 | 3;
  /** Students enrolled — grows with tier. */
  studentsCount: number;
  /** Coins earned per season from the academy. */
  revenuePerSeason: number;
  /** Season the academy was founded. */
  foundedYear: number;
}

export type PersonalCoachDiscipline = 'BATTING' | 'BOWLING' | 'MENTAL';

export interface PersonalCoachContract {
  discipline: PersonalCoachDiscipline;
  hiredYear: number;
  seasonsRemaining: number;
}

export interface PlayerLifeMatch {
  id: string;
  year: number;
  opponent: string;
  competition: string;
  format: Format;
  runs: number;
  wickets: number;
  rating: number;
  result: 'W' | 'L' | 'D';
  international: boolean;
}

export interface PlayerSocialPost {
  id: string;
  year: number;
  headline: string;
  body: string;
  reactions: number;
  comments: string[];
  followersDelta: number;
}

export interface PlayerCaptainIssue {
  id: string;
  title: string;
  detail: string;
  affectedPlayerIds: string[];
  resolved?: boolean;
  outcome?: string;
}

export interface PlayerPerformanceAnalysis {
  fixtureId: string;
  year: number;
  opponentTeamId: string;
  opponentName: string;
  format: Format;
  threatName: string;
  threatDetail: string;
  weakness: string;
  matchAdvice: string;
  recommendedTrainingGroup:
    'batting' | 'bowling' | 'fielding' | 'wicketkeeping' | 'fitness' | 'mental';
  trainingReason: string;
}

/**
 * Player Career's consolidated off-field simulation. Catalog metadata lives
 * in game/playerLife.ts; saves retain only ownership, balances and history.
 */
export interface PlayerLifeState {
  followers: number;
  bankCoins: number;
  propertyIds: string[];
  businessIds: string[];
  /** @deprecated Refunded and removed by schema 42. Retained only for migration input. */
  legacyTokenUnits?: number;
  /** @deprecated Refunded and removed by schema 42. Retained only for migration input. */
  legacyTokenCostBasis?: number;
  personalCoaches: Partial<Record<PersonalCoachDiscipline, PersonalCoachContract>>;
  equipmentIds: string[];
  physioVisitsThisSeason: number;
  analysedFixtureIds: string[];
  recentMatches: PlayerLifeMatch[];
  socialFeed: PlayerSocialPost[];
  mediaPostsThisSeason: number;
  sponsorNegotiatedYear?: number;
  captainIssue?: PlayerCaptainIssue;
  lastAnalysisReport?: PlayerPerformanceAnalysis;
  lastSeasonIncome?: {
    year: number;
    bankInterest: number;
    propertyIncome: number;
    businessIncome: number;
    total: number;
  };
}

/** An event in the international cricket calendar (Feature 8). */
export interface IntlCalendarEvent {
  id: string;
  name: string;
  type: 'WC' | 'WTC' | 'CT' | 'SERIES';
  format: Format;
  months: number[]; // in-game months (1–12) the event spans
  teams: string[]; // participating team ids / country codes
  selection?: 'SELECTED' | 'NOT_SELECTED' | 'QUALIFICATION_PENDING';
  selectionReason?: string;
}

/** 4-year international cycle stored in the save (Feature 8). */
export interface IntlCalendar {
  year: number; // base year of the current 4-year cycle
  events: IntlCalendarEvent[];
}

export interface WtcStanding {
  countryId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export interface WtcCycleState {
  id: string;
  startYear: number;
  endYear: number;
  standings: Record<string, WtcStanding>;
  processedSeriesIds: string[];
  recordedFixtureIds: string[];
  finalTeamIds?: [string, string];
  finalFixtureId?: string;
  championCountryId?: string;
}

export interface InternationalTournamentStanding {
  countryId: string;
  played: number;
  won: number;
  tied: number;
  lost: number;
  points: number;
  /** Stable tie-break value used when points and wins are level. */
  tiebreak: number;
}

export type InternationalTournamentStage =
  'GROUP' | 'SEMI_FINAL' | 'FINAL' | 'ELIMINATED' | 'COMPLETE';

/**
 * Durable state for an ICC event. Knockouts are staged only after their feeder
 * matches finish, so a save can never enter a semifinal it did not qualify for.
 */
export interface InternationalTournamentState {
  id: string;
  year: number;
  name: string;
  format: Format;
  controlledCountryId: string;
  controlledTeamId: string;
  participantCountryIds: string[];
  groupCountryIds: string[];
  groupFixtureIds: string[];
  standings: Record<string, InternationalTournamentStanding>;
  stage: InternationalTournamentStage;
  position?: number;
  semiFinalFixtureId?: string;
  finalFixtureId?: string;
  championCountryId?: string;
  eliminatedAt?: 'GROUP' | 'SEMI_FINAL' | 'FINAL';
  rewardKeys: string[];
  managerPhase?: ManagerCalendarPhase;
}

export type U19WorldCupStatus =
  'TRACKING' | 'SELECTED' | 'NOT_SELECTED' | 'ELIMINATED' | 'RUNNER_UP' | 'CHAMPION';

/**
 * Exact, fixture-backed merit retained for the protagonist's single U19 World
 * Cup selection opportunity. It remains valid if an early domestic promotion
 * resets the ordinary career-path counters.
 */
export interface U19WorldCupMeritSnapshot {
  appearanceFixtureIds: string[];
  appearances: number;
  runs: number;
  wickets: number;
  ratingSum: number;
  averageRating: number;
  readiness: number;
  qualified: boolean;
}

/** Durable six-country knockout state, wholly separate from senior caps. */
export interface U19WorldCupState {
  id: string;
  opportunityAge: 18;
  opportunityYear?: number;
  status: U19WorldCupStatus;
  merit: U19WorldCupMeritSnapshot;
  controlledCountryId?: string;
  controlledTeamId?: string;
  participantCountryIds: string[];
  teamIds: string[];
  quarterFinalFixtureIds: string[];
  semiFinalFixtureIds: string[];
  finalFixtureId?: string;
  championTeamId?: string;
  eliminatedAt?: 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL';
}

/** A rival club headhunting a successful manager with a better-paid job. */
export interface ManagerJobOffer {
  teamId: string; // the club making the approach
  clubName: string;
  reputation: number; // the approaching club's reputation (higher than yours)
  salaryPromise: number; // headline seasonal salary on offer
  reason: string; // flavour text ("Champions want a proven winner", etc.)
}

/** Current canonical save schema. Bump + add a migration on any shape change. */
export const SAVE_SCHEMA_VERSION = 43;

export type CareerArchetype = 'PRODIGY' | 'LATE_BLOOMER' | 'SPECIALIST' | 'COMEBACK';
export type CoachPersonality = 'DEVELOPER' | 'TACTICIAN' | 'DISCIPLINARIAN' | 'MENTOR';
export type ClubCulture = 'ACADEMY' | 'ANALYTICAL' | 'FEARLESS' | 'TRADITIONAL';
export type ManagerPhilosophy = 'DEVELOPER' | 'TACTICIAN' | 'MOTIVATOR' | 'PRAGMATIST';

export interface MatchImpactChange {
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface MatchDecisionImpact {
  id: string;
  decision: string;
  outcome: string;
  evidence: string;
  confidence: 'OBSERVED' | 'ESTIMATED';
  tone: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL';
}

/** Persisted explanation of what the previous match changed and why. */
export interface MatchImpactSummary {
  matchId: string;
  createdAt: number;
  headline: string;
  narrative: string;
  why: string[];
  changes: MatchImpactChange[];
  playerOfMatchReason?: string;
  decisions?: MatchDecisionImpact[];
  leaguePosition?: { before: number; after: number };
}

/** A milestone article kept in the Player Career media scrapbook. */
export interface NewspaperStory {
  id: string;
  matchId: string;
  createdAt: number;
  season: number;
  kind?: 'MATCH' | 'TROPHY' | 'ELIMINATION' | 'PROMOTION' | 'MILESTONE';
  /** Immutable copy selection metadata added in schema 34. Absent on legacy clippings. */
  templateId?: string;
  newspaperCategory?:
    | 'CENTURY_STANDARD'
    | 'CENTURY_CHASE'
    | 'FIFTY_WIN'
    | 'FIFTY_LOSS'
    | 'WICKET_SPELL'
    | 'FIVE_WICKET'
    | 'ALL_ROUND'
    | 'CLOSE_WIN'
    | 'CLOSE_LOSS'
    | 'PLAYER_OF_MATCH'
    | 'TROPHY'
    | 'PROMOTION'
    | 'ELIMINATION'
    | 'MILESTONE_RECORD';
  headlineFamily?:
    | 'PLAYER_PERFORMANCE'
    | 'PLAYER_RECOGNITION'
    | 'PLAYER_JOURNEY'
    | 'TEAM_RESULT'
    | 'OPPOSITION_RESULT'
    | 'EVENT_RESULT'
    | 'TROPHY_FOCUS'
    | 'RECORD_FOCUS';
  trophyNames?: string[];
  promotionFrom?: CareerPathLevel;
  promotionTo?: CareerPathLevel;
  format: Format;
  edition: string;
  kicker: string;
  headline: string;
  subheadline: string;
  body: string;
  playerName: string;
  opponentName: string;
  result: 'WIN' | 'LOSS' | 'TIE' | 'NEUTRAL';
  runs: number;
  balls: number;
  wickets: number;
  /** Verified completed-match facts used by the score panel. */
  teamName?: string;
  teamScore?: string;
  opponentScore?: string;
  resultLine?: string;
  competitionName?: string;
  venueName?: string;
}

export interface RelationshipMemory {
  id: string;
  characterId: string;
  characterName: string;
  role: string;
  summary: string;
  season: number;
  createdAt: number;
  delta: number;
  consequence: string;
}

export interface ArchetypeJourneyState {
  highPressureMatches: number;
  selectionSetbacks: number;
  injuryReturns: number;
  signaturePerformances: number;
  legacyEnding?: string;
}

export interface SeasonPassBrandingState {
  customTeamNames: Record<string, string>;
  customLeagueNames: Record<string, string>;
  originalTeamNames: Record<string, { name: string; shortName: string }>;
  originalLeagueNames: Record<string, string>;
  applied: boolean;
}

/** The emotional continuity layer shared by Player and Manager careers. */
export interface CareerExperienceState {
  playerArchetype?: CareerArchetype;
  coachPersonality?: CoachPersonality;
  clubCulture?: ClubCulture;
  managerPhilosophy?: ManagerPhilosophy;
  ironman?: boolean;
  starterPackUnlockedAt?: number;
  starterPackDismissedAt?: number;
  lastMatchImpact?: MatchImpactSummary;
  mediaScrapbook?: NewspaperStory[];
  pendingNewspaperId?: string;
  archetypeJourney?: ArchetypeJourneyState;
  relationshipMemories?: RelationshipMemory[];
  pendingTeamTalk?: {
    tone: string;
    formDelta: number;
    volatility: number;
    result: string;
  };
}

/** Equipped player cosmetics (career mode). Ids come from PlayerCosmeticsScreen. */
export interface PlayerCosmetics {
  avatar: string;
  kit: string;
  celebration: string;
  /** User-selected lettering printed across the back of the playing shirt. */
  shirtName?: string;
  /** User-selected playing number, restricted to 1-99. */
  shirtNumber?: number;
  profileFrame?: string;
  stadiumTheme?: string;
  officeTheme?: string;
  /** Schema 32 fixed portrait. Only a stable portrait ID and optional frame are persisted. */
  avatarConfig?: AvatarConfig;
}

export interface SeasonPassScenarioProgress {
  id: string;
  matches: number;
  wins: number;
  runs: number;
  wickets: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface SeasonPassExperienceState {
  monthlyDropCycleId?: string;
  monthlyDropItemIds?: string[];
  scenarioCycleId?: string;
  playerStoryCycleId?: string;
  managerStoryCycleId?: string;
  activeScenarioId?: string;
  scenarios: Record<string, SeasonPassScenarioProgress>;
  selectedStadiumTheme: string;
  selectedOfficeTheme: string;
  selectedProfileFrame: string;
}

export type ManagerResourceAction =
  'MATCH_ANALYSIS' | 'EMERGENCY_TEAM_TALK' | 'FAST_TRACK_SCOUT' | 'ELITE_STAFF_SEARCH';

export interface ManagerResourceTransaction {
  id: string;
  action: ManagerResourceAction;
  currency: 'coins' | 'gems';
  amount: number;
  scopeId: string;
  createdAt: number;
  detail: string;
}

/** Durable audit trail for Manager wallet spending and duplicate protection. */
export interface ManagerResourceState {
  totalCoinsSpent: number;
  totalGemsSpent: number;
  transactions: ManagerResourceTransaction[];
}

export interface LastSeasonSettlement {
  year: number;
  leaguePosition: number;
  leaguePrize: number;
  continentalPrize: number;
  /** @deprecated Legacy name; new settlements expose the same amount as broadcastIncome. */
  sponsorIncome: number;
  broadcastIncome?: number;
  /** Earned and permanent kit-partner payments already credited fixture by fixture. */
  kitSponsorIncome?: number;
  playerWages: number;
  gateReceipts: number;
  staffWages: number;
  facilityUpkeep: number;
  previousBudget: number;
  newBudget: number;
}

export interface SaveGame {
  schemaVersion: number; // bump + migrate on change
  id: string;
  mode: GameMode;
  createdAt: number;
  updatedAt: number;
  wallet: Wallet;
  /** Canonical account-currency state. `wallet` remains as the compatibility
   *  view consumed by older gameplay code and is synchronized on persistence. */
  premiumWallet?: PremiumWalletState;
  premiumInventory?: PremiumInventoryState;
  playerCareerResources?: PlayerCareerResources;
  playerCalendar?: PlayerCalendarState;
  pendingDomesticCountry?: string;
  clubFinance?: CanonicalClubFinance;
  managerProgression?: ManagerProgressionState;
  managerResources?: ManagerResourceState;
  /** Itemized club-finance statement from the most recently completed season. */
  lastSeasonSettlement?: LastSeasonSettlement;
  auctionAssistants?: Record<string, AuctionAssistantState>;
  entitlements: Entitlements;
  userPlayerId?: string;
  /**
   * The senior domestic club reserved for Player Career. During SCHOOL/U19
   * this is a future destination and does not contain the user player.
   */
  userTeamId?: string;
  /** Player Career's separate T20 affiliation. `userTeamId` remains the
   *  domestic First-Class/List A club; Manager saves do not use this field. */
  franchiseTeamId?: string;
  /** Separate seasonal T20 terms. The player's ordinary `contract` remains
   *  their domestic First-Class/List A agreement. */
  franchiseContract?: Contract;
  /** Active Grade A/U19 XI. Cleared when the senior domestic contract begins. */
  careerPathTeamId?: string;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  seasons: Record<string, Season>;
  leagues: Record<string, League>;
  fixtures: Record<string, Fixture>;
  currentSeasonId?: string;
  difficulty: Difficulty;
  flags: Record<string, boolean>;
  tactics?: Tactics;
  // ---- Domestic pyramid (promotion/relegation) ----
  divisions?: { tier1: string[]; tier2: string[]; tier3?: string[] }; // tier1 = top flight
  userDivision?: DomesticTier; // league-1 always points at the user's current tier
  promotionNews?: { promoted: string[]; relegated: string[]; userMoved?: 'PROMOTED' | 'RELEGATED' };
  freeAgents?: string[]; // transfer-market player ids (players live in `players`)
  boardObjective?: BoardObjective;
  records?: Records;
  championTeamId?: string; // winner of the current season's Grand Final
  lastDailyClaim?: number; // day-index of the last claimed daily reward
  // ---- Career pathway (career mode, all optional) ----
  careerPathLevel?: CareerPathLevel; // current level; defaults to DOMESTIC for existing saves
  careerPathMatches?: number; // matches played at the current path level (resets on promotion)
  // Accumulated performance at the current path level (reset on promotion).
  // Progression is 75% performance (runs/wickets) + 25% rating, so a player can
  // be genuinely stuck at a level for years if their output doesn't justify a step up.
  careerPathRuns?: number; // runs scored at the current path level
  careerPathWickets?: number; // wickets taken at the current path level
  careerPathRatingSum?: number; // sum of match ratings at the current level (÷ matches = avg)
  legendGranted?: boolean; // Legend status granted (achievement threshold or IAP)
  intlDroppedSeasons?: number; // consecutive seasons without an international appearance (for age-triggered retirement)
  careerToManagerEligible?: boolean; // true once career stats qualify for a management transition
  // ---- Personal finance (career mode, all optional) ----
  stockPortfolio?: StockPortfolio;
  /** @deprecated Migrated to stockPortfolio by schema 42. */
  stockInvestment?: StockInvestment;
  personalAcademy?: PersonalAcademy;
  playerLife?: PlayerLifeState;
  /** Coin-sink "Legacy" prestige points funded from career earnings. Pure
   *  vanity/rank (no gameplay effect), so it never becomes a coin faucet. */
  legacyPoints?: number;
  // ---- Career ladder / national team (career mode, all optional) ----
  capped?: boolean; // called up to the national side
  userCaps?: number; // international appearances
  userCapsAtSeasonStart?: number; // lifetime-cap snapshot used to derive this season's caps
  nationalRep?: number; // 0..100 selection reputation toward the next call-up
  // ---- Live-ops (all optional; default at runtime) ----
  dailyStreak?: number;
  quests?: { day: number; items: { id: string; progress: number; claimed: boolean }[] };
  weeklyQuests?: {
    week: number;
    /** UTC pass cycle in which this progress was earned. */
    passCycleId?: string;
    items: { id: string; progress: number; claimed: boolean }[];
  };
  pass?: {
    /** UTC calendar-month cycle id, independent from the in-game career season. */
    seasonId: string;
    periodStartedAt?: number;
    periodEndsAt?: number;
    /** Reward-curve revision used to migrate XP without losing earned tiers. */
    balanceVersion?: number;
    xp: number;
    premium: boolean;
    claimedFree: number[];
    claimedPremium: number[];
  };
  achievements?: string[]; // unlocked achievement ids
  inventory?: Record<string, number>; // cosmetic/consumable items (from the pass, events)
  cosmetics?: PlayerCosmetics; // equipped player look (career mode)
  seasonPassExperience?: SeasonPassExperienceState;
  experience?: CareerExperienceState;
  seasonPassBranding?: SeasonPassBrandingState;
  // ---- Career narrative & life (career mode, all optional) ----
  story?: StoryState;
  timeline?: TimelineEntry[];
  relationships?: Record<string, Relationship>;
  sponsors?: Sponsor[];
  sponsorship?: SponsorshipState;
  brand?: number; // 0..100 marketability
  integrity?: number; // 0..100 clean image / trust
  captainClub?: boolean;
  captainCountry?: boolean;
  rivalPlayerId?: string;
  seasonRatings?: number[]; // per-match ratings this season
  auctionOffers?: AuctionOffer[]; // franchise bids on the user, offered at season start
  /** Rival domestic-club approaches for First-Class and List A cricket. */
  domesticClubOffers?: AuctionOffer[];
  newGamePlus?: number; // legacy generation counter
  // ---- Manager depth (manager mode, all optional) ----
  staff?: StaffMember[];
  staffCandidates?: StaffMember[];
  facilities?: Facilities;
  academy?: AcademyState;
  scoutReports?: ScoutReport[];
  finances?: ClubFinances;
  /** Canonical per-club Manager assets. Legacy fields above remain synchronized
   *  temporarily while older screens are migrated onto this record. */
  managerClubs?: Record<string, ManagerClubState>;
  managerStory?: StoryState;
  cupWins?: number;
  /** Per-player season training focus (playerId -> attribute group). */
  trainingFocus?: Record<string, 'batting' | 'bowling' | 'fielding' | 'meta'>;
  boardConfidence?: number; // 0..100 job security signal
  // ---- Manager career progression (manager mode, all optional) ----
  managerCareerLevel?: ManagerCareerLevel; // current level; defaults CLUB
  /** Manager Career begins at 35 and ends after the season that reaches age 60. */
  managerAge?: number;
  managerRetired?: boolean;
  managerCareerSeasons?: number; // seasons completed at current level
  managerTitlesAtLevel?: number; // league titles won at current level (used for promotion)
  managerTopFinishes?: number; // top-2 league finishes at current level (promotion route without a title)
  managerCalendar?: ManagerCalendarState;
  managerWonTierOneFirstClass?: boolean;
  managerNationalTeamId?: string;
  managerJobOffer?: ManagerJobOffer; // a pending headhunt from a bigger club (offered at season start)
  /** Board protection and onboarding state after accepting a new club job. */
  managerGraceMatchesRemaining?: number;
  managerMatchesAtCurrentClub?: number;
  managerAppointmentPending?: {
    teamId: string;
    clubName: string;
    appointedAt: number;
  };
  // ---- Achievement counters (career mode) ----
  careerWins?: number; // total match wins accumulated this career
  careerLosses?: number; // total match losses accumulated this career
  careerDraws?: number; // total tied/drawn/no-result matches accumulated this career
  winStreak?: number; // current consecutive win streak
  // ---- Cross-career achievement counters (feed the all-time Hall of Fame) ----
  careerSeasons?: number; // seasons completed in this save
  leagueTitles?: number; // league championships won by the user's team
  promotions?: number; // times the user's team was promoted a division
  bestLeaguePos?: number; // best league finish achieved (1 = champions)
  continentalTitles?: number; // Continental Cup wins
  continentalChampion?: string; // last Continental Cup winner (team id)
  // ---- In-game inbox ----
  inbox?: InboxMessage[];
  // ---- Daily challenge (keyed by date string YYYYMMDD) ----
  dailyChallengeCompleted?: Record<string, boolean>;
  activeDailyChallenge?: DailyChallenge;
  // ---- VIP / monetization flags ----
  firstPurchaseDone?: boolean; // first-ever IAP completed — bonus already granted
  vipStreakDays?: number; // consecutive login days with Remove Ads active
  vipStreakLastDay?: number; // day-index of last VIP streak tick
  vipEnergyBonusActive?: boolean; // 60-cap energy active (removeAds perk)
  // ---- Manager pre-season (Feature 6) ----
  preSeasonComplete?: boolean; // false during pre-season phase
  // ---- Year-round cricket calendar (Feature 7) ----
  currentMonth?: number; // 1–12 in-game calendar month
  // ---- International calendar (Feature 8) ----
  internationalCalendar?: IntlCalendar;
  wtcCycles?: Record<string, WtcCycleState>;
  internationalTournaments?: Record<string, InternationalTournamentState>;
  /** Career-best international player position and rating, tracked prospectively. */
  internationalPlayerRankingPeaks?: InternationalPlayerRankingPeaks;
  /** One merit-based age-18 U19 World Cup opportunity per Player Career. */
  u19WorldCup?: U19WorldCupState;
  iccRankings?: Record<string, number>; // Encoded format/team rating and match-count state.
  lastMatchWon?: boolean; // result of most recent user match (for main-menu flavour text)
  /** Timestamp from which domestic/international career totals are exact. */
  statsScopeTrackingStartedAt?: number;
  /** Timestamp from which competition-and-format career totals are exact. */
  competitionStatsTrackingStartedAt?: number;
}
