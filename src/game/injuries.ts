/**
 * Injuries — a shared availability system for both modes. Injuries are rolled at
 * the match boundary (never mid-ball) so the deterministic engine is untouched;
 * injured players are skipped by selection until they recover.
 */
import { Injury, Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { clamp } from '../utils/math';

interface InjurySpec {
  type: string;
  severity: Injury['severity'];
  matches: [number, number]; // inclusive range of matches out
  weight: number;
}

const INJURIES: InjurySpec[] = [
  { type: 'Tight hamstring', severity: 'KNOCK', matches: [1, 1], weight: 5 },
  { type: 'Bruised finger', severity: 'KNOCK', matches: [1, 2], weight: 4 },
  { type: 'Rolled ankle', severity: 'STRAIN', matches: [2, 3], weight: 3 },
  { type: 'Side strain', severity: 'STRAIN', matches: [2, 4], weight: 3 },
  { type: 'Hamstring tear', severity: 'SERIOUS', matches: [4, 7], weight: 1.5 },
  { type: 'Stress fracture', severity: 'SERIOUS', matches: [5, 9], weight: 1 },
];

export function isAvailable(p: Player): boolean {
  return !p.injury || p.injury.matchesOut <= 0;
}

export function injuryLabel(inj: Injury): string {
  return `${inj.type} — ${inj.matchesOut} match${inj.matchesOut === 1 ? '' : 'es'}`;
}

/**
 * Match workload → injury-risk multiplier. A long bowling spell or a long innings
 * (or a big all-round shift) raises the odds of breaking down. `1` is a neutral
 * (light) match; heavy loads climb toward ~1.7.
 */
export function workloadFactor(ballsBowled: number, ballsFaced: number): number {
  const bowlLoad = clamp(ballsBowled / 24, 0, 1); // ~4 overs = full pace load
  const batLoad = clamp(ballsFaced / 60, 0, 1); // a long innings
  return clamp(1 + bowlLoad * 0.55 + batLoad * 0.2, 1, 1.75);
}

/**
 * Roll for a new injury after a match. Base chance falls with fitness, rises with
 * match workload (`loadFactor`, see {@link workloadFactor}), and is reduced by
 * medical/physio quality (`medicalReduction` 0..0.75). Returns the injury to
 * apply, or undefined if the player came through fine.
 */
export function rollMatchInjury(
  player: Player,
  medicalReduction: number,
  rng: Rng,
  loadFactor = 1,
): Injury | undefined {
  if (!isAvailable(player)) return undefined;
  const fitness = player.meta.fitness ?? 60;
  const base = clamp(0.05 + (100 - fitness) / 900, 0.03, 0.16);
  const chance = base * clamp(loadFactor, 0.3, 1.75) * (1 - clamp(medicalReduction, 0, 0.75));
  if (rng() > chance) return undefined;

  const total = INJURIES.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  let spec = INJURIES[0];
  for (const i of INJURIES) {
    r -= i.weight;
    if (r <= 0) {
      spec = i;
      break;
    }
  }
  const span = spec.matches[1] - spec.matches[0];
  let out = spec.matches[0] + Math.floor(rng() * (span + 1));
  // Better medical care shortens recovery.
  out = Math.max(1, Math.round(out * (1 - clamp(medicalReduction, 0, 0.6))));
  return { type: spec.type, severity: spec.severity, matchesOut: out };
}

/** Advance recovery by one match for everyone (clears healed injuries). */
export function tickInjuries(save: SaveGame): void {
  for (const p of Object.values(save.players)) {
    if (p.injury) {
      p.injury.matchesOut -= 1;
      if (p.injury.matchesOut <= 0) p.injury = undefined;
    }
  }
}

/** Currently injured players in a squad (for the UI). */
export function injuredIn(save: SaveGame, playerIds: string[]): Player[] {
  return playerIds
    .map((id) => save.players[id])
    .filter((p): p is Player => Boolean(p) && !isAvailable(p));
}
