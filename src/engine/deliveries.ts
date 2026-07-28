/**
 * Delivery-type model — the bowler's *choice* of ball (PART B of the engine
 * deepening). Each delivery carries gentle, roughly mean-neutral multipliers on
 * the base outcome weights so it adds real texture and matchup drama (a yorker
 * cramps at the death; a bouncer punishes poor technique; a slower ball buys a
 * wicket against a slog) without destabilising the verified Monte-Carlo balance.
 *
 * Selection is 100% deterministic — it always flows through the injected rng.
 */
import { Player } from '../domain/types';
import { clamp } from '../utils/math';
import { isSpinner } from './rating';
import { Rng, weightedSample } from './rng';

export type PaceDelivery = 'GOOD_LENGTH' | 'FULL' | 'SHORT' | 'YORKER' | 'BOUNCER' | 'SLOWER_BALL';
export type SpinDelivery = 'STOCK' | 'FLIGHTED' | 'ARM_BALL' | 'WRONG_UN' | 'QUICKER' | 'TOSSED_UP';
export type DeliveryType = PaceDelivery | SpinDelivery;

/** Multipliers applied to the base outcome weights for this delivery. */
export interface DeliveryEffect {
  four: number;
  six: number;
  dot: number;
  wicket: number;
  /** Optional nudge to the single/rotation weight. */
  one?: number;
}

export interface DeliverySpec {
  type: DeliveryType;
  label: string; // short commentary noun ("a searing yorker")
  spin: boolean;
  effect: DeliveryEffect;
}

const NEUTRAL: DeliveryEffect = { four: 1, six: 1, dot: 1, wicket: 1, one: 1 };

/** Pace bowler's arsenal. */
const PACE: DeliverySpec[] = [
  { type: 'GOOD_LENGTH', label: 'good length', spin: false, effect: { ...NEUTRAL } },
  { type: 'FULL', label: 'full and driveable', spin: false, effect: { four: 1.18, six: 1.06, dot: 0.9, wicket: 1.06 } },
  { type: 'SHORT', label: 'short of a length', spin: false, effect: { four: 1.05, six: 1.1, dot: 0.96, wicket: 1.02 } },
  { type: 'YORKER', label: 'a searing yorker', spin: false, effect: { four: 0.72, six: 0.62, dot: 1.22, wicket: 1.18, one: 0.9 } },
  { type: 'BOUNCER', label: 'a nasty bouncer', spin: false, effect: { four: 0.85, six: 1.2, dot: 1.08, wicket: 1.12, one: 0.85 } },
  { type: 'SLOWER_BALL', label: 'a clever slower ball', spin: false, effect: { four: 0.82, six: 0.8, dot: 1.14, wicket: 1.22 } },
];

/** Spin bowler's arsenal. */
const SPIN: DeliverySpec[] = [
  { type: 'STOCK', label: 'the stock ball', spin: true, effect: { ...NEUTRAL } },
  { type: 'FLIGHTED', label: 'lovely flight', spin: true, effect: { four: 1.08, six: 1.14, dot: 0.92, wicket: 1.16 } },
  { type: 'ARM_BALL', label: 'the arm ball', spin: true, effect: { four: 0.9, six: 0.82, dot: 1.12, wicket: 1.12 } },
  { type: 'WRONG_UN', label: 'a disguised wrong-un', spin: true, effect: { four: 0.88, six: 0.86, dot: 1.06, wicket: 1.28 } },
  { type: 'QUICKER', label: 'a quicker one', spin: true, effect: { four: 0.86, six: 0.72, dot: 1.16, wicket: 1.14, one: 0.92 } },
  { type: 'TOSSED_UP', label: 'tossed up, tempting', spin: true, effect: { four: 1.16, six: 1.2, dot: 0.86, wicket: 1.2 } },
];

export interface DeliveryContext {
  bowler: Player;
  inPowerplay: boolean;
  inDeath: boolean;
  /** Bowling plan bias, if the user set one this over. */
  attacking?: boolean;
  containing?: boolean;
  varying?: boolean;
}

/**
 * Choose a delivery. Base (stock/good-length) balls dominate; the frequency of
 * wicket-taking variations scales with the bowler's `variations` attribute and
 * the match phase (more yorkers/slower balls at the death, more attacking
 * variations in the powerplay). A `VARY` plan tilts toward variations.
 */
export function selectDelivery(ctx: DeliveryContext, rng: Rng): DeliverySpec {
  const spin = isSpinner(ctx.bowler);
  const arsenal = spin ? SPIN : PACE;
  const variation = clamp(ctx.bowler.bowling.variations, 0, 100) / 100; // 0..1
  const varyBoost = ctx.varying ? 1.8 : 1;
  const stockBias = ctx.containing ? 2.2 : 1;

  // Base weight for the stock ball, then the variations share the rest.
  const w: Record<string, number> = {};
  for (const d of arsenal) {
    const isStock = d.type === 'GOOD_LENGTH' || d.type === 'STOCK';
    let weight = isStock ? 46 * stockBias : 10 + variation * 26;
    // Phase-appropriate variations get a lift.
    if (!spin) {
      if (ctx.inDeath && (d.type === 'YORKER' || d.type === 'SLOWER_BALL')) weight *= 1.9 * varyBoost;
      if (ctx.inPowerplay && (d.type === 'FULL' || d.type === 'SHORT')) weight *= 1.3;
      if (ctx.attacking && (d.type === 'BOUNCER' || d.type === 'FULL')) weight *= 1.3;
    } else {
      if (ctx.inDeath && (d.type === 'QUICKER' || d.type === 'ARM_BALL')) weight *= 1.7 * varyBoost;
      if (ctx.attacking && (d.type === 'FLIGHTED' || d.type === 'TOSSED_UP' || d.type === 'WRONG_UN')) weight *= 1.4;
      if (!isStock) weight *= varyBoost;
    }
    w[d.type] = weight;
  }
  const type = weightedSample(w, rng) as DeliveryType;
  return arsenal.find((d) => d.type === type) ?? arsenal[0];
}
