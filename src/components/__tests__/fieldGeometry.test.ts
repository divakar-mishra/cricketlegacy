import {
  deliveryBouncePoint,
  fieldCatchPoint,
  fieldGeometry,
  fieldingPositions,
  fieldShotEnd,
  fieldShotPath,
  FieldLayout,
  FieldShotTone,
  pitchGeometry,
} from '../fieldGeometry';

function radialDistance(size: number, point: { x: number; y: number }): number {
  const centre = size / 2;
  return Math.hypot(point.x - centre, point.y - centre);
}

describe('live field geometry', () => {
  const size = 280;

  it('places the striker at the top and the bowler at the bottom', () => {
    const field = fieldGeometry(size);

    expect(field.striker.y).toBeLessThan(field.cy);
    expect(field.keeper.y).toBeLessThan(field.striker.y);
    expect(field.bowler.y).toBeGreaterThan(field.cy);
    expect(field.nonStriker.y).toBeGreaterThan(field.cy);
    expect(
      Math.hypot(field.bowler.x - field.nonStriker.x, field.bowler.y - field.nonStriker.y),
    ).toBeGreaterThan(size * 0.13);
  });

  it('keeps the pitch near half the playable ground diameter', () => {
    const field = fieldGeometry(size);
    const pitch = pitchGeometry(size);

    expect(pitch.height / (field.groundR * 2)).toBeLessThanOrEqual(0.51);
    expect(pitch.top).toBeGreaterThan(field.cy - field.groundR);
    expect(pitch.top + pitch.height).toBeLessThan(field.cy + field.groundR);
    expect(pitch.strikerStumpY).toBeLessThan(field.cy);
    expect(pitch.bowlerStumpY).toBeGreaterThan(field.cy);
  });

  it.each([
    ['straight', 0],
    ['square', 90],
    ['behind square', 150],
    ['leg side', 270],
  ])('puts fours just beyond the rope for a %s shot', (_label, angleDeg) => {
    const field = fieldGeometry(size);
    const end = fieldShotEnd(size, { angleDeg, reach: 0.9, tone: 'four' });

    expect(radialDistance(size, end)).toBeGreaterThan(field.groundR);
    expect(radialDistance(size, end)).toBeLessThan(field.groundR + size * 0.012);
  });

  it.each([0, 45, 120, 225, 315])('puts sixes visibly beyond fours at %i degrees', (angleDeg) => {
    const field = fieldGeometry(size);
    const four = fieldShotEnd(size, { angleDeg, reach: 0.9, tone: 'four' });
    const six = fieldShotEnd(size, { angleDeg, reach: 0.99, tone: 'six' });

    expect(radialDistance(size, six)).toBeGreaterThan(radialDistance(size, four));
    expect(radialDistance(size, six)).toBeGreaterThan(field.groundR + size * 0.018);
  });

  it.each<FieldShotTone>(['normal', 'extra'])('keeps %s outcomes inside the rope', (tone) => {
    const field = fieldGeometry(size);
    const end = fieldShotEnd(size, { angleDeg: 0, reach: 0.72, tone });

    expect(radialDistance(size, end)).toBeLessThan(field.groundR);
  });

  it('finishes a wicket at the striker end', () => {
    const field = fieldGeometry(size);
    const end = fieldShotEnd(size, { angleDeg: 250, reach: 0.9, tone: 'wicket' });

    expect(end).toEqual(field.striker);
  });

  it.each<[FieldLayout, number]>([
    ['CATCHING', 6],
    ['ATTACKING', 7],
    ['BALANCED', 9],
    ['DEFENSIVE', 9],
    ['SWEEPER', 9],
  ])('maps the %s plan to %i fielders outside the circle', (layout, expectedOutside) => {
    const field = fieldGeometry(size);
    const outside = fieldingPositions(size, layout).filter(
      (fielder) => radialDistance(size, fielder) > field.innerR,
    );

    expect(fieldingPositions(size, layout)).toHaveLength(9);
    expect(outside).toHaveLength(expectedOutside);
  });

  it('keeps wide fielders inside the boundary rope', () => {
    const field = fieldGeometry(size);

    for (const layout of ['BALANCED', 'DEFENSIVE', 'SWEEPER'] as FieldLayout[]) {
      for (const fielder of fieldingPositions(size, layout)) {
        expect(radialDistance(size, fielder)).toBeLessThanOrEqual(field.groundR * 0.91 + 0.0001);
      }
    }
  });

  it('shows short balls landing earlier than yorkers', () => {
    const bouncer = deliveryBouncePoint(size, 'BOUNCER');
    const yorker = deliveryBouncePoint(size, 'YORKER');
    const field = fieldGeometry(size);

    expect(bouncer.y).toBeLessThan(field.bowler.y);
    expect(bouncer.y).toBeGreaterThan(yorker.y);
    expect(yorker.y).toBeGreaterThan(field.striker.y);
  });

  it('gives a six a curved aerial path while a four stays grounded', () => {
    const six = fieldShotPath(size, { angleDeg: 62, reach: 0.99, tone: 'six' });
    const four = fieldShotPath(size, { angleDeg: 62, reach: 0.9, tone: 'four' });
    const striker = fieldGeometry(size).striker;
    const linearSixMidpoint = {
      x: (striker.x + six.end.x) / 2,
      y: (striker.y + six.end.y) / 2,
    };

    expect(six.airborne).toBe(true);
    expect(four.airborne).toBe(false);
    expect(six.control).not.toEqual(linearSixMidpoint);
  });

  it('resolves a catch to a real fielder in the selected plan', () => {
    const catchPoint = fieldCatchPoint(size, 75, 'ATTACKING');
    const positions = fieldingPositions(size, 'ATTACKING');

    expect(
      positions.some((fielder) => fielder.x === catchPoint.x && fielder.y === catchPoint.y),
    ).toBe(true);
  });
});
