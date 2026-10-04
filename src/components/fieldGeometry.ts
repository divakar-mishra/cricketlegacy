export type FieldShotTone = 'normal' | 'four' | 'six' | 'wicket' | 'extra';
export type FieldLayout = 'CATCHING' | 'ATTACKING' | 'BALANCED' | 'DEFENSIVE' | 'SWEEPER';
export type FieldDismissalType = 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED' | 'HIT_WICKET';

export interface FieldShot {
  angleDeg: number;
  reach: number;
  tone: FieldShotTone;
  dismissalType?: FieldDismissalType;
}

export interface FieldPoint {
  x: number;
  y: number;
}

export interface FieldGeometry {
  cx: number;
  cy: number;
  stadiumR: number;
  groundR: number;
  innerR: number;
  bowler: FieldPoint;
  striker: FieldPoint;
  nonStriker: FieldPoint;
  keeper: FieldPoint;
  umpire: FieldPoint;
  closeCatcher: FieldPoint;
}

export interface PitchGeometry {
  top: number;
  height: number;
  width: number;
  strikerStumpY: number;
  bowlerStumpY: number;
}

export interface PositionedFielder extends FieldPoint {
  angleDeg: number;
  radiusFraction: number;
}

export interface FieldShotPath {
  end: FieldPoint;
  control: FieldPoint;
  airborne: boolean;
}

const FIELD_LAYOUTS: Record<FieldLayout, readonly (readonly [number, number])[]> = {
  // The 30-yard circle is at ground-radius fraction 0.605. These nine sprites
  // exclude the keeper and bowler, so each plan must show its actual outside
  // count: 0 catching, 2 attacking, 3 balanced, 5 defensive/sweeper.
  CATCHING: [
    [22, 0.53], [72, 0.56], [122, 0.54], [154, 0.48], [176, 0.46],
    [202, 0.48], [238, 0.54], [288, 0.56], [338, 0.53],
  ],
  ATTACKING: [
    [26, 0.55], [70, 0.84], [112, 0.54], [158, 0.5], [200, 0.5],
    [232, 0.54], [250, 0.86], [292, 0.55], [334, 0.55],
  ],
  BALANCED: [
    [24, 0.55], [66, 0.88], [108, 0.54], [148, 0.55], [184, 0.5],
    [220, 0.55], [258, 0.74], [296, 0.88], [336, 0.55],
  ],
  DEFENSIVE: [
    [22, 0.55], [66, 0.91], [110, 0.87], [150, 0.55], [184, 0.5],
    [218, 0.55], [254, 0.87], [298, 0.91], [338, 0.9],
  ],
  SWEEPER: [
    [18, 0.55], [62, 0.91], [106, 0.9], [148, 0.55], [188, 0.5],
    [228, 0.91], [270, 0.55], [310, 0.91], [344, 0.91],
  ],
};

export function fieldGeometry(size: number): FieldGeometry {
  const cx = size / 2;
  const cy = size / 2;

  return {
    cx,
    cy,
    stadiumR: size * 0.492,
    groundR: size * 0.418,
    innerR: size * 0.253,
    // The striker is always shown at the top end. The bowler and non-striker
    // approach from the bottom so the direction of the delivery is immediate.
    // Bowler anchor is the release point, not the start of the run-up.
    bowler: { x: cx + size * 0.025, y: cy + size * 0.145 },
    striker: { x: cx, y: cy - size * 0.155 },
    nonStriker: { x: cx - size * 0.065, y: cy + size * 0.155 },
    keeper: { x: cx, y: cy - size * 0.235 },
    umpire: { x: cx, y: cy + size * 0.235 },
    closeCatcher: { x: cx - size * 0.085, y: cy - size * 0.205 },
  };
}

/**
 * Presentation-scale pitch dimensions. The pitch stays deliberately readable
 * on a phone, but no longer dominates the full stadium bowl.
 */
export function pitchGeometry(size: number): PitchGeometry {
  const { cy } = fieldGeometry(size);
  return {
    top: cy - size * 0.21,
    height: size * 0.42,
    width: size * 0.105,
    strikerStumpY: cy - size * 0.17,
    bowlerStumpY: cy + size * 0.17,
  };
}

export function fieldPointFromPolar(size: number, angleDeg: number, radius: number): FieldPoint {
  const { cx, cy } = fieldGeometry(size);
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: cx - radius * Math.sin(angle),
    y: cy + radius * Math.cos(angle),
  };
}

export function fieldingPositions(
  size: number,
  layout: FieldLayout = 'BALANCED',
): PositionedFielder[] {
  const { groundR } = fieldGeometry(size);
  return FIELD_LAYOUTS[layout].map(([angleDeg, radiusFraction]) => ({
    ...fieldPointFromPolar(size, angleDeg, radiusFraction * groundR),
    angleDeg,
    radiusFraction,
  }));
}

