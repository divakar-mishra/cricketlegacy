/**
 * Career progression: training, age-based growth/decline, form, match ratings,
 * per-match objectives and season awards. Pure functions (mutating helpers are
 * explicit) so they are easy to unit-test.
 */
import { ATTR_META, TRAINING } from '../data/attributes';
import { CareerPathLevel, MatchState, Player, Role, SaveGame } from '../domain/types';
import { computeOverall } from '../engine/rating';
import { makeRng, Rng } from '../engine/rng';
import { clamp } from '../utils/math';
import { trainingAttributeCeiling } from './youthBalance';

type GroupId = keyof typeof ATTR_META; // 'batting' | 'bowling' | 'fielding' | 'meta'
export type TrainGroup =
  'batting' | 'bowling' | 'fielding' | 'wicketkeeping' | 'fitness' | 'mental';
export const TRAINING_GROUPS: GroupId[] = ['batting', 'bowling', 'fielding', 'meta'];

/**
 * All-Rounders split the same training week across two technical disciplines.
 * The small workload reduction keeps their full-career OVR alongside the two
 * specialist roles while every valid paid session still moves attributes.
 */
export const ALLROUNDER_TRAINING_GAIN_MULTIPLIER = 0.98;

function stableSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface TrainingFocus {
  id: TrainGroup;
  label: string;
  sourceGroup: GroupId;
  attributes: string[];
}

export const TRAINING_FOCUSES: Record<TrainGroup, TrainingFocus> = {
  batting: {
    id: 'batting',
    label: 'Batting',
    sourceGroup: 'batting',
    attributes: ATTR_META.batting.map(([key]) => key as string),
  },
  bowling: {
    id: 'bowling',
    label: 'Bowling',
    sourceGroup: 'bowling',
    attributes: ATTR_META.bowling.map(([key]) => key as string),
  },
  fielding: {
    id: 'fielding',
    label: 'Fielding',
    sourceGroup: 'fielding',
    attributes: ['catching', 'throwing', 'agility'],
  },
  wicketkeeping: {
    id: 'wicketkeeping',
    label: 'Wicketkeeping',
    sourceGroup: 'fielding',
    attributes: ['keeping', 'catching', 'agility'],
  },
  fitness: {
    id: 'fitness',
    label: 'Fitness',
    sourceGroup: 'meta',
    attributes: ['fitness'],
  },
  mental: {
    id: 'mental',
    label: 'Mental',
    sourceGroup: 'meta',
    attributes: ['confidence', 'aggression', 'discipline'],
  },
};

function groupObj(player: Player, group: GroupId): Record<string, number> {
  return player[group] as unknown as Record<string, number>;
}

export function trainingGroupsForRole(role: Role): TrainGroup[] {
  switch (role) {
    case 'BATTER':
      return ['batting', 'fielding', 'fitness', 'mental'];
    case 'BOWLER':
      return ['bowling', 'fielding', 'fitness', 'mental'];
    case 'WK_BATTER':
      return ['batting', 'wicketkeeping', 'fielding', 'fitness', 'mental'];
    case 'ALLROUNDER':
      return ['batting', 'bowling', 'fielding', 'fitness', 'mental'];
    default:
      return ['batting', 'fielding', 'fitness', 'mental'];
  }
}

export function trainingFocusForGroup(group: TrainGroup): TrainingFocus {
  return TRAINING_FOCUSES[group];
}

export function trainingFocusesForRole(role: Role): TrainingFocus[] {
  return trainingGroupsForRole(role).map(trainingFocusForGroup);
}

export function canTrainGroup(player: Player, group: TrainGroup): boolean {
  return trainingGroupsForRole(player.role).includes(group);
}

/* ---------------- Age-based development (season rollover) ---------------- */

/**
 * Advance a player one season. AI careers retain natural development; the
 * playable career can disable free positive growth so upgrades come from the
 * paid training sessions the user chose. Age-related decline still applies.
 */
