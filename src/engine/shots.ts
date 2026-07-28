import { BallEvent, BattingStyle } from '../domain/types';
import { DeliveryType } from './deliveries';
import { Rng } from './rng';

/**
 * Shot model: a *named* stroke that is consistent with the ball's outcome, used
 * to drive real wagon-wheel geography and contextual commentary. The outcome is
 * decided first (by the weighted engine); the shot then explains it. Geography
 * is physically modelled per shot sector (mirrored for left-handers) rather than
 * the old hash, so a cover drive really goes through the covers.
 */
export type ShotType =
  | 'LEAVE'
  | 'DEFEND'
  | 'GLANCE'
  | 'PUSH'
  | 'DRIVE'
  | 'COVER_DRIVE'
  | 'CUT'
  | 'PULL'
  | 'FLICK'
  | 'SWEEP'
  | 'LOFT'
  | 'SLOG'
  | 'RAMP';

/** Human shot noun for commentary. */
export const SHOT_LABEL: Record<ShotType, string> = {
  LEAVE: 'leaves it',
  DEFEND: 'defends',
  GLANCE: 'glances',
  PUSH: 'pushes',
  DRIVE: 'drives straight',
  COVER_DRIVE: 'drives through cover',
  CUT: 'cuts',
  PULL: 'pulls',
  FLICK: 'flicks',
  SWEEP: 'sweeps',
  LOFT: 'lofts',
  SLOG: 'slogs',
  RAMP: 'ramps',
};

/**
 * Angle sector per shot for a right-handed batter, in degrees clockwise from
 * straight down the ground (0° = straight, 90° = point/off-square, 270° =
 * square leg). Left-handers mirror across the straight axis.
 */
const SECTOR: Record<ShotType, [number, number]> = {
  LEAVE: [0, 0],
  DEFEND: [345, 15],
  PUSH: [340, 40],
  DRIVE: [345, 20],
  COVER_DRIVE: [40, 80],
  CUT: [85, 120],
  RAMP: [120, 160],
  GLANCE: [200, 235],
  SWEEP: [225, 275],
  PULL: [255, 290],
  FLICK: [295, 335],
  SLOG: [285, 330],
  LOFT: [330, 30],
};

/** Small deterministic hash of an event (used for stable within-sector jitter). */
function hashEvent(ev: Pick<BallEvent, 'over' | 'ballInOver' | 'strikerId' | 'outcome' | 'runs'>): number {
  let h = 2166136261 >>> 0;
  const s = `${ev.over}:${ev.ballInOver}:${ev.strikerId}:${ev.outcome}:${ev.runs}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sectorAngle(shot: ShotType, style: BattingStyle, jitter01: number): number {
  const [a, b] = SECTOR[shot];
  const span = (b - a + 360) % 360;
  let angle = (a + jitter01 * span) % 360;
  // Mirror leg/off for left-handers (reflect across the straight 0-180 axis).
  if (style === 'LHB') angle = (360 - angle) % 360;
  return angle;
}

/**
 * Pick the stroke that produced this outcome, given the batter's aggression and
 * the delivery. Deterministic via the injected rng. Returns both the shot and a
 * physical wagon-wheel angle (degrees) so the event can carry it.
 */
export function selectShot(
  outcome: BallEvent['outcome'],
  isWicket: boolean,
  aggression: number,
  delivery: DeliveryType | undefined,
  style: BattingStyle,
  rng: Rng,
): { shot: ShotType; angleDeg: number } {
  const shot = chooseShot(outcome, isWicket, aggression, delivery, rng);
  const angleDeg = shot === 'LEAVE' ? -1 : sectorAngle(shot, style, rng());
  return { shot, angleDeg };
}

function chooseShot(
  outcome: BallEvent['outcome'],
  isWicket: boolean,
  aggression: number,
  delivery: DeliveryType | undefined,
  rng: Rng,
): ShotType {
  const legSide = delivery === 'BOUNCER' || delivery === 'SHORT' || delivery === 'WRONG_UN';
  const full = delivery === 'FULL' || delivery === 'YORKER' || delivery === 'TOSSED_UP' || delivery === 'FLIGHTED';

  if (isWicket) {
    if (aggression > 0.7) return rng() < 0.6 ? 'SLOG' : 'LOFT';
    if (aggression > 0.45) return rng() < 0.5 ? 'DRIVE' : 'PULL';
    return rng() < 0.5 ? 'DEFEND' : 'PUSH';
  }

  switch (outcome) {
    case 'DOT':
      return aggression < 0.25 && rng() < 0.5 ? 'LEAVE' : 'DEFEND';
    case '1':
    case '2':
    case '3':
      if (rng() < 0.4) return legSide ? 'FLICK' : 'PUSH';
      return pick3(rng, full ? 'DRIVE' : 'GLANCE', 'COVER_DRIVE', legSide ? 'PULL' : 'CUT');
    case '4':
      if (aggression > 0.55 && rng() < 0.3) return legSide ? 'PULL' : 'COVER_DRIVE';
      return pick3(rng, full ? 'COVER_DRIVE' : 'CUT', legSide ? 'PULL' : 'DRIVE', rng() < 0.3 ? 'SWEEP' : 'FLICK');
    case '6':
      if (aggression > 0.8) return rng() < 0.5 ? 'SLOG' : 'LOFT';
      if (legSide) return rng() < 0.5 ? 'PULL' : 'SLOG';
      return rng() < 0.4 ? 'RAMP' : 'LOFT';
    default:
      return 'PUSH';
  }
}

function pick3(rng: Rng, a: ShotType, b: ShotType, c: ShotType): ShotType {
  const r = rng();
  return r < 0.34 ? a : r < 0.67 ? b : c;
}

/* ------------------------------------------------------------------ */
/* Back-compatible accessors used by the UI (MatchScreen / WagonWheel) */
/* ------------------------------------------------------------------ */

/**
 * Wagon-wheel angle for an event. Prefers the physically-modelled angle stored
 * on the event; falls back to a stable hash for any legacy event without one.
 */
export function shotAngle(ev: BallEvent): number {
  if (ev.shotAngleDeg != null && ev.shotAngleDeg >= 0) return ev.shotAngleDeg;
  return (hashEvent(ev) % 3600) / 10;
}

/** Reach of the shot as a fraction of the ground radius, by runs scored. */
export function shotReach(runs: number, isBoundarySix: boolean): number {
  if (isBoundarySix) return 0.99;
  switch (runs) {
    case 4:
      return 0.9;
    case 3:
      return 0.72;
    case 2:
      return 0.56;
    case 1:
      return 0.4;
    default:
      return 0.22;
  }
}
