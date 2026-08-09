/**
 * Career-mode depth: the ladder from academy to international, form-driven club
 * selection (you can be dropped), national-team call-ups, personal contracts &
 * wage negotiation, national captaincy, selector promotions, age-triggered
 * retirement, career-to-manager eligibility, and personal finance.
 */
import {
  CareerPathLevel,
  Contract,
  Format,
  Player,
  PlayerCareerResources,
  SaveGame,
} from '../domain/types';
import { clamp } from '../utils/math';
import {
  archetypeDropThreshold,
  archetypePathPolicy,
  nationalRepDeltaMultiplier,
  relationshipContractMultiplier,
} from './careerArchetypes';
import { computeValue, WAGE_RATE } from './finance';
import { matchImpactScore } from './progression';
import { passSelectionMultiplier } from './seasonPass';
import { autoXI, XI_SIZE } from './squad';
import { careerPlayingTeamId } from './youthFixtures';

export type CareerTier = 'ACADEMY' | 'DOMESTIC' | 'FRANCHISE' | 'INTERNATIONAL' | 'LEGEND';

export const TIER_LABEL: Record<CareerTier, string> = {
  ACADEMY: 'Academy Prospect',
  DOMESTIC: 'Domestic Regular',
  FRANCHISE: 'Franchise Star',
  INTERNATIONAL: 'International',
  LEGEND: 'Living Legend',
};

/** Attribute/cap thresholds that gate a national call-up. */
export const CALLUP_OVERALL = 70;
export const CALLUP_REP = 80;
const LEGEND_CAPS = 40;

export interface NationalState {
  caps: number;
  rep: number; // 0..100 progress toward (and beyond) a call-up
  capped: boolean; // has been called up to the national side
}

export function nationalState(save: SaveGame): NationalState {
  return { caps: save.userCaps ?? 0, rep: save.nationalRep ?? 0, capped: Boolean(save.capped) };
}

/**
 * Legend status is earned through a genuinely great CAREER — not a single stat.
 * Any of: a mountain of runs, a haul of wickets, an elite all-round record,
 * a trophy cabinet, or a long, high-class international career. Can also be
 * granted directly (a prestige IAP or a scripted achievement) via legendGranted.
 */
export function isLegend(save: SaveGame, user: Player): boolean {
  if (save.legendGranted) return true;
  if (!save.capped) return false; // you must have played international cricket
  const cs = user.careerStats;
  const runs = cs?.runs ?? 0;
  const wickets = cs?.wickets ?? 0;
  const caps = save.userCaps ?? 0;
  const titles = save.leagueTitles ?? 0;
  return (
    runs >= 8_000 || // prolific run-scorer
    wickets >= 300 || // great wicket-taker
    (runs >= 4_000 && wickets >= 150) || // elite all-rounder
    titles >= 5 || // serial winner
    caps >= 60 || // long international servant
    (caps >= LEGEND_CAPS && user.overall >= 84) // sustained world-class quality
  );
}

export function careerTier(save: SaveGame, user: Player): CareerTier {
  if (isLegend(save, user)) return 'LEGEND';
  if (save.capped) return 'INTERNATIONAL';
  if (user.overall >= 68) return 'FRANCHISE';
  if (user.overall >= 58) return 'DOMESTIC';
  return 'ACADEMY';
}

export interface CallupResult {
  calledUp: boolean; // first-time call-up just happened
  rep: number;
}

/**
 * Fold a club match into national selection reputation. The case for a call-up
 * is built 75% on genuine OUTPUT (runs/wickets) and 25% on the match rating — a
 * flattering rating from a cameo won't force selectors' hands; you have to score
 * runs and take wickets. Poor returns erode the reputation.
 *
 * `perf` is optional: when omitted (non-match rep ticks / tests) an implied
 * performance is derived from the rating so behaviour stays monotonic.
 */
export function accrueNationalRep(
  save: SaveGame,
  user: Player,
  rating: number,
  perf?: { runs: number; wickets: number },
): CallupResult {
  const before = save.nationalRep ?? 0;
  const ratingNorm = clamp((rating - 4) / 5, 0, 1); // rating 4 → 0, 9 → 1
  const impact = perf ? matchImpactScore(perf, user.role) : ratingNorm;
  const blended = 0.75 * impact + 0.25 * ratingNorm; // 0..1
  // Neutral point ~0.42: a genuinely good all-round game builds rep, a quiet one erodes it.
  const rawDelta = (blended - 0.42) * 26;
  const delta =
    rawDelta *
    nationalRepDeltaMultiplier(save, user, rawDelta) *
    passSelectionMultiplier(save, rawDelta);
  const rep = clamp(before + delta, 0, 100);
  save.nationalRep = Math.round(rep);
  if (!save.capped && user.overall >= CALLUP_OVERALL && rep >= CALLUP_REP) {
    save.capped = true;
    return { calledUp: true, rep: save.nationalRep };
  }
  return { calledUp: false, rep: save.nationalRep };
}

/** All countries with a viable player pool, most-represented first. */
export function nationsWithPool(save: SaveGame, minPlayers = XI_SIZE): string[] {
  const counts: Record<string, number> = {};
  for (const p of Object.values(save.players))
    counts[p.nationality] = (counts[p.nationality] ?? 0) + 1;
  return Object.keys(counts)
    .filter((c) => counts[c] >= minPlayers)
    .sort((a, b) => counts[b] - counts[a]);
}

/** Best XI available to a nation (optionally guaranteeing a player is included). */
export function buildNationalXI(save: SaveGame, country: string, mustIncludeId?: string): Player[] {
  const pool = Object.values(save.players).filter((p) => p.nationality === country && !p.retired);
  const ranked = [...pool].sort((a, b) => b.overall - a.overall);
  const picked: Player[] = [];
  const forced = mustIncludeId ? save.players[mustIncludeId] : undefined;
  if (forced) picked.push(forced);
  const keeper = ranked.find((player) => player.role === 'WK_BATTER');
  if (keeper && !picked.some((player) => player.id === keeper.id)) picked.push(keeper);
  for (const p of ranked) {
    if (picked.length >= 16) break;
    if (!picked.some((x) => x.id === p.id)) picked.push(p);
  }
  // autoXI guarantees a keeper + bowling balance and a sensible order.
  return autoXI(picked, forced?.id);
}