export function developPlayer(
  player: Player,
  rng: Rng,
  stageCeiling = 99,
  allowPositiveGrowth = true,
): void {
  player.age += 1;
  const growthCap = Math.min(
    stageCeiling,
    player.isUserPlayer ? 99 : Math.min(99, player.potential + 5),
  );

  let center: number;
  if (player.age <= 25) center = 2.6;
  else if (player.age <= 29) center = 0.6;
  else if (player.age <= 32) center = -0.9;
  else center = -2.4;
  const growing = center > 0;

  if (growing && !allowPositiveGrowth) {
    player.overall = computeOverall(player);
    return;
  }

  for (const g of TRAINING_GROUPS) {
    const obj = groupObj(player, g);
    for (const [key] of ATTR_META[g]) {
      const jitter = center + (rng() * 2 - 1) * 1.2;
      let next = Math.round(obj[key] + jitter);
      // A stage cap blocks new automatic growth but never downgrades an old
      // save whose attribute already sits above today's cap.
      if (growing) next = Math.min(next, Math.max(obj[key], growthCap));
      obj[key] = clamp(next, 1, 99);
    }
  }
  player.overall = computeOverall(player);
}

/* ---------------- Training (coin sink, in-season) ---------------- */

export function trainingSessionLimit(level?: CareerPathLevel): number {
  if (level === 'SCHOOL') return 8;
  if (level === 'U19') return 12;
  return TRAINING.maxSessionsPerSeason;
}

export function trainingFocusSessionLimit(level?: CareerPathLevel): number {
  return Math.ceil(trainingSessionLimit(level) / 2);
}

export function trainingCostMultiplier(overall: number): number {
  // Late development is the long-term economy boundary. Sessions still grant
  // their full visible attribute movement, but sustaining an elite rating now
  // requires substantially more earned/ad/IAP currency than reaching the
  // professional 80s.
  if (overall >= 90) return 60;
  if (overall >= 85) return 10;
  if (overall >= 80) return 1.75;
  if (overall >= 70) return 1.25;
  return 1;
}

export function trainingCost(sessionsDone: number, overall = 0, role?: Role): number {
  const base = TRAINING.baseCost + sessionsDone * TRAINING.costGrowth;
  // Batting specialists spread development across six core batting skills,
  // compared with five bowling skills. The development discount prevents a
  // low-rated specialist from becoming permanently benched before reaching
  // professional standard; it ends at 80 OVR, before elite progression.
  const battingSpecialist = role === 'BATTER' || role === 'WK_BATTER';
  const roleCostFactor = battingSpecialist
    ? overall < 80
      ? 0.3
      : overall >= 90
        ? 4
        : overall >= 85
          ? 2
          : 1
    : role === 'ALLROUNDER' && overall >= 90
      ? 2
      : role === 'ALLROUNDER' && overall >= 85
        ? 1.2
        : role === 'BOWLER' && overall >= 90
          ? 4
          : 1;
  return Math.round(base * trainingCostMultiplier(overall) * roleCostFactor);
}

export function sessionsDone(player: Player, group?: TrainGroup): number {
  if (!group) return player.trainingSessionsThisSeason ?? 0;
  return player.trainingGroupSessionsThisSeason?.[group] ?? 0;
}

export function canTrain(
  player: Player,
  group?: TrainGroup,
  careerPathLevel?: CareerPathLevel,
): boolean {
  if (group && !canTrainGroup(player, group)) return false;
  return (
    sessionsDone(player) < trainingSessionLimit(careerPathLevel) &&
    (!group || sessionsDone(player, group) < trainingFocusSessionLimit(careerPathLevel))
  );
}

export interface TrainGain {
  key: string;
  label: string;
  from: number;
  to: number;
}

/** Improve the three weakest attributes in a focus group. Mutates the player. */
export function applyTraining(
  player: Player,
  group: TrainGroup,
  rng: Rng,
  careerPathLevel?: CareerPathLevel,
  gainMultiplier = 1,
): TrainGain[] {
  if (!canTrain(player, group, careerPathLevel)) return [];
  const focus = trainingFocusForGroup(group);
  const obj = groupObj(player, focus.sourceGroup);
  const labels = new Map(
    ATTR_META[focus.sourceGroup].map(([key, label]) => [key as string, label]),
  );
  const entries = focus.attributes.map((key) => ({
    key,
    label: labels.get(key) ?? key,
    val: obj[key],
  }));
  entries.sort((a, b) => a.val - b.val);
  const ceiling = Math.min(TRAINING.attrCeiling, trainingAttributeCeiling(careerPathLevel));

  const gains: TrainGain[] = [];
  for (const e of entries.slice(0, TRAINING.attrsPerSession)) {
    const baseGain =
      TRAINING.gainMin + Math.floor(rng() * (TRAINING.gainMax - TRAINING.gainMin + 1));
    const roleMultiplier = player.role === 'ALLROUNDER' ? ALLROUNDER_TRAINING_GAIN_MULTIPLIER : 1;
    const scaledGain = baseGain * Math.max(1, gainMultiplier) * roleMultiplier;
    const wholeGain = Math.floor(scaledGain);
    const gain = Math.max(1, wholeGain + (rng() < scaledGain - wholeGain ? 1 : 0));
    const to = clamp(e.val + gain, 1, ceiling);
    if (to <= e.val) continue;
    obj[e.key] = to;
    gains.push({ key: e.key, label: e.label, from: e.val, to });
  }
  if (gains.length === 0) return [];
  player.overall = computeOverall(player);
  player.trainingGroupSessionsThisSeason = {
    ...(player.trainingGroupSessionsThisSeason ?? {}),
    [group]: sessionsDone(player, group) + 1,
  };
  player.trainingSessionsThisSeason = sessionsDone(player) + 1;
  return gains;
}