/** Approximate the real landing length of the generated delivery on the pitch. */
export function deliveryBouncePoint(size: number, delivery?: string): FieldPoint {
  const { bowler, striker } = fieldGeometry(size);
  const progressByDelivery: Record<string, number> = {
    BOUNCER: 0.48,
    SHORT: 0.54,
    GOOD_LENGTH: 0.67,
    STOCK: 0.68,
    SLOWER_BALL: 0.7,
    FLIGHTED: 0.72,
    TOSSED_UP: 0.74,
    FULL: 0.78,
    ARM_BALL: 0.78,
    WRONG_UN: 0.78,
    QUICKER: 0.8,
    YORKER: 0.9,
  };
  const progress = progressByDelivery[delivery ?? ''] ?? 0.68;
  const offsetSeed = (delivery ?? 'GOOD_LENGTH')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const lateralOffset = ((offsetSeed % 5) - 2) * size * 0.0025;

  return {
    x: bowler.x + (striker.x - bowler.x) * progress + lateralOffset,
    y: bowler.y + (striker.y - bowler.y) * progress,
  };
}

function distanceAlongRayToRadius(
  start: FieldPoint,
  direction: FieldPoint,
  centre: FieldPoint,
  radius: number,
): number {
  const offsetX = start.x - centre.x;
  const offsetY = start.y - centre.y;
  const projection = offsetX * direction.x + offsetY * direction.y;
  const offsetSquared = offsetX * offsetX + offsetY * offsetY;
  const discriminant = projection * projection - (offsetSquared - radius * radius);

  return -projection + Math.sqrt(Math.max(0, discriminant));
}

/**
 * Resolve a visible shot endpoint from the striker's crease.
 *
 * Non-boundaries use `reach` as a fraction of the available distance to the
 * rope in that exact direction. A four ends just beyond the rope and a six
 * travels farther beyond it, while remaining inside the square drawing area.
 */
export function fieldShotEnd(size: number, shot: FieldShot): FieldPoint {
  const geometry = fieldGeometry(size);
  const { cx, cy, groundR, striker } = geometry;
  if (shot.tone === 'wicket') return striker;

  const angle = (shot.angleDeg * Math.PI) / 180;
  // This is the previous shot compass rotated through 180 degrees with the
  // field: 0 degrees remains a straight shot back past the bowler.
  const direction = { x: -Math.sin(angle), y: Math.cos(angle) };
  const centre = { x: cx, y: cy };
  const distanceToRope = distanceAlongRayToRadius(striker, direction, centre, groundR);

  let travelDistance: number;
  if (shot.tone === 'four' || shot.tone === 'six') {
    const outsideRope = shot.tone === 'six' ? size * 0.022 : size * 0.008;
    travelDistance = distanceAlongRayToRadius(striker, direction, centre, groundR + outsideRope);
  } else {
    travelDistance = distanceToRope * Math.min(0.92, Math.max(0, shot.reach));
  }

  return {
    x: striker.x + direction.x * travelDistance,
    y: striker.y + direction.y * travelDistance,
  };
}

export function fieldShotPath(size: number, shot: FieldShot): FieldShotPath {
  const { striker } = fieldGeometry(size);
  const end = fieldShotEnd(size, shot);
  const airborne = shot.tone === 'six';
  const midpoint = {
    x: (striker.x + end.x) / 2,
    y: (striker.y + end.y) / 2,
  };

  if (!airborne) return { end, control: midpoint, airborne: false };

  const dx = end.x - striker.x;
  const dy = end.y - striker.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const curveDirection = shot.angleDeg >= 180 ? -1 : 1;
  const curve = size * 0.055 * curveDirection;

  return {
    end,
    control: {
      x: midpoint.x + (-dy / distance) * curve,
      y: midpoint.y + (dx / distance) * curve,
    },
    airborne: true,
  };
}

/** Choose a visible fielder on the shot's real sector for a caught dismissal. */
export function fieldCatchPoint(
  size: number,
  angleDeg: number,
  layout: FieldLayout = 'BALANCED',
): FieldPoint {
  const { cx, cy, groundR, striker } = fieldGeometry(size);
  const angle = (angleDeg * Math.PI) / 180;
  const direction = { x: -Math.sin(angle), y: Math.cos(angle) };
  const distance = distanceAlongRayToRadius(striker, direction, { x: cx, y: cy }, groundR);
  const target = {
    x: striker.x + direction.x * distance * 0.72,
    y: striker.y + direction.y * distance * 0.72,
  };

  return fieldingPositions(size, layout).reduce((nearest, fielder) => {
    const currentDistance = Math.hypot(fielder.x - target.x, fielder.y - target.y);
    const nearestDistance = Math.hypot(nearest.x - target.x, nearest.y - target.y);
    return currentDistance < nearestDistance ? fielder : nearest;
  });
}