/**
 * Form threshold below which a player aged 20+ can be dropped from the XI.
 * 28/100 represents genuinely poor form — not just a bad patch, but a real
 * slump. Under-20 players are always selected regardless to protect early-
 * career engagement; the bench mechanic only bites once they're established.
 */
function inferredCareerResources(save: SaveGame, user: Player): PlayerCareerResources {
  const current = save.playerCareerResources;
  const adaptability = Math.round(
    (user.meta.discipline + user.batting.technique + user.batting.temperament) / 3,
  );
  const whiteBallTempo = Math.round(
    (user.meta.aggression + user.batting.power + user.batting.running) / 3,
  );
  const redBallMemory = Math.round(
    (user.batting.technique + user.batting.temperament + user.bowling.stamina) / 3,
  );
  const birthCountry = current?.birthCountry ?? user.nationality;
  const domesticCountry =
    (save.userTeamId ? save.teams[save.userTeamId]?.country : undefined) ??
    current?.domesticCountry ??
    birthCountry;
  const eligibleCountries = [
    ...new Set([birthCountry, ...(current?.eligibleCountries ?? [])].filter(Boolean)),
  ];
  const declaredCountry =
    current?.cappedCountry ??
    current?.declaredCountry ??
    (eligibleCountries.includes(user.nationality) ? user.nationality : eligibleCountries[0]);
  return {
    trainingFocus: Math.max(0, current?.trainingFocus ?? save.wallet.energy),
    trainingFocusCap: Math.max(1, current?.trainingFocusCap ?? 10),
    playerCondition: clamp(user.condition ?? current?.playerCondition ?? 100, 0, 100),
    form: clamp(user.meta.form, 0, 100),
    confidence: clamp(user.meta.confidence, 0, 100),
    coachTrust: clamp(current?.coachTrust ?? 55, 0, 100),
    adaptability: clamp(current?.adaptability ?? adaptability, 1, 100),
    whiteBallTempo: clamp(current?.whiteBallTempo ?? whiteBallTempo, 1, 100),
    redBallMemory: clamp(current?.redBallMemory ?? redBallMemory, 1, 100),
    specialization: current?.specialization ?? 'ALL_FORMATS',
    birthCountry,
    domesticCountry,
    cappedCountry:
      current?.cappedCountry ?? ((save.userCaps ?? 0) > 0 ? declaredCountry : undefined),
    declaredCountry,
    eligibleCountries,
    residencySeasons: { ...(current?.residencySeasons ?? { [domesticCountry]: 0 }) },
    lastFormat: current?.lastFormat,
    consecutiveMatches: Math.max(0, Math.floor(current?.consecutiveMatches ?? 0)),
    formatAppearances: { ...(current?.formatAppearances ?? {}) },
    requestedRestFixtureId: current?.requestedRestFixtureId,
    selectionGuaranteeMatches: Math.max(0, Math.floor(current?.selectionGuaranteeMatches ?? 0)),
    selectionBoostMatches: Math.max(0, Math.floor(current?.selectionBoostMatches ?? 0)),
    selectionBoostAmount: Math.max(0, current?.selectionBoostAmount ?? 0),
    lastSelection: current?.lastSelection,
    internationalSelections: { ...(current?.internationalSelections ?? {}) },
  };
}

/** Select an eligible national side before the player's first senior cap. */
export function declareInternationalCountry(
  save: SaveGame,
  countryId: string,
): { ok: boolean; reason?: string } {
  const resources = ensurePlayerCareerResources(save);
  if (!resources) return { ok: false, reason: 'Player career data is unavailable.' };
  if (resources.cappedCountry || (save.userCaps ?? 0) > 0) {
    return {
      ok: false,
      reason: `International allegiance is locked to ${resources.cappedCountry ?? resources.declaredCountry}.`,
    };
  }
  if (!resources.eligibleCountries.includes(countryId)) {
    return { ok: false, reason: 'That country is not yet available through birth or residency.' };
  }
  resources.declaredCountry = countryId;
  return { ok: true };
}

/** Count domestic residency and unlock a second national eligibility after three seasons. */
export function tickCareerResidency(save: SaveGame): string | undefined {
  const resources = ensurePlayerCareerResources(save);
  if (!resources) return undefined;
  const country = resources.domesticCountry;
  resources.residencySeasons[country] = (resources.residencySeasons[country] ?? 0) + 1;
  if (resources.residencySeasons[country] >= 3 && !resources.eligibleCountries.includes(country)) {
    resources.eligibleCountries.push(country);
    return country;
  }
  return undefined;
}

