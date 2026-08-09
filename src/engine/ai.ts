import { FORMATS } from '../data/gameConfig';
import { Conditions, Difficulty, Format, Player } from '../domain/types';
import { clamp } from '../utils/math';
import { bowlingMean, isSpinner } from './rating';
import { Rng } from './rng';

/** Par run-rate per over used to judge how aggressive to bat. */
const PAR_RUN_RATE: Record<Format, number> = {
  T20: 8.3,
  ODI: 5.7,
  TEST: 3.2,
  HUNDRED: 8.6,
  T10: 10.5,
};

/**
 * Per-format acceleration profile for a side *setting* a total (not chasing).
 * `base = start + phase*slope`, plus `deathBoost` once `phase > deathFrom`.
 *
 * T20/HUNDRED intentionally reproduce the original `0.32 + phase*0.5 (+0.15 at
 * the death)` curve so verified T20 balance + the determinism snapshot are
 * preserved. ODI flattens the middle overs (real 50-over innings consolidate,
 * so ~6-7 wickets fall, not ~9), and TEST bats very defensively so sides are
 * not routinely bowled out inside the over budget → realistic draw rate.
 */
interface AccelProfile {
  start: number;
  slope: number;
  deathBoost: number;
  deathFrom: number;
}
const ACCEL: Record<Format, AccelProfile> = {
  T20: { start: 0.32, slope: 0.5, deathBoost: 0.15, deathFrom: 0.8 },
  HUNDRED: { start: 0.32, slope: 0.5, deathBoost: 0.15, deathFrom: 0.8 },
  T10: { start: 0.44, slope: 0.44, deathBoost: 0.14, deathFrom: 0.7 },
  ODI: { start: 0.26, slope: 0.32, deathBoost: 0.26, deathFrom: 0.8 },
  TEST: { start: 0.16, slope: 0.12, deathBoost: 0, deathFrom: 2 },
};

/** Difficulty scales AI aggression + reduces its variance — never free runs/wickets. */
export function difficultyAggression(d: Difficulty): number {
  return { EASY: 0.78, NORMAL: 1.0, HARD: 1.08, PRO: 1.15 }[d];
}

export interface BattingSituation {
  format: Format;
  ballsBowledLegal: number;
  wicketsLost: number;
  scoreNow: number;
  target?: number;
  batter: Player;
  difficulty: Difficulty;
}

/** Target aggression 0..1 for the current delivery. */
export function battingAggression(s: BattingSituation): number {
  const fmt = FORMATS[s.format];
  const totalBalls = fmt.overs * fmt.ballsPerOver;
  const ballsLeft = Math.max(1, totalBalls - s.ballsBowledLegal);
  const wicketsLeft = Math.max(1, 10 - s.wicketsLost);
  const phase = clamp(s.ballsBowledLegal / totalBalls, 0, 1);
  const par = PAR_RUN_RATE[s.format];

  let base: number;
  let desperate = false;
  if (s.target != null) {
    const runsNeeded = Math.max(0, s.target - s.scoreNow);
    const reqRate = (runsNeeded / ballsLeft) * fmt.ballsPerOver;
    base = clamp(0.35 + (reqRate - par) * 0.07, 0.1, 0.97);
    desperate = reqRate > par * 1.4;
  } else {
    // Setting a total: start watchful, accelerate, slog at the death (per format).
    const a = ACCEL[s.format];
    base = a.start + phase * a.slope;
    if (phase > a.deathFrom) base += a.deathBoost;
  }

  // Protect the tail unless the chase demands risk. Longer formats guard deeper
  // (more overs in hand → less need to slog with the tail exposed).
  const tailThreshold = s.format === 'TEST' ? 5 : s.format === 'ODI' ? 4 : 3;
  const wicketFactor = wicketsLeft <= tailThreshold && !desperate ? -0.18 : 0;
  // Personal temperament nudge.
  const personal = ((s.batter.meta.aggression - 50) / 100) * 0.2;

  const raw = base + wicketFactor + personal;
  return clamp(raw * difficultyAggression(s.difficulty), 0.06, 0.98);
}

export interface BowlerSelectionCtx {
  format: Format;
  conditions: Conditions;
  lastBowlerId?: string;
  oversBowled: Record<string, number>;
  /** Over about to be bowled (0-indexed) — drives phase-aware selection. */
  over?: number;
  /** The batter on strike at the top of the over — drives matchup targeting. */
  striker?: Player;
  /** Innings over limit after rain/Test caps. */
  inningsOvers?: number;
  /** Live figures let a captain reward a bowler who is taking wickets now. */
  bowlingFigures?: Record<string, { balls: number; runs: number; wickets: number }>;
  /** Career protagonist, considered on merit after their guaranteed spell. */
  preferredPlayerId?: string;
}

export function minimumAllRounderOvers(format: Format): number {
  switch (format) {
    case 'TEST':
      return 8;
    case 'ODI':
      return 4;
    case 'T20':
    case 'HUNDRED':
      return 2;
    case 'T10':
      return 1;
  }
}

