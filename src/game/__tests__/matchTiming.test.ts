import { deliveryDelayMs, MATCH_SPEED_OPTIONS } from '../matchTiming';

describe('match timing', () => {
  it('defines compact multiplier speed modes', () => {
    expect(MATCH_SPEED_OPTIONS.map((o) => o.label)).toEqual(['1×', '2×', '4×']);
  });

  it('keeps normal commentary slower than fast modes', () => {
    const normal = deliveryDelayMs({ speed: 1, userBatting: true });
    const fast = deliveryDelayMs({ speed: 2, userBatting: true });
    const veryFast = deliveryDelayMs({ speed: 4, userBatting: true });

    expect(normal).toBeGreaterThan(fast);
    expect(fast).toBeGreaterThan(veryFast);
  });

  it('keeps 1x readable enough for commentary and score context', () => {
    expect(deliveryDelayMs({ speed: 1, userBatting: true })).toBeGreaterThanOrEqual(2500);
    expect(
      deliveryDelayMs({ speed: 1, userBatting: true, wicketOrMilestone: true }),
    ).toBeGreaterThanOrEqual(3200);
  });

  it('lingers on user batting and key events', () => {
    expect(deliveryDelayMs({ speed: 1, userBatting: true })).toBeGreaterThan(
      deliveryDelayMs({ speed: 1, userBatting: false }),
    );
    expect(deliveryDelayMs({ speed: 1, userBatting: true, wicketOrMilestone: true })).toBeGreaterThan(
      deliveryDelayMs({ speed: 1, userBatting: true }),
    );
    expect(deliveryDelayMs({ speed: 1, userBatting: true, inningsBreak: true })).toBeGreaterThan(
      deliveryDelayMs({ speed: 1, userBatting: true, wicketOrMilestone: true }),
    );
  });

  it('fast-forwards quiet balls in key-highlights mode', () => {
    expect(deliveryDelayMs({ speed: 1, userBatting: true, keyHighlightsMode: true, keyBall: false })).toBe(45);
    expect(deliveryDelayMs({ speed: 1, userBatting: true, keyHighlightsMode: true, keyBall: true })).toBeGreaterThan(45);
  });
});
