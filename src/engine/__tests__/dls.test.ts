import { dlsRevisedTarget, resourcePercent, revisedTarget } from '../dls';

describe('DLS resource model', () => {
  it('a full innings is 100% and an empty one is 0%', () => {
    expect(Math.round(resourcePercent(50, 0))).toBe(100);
    expect(resourcePercent(0, 0)).toBe(0);
    expect(resourcePercent(20, 10)).toBeGreaterThanOrEqual(0);
  });

  it('resources fall as wickets are lost and as overs shorten', () => {
    expect(resourcePercent(30, 0)).toBeGreaterThan(resourcePercent(30, 4));
    expect(resourcePercent(30, 4)).toBeGreaterThan(resourcePercent(30, 8));
    expect(resourcePercent(40, 2)).toBeGreaterThan(resourcePercent(20, 2));
  });

  it('a shortened chase (fewer resources) lowers the target', () => {
    const full = revisedTarget(300, 100, 100); // 301 to win a full chase
    const short = revisedTarget(300, 100, 70); // fewer resources
    expect(full).toBe(301);
    expect(short).toBeLessThan(full);
    expect(short).toBeGreaterThan(1);
  });

  it('a team with more resources than the setters gets a raised target', () => {
    const raised = revisedTarget(200, 70, 100);
    expect(raised).toBeGreaterThan(201);
  });

  it('dlsRevisedTarget shortens a pre-innings reduced chase', () => {
    const target = dlsRevisedTarget({ firstInningsRuns: 250, fullOvers: 50, reducedOvers: 30 });
    expect(target).toBeLessThan(251);
    expect(target).toBeGreaterThan(1);
  });

  it('dlsRevisedTarget handles a mid-innings interruption', () => {
    const target = dlsRevisedTarget({
      firstInningsRuns: 250,
      fullOvers: 50,
      reducedOvers: 35,
      oversUsedAtBreak: 20,
      wktsLostAtBreak: 3,
    });
    expect(target).toBeGreaterThan(1);
    expect(target).toBeLessThanOrEqual(251);
  });
});
