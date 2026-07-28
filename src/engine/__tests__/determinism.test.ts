import { simulateMatch } from '../simulateMatch';
import { makeTeams, NEUTRAL_CONDITIONS } from './_helpers';

describe('determinism & golden master', () => {
  const { home, away } = makeTeams();

  it('same (seed, inputs) produces byte-identical match state', () => {
    const input = {
      id: 'm1',
      seed: 20260706,
      format: 'T20' as const,
      conditions: NEUTRAL_CONDITIONS,
      home,
      away,
    };
    const a = simulateMatch(input);
    const b = simulateMatch(input);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('matches a committed golden-master summary', () => {
    const m = simulateMatch({
      id: 'gm',
      seed: 777,
      format: 'T20',
      conditions: NEUTRAL_CONDITIONS,
      home,
      away,
    });
    const summary = {
      format: m.format,
      margin: m.result?.margin,
      winner: m.result?.winnerTeamId ?? (m.result?.tie ? 'tie' : 'none'),
      scores: m.innings.map((i) => `${i.runs}/${i.wickets} (${i.overs.toFixed(1)})`),
    };
    expect(summary).toMatchSnapshot();
  });
});
