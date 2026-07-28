import { Player } from '../domain/types';

/** Derived overall rating & attribute means (PART 3.1). */

function mean(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function battingMean(p: Player): number {
  const b = p.batting;
  return mean([b.technique, b.timing, b.power, b.footwork, b.temperament, b.running]);
}

export function bowlingMean(p: Player): number {
  const b = p.bowling;
  return mean([b.paceOrSpin, b.accuracy, b.movement, b.variations, b.stamina]);
}

export function fieldingMean(p: Player): number {
  const f = p.fielding;
  return mean([f.catching, f.throwing, f.agility, f.keeping]);
}

export function metaMean(p: Player): number {
  const m = p.meta;
  return mean([m.fitness, m.form, m.confidence, m.aggression, m.discipline]);
}

export function computeOverall(p: Player): number {
  const bat = battingMean(p);
  const bowl = bowlingMean(p);
  const field = fieldingMean(p);
  const meta = metaMean(p);

  let v: number;
  switch (p.role) {
    case 'BATTER':
      v = 0.7 * bat + 0.15 * field + 0.15 * meta;
      break;
    case 'BOWLER':
      v = 0.7 * bowl + 0.15 * field + 0.15 * meta;
      break;
    case 'ALLROUNDER':
      v = 0.4 * bat + 0.4 * bowl + 0.1 * field + 0.1 * meta;
      break;
    case 'WK_BATTER':
      v = 0.55 * bat + 0.3 * p.fielding.keeping + 0.15 * meta;
      break;
    default:
      v = mean([bat, bowl, field, meta]);
  }
  return Math.round(v);
}

/** True if the player can be used as a bowler in the sim. */
export function canBowl(p: Player): boolean {
  return Boolean(p.bowlingStyle) && bowlingMean(p) >= 25;
}

export function isSpinner(p: Player): boolean {
  return (
    p.bowlingStyle === 'OFF_SPIN' ||
    p.bowlingStyle === 'LEG_SPIN' ||
    p.bowlingStyle === 'LEFT_ARM_SPIN'
  );
}
