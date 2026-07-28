import { Format } from '../../domain/types';
import { simulateInnings } from '../simulateInnings';
import { simulateMatch } from '../simulateMatch';
import { makeRng } from '../rng';
import { makeTeams, NEUTRAL_CONDITIONS, seedFor } from './_helpers';

interface Bands {
  meanRuns: number;
  meanWkts: number;
  boundaryPct: number;
  dotPct: number;
}

function sampleInnings(format: Format, n: number): Bands {
  const { home, away } = makeTeams(66);
  let runsSum = 0;
  let wktSum = 0;
  let boundaries = 0;
  let dots = 0;
  let legalBalls = 0;

  for (let i = 1; i <= n; i++) {
    const inn = simulateInnings(
      {
        battingTeamId: 'home',
        bowlingTeamId: 'away',
        battingOrder: home.players,
        bowlingXI: away.players,
        format,
        conditions: NEUTRAL_CONDITIONS,
        difficulty: 'NORMAL',
      },
      makeRng(seedFor(i)),
    );
    expect(Number.isFinite(inn.runs)).toBe(true);
    expect(inn.runs).toBeGreaterThanOrEqual(0);
    runsSum += inn.runs;
    wktSum += inn.wickets;
    for (const e of inn.events) {
      if (e.outcome === 'WD' || e.outcome === 'NB') continue;
      legalBalls++;
      if (e.outcome === '4' || e.outcome === '6') boundaries++;
      if (e.outcome === 'DOT') dots++;
    }
  }
  return {
    meanRuns: runsSum / n,
    meanWkts: wktSum / n,
    boundaryPct: boundaries / legalBalls,
    dotPct: dots / legalBalls,
  };
}

describe('Monte Carlo balance (PART 3.6)', () => {
  it('T20 sits in realistic bands', () => {
    const s = sampleInnings('T20', 3000);
    console.log('T20 Monte Carlo:', s);
    expect(s.meanRuns).toBeGreaterThanOrEqual(150);
    expect(s.meanRuns).toBeLessThanOrEqual(185);
    expect(s.meanWkts).toBeGreaterThanOrEqual(5.5);
    expect(s.meanWkts).toBeLessThanOrEqual(8.2);
    expect(s.boundaryPct).toBeGreaterThan(0.12);
    expect(s.boundaryPct).toBeLessThan(0.26);
    expect(s.dotPct).toBeGreaterThan(0.28);
    expect(s.dotPct).toBeLessThan(0.46);
  });

  it('ODI mean is realistic and sides are not routinely all out', () => {
    const s = sampleInnings('ODI', 1200);
    console.log('ODI Monte Carlo:', s);
    expect(s.meanRuns).toBeGreaterThanOrEqual(230);
    expect(s.meanRuns).toBeLessThanOrEqual(320);
    // Real ODI innings finish ~6-7.5 down, not near all-out (~9-10).
    expect(s.meanWkts).toBeGreaterThanOrEqual(5.5);
    expect(s.meanWkts).toBeLessThanOrEqual(8.5);
  });

  it('Test matches produce a realistic mix of results and draws', () => {
    const { home, away } = makeTeams(66);
    let draws = 0;
    let decisive = 0;
    const N = 40;
    for (let i = 1; i <= N; i++) {
      const m = simulateMatch({
        id: `t${i}`,
        seed: seedFor(i + 500),
        format: 'TEST',
        conditions: { pitch: 'DRY', weather: 'CLEAR' },
        home,
        away,
      });
      for (const inn of m.innings) expect(Number.isFinite(inn.runs)).toBe(true);
      if (!m.result?.winnerTeamId && !m.result?.tie) draws++;
      else decisive++;
    }
    console.log(`Test draws: ${draws}/${N}, decisive: ${decisive}`);
    // Neither "someone always wins" (old bug: 1/40) nor "always drawn".
    expect(draws).toBeGreaterThanOrEqual(3);
    expect(draws).toBeLessThanOrEqual(28);
    expect(decisive).toBeGreaterThanOrEqual(10);
  });
});
