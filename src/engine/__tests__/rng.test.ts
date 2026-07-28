import { chance, makeRng, weightedSample } from '../rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });

  it('produces values in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('weightedSample never picks a zero-weight key', () => {
    const r = makeRng(9);
    for (let i = 0; i < 500; i++) {
      expect(weightedSample({ A: 1, B: 0 }, r)).toBe('A');
    }
  });

  it('weightedSample is roughly proportional', () => {
    const r = makeRng(11);
    let a = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) {
      if (weightedSample({ A: 3, B: 1 }, r) === 'A') a++;
    }
    expect(a / N).toBeGreaterThan(0.72);
    expect(a / N).toBeLessThan(0.78);
  });

  it('chance ~ p', () => {
    const r = makeRng(13);
    let hits = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) if (chance(0.3, r)) hits++;
    expect(hits / N).toBeGreaterThan(0.28);
    expect(hits / N).toBeLessThan(0.32);
  });
});
