import { simulateInnings } from '../simulateInnings';
import { makeRng } from '../rng';
import { makeTeams, NEUTRAL_CONDITIONS, seedFor } from './_helpers';

describe('innings invariants (T20)', () => {
  const { home, away } = makeTeams();

  const runOne = (seed: number) =>
    simulateInnings(
      {
        battingTeamId: 'home',
        bowlingTeamId: 'away',
        battingOrder: home.players,
        bowlingXI: away.players,
        format: 'T20',
        conditions: NEUTRAL_CONDITIONS,
        difficulty: 'NORMAL',
      },
      makeRng(seed),
    );

  it('runs equal the sum of ball events', () => {
    for (let i = 1; i <= 50; i++) {
      const inn = runOne(seedFor(i));
      const sum = inn.events.reduce((a, e) => a + e.runs, 0);
      expect(inn.runs).toBe(sum);
    }
  });

  it('wickets are counted correctly and never exceed 10', () => {
    for (let i = 1; i <= 50; i++) {
      const inn = runOne(seedFor(i + 100));
      const wk = inn.events.filter((e) => e.isWicket).length;
      expect(inn.wickets).toBe(wk);
      expect(inn.wickets).toBeLessThanOrEqual(10);
    }
  });

  it('has exactly 6 legal balls per completed over and <= 120 legal balls', () => {
    const inn = runOne(seedFor(7));
    const legal = inn.events.filter((e) => e.outcome !== 'WD' && e.outcome !== 'NB');
    expect(inn.balls).toBe(legal.length);
    expect(inn.balls).toBeLessThanOrEqual(120);

    const perOver: Record<number, number> = {};
    for (const e of legal) perOver[e.over] = (perOver[e.over] ?? 0) + 1;
    const overs = Object.keys(perOver)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 0; i < overs.length - 1; i++) {
      expect(perOver[overs[i]]).toBe(6); // every over except possibly the last is complete
    }
  });

  it('batter runs + extras reconcile to the innings total, with no NaN/negatives', () => {
    for (let i = 1; i <= 30; i++) {
      const inn = runOne(seedFor(i + 200));
      const cardRuns = inn.batting.reduce((a, b) => a + b.runs, 0);
      const extras = inn.events
        .filter((e) => e.outcome === 'WD' || e.outcome === 'NB' || e.outcome === 'BYE' || e.outcome === 'LB')
        .reduce((a, e) => a + e.runs, 0);
      expect(cardRuns + extras).toBe(inn.runs);
      expect(inn.runs).toBeGreaterThanOrEqual(0);
      for (const b of inn.batting) {
        expect(Number.isFinite(b.runs)).toBe(true);
        expect(b.runs).toBeGreaterThanOrEqual(0);
        expect(b.balls).toBeGreaterThanOrEqual(0);
      }
      for (const b of inn.bowling) {
        expect(b.runs).toBeGreaterThanOrEqual(0);
        expect(b.wickets).toBeGreaterThanOrEqual(0);
        expect(b.wickets).toBeLessThanOrEqual(10);
      }
    }
  });
});
