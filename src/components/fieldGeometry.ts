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

const FIELD_LAYOUTS: Record<FieldLayout, ReadonlyArray<readonly [number, number]>> = {
  // Radius 0.605 meets the 30-yard ring. Most fielders now sit clearly beyond
  // it so the live view reads like a full cricket ground instead of a cluster
  // around the pitch. Only catching/attacking plans retain deliberate close
  // catchers behind and beside the striker.
  CATCHING: [
    [22, 0.78],
    [72, 0.84],
    [122, 0.72],
    [154, 0.59],
    [176, 0.57],
    [202, 0.59],
    [238, 0.72],
    [288, 0.84],
    [338, 0.78],
  ],
  ATTACKING: [
    [26, 0.76],
    [70, 0.84],
    [112, 0.72],
    [158, 0.6],
    [200, 0.6],
    [232, 0.7],
    [250, 0.86],
    [292, 0.74],
    [334, 0.8],
  ],
  BALANCED: [
    [24, 0.76],
    [66, 0.88],
    [108, 0.72],
    [148, 0.82],
    [184, 0.7],
    [220, 0.82],
    [258, 0.74],
    [296, 0.88],
    [336, 0.76],
  ],
  DEFENSIVE: [
    [22, 0.9],
    [66, 0.91],
    [110, 0.87],
    [150, 0.9],
    [184, 0.8],
    [218, 0.9],
    [254, 0.87],
    [298, 0.91],
    [338, 0.9],
  ],
  SWEEPER: [
    [18, 0.91],
    [62, 0.91],
    [106, 0.9],
    [148, 0.91],
    [188, 0.86],
    [228, 0.91],
    [270, 0.9],
    [310, 0.91],
    [344, 0.91],
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
    bowler: { x: cx + size * 0.035, y: cy + size * 0.27 },
    striker: { x: cx, y: cy - size * 0.16 },
    nonStriker: { x: cx - size * 0.085, y: cy + size * 0.18 },
    keeper: { x: cx, y: cy - size * 0.292 },
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
