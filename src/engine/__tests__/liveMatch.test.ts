import { LiveMatch } from '../liveMatch';
import { simulateMatch } from '../simulateMatch';
import { makeTeams, NEUTRAL_CONDITIONS, seedFor } from './_helpers';

const { home, away } = makeTeams();

function driveToEnd(seed: number, format: 'T20' | 'ODI' | 'TEST') {
  const lm = new LiveMatch({ id: 'm', seed, format, conditions: NEUTRAL_CONDITIONS, home, away, difficulty: 'NORMAL' });
  let guard = 0;
  while (!lm.matchDone && guard++ < 100_000) lm.nextBall();
  return lm.finalizeMatch();
}

describe('LiveMatch (full match orchestration)', () => {
  it('a fully-watched Test equals the auto-simulated Test for the same seed', () => {
    for (let i = 1; i <= 8; i++) {
      const seed = seedFor(i);
      const auto = simulateMatch({ id: 'm', seed, format: 'TEST', conditions: NEUTRAL_CONDITIONS, home, away, difficulty: 'NORMAL' });
      const live = driveToEnd(seed, 'TEST');
      expect(live.innings.length).toBe(4);
      expect(JSON.stringify(live.innings)).toBe(JSON.stringify(auto.innings));
      expect(live.result).toEqual(auto.result);
    }
  });

  it('a watched limited-overs match equals the auto-sim for the same seed', () => {
    for (const format of ['T20', 'ODI'] as const) {
      const seed = seedFor(3);
      const auto = simulateMatch({ id: 'm', seed, format, conditions: NEUTRAL_CONDITIONS, home, away, difficulty: 'NORMAL' });
      const live = driveToEnd(seed, format);
      expect(JSON.stringify(live.innings)).toBe(JSON.stringify(auto.innings));
      expect(live.result).toEqual(auto.result);
    }
  });
});
