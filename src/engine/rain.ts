/**
 * Rain interruptions for limited-overs matches, resolved with the DLS model in
 * `engine/dls.ts` (previously built but unwired). Deterministic and opt-in:
 * only fires when a match is flagged rain-eligible AND the weather is not clear,
 * so the verified Monte-Carlo balance and the live/auto determinism tests (which
 * always use CLEAR skies) are completely unaffected.
 */
import { Conditions } from '../domain/types';
import { dlsRevisedTarget } from './dls';
import { makeRng } from './rng';

export interface RainPlan {
  /** Overs the chasing side actually gets after the interruption. */
  reducedOvers: number;
  /** DLS-revised target (runs to WIN). */
  revisedTarget: number;
}

/**
 * Decide whether rain shortens the chase, and if so by how much + the revised
 * target. Uses a seed-derived rng so it never perturbs the main match stream.
 */
export function planRain(
  seed: number,
  weather: Conditions['weather'],
  fullOvers: number,
  firstInningsRuns: number,
): RainPlan | null {
  if (weather === 'CLEAR') return null;
  const r = makeRng((seed ^ 0x2a1c9e3b) >>> 0);
  const chance = weather === 'OVERCAST' ? 0.18 : 0.1;
  if (r() >= chance) return null;
  const frac = 0.5 + r() * 0.35; // 50%–85% of the innings survives
  const reducedOvers = Math.max(5, Math.floor(fullOvers * frac));
  if (reducedOvers >= fullOvers) return null;
  const revisedTarget = dlsRevisedTarget({ firstInningsRuns, fullOvers, reducedOvers });
  return { reducedOvers, revisedTarget };
}