/** Ensure old and newly-created careers have the complete player workload state. */
export function ensurePlayerCareerResources(save: SaveGame): PlayerCareerResources | undefined {
  if (save.mode !== 'career' || !save.userPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  if (!user) return undefined;
  const inferred = inferredCareerResources(save, user);
  const resources = save.playerCareerResources
    ? Object.assign(save.playerCareerResources, inferred)
    : inferred;
  save.playerCareerResources = resources;
  user.condition = resources.playerCondition;
  return resources;
}

function shortFormat(format: Format): boolean {
  return format === 'T20' || format === 'HUNDRED' || format === 'T10';
}

function whiteBallFormat(format: Format): boolean {
  return shortFormat(format) || format === 'ODI';
}

function rivalFormatScore(player: Player, format: Format): number {
  if (shortFormat(format)) {
    return (player.meta.aggression + player.batting.power + player.batting.running) / 3;
  }
  if (format === 'TEST') {
    return (player.batting.technique + player.batting.temperament + player.bowling.stamina) / 3;
  }
  return (player.batting.timing + player.meta.discipline + player.bowling.accuracy) / 3;
}

/** Match-readiness modifier applied without mutating permanent attributes. */
export function careerFormatModifier(save: SaveGame, format: Format): number {
  if (!save.userPlayerId) return 0;
  const user = save.players[save.userPlayerId];
  if (!user) return 0;
  const resources = inferredCareerResources(save, user);
  const readiness = whiteBallFormat(format) ? resources.whiteBallTempo : resources.redBallMemory;
  const currentBucket = whiteBallFormat(format) ? 'WHITE' : 'RED';
  const previousBucket = resources.lastFormat
    ? whiteBallFormat(resources.lastFormat)
      ? 'WHITE'
      : 'RED'
    : currentBucket;
  const switchPenalty =
    previousBucket === currentBucket ? 0 : ((100 - resources.adaptability) / 100) * 6;
  const conditionPenalty = Math.max(0, 65 - resources.playerCondition) * 0.12;
  const specializationPenalty =
    format === 'TEST' && resources.specialization !== 'ALL_FORMATS'
      ? resources.specialization === 'T20_ONLY'
        ? 5
        : 2.5
      : 0;
  return clamp(
    (readiness - 50) * 0.08 - switchPenalty - conditionPenalty - specializationPenalty,
    -12,
    4,
  );
}

/** Clone the protagonist with temporary format/readiness adjustments for the match engine. */
export function prepareCareerPlayerForMatch(
  save: SaveGame,
  player: Player,
  format: Format,
): Player {
  if (save.mode !== 'career' || player.id !== save.userPlayerId) return player;
  const modifier = careerFormatModifier(save, format);
  const shift = (value: number): number => Math.round(clamp(value + modifier, 1, 99));
  const batting = { ...player.batting };
  const bowling = { ...player.bowling };
  if (shortFormat(format)) {
    batting.timing = shift(batting.timing);
    batting.power = shift(batting.power);
    batting.running = shift(batting.running);
    bowling.accuracy = shift(bowling.accuracy);
    bowling.variations = shift(bowling.variations);
  } else if (format === 'TEST') {
    batting.technique = shift(batting.technique);
    batting.footwork = shift(batting.footwork);
    batting.temperament = shift(batting.temperament);
    bowling.movement = shift(bowling.movement);
    bowling.stamina = shift(bowling.stamina);
  } else {
    batting.technique = shift(batting.technique);
    batting.timing = shift(batting.timing);
    batting.running = shift(batting.running);
    bowling.accuracy = shift(bowling.accuracy);
    bowling.variations = shift(bowling.variations);
  }
  return {
    ...player,
    batting,
    bowling,
    meta: { ...player.meta, fitness: shift(player.meta.fitness) },
  };
}

export interface CareerSelectionDecision {
  selected: boolean;
  userScore: number;
  rivalScore: number;
  reason: string;
}

/**
 * Compare same-role players using 40% ability, 35% form and 25% coach trust.
 * Format readiness and current condition refine the result.
 */
export function careerSelectionDecision(
  save: SaveGame,
  format: Format = 'T20',
  fixtureId?: string,
): CareerSelectionDecision {
  const activeTeamId = careerPlayingTeamId(save, fixtureId);
  if (!activeTeamId || !save.userPlayerId) {
    return { selected: false, userScore: 0, rivalScore: 0, reason: 'No active player squad.' };
  }
  const user = save.players[save.userPlayerId];
  const team = save.teams[activeTeamId];
  if (!user || !team) {
    return { selected: false, userScore: 0, rivalScore: 0, reason: 'Player squad unavailable.' };
  }
  const resources = inferredCareerResources(save, user);
  const selectionBoost =
    (resources.selectionBoostMatches ?? 0) > 0 ? (resources.selectionBoostAmount ?? 25) : 0;
  const userScore =
    user.overall * 0.4 +
    user.meta.form * 0.35 +
    resources.coachTrust * 0.25 +
    careerFormatModifier(save, format) +
    selectionBoost;
  const rivals = team.playerIds
    .map((id) => save.players[id])
    .filter((player): player is Player =>
      Boolean(
        player &&
        player.id !== user.id &&
        player.role === user.role &&
        !player.retired &&
        !player.injury,
      ),
    );
  const rivalScore = rivals.reduce((best, player) => {
    const trust = clamp(45 + player.meta.confidence * 0.1, 45, 55);
    const fit = (rivalFormatScore(player, format) - 50) * 0.08;
    return Math.max(best, player.overall * 0.4 + player.meta.form * 0.35 + trust * 0.25 + fit);
  }, 0);

  if (user.injury) {
    return { selected: false, userScore, rivalScore, reason: `Unavailable: ${user.injury.type}.` };
  }
  if (fixtureId && resources.requestedRestFixtureId === fixtureId) {
    return { selected: false, userScore, rivalScore, reason: 'Rested to recover condition.' };
  }
  if (resources.playerCondition < 18) {
    return { selected: false, userScore, rivalScore, reason: 'Rested: condition is too low.' };
  }
  if ((resources.selectionGuaranteeMatches ?? 0) > 0) {
    return {
      selected: true,
      userScore,
      rivalScore,
      reason: 'Selected: your last exceptional performance guarantees this appearance.',
    };
  }

  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'SCHOOL') {
    return {
      selected: true,
      userScore,
      rivalScore,
      reason: 'Selected in the development XI.',
    };
  }
  if (level === 'U19' && user.meta.form < 40) {
    return {
      selected: false,
      userScore,
      rivalScore,
      reason: 'Benched: U19 form is below the selector target of 40.',
    };
  }

  const archetypeThreshold = archetypeDropThreshold(save);
  if (user.meta.form < archetypeThreshold) {
    return {
      selected: false,
      userScore,
      rivalScore,
      reason: `Benched: form is below ${archetypeThreshold}.`,
    };
  }
  const allowance = level === 'U19' ? 6 : 2;
  const selected = rivalScore === 0 || userScore + allowance >= rivalScore;
  return {
    selected,
    userScore,
    rivalScore,
    reason: selected
      ? `Selected on role merit for ${format}.`
      : `Benched: a same-role rival leads the ${format} selection score.`,
  };
}

/**
 * Select the XI for the user's club.
 * - Under 20: always in the XI (protects early-career engagement).
 * - Injured: defers to the injury system.
 * - Age 20+, form < 28: the selectors can drop them — a rare but meaningful
 *   consequence that rewards consistent performances.
 */
export function selectCareerXI(
  save: SaveGame,
  format: Format = 'T20',
  fixtureId?: string,
): boolean {
  const activeTeamId = careerPlayingTeamId(save, fixtureId);
  if (!activeTeamId || !save.userPlayerId) return false;
  const team = save.teams[activeTeamId];
  const resources = ensurePlayerCareerResources(save);
  const decision = careerSelectionDecision(save, format, fixtureId);
  const squad = team.playerIds
    .map((id) => save.players[id])
    .filter((player): player is Player =>
      Boolean(player && (decision.selected || player.id !== save.userPlayerId)),
    );
  const forceId = decision.selected ? save.userPlayerId : undefined;
  team.xi = autoXI(squad, forceId).map((player) => player.id);
  if (resources) {
    resources.lastSelection = {
      fixtureId,
      format,
      selected: decision.selected,
      userScore: Math.round(decision.userScore),
      rivalScore: Math.round(decision.rivalScore),
      reason: decision.reason,
    };
  }
  return decision.selected;
}