/* ---------------- Match performance, form & ratings ---------------- */

export interface MatchPerformance {
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  bowled: boolean;
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
}

export function userPerformance(match: MatchState, userId: string): MatchPerformance {
  const p: MatchPerformance = {
    batted: false,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    bowled: false,
    wickets: 0,
    runsConceded: 0,
    ballsBowled: 0,
  };
  for (const inn of match.innings) {
    const b = inn.batting.find((x) => x.playerId === userId);
    if (b && (b.balls > 0 || b.out)) {
      p.batted = true;
      p.runs += b.runs;
      p.balls += b.balls;
      p.fours += b.fours;
      p.sixes += b.sixes;
      if (b.out) p.out = true;
    }
    const bw = inn.bowling.find((x) => x.playerId === userId);
    if (bw && bw.balls > 0) {
      p.bowled = true;
      p.wickets += bw.wickets;
      p.runsConceded += bw.runs;
      p.ballsBowled += bw.balls;
    }
  }
  return p;
}

const economy = (p: MatchPerformance): number =>
  p.ballsBowled > 0 ? p.runsConceded / (p.ballsBowled / 6) : 0;

/** Adjust the player's form & confidence based on how the match went. */
export function updateFormAfterMatch(player: Player, perf: MatchPerformance): void {
  let d = 0;
  if (perf.batted) {
    if (perf.runs >= 50) d += 12;
    else if (perf.runs >= 30) d += 7;
    else if (perf.runs >= 15) d += 2;
    else if (perf.out && perf.runs < 10) d -= 5;
    else d -= 1;
  }
  if (perf.bowled) {
    const econ = economy(perf);
    if (perf.wickets >= 3) d += 12;
    else if (perf.wickets >= 2) d += 7;
    else if (perf.wickets >= 1) d += 3;
    else if (econ > 10) d -= 6;
    else d -= 1;
  }
  player.meta.form = clamp(Math.round(player.meta.form + d), 1, 99);
  player.meta.confidence = clamp(Math.round(player.meta.confidence + d * 0.4), 1, 99);
}

/* ---------------- Team morale after match results (Feature 3) ---------------- */

/**
 * Update the entire squad's morale based on match outcome.
 * Win: +2–5; Loss: −2–5; Thrashing (margin ≥ 100 runs or 8 wickets): −8.
 * A consistent winning streak builds a "team spirit" multiplier (capped 1.2×).
 */
export function updateTeamMorale(save: SaveGame, userWon: boolean, teamId = save.userTeamId): void {
  if (!teamId) return;
  const team = save.teams[teamId];

  // Determine thrashing based on recent result in fixtures.
  const recentFixtures = Object.values(save.fixtures)
    .filter((f) => f.played && (f.homeTeamId === teamId || f.awayTeamId === teamId))
    .slice(-1);
  const lastFx = recentFixtures[0];
  const isThrashing =
    lastFx && !userWon && lastFx.winnerTeamId !== undefined && lastFx.winnerTeamId !== teamId;

  // Spirit multiplier: ratio of wins in last 5 matches.
  const last5 = Object.values(save.fixtures)
    .filter((f) => f.played && (f.homeTeamId === teamId || f.awayTeamId === teamId))
    .slice(-5);
  const recentWins = last5.filter((f) => f.winnerTeamId === teamId).length;
  const spiritMultiplier = clamp(1 + (recentWins / 5) * 0.2, 1, 1.2);

  // Match settlement must be reproducible from the save and fixture. Using
  // ambient Math.random here made identical career-audit runs diverge and
  // could change later selection/results after reloading the same save.
  const rng = makeRng(stableSeed(`${save.id}:${lastFx?.id ?? save.currentSeasonId}:morale`));
  const delta = userWon
    ? Math.round((2 + rng() * 3) * spiritMultiplier)
    : isThrashing
      ? -8
      : -(2 + Math.round(rng() * 3));

  for (const id of team.playerIds) {
    const p = save.players[id];
    if (!p) continue;
    p.morale = clamp((p.morale ?? 70) + delta, 0, 100);
  }
}

