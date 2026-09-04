import { deliveryDelayMs } from '../../game/matchTiming';
import {
  DELIVERY_ROLE_MOTION_MS,
  deliveryBallFlightMs,
  deliveryVisualDurationMs,
  fieldingReaction,
} from '../fieldMotion';
import { fieldGeometry, FieldLayout, FieldShotTone } from '../fieldGeometry';

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('live field motion', () => {
  it('preserves the approved ball-flight durations', () => {
    expect(deliveryBallFlightMs('normal')).toBe(460);
    expect(deliveryBallFlightMs('four')).toBe(460);
    expect(deliveryBallFlightMs('wicket')).toBe(460);
    expect(deliveryBallFlightMs('six')).toBe(620);
  });

  it.each<FieldShotTone>(['normal', 'four', 'six', 'wicket', 'extra'])(
    'fits the full %s visual sequence inside the shortest 1x delivery window',
    (tone) => {
      const shortestDelivery = deliveryDelayMs({ speed: 1, userBatting: false });

      expect(deliveryVisualDurationMs(tone)).toBe(DELIVERY_ROLE_MOTION_MS);
      expect(deliveryVisualDurationMs(tone)).toBeLessThan(shortestDelivery);
    },
  );

  it.each<FieldLayout>(['CATCHING', 'ATTACKING', 'BALANCED', 'DEFENSIVE', 'SWEEPER'])(
    'moves one %s fielder toward the shot while keeping them inside the rope',
    (layout) => {
      const size = 280;
      const reaction = fieldingReaction(
        size,
        { angleDeg: 78, reach: 0.82, tone: 'normal' },
        layout,
      );
      const field = fieldGeometry(size);
      const centre = { x: field.cx, y: field.cy };

      expect(distance(reaction.end, reaction.target)).toBeLessThan(
        distance(reaction.start, reaction.target),
      );
      expect(distance(reaction.end, centre)).toBeLessThan(field.groundR);
    },
  );
});