/** Mark or clear a deliberate rest for the next fixture. */
export function setCareerRestRequest(save: SaveGame, fixtureId: string, rest: boolean): void {
  const resources = ensurePlayerCareerResources(save);
  if (!resources) return;
  resources.requestedRestFixtureId = rest ? fixtureId : undefined;
}

/** Existing role training also prepares the player for the next match format. */
export function prepareCareerFormat(save: SaveGame, format: Format): void {
  const resources = ensurePlayerCareerResources(save);
  if (!resources) return;
  if (whiteBallFormat(format)) {
    resources.whiteBallTempo = clamp(resources.whiteBallTempo + 5, 1, 100);
  } else {
    resources.redBallMemory = clamp(resources.redBallMemory + 5, 1, 100);
  }
  resources.adaptability = clamp(resources.adaptability + 0.5, 1, 100);
}

/** Apply workload, age-adjusted recovery, coach trust and format familiarity. */
export function applyCareerMatchReadiness(
  save: SaveGame,
  input: {
    fixtureId: string;
    format: Format;
    selected: boolean;
    rating?: number;
    ballsFaced?: number;
    ballsBowled?: number;
  },
): void {
  if (!save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  const resources = ensurePlayerCareerResources(save);
  if (!user || !resources) return;

  const ageRecovery = user.age <= 22 ? 6 : user.age <= 29 ? 4 : user.age <= 32 ? 2 : 0;
  if (input.selected) {
    const baseLoad =
      input.format === 'TEST' ? 25 : input.format === 'ODI' ? 16 : input.format === 'T20' ? 9 : 7;
    const workload = Math.min(
      10,
      Math.round((input.ballsFaced ?? 0) / 24 + (input.ballsBowled ?? 0) / 18),
    );
    resources.playerCondition = clamp(
      resources.playerCondition - baseLoad - workload + ageRecovery,
      0,
      100,
    );
    resources.consecutiveMatches += 1;
    resources.formatAppearances[input.format] =
      (resources.formatAppearances[input.format] ?? 0) + 1;
    const rating = input.rating ?? 5;
    if ((resources.selectionGuaranteeMatches ?? 0) > 0) {
      resources.selectionGuaranteeMatches = Math.max(
        0,
        (resources.selectionGuaranteeMatches ?? 0) - 1,
      );
    }
    if ((resources.selectionBoostMatches ?? 0) > 0) {
      resources.selectionBoostMatches = Math.max(0, (resources.selectionBoostMatches ?? 0) - 1);
      if (resources.selectionBoostMatches === 0) resources.selectionBoostAmount = 0;
    }
    if (rating >= 9.95) {
      user.meta.form = clamp(user.meta.form + 20, 0, 100);
      user.meta.confidence = clamp(user.meta.confidence + 15, 0, 100);
      resources.form = user.meta.form;
      resources.confidence = user.meta.confidence;
      resources.coachTrust = clamp(resources.coachTrust + 15, 0, 100);
      resources.selectionGuaranteeMatches = Math.max(1, resources.selectionGuaranteeMatches ?? 0);
    } else {
      const trustDelta = rating >= 8 ? 5 : rating >= 7 ? 3 : rating >= 6 ? 1 : rating < 4 ? -4 : -1;
      resources.coachTrust = clamp(resources.coachTrust + trustDelta, 0, 100);
    }
  } else {
    const recovery = user.age <= 22 ? 28 : user.age <= 29 ? 24 : user.age <= 32 ? 20 : 16;
    resources.playerCondition = clamp(resources.playerCondition + recovery, 0, 100);
    resources.consecutiveMatches = 0;
    if (resources.requestedRestFixtureId !== input.fixtureId) {
      resources.coachTrust = clamp(resources.coachTrust - 1, 0, 100);
    }
  }

  if (whiteBallFormat(input.format)) {
    resources.whiteBallTempo = clamp(
      resources.whiteBallTempo + (shortFormat(input.format) ? 3 : 2),
      1,
      100,
    );
    resources.redBallMemory = clamp(resources.redBallMemory - 1, 1, 100);
  } else {
    resources.redBallMemory = clamp(resources.redBallMemory + 3, 1, 100);
    resources.whiteBallTempo = clamp(resources.whiteBallTempo - 1, 1, 100);
  }
  resources.adaptability = clamp(resources.adaptability + 0.25, 1, 100);
  resources.lastFormat = input.format;
  resources.requestedRestFixtureId = undefined;
  user.condition = resources.playerCondition;

  const appearances = resources.formatAppearances;
  const total = Object.values(appearances).reduce((sum, value) => sum + (value ?? 0), 0);
  if (user.age >= 31 && total >= 12) {
    const shortAppearances =
      (appearances.T20 ?? 0) + (appearances.HUNDRED ?? 0) + (appearances.T10 ?? 0);
    const t20Share = shortAppearances / total;
    const whiteShare = (shortAppearances + (appearances.ODI ?? 0)) / total;
    resources.specialization =
      t20Share >= 0.65 ? 'T20_ONLY' : whiteShare >= 0.72 ? 'WHITE_BALL' : 'ALL_FORMATS';
  }
}

/**
 * A player who comes within one wicket or ten runs of an established record
 * receives a visible, bounded selection advantage for the next three fixtures.
 */
export function applyNearRecordSelectionBoost(
  save: SaveGame,
  performance: { runs: number; wickets: number },
): boolean {
  const resources = ensurePlayerCareerResources(save);
  if (!resources) return false;
  const battingRecord = save.records?.highestScore?.runs ?? 0;
  const bowlingRecord = save.records?.bestBowling?.wickets ?? 0;
  const nearBattingRecord = battingRecord >= 100 && performance.runs >= battingRecord - 10;
  const nearBowlingRecord = bowlingRecord >= 5 && performance.wickets >= bowlingRecord - 1;
  if (!nearBattingRecord && !nearBowlingRecord) return false;
  resources.selectionBoostMatches = 3;
  resources.selectionBoostAmount = 25;
  return true;
}

/** Full off-season recovery; permanent fitness and age decline remain separate. */
export function recoverCareerOffSeason(save: SaveGame): void {
  const resources = ensurePlayerCareerResources(save);
  if (!resources || !save.userPlayerId) return;
  resources.playerCondition = 100;
  resources.consecutiveMatches = 0;
  resources.requestedRestFixtureId = undefined;
  save.players[save.userPlayerId].condition = 100;
}

/* ---------------- Personal contract & wage negotiation ---------------- */

const CAPTAINCY_CAPS = 10; // caps before the armband is on the table

/** Give the user a starting contract if they don't have one (idempotent). */
export function ensureUserContract(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  if (save.careerPathLevel === 'SCHOOL' || save.careerPathLevel === 'U19') return;
  const user = save.players[save.userPlayerId];
  if (!user || user.contract) return;
  user.contract = { wage: Math.round(computeValue(user) * WAGE_RATE), yearsLeft: 2 };
}

/** True when the user's deal is up and needs (re)negotiating. */
export function userContractExpiring(save: SaveGame): boolean {
  if (!save.userPlayerId) return false;
  const c = save.players[save.userPlayerId]?.contract;
  return !c || c.yearsLeft <= 0;
}

export interface ContractOffer {
  wage: number;
  years: number;
  signingBonus: number; // paid to the player in coins on signing
}

/** A renewal offer scaled by the player's overall, tier and caps. */
export function contractOffer(save: SaveGame): ContractOffer {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!user) return { wage: 0, years: 1, signingBonus: 0 };
  const tierMult = save.capped ? 1.6 : user.overall >= 68 ? 1.25 : 1;
  const relationshipMult = relationshipContractMultiplier(save);
  const wage = Math.round(computeValue(user) * WAGE_RATE * tierMult * relationshipMult);
  const signingBonus = Math.round(
    ((user.overall - 40) * 22 * tierMult + (save.userCaps ?? 0) * 8) * relationshipMult,
  );
  const years = user.overall >= 72 ? 3 : 2;
  return { wage, years, signingBonus: Math.max(50, signingBonus) };
}

