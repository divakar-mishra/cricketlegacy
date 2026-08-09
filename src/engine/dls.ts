/**
 * Duckworth–Lewis–Stern (DLS) resource model for rain-affected limited-overs
 * games. This is a normalised single-decay approximation of the DLS resource
 * table — it reproduces the correct *shape* (100% for a full innings, 0% with no
 * overs left, monotonically decreasing as wickets fall and as overs shorten) and
 * the standard target formula, which is what drives believable rain outcomes.
 *
 * Pure + deterministic. Kept opt-in so the verified Monte-Carlo balance (which
 * never rains) is unaffected.
 */
import { clamp } from '../utils/math';

/** Standard "average runs a full innings is worth" constant (the DLS G50). */
export const G50 = 245;

/** Per-over resource decay. Tuned so 50 overs / 0 wickets ≈ the full resource. */
const DECAY = 0.0447;

/**
 * Asymptotic resource fraction still available with `w` wickets lost (0..9).
 * Monotonically decreasing: the more wickets down, the less can be recovered.
 */
const WK_CAP = [1.0, 0.964, 0.914, 0.847, 0.758, 0.646, 0.513, 0.367, 0.219, 0.085];

function rawResource(oversLeft: number, wktsLost: number): number {
  const w = clamp(Math.floor(wktsLost), 0, 9);
  const cap = WK_CAP[w];
  return cap * (1 - Math.exp(-DECAY * Math.max(0, oversLeft)));
}

/** Resource still available (on the 0–100 scale, 50-over reference). */
export function resourcePercent(oversLeft: number, wktsLost: number): number {
  const full = rawResource(50, 0);
  return clamp((rawResource(oversLeft, wktsLost) / full) * 100, 0, 100);
}

/**
 * Revised target (runs needed to WIN, i.e. par + 1) for the chasing side, given
 * the first-innings score and each side's total resource percentage.
 * - Team 2 with fewer resources → scaled-down target.
 * - Team 2 with more resources (rare) → add G50-weighted surplus.
 */
export function revisedTarget(firstInningsRuns: number, r1Pct: number, r2Pct: number, g50 = G50): number {
  if (r1Pct <= 0) return firstInningsRuns + 1;
  let par: number;
  if (r2Pct <= r1Pct) {
    par = firstInningsRuns * (r2Pct / r1Pct);
  } else {
    par = firstInningsRuns + g50 * ((r2Pct - r1Pct) / 100);
  }
  return Math.floor(par) + 1;
}

export interface DlsScenario {
  firstInningsRuns: number;
  fullOvers: number;
  /** Overs the chasing side actually gets after the interruption. */
  reducedOvers: number;
  /** Wickets the chasing side had already lost at the interruption (0 if pre-innings). */
  wktsLostAtBreak?: number;
  /** Overs already faced by the chaser before the break (0 if pre-innings). */
  oversUsedAtBreak?: number;
}

/**
 * Compute a revised target for a chase that is shortened by rain. Handles both
 * the "reduced before a ball is bowled" case and a mid-innings interruption.
 */
export function dlsRevisedTarget(s: DlsScenario): number {
  const r1 = resourcePercent(s.fullOvers, 0); // team 1 had a full innings
  const usedBefore = s.oversUsedAtBreak ?? 0;
  const wktsAtBreak = s.wktsLostAtBreak ?? 0;

  // Resource team 2 would have had for a full chase.
  const r2Full = resourcePercent(s.fullOvers, 0);
  // Resource lost to the interruption: they had (fullOvers - usedBefore) left but
  // resume with only (reducedOvers - usedBefore) left, at the current wickets.
  const remainingBefore = resourcePercent(s.fullOvers - usedBefore, wktsAtBreak);
  const remainingAfter = resourcePercent(Math.max(0, s.reducedOvers - usedBefore), wktsAtBreak);
  const r2 = clamp(r2Full - (remainingBefore - remainingAfter), 0, 100);

  return revisedTarget(s.firstInningsRuns, r1, r2);
}