/**
 * Guarantees a selected career all-rounder a meaningful spell. The spell is
 * scheduled early enough to survive short chases, while still respecting the
 * consecutive-over and per-format bowling limits.
 */
export function requiredAllRounderBowler(
  bowlers: Player[],
  ctx: BowlerSelectionCtx,
  preferredPlayerId?: string,
): Player | undefined {
  if (!preferredPlayerId) return undefined;
  const player = bowlers.find(
    (bowler) => bowler.id === preferredPlayerId && bowler.role === 'ALLROUNDER',
  );
  if (!player || player.id === ctx.lastBowlerId) return undefined;

  const format = FORMATS[ctx.format];
  const minimum = Math.min(minimumAllRounderOvers(ctx.format), format.maxOversPerBowler);
  const bowled = ctx.oversBowled[player.id] ?? 0;
  if (bowled >= minimum || bowled >= format.maxOversPerBowler) return undefined;

  const over = ctx.over ?? 0;
  const inningsOvers = Math.max(1, ctx.inningsOvers ?? format.overs);
  const dueByNow = Math.min(minimum, Math.floor((over + 1) / 2));
  const oversRemaining = Math.max(0, inningsOvers - over);
  const needsCatchUp = oversRemaining <= (minimum - bowled) * 2;
  return bowled < dueByNow || needsCatchUp ? player : undefined;
}

/**
 * Captain AI: choose the next bowler by a utility score. Beyond raw skill and
 * conditions it now models real captaincy: **strike bowlers open and close** the
 * innings (powerplay + death), part-timers/spin fill the middle, and the captain
 * **targets the batter's weakness** (spin at poor footwork, pace at poor
 * technique). Usage is still spread and a little noise keeps it unpredictable.
 */
export function selectBowler(bowlers: Player[], ctx: BowlerSelectionCtx, rng: Rng): Player {
  const fmt = FORMATS[ctx.format];
  const available = bowlers.filter((b) => (ctx.oversBowled[b.id] ?? 0) < fmt.maxOversPerBowler);
  const pool = available.filter((b) => b.id !== ctx.lastBowlerId);
  const candidates = pool.length ? pool : available.length ? available : bowlers;

  const dusty = ctx.conditions.pitch === 'DUSTY' || ctx.conditions.pitch === 'CRACKED';
  const seaming = ctx.conditions.pitch === 'GREEN' || ctx.conditions.weather === 'OVERCAST';

  // Match phase (limited overs only; Test has no powerplay/death premium).
  const limited = fmt.overs < 200;
  const phase = limited && ctx.over != null ? clamp(ctx.over / fmt.overs, 0, 1) : -1;
  const inPowerplay = ctx.over != null && ctx.over < fmt.powerplayOvers;
  const inDeath = phase >= 0.8;
  const inMiddle = phase >= 0.35 && phase < 0.8;

  let best = candidates[0];
  let bestScore = -Infinity;

  for (const b of candidates) {
    const mean = bowlingMean(b);
    let score = mean;
    if (dusty && isSpinner(b)) score += 9;
    if (seaming && !isSpinner(b)) score += 7;

    // Phase management: bring your best on with the new ball and at the death;
    // rest them (relative to part-timers) through the middle overs.
    const eliteEdge = (mean - 55) / 6; // how much better than a journeyman
    if (inPowerplay) {
      if (!isSpinner(b)) score += 6; // new-ball seamers
      score += eliteEdge * 1.5;
    } else if (inDeath) {
      score += eliteEdge * 2.5; // your death specialists close it out
      if (b.traits.includes('DEATH_SPECIALIST')) score += 8;
    } else if (inMiddle) {
      if (isSpinner(b)) score += 4; // spin chokes the middle
      score -= eliteEdge * 1.2; // save the quicks
    }

    // Batter matchup: attack the striker's specific weakness.
    if (ctx.striker) {
      if (isSpinner(b)) score += clamp(55 - ctx.striker.batting.footwork, 0, 40) * 0.12;
      else score += clamp(55 - ctx.striker.batting.technique, 0, 40) * 0.12;
    }

    const figures = ctx.bowlingFigures?.[b.id];
    if (figures) {
      const overs = Math.max(1 / 6, figures.balls / 6);
      const economy = figures.runs / overs;
      score += figures.wickets * 8;
      score += clamp(PAR_RUN_RATE[ctx.format] - economy, -5, 5) * 1.4;
    }

    // After the guaranteed spell, the controlled all-rounder stays on merit.
    // Elite skill, form and live wickets can earn the legal maximum.
    if (b.id === ctx.preferredPlayerId) {
      score += clamp(mean - 55, 0, 40) * 0.18;
      score += clamp(b.meta.form - 50, -30, 40) * 0.08;
    }

    score -= (ctx.oversBowled[b.id] ?? 0) * 2.1; // spread the load
    score += rng() * 5; // a little unpredictability
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}