/** Accept a renewal: sets the contract and returns the coin signing bonus. */
export function signUserContract(save: SaveGame, offer: ContractOffer): number {
  if (!save.userPlayerId) return 0;
  const user = save.players[save.userPlayerId];
  if (!user) return 0;
  const contract: Contract = { wage: offer.wage, yearsLeft: offer.years };
  user.contract = contract;
  return Math.max(0, offer.signingBonus);
}

/** Tick the user's deal down a year at a season rollover. */
export function tickUserContract(save: SaveGame): void {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (user?.contract) user.contract.yearsLeft = Math.max(0, user.contract.yearsLeft - 1);
}

/* ===================================================================
 * CONTRACT NEGOTIATION — player counter-offers, hold-out, release clauses
 * ===================================================================
 */

export interface ContractDemand {
  /** Multiplier on the club's offered wage (1.0 = accept as-is, max 1.6). */
  wageMultiplier: number;
  /** Override years requested by player (1–5). */
  yearsOverride?: number;
  /** Additional signing bonus demanded on top of the club's offer (0–5000). */
  extraBonus?: number;
  /** Player demands a release clause at 150% of transfer value. */
  wantsReleaseClause?: boolean;
}

export interface NegotiationResult {
  /** Whether the club accepted the player's counter. */
  clubAccepted: boolean;
  /** The agreed-upon (or re-offered) contract terms. */
  finalOffer: ContractOffer;
  /**
   * If the club did NOT accept, they send back a counter-offer (midway
   * between their original and the player's demand). The player can accept
   * this, re-counter, or hold out.
   */
  counterOffer?: ContractOffer;
  /** Human-readable outcome text for the UI. */
  text: string;
}

/**
 * Player submits a counter-demand. The club responds based on:
 * • the player's value relative to the wage demand
 * • the club's current budget health
 * • a small random element (negotiating leverage varies)
 *
 * Returns either an acceptance or a counter-offer. Pure helper — the caller
 * must call `signUserContract` if they choose to accept.
 */
export function negotiateContract(
  save: SaveGame,
  demand: ContractDemand,
  rng: () => number,
): NegotiationResult {
  if (!save.userPlayerId || !save.userTeamId) {
    const fallback = contractOffer(save);
    return { clubAccepted: false, finalOffer: fallback, text: 'No active player or club.' };
  }
  const user = save.players[save.userPlayerId];
  const team = save.teams[save.userTeamId];
  const base = contractOffer(save);

  const demandedWage = Math.round(base.wage * clamp(demand.wageMultiplier, 1, 1.6));
  const demandedYears = demand.yearsOverride ?? base.years;
  const demandedBonus = base.signingBonus + (demand.extraBonus ?? 0);

  // Acceptance probability: rises with player value, falls with demand premium.
  const premium = demand.wageMultiplier - 1.0; // 0..0.6
  const valueFactor = clamp((user.overall - 50) / 40, 0, 1); // 0 (weak) → 1 (elite)
  const budgetFactor = clamp(team.budget / (demandedWage * 8), 0, 1);
  const capsFactor = Math.min((save.userCaps ?? 0) / 40, 0.2);
  const pAccept = clamp(
    0.6 + valueFactor * 0.3 + capsFactor - premium * 1.4 + budgetFactor * 0.1,
    0.05,
    0.92,
  );

  if (rng() < pAccept) {
    // Club accepts!
    const finalOffer: ContractOffer = {
      wage: demandedWage,
      years: demandedYears,
      signingBonus: Math.max(base.signingBonus, demandedBonus),
    };
    return {
      clubAccepted: true,
      finalOffer,
      text:
        demand.wageMultiplier > 1.1
          ? 'They accepted your terms! A strong negotiation result.'
          : 'Signed! Deal confirmed.',
    };
  }

  // Club sends a counter at roughly halfway between original and demand.
  const counterWage = Math.round(base.wage + (demandedWage - base.wage) * 0.45);
  const counter: ContractOffer = {
    wage: counterWage,
    years: demandedYears,
    signingBonus: Math.round(base.signingBonus * 1.12),
  };
  return {
    clubAccepted: false,
    finalOffer: base,
    counterOffer: counter,
    text:
      premium > 0.3
        ? 'The board baulked at the wage demand and came back with a compromise.'
        : 'The club countered — close, but not quite what you asked for.',
  };
}

