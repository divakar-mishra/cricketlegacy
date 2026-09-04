import type { FieldLayout, FieldPoint, FieldShot, FieldShotTone } from './fieldGeometry';
import { fieldGeometry, fieldingPositions, fieldShotEnd } from './fieldGeometry';

export const DELIVERY_RUN_UP_MS = 180;
export const DELIVERY_ROLE_MOTION_MS = 1200;

export function deliveryBallFlightMs(tone: FieldShotTone): number {
  return tone === 'six' ? 620 : 460;
}

export function deliveryVisualDurationMs(tone: FieldShotTone): number {
  return Math.max(DELIVERY_ROLE_MOTION_MS, DELIVERY_RUN_UP_MS + deliveryBallFlightMs(tone));
}

export interface FieldingReaction {
  index: number;
  start: FieldPoint;
  end: FieldPoint;
  target: FieldPoint;
}

function clampTargetInsideRope(size: number, point: FieldPoint): FieldPoint {
  const { cx, cy, groundR } = fieldGeometry(size);
  const dx = point.x - cx;
  const dy = point.y - cy;
  const distance = Math.hypot(dx, dy);
  const maximum = groundR * 0.9;

  if (distance <= maximum || distance === 0) return point;

  return {
    x: cx + (dx / distance) * maximum,
    y: cy + (dy / distance) * maximum,
  };
}

/**
 * Choose the fielder in the shot sector and give them a short visual reaction.
 * The movement is deliberately partial: the deterministic engine still owns
 * the actual outcome, while the field view communicates who attacked the ball.
 */
export function fieldingReaction(
  size: number,
  shot: FieldShot,
  layout: FieldLayout = 'BALANCED',
): FieldingReaction {
  const fielders = fieldingPositions(size, layout);
  const targetShot =
    shot.tone === 'wicket' ? { ...shot, tone: 'normal' as const, reach: 0.72 } : shot;
  const target = clampTargetInsideRope(size, fieldShotEnd(size, targetShot));

  const index = fielders.reduce((nearestIndex, fielder, currentIndex) => {
    const currentDistance = Math.hypot(fielder.x - target.x, fielder.y - target.y);
    const nearest = fielders[nearestIndex];
    const nearestDistance = Math.hypot(nearest.x - target.x, nearest.y - target.y);
    return currentDistance < nearestDistance ? currentIndex : nearestIndex;
  }, 0);
  const start = fielders[index];
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const distance = Math.hypot(dx, dy);
  const movement = Math.min(distance * 0.18, size * 0.055);
  const end =
    distance === 0
      ? start
      : {
          x: start.x + (dx / distance) * movement,
          y: start.y + (dy / distance) * movement,
        };

  return { index, start, end, target };
}