/**
 * Performance impact of a match, 0..1 — how much genuine ON-FIELD output the
 * player produced (runs for batters, wickets for bowlers, both for all-rounders).
 * This is the *performance* half of progression (weighted 75%), deliberately
 * separate from `matchRating` (the *rating* half, weighted 25%). A high rating
 * from a cameo cannot substitute for sustained output.
 */
export function matchImpactScore(perf: { runs: number; wickets: number }, role: Role): number {
  const batImpact = clamp(perf.runs / 55, 0, 1.15); // ~55 runs = a top-class knock
  const bowlImpact = clamp(perf.wickets / 3.2, 0, 1.15); // ~3+ wickets = a match-winning spell
  if (role === 'BOWLER') return clamp(bowlImpact, 0, 1);
  if (role === 'BATTER' || role === 'WK_BATTER') return clamp(batImpact, 0, 1);
  // All-rounder: reward the stronger discipline, credit the weaker one partially.
  return clamp(Math.max(batImpact, bowlImpact) * 0.7 + Math.min(batImpact, bowlImpact) * 0.3, 0, 1);
}

/** 1.0–10.0 match rating (out of 10). */
export function matchRating(perf: MatchPerformance): number {
  let r = 5.0;
  if (perf.batted) {
    r += perf.runs / 12 + perf.sixes * 0.15 + perf.fours * 0.08;
    if (!perf.out && perf.balls > 0) r += 0.4;
    if (perf.out && perf.runs === 0) r -= 1.5;
  }
  if (perf.bowled) {
    const econ = economy(perf);
    r += perf.wickets * 1.3;
    if (econ < 6) r += 0.6;
    else if (econ > 10) r -= 0.8;
  }
  return clamp(Math.round(r * 10) / 10, 1, 10);
}

/* ---------------- Objectives ---------------- */

export interface Objective {
  text: string;
  kind: 'RUNS' | 'WICKETS' | 'EITHER';
  runs?: number;
  wickets?: number;
  reward: number;
}

export function matchObjective(role: Role): Objective {
  switch (role) {
    case 'BOWLER':
      return { text: 'Take 2+ wickets', kind: 'WICKETS', wickets: 2, reward: 100 };
    case 'ALLROUNDER':
      return {
        text: 'Score 20+ or take 2 wickets',
        kind: 'EITHER',
        runs: 20,
        wickets: 2,
        reward: 100,
      };
    default:
      return { text: 'Score 30+ runs', kind: 'RUNS', runs: 30, reward: 100 };
  }
}

export function objectiveMet(perf: MatchPerformance, obj: Objective): boolean {
  const runsOk = obj.runs != null && perf.runs >= obj.runs;
  const wktOk = obj.wickets != null && perf.wickets >= obj.wickets;
  if (obj.kind === 'RUNS') return runsOk;
  if (obj.kind === 'WICKETS') return wktOk;
  return runsOk || wktOk;
}

/* ---------------- Season awards ---------------- */

export interface SeasonAwards {
  topScorer?: { playerId: string; runs: number };
  topWicketTaker?: { playerId: string; wickets: number };
}

export function seasonAwards(save: SaveGame): SeasonAwards {
  let topScorer: SeasonAwards['topScorer'];
  let topWicketTaker: SeasonAwards['topWicketTaker'];
  for (const p of Object.values(save.players)) {
    const s = p.seasonStats;
    if (!s) continue;
    if (!topScorer || s.runs > topScorer.runs) topScorer = { playerId: p.id, runs: s.runs };
    if (!topWicketTaker || s.wickets > topWicketTaker.wickets) {
      topWicketTaker = { playerId: p.id, wickets: s.wickets };
    }
  }
  return { topScorer, topWicketTaker };
}