/**
 * Hold-out: player refuses to sign, creating pressure on the club.
 * - Their form drops by 3 points (they're distracted).
 * - The club improves the next offer by ~10%.
 * Returns the improved offer to display in the UI.
 */
export function holdOut(save: SaveGame): ContractOffer {
  if (save.userPlayerId) {
    const user = save.players[save.userPlayerId];
    if (user) user.meta.form = clamp(user.meta.form - 3, 1, 99);
  }
  const base = contractOffer(save);
  return {
    wage: Math.round(base.wage * 1.1),
    years: base.years,
    signingBonus: Math.round(base.signingBonus * 1.25),
  };
}

/** Weekly wage in the player's contract (for display purposes). */
export function weeklyWage(annualWage: number): number {
  return Math.round(annualWage / 52);
}

/* ===================================================================
 * CAREER PATHWAY — performance-driven selector promotion
 * ===================================================================
 *
 * Promotion is earned, not gifted. A "readiness" score blends genuine OUTPUT
 * (runs/wickets accumulated at the level, 75%) with match ratings (25%). Rating
 * alone can never promote you — you must actually perform. This means an average
 * player can be stuck at a level for years, while a genuine prodigy fast-tracks.
 *
 *   SCHOOL  → U19      : readiness ≥ 0.75 over ≥ 5 matches, OR overall ≥ 62
 *   U19     → DOMESTIC : readiness ≥ 0.75 over ≥ 6 matches, OR overall ≥ 65
 *   DOMESTIC→ INTERNATIONAL : national call-up (accrueNationalRep — perf-driven)
 *
 * All transitions are idempotent and mutate the save.
 */

/** Readiness threshold — deliberately above the 0.25 rating ceiling so output is required. */
const PATH_READY = 0.75;

interface PathBench {
  minMatches: number;
  runsTarget: number; // accumulated runs at the level for a full performance score
  wktsTarget: number; // accumulated wickets at the level for a full performance score
  fastTrackOverall: number; // a genuine prodigy jumps the queue at this overall
}
const PATH_BENCH: Partial<Record<CareerPathLevel, PathBench>> = {
  SCHOOL: { minMatches: 5, runsTarget: 140, wktsTarget: 9, fastTrackOverall: 62 },
  U19: { minMatches: 6, runsTarget: 320, wktsTarget: 16, fastTrackOverall: 65 },
};

export function resolveCareerStageForAge(
  age: number,
  current?: CareerPathLevel,
  capped = false,
): CareerPathLevel {
  if (capped && age >= 20) return 'INTERNATIONAL';
  const ageFloor: CareerPathLevel = age <= 15 ? 'SCHOOL' : age <= 19 ? 'U19' : 'DOMESTIC';
  if (!current) return ageFloor;
  const rank: Record<CareerPathLevel, number> = {
    SCHOOL: 0,
    U19: 1,
    DOMESTIC: 2,
    INTERNATIONAL: 3,
  };
  // Age can move a stale player forward, but it must never undo a promotion
  // already earned through performance or a prodigy fast-track.
  return rank[current] > rank[ageFloor] ? current : ageFloor;
}

export function validateAgeEligibility(save: SaveGame): CareerPathLevel | undefined {
  if (save.mode !== 'career' || !save.userPlayerId) return undefined;
  const user = save.players[save.userPlayerId];
  if (!user) return undefined;
  const next = resolveCareerStageForAge(user.age, save.careerPathLevel, Boolean(save.capped));
  if (save.careerPathLevel !== next) promoteTo(save, next);
  return next;
}

/** Ensure the career path level is initialised and age-compatible. */
export function ensureCareerPathLevel(save: SaveGame): void {
  if (save.mode !== 'career') return;
  if (!save.careerPathLevel) {
    const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
    save.careerPathLevel = resolveCareerStageForAge(
      user?.age ?? 20,
      undefined,
      Boolean(save.capped),
    );
    save.careerPathMatches = 0;
  }
  validateAgeEligibility(save);
}

/** Record one match at the current path level. */
export function tickCareerPathMatch(save: SaveGame): void {
  if (save.mode !== 'career') return;
  ensureCareerPathLevel(save);
  save.careerPathMatches = (save.careerPathMatches ?? 0) + 1;
}

/**
 * Record a match's OUTPUT + rating at the current path level (call only when the
 * user actually played). Feeds the performance-based promotion readiness.
 */
export function recordPathPerformance(
  save: SaveGame,
  perf: { runs: number; wickets: number },
  rating: number,
): void {
  if (save.mode !== 'career') return;
  save.careerPathRuns = (save.careerPathRuns ?? 0) + perf.runs;
  save.careerPathWickets = (save.careerPathWickets ?? 0) + perf.wickets;
  save.careerPathRatingSum = (save.careerPathRatingSum ?? 0) + rating;
}

/** Role-weighted 0..1 fraction of the level's output benchmark achieved. */
function outputFraction(user: Player, runs: number, wkts: number, bench: PathBench): number {
  const bat = clamp(runs / bench.runsTarget, 0, 1.2);
  const bowl = clamp(wkts / bench.wktsTarget, 0, 1.2);
  if (user.role === 'BOWLER') return Math.min(1, bowl);
  if (user.role === 'BATTER' || user.role === 'WK_BATTER') return Math.min(1, bat);
  return Math.min(1, Math.max(bat, bowl) * 0.7 + Math.min(bat, bowl) * 0.3);
}

/**
 * Promotion readiness 0..1 at a youth level (75% output, 25% avg rating).
 * DOMESTIC uses national reputation; INTERNATIONAL is the ceiling.
 */
export function pathReadiness(save: SaveGame, user: Player): number {
  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'DOMESTIC') return clamp((save.nationalRep ?? 0) / 100, 0, 1);
  if (level === 'INTERNATIONAL') return 1;
  const bench = PATH_BENCH[level];
  if (!bench) return 1;
  const matches = save.careerPathMatches ?? 0;
  const runs = save.careerPathRuns ?? 0;
  const wkts = save.careerPathWickets ?? 0;
  const avgRating = matches > 0 ? (save.careerPathRatingSum ?? 0) / matches : 0;
  const outputComponent = outputFraction(user, runs, wkts, bench);
  const ratingComponent = clamp((avgRating - 4) / 4, 0, 1);
  return 0.75 * outputComponent + 0.25 * ratingComponent;
}

