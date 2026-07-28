/**
 * Seeded RNG (PART 3.2). All engine randomness flows through here so a match is
 * 100% reproducible from (seed, inputs). No Math.random anywhere in the engine.
 */

export type Rng = () => number;

/** mulberry32 — fast, deterministic, good-enough distribution for a game. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True with probability p (clamped 0..1). */
export function chance(p: number, rng: Rng): boolean {
  return rng() < p;
}

/** Inclusive integer in [min, max]. */
export function randInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pick a key from a weight map with probability proportional to its weight.
 * Negative weights are treated as 0.
 */
export function weightedSample<K extends string>(weights: Record<K, number>, rng: Rng): K {
  const entries = Object.entries(weights) as [K, number][];
  let total = 0;
  for (const [, w] of entries) total += w > 0 ? w : 0;
  if (total <= 0) return entries[0][0];
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w > 0 ? w : 0;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}