export interface PromotionResult {
  promoted: boolean;
  from?: CareerPathLevel;
  to?: CareerPathLevel;
}

function promoteTo(save: SaveGame, to: CareerPathLevel): void {
  save.careerPathLevel = to;
  save.careerPathMatches = 0;
  save.careerPathRuns = 0;
  save.careerPathWickets = 0;
  save.careerPathRatingSum = 0;
}

/**
 * Check whether the user should be promoted to the next path level.
 * Called after each match (and on season rollover) — cheap, idempotent.
 */
export function checkPathPromotion(save: SaveGame, _avgRating?: number): PromotionResult {
  if (save.mode !== 'career' || !save.userPlayerId) return { promoted: false };
  const beforeEligibility = save.careerPathLevel;
  ensureCareerPathLevel(save);
  if (beforeEligibility && save.careerPathLevel && beforeEligibility !== save.careerPathLevel) {
    return { promoted: true, from: beforeEligibility, to: save.careerPathLevel };
  }

  const user = save.players[save.userPlayerId];
  if (!user) return { promoted: false };
  const level = save.careerPathLevel!;
  const matches = save.careerPathMatches ?? 0;
  const policy = archetypePathPolicy(save);

  if (level === 'SCHOOL' && user.age >= 16) {
    promoteTo(save, 'U19');
    return { promoted: true, from: 'SCHOOL', to: 'U19' };
  }

  if (level === 'U19' && user.age >= 20) {
    promoteTo(save, 'DOMESTIC');
    return { promoted: true, from: 'U19', to: 'DOMESTIC' };
  }

  if (level === 'SCHOOL') {
    const bench = PATH_BENCH.SCHOOL!;
    const earned =
      matches >= Math.max(2, bench.minMatches + policy.matchAdjustment) &&
      pathReadiness(save, user) >= policy.readiness;
    const prodigy = user.overall >= bench.fastTrackOverall + policy.fastTrackAdjustment;
    if (earned || prodigy) {
      promoteTo(save, 'U19');
      return { promoted: true, from: 'SCHOOL', to: 'U19' };
    }
  }

  if (level === 'U19') {
    const bench = PATH_BENCH.U19!;
    const earned =
      matches >= Math.max(2, bench.minMatches + policy.matchAdjustment) &&
      pathReadiness(save, user) >= policy.readiness;
    const prodigy = user.overall >= bench.fastTrackOverall + policy.fastTrackAdjustment;
    if (earned || prodigy) {
      promoteTo(save, 'DOMESTIC');
      return { promoted: true, from: 'U19', to: 'DOMESTIC' };
    }
  }

  if (level === 'DOMESTIC' && save.capped) {
    promoteTo(save, 'INTERNATIONAL');
    return { promoted: true, from: 'DOMESTIC', to: 'INTERNATIONAL' };
  }

  return { promoted: false };
}

/** Human-readable label for each career path level. */
export const CAREER_PATH_LABEL: Record<CareerPathLevel, string> = {
  SCHOOL: 'School Cricket',
  U19: 'Under-19',
  DOMESTIC: 'Domestic Professional',
  INTERNATIONAL: 'International',
};

/** Next level label (for display in progression bars). */
export function nextCareerPathLabel(save: SaveGame): string {
  const level = save.careerPathLevel ?? 'DOMESTIC';
  const map: Record<CareerPathLevel, string> = {
    SCHOOL: 'Under-19 call-up',
    U19: 'Domestic contract',
    DOMESTIC: 'International cap',
    INTERNATIONAL: 'Living Legend',
  };
  return map[level];
}

/** How far through the current pathway level (0..1), for a progress bar. */
export function careerPathProgress(save: SaveGame, user: Player): number {
  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'DOMESTIC') return clamp((save.nationalRep ?? 0) / 100, 0, 1);
  if (level === 'INTERNATIONAL') return 1;
  // Youth: show the performance-readiness (scaled so hitting the bar reads ~full),
  // or the prodigy fast-track, whichever is further along.
  const bench = PATH_BENCH[level];
  if (!bench) return 1;
  const readiness = pathReadiness(save, user) / PATH_READY; // 1.0 = ready
  const prodigy = clamp((user.overall - 40) / (bench.fastTrackOverall - 40), 0, 1);
  return clamp(Math.max(readiness, prodigy), 0, 1);
}

/* ===================================================================
 * AGE-TRIGGERED RETIREMENT
 * ===================================================================
 * At each season rollover, if the player is 34+ and was previously
 * capped but hasn't played an international in 2 consecutive seasons,
 * the game triggers a "twilight" flag. One more missed season → the
 * retirement inbox message fires automatically.
 */

/**
 * Track whether the player qualified for international cricket this season.
 * Call at season end BEFORE resetting caps. Returns true if auto-retirement
 * should now be suggested (34+, missed intl for 2 seasons).
 */
export function checkAgeRetirement(save: SaveGame, capsThisSeason: number): boolean {
  if (save.mode !== 'career' || !save.userPlayerId) return false;
  const user = save.players[save.userPlayerId];
  if (!user || user.retired || (user.age ?? 0) < 34) return false;
  // Only applies to previously capped players
  if (!save.capped) return false;

  if (capsThisSeason === 0) {
    save.intlDroppedSeasons = (save.intlDroppedSeasons ?? 0) + 1;
  } else {
    save.intlDroppedSeasons = 0;
  }

  return (save.intlDroppedSeasons ?? 0) >= 2;
}

/** Close the international season and advance the lifetime-cap baseline. */
export function closeInternationalCapSeason(save: SaveGame): number {
  const totalCaps = save.userCaps ?? 0;
  const capsThisSeason = Math.max(0, totalCaps - (save.userCapsAtSeasonStart ?? totalCaps));
  save.userCapsAtSeasonStart = totalCaps;
  return capsThisSeason;
}

/* ===================================================================
 * CAREER → MANAGER TRANSITION
 * ===================================================================
 * After retirement, if the player's career was exceptional they can
 * choose to move into management. The bar is deliberately achievable
 * (not legend-only) — a solid 10-season career qualifies.
 */

export interface CareerStats {
  runs: number;
  wickets: number;
  caps: number;
  seasons: number;
}

/** Returns true once the player's career stats qualify for management. */
export function isCareerToManagerEligible(stats: CareerStats): boolean {
  const { runs, wickets, caps, seasons } = stats;
  // Any of these thresholds qualifies:
  return (
    runs >= 8_000 || // solid international run-scorer
    wickets >= 250 || // quality wicket-taker
    (runs >= 5_000 && wickets >= 150) || // quality all-rounder
    caps >= 50 || // established international
    seasons >= 10 // long enough career for experience
  );
}

/** Compute a "management reputation" starting value from career stats (0..100). */
export function managerRepFromCareer(stats: CareerStats): number {
  const runsScore = Math.min(40, Math.round(stats.runs / 400));
  const wktScore = Math.min(30, Math.round(stats.wickets / 10));
  const capsScore = Math.min(20, Math.round(stats.caps / 5));
  const seasonsScore = Math.min(10, stats.seasons);
  return clamp(runsScore + wktScore + capsScore + seasonsScore, 30, 95);
}

/* ===================================================================
 * PERSONAL FINANCE — stocks + cricket academy
 * ===================================================================
 */

export const STOCK_MIN_INVEST = 500; // coins
export const STOCK_MAX_INVEST = 50_000; // coins

/** Invest coins in the stock market. Mutates wallet and creates/updates the position. */
export function investInStocks(save: SaveGame, coins: number): { ok: boolean; reason?: string } {
  const toInvest = Math.round(coins);
  if (toInvest < STOCK_MIN_INVEST)
    return { ok: false, reason: `Minimum investment is ${STOCK_MIN_INVEST} coins.` };
  if (save.wallet.coins < toInvest)
    return { ok: false, reason: 'Not enough coins in your wallet.' };
  save.wallet = { ...save.wallet, coins: save.wallet.coins - toInvest };
  if (!save.stockInvestment) {
    save.stockInvestment = { invested: toInvest, currentValue: toInvest, totalWithdrawn: 0 };
  } else {
    save.stockInvestment.invested += toInvest;
    save.stockInvestment.currentValue += toInvest;
  }
  return { ok: true };
}

/** Withdraw all stock value back into the wallet. */
export function withdrawStocks(save: SaveGame): number {
  const inv = save.stockInvestment;
  if (!inv || inv.currentValue <= 0) return 0;
  const value = Math.round(inv.currentValue);
  save.wallet = { ...save.wallet, coins: save.wallet.coins + value };
  inv.totalWithdrawn += value;
  inv.currentValue = 0;
  inv.invested = 0;
  return value;
}

/**
 * Fluctuate stock value at season end: ±10% based on win rate this season
 * and a random component. A dominant season = markets reward it.
 */
export function tickStockMarket(save: SaveGame, winRate: number): void {
  const inv = save.stockInvestment;
  if (!inv || inv.currentValue <= 0) return;
  // Win rate 50% = ±0%; higher = positive drift; market noise ±5%
  const drift = (winRate - 0.5) * 0.14;
  const noise = Math.random() * 0.1 - 0.05;
  const multiplier = 1 + drift + noise;
  inv.currentValue = Math.max(0, Math.round(inv.currentValue * multiplier));
  // Record the value for the sparkline chart (keep last 8 values).
  if (!inv.history) inv.history = [];
  inv.history.push(inv.currentValue);
  if (inv.history.length > 8) inv.history = inv.history.slice(-8);
}

// Academy setup costs per tier.
export const ACADEMY_COSTS: Record<1 | 2 | 3, number> = {
  1: 15_000, // Small local coaching school
  2: 50_000, // Regional centre
  3: 150_000, // Elite national academy
};
export const ACADEMY_REVENUE: Record<1 | 2 | 3, number> = {
  1: 800,
  2: 2_500,
  3: 7_000,
};
export const ACADEMY_STUDENTS: Record<1 | 2 | 3, number> = {
  1: 15,
  2: 60,
  3: 200,
};

/** Establish or upgrade a personal cricket academy. */
export function fundPersonalAcademy(
  save: SaveGame,
  tier: 1 | 2 | 3,
  name: string,
): { ok: boolean; reason?: string } {
  const cost = ACADEMY_COSTS[tier];
  if (save.wallet.coins < cost)
    return {
      ok: false,
      reason: `Need ${cost.toLocaleString()} coins to open a Tier-${tier} academy.`,
    };
  if (save.personalAcademy && save.personalAcademy.tier >= tier) {
    return { ok: false, reason: 'Your academy is already at this tier or higher.' };
  }
  save.wallet = { ...save.wallet, coins: save.wallet.coins - cost };
  const currentYear = save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
    : 2026;
  save.personalAcademy = {
    name,
    tier,
    studentsCount: ACADEMY_STUDENTS[tier],
    revenuePerSeason: ACADEMY_REVENUE[tier],
    foundedYear: currentYear,
  };
  return { ok: true };
}

/** Pay out academy revenue at season end. Returns coins awarded. */
export function collectAcademyRevenue(save: SaveGame): number {
  const ac = save.personalAcademy;
  if (!ac) return 0;
  const revenue = ac.revenuePerSeason;
  save.wallet = { ...save.wallet, coins: save.wallet.coins + revenue };
  return revenue;
}

/**
 * Once a capped player is experienced and highly rated (and the best in their
 * national side), hand them the armband. Sets `save.captainCountry` — which the
 * profile screen reads but nothing previously wrote. Returns true on appointment.
 */
export function maybeNationalCaptaincy(save: SaveGame): boolean {
  if (!save.capped || save.captainCountry || !save.userPlayerId) return false;
  const user = save.players[save.userPlayerId];
  if (!user || (save.userCaps ?? 0) < CAPTAINCY_CAPS || user.overall < 76) return false;
  const country = ensurePlayerCareerResources(save)?.cappedCountry ?? user.nationality;
  const compatriots = Object.values(save.players).filter(
    (p) => p.nationality === country && !p.retired && p.id !== user.id,
  );
  const best = compatriots.reduce((m, p) => Math.max(m, p.overall), 0);
  if (user.overall < best) return false; // not yet the standout
  save.captainCountry = true;
  return true;
}
