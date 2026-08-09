import { difficultyAggression } from '../ai';
import { difficultyOutcomeBalance } from '../difficulty';
import { LiveMatch } from '../liveMatch';
import { generateSquad } from '../../generation/players';
import { makeRng } from '../rng';
import { Difficulty } from '../../domain/types';

function difficultySample(difficulty: Difficulty): { wins: number; runDifference: number } {
  const home = generateSquad({
    nationality: 'india',
    quality: 48,
    idPrefix: 'school-user',
    rng: makeRng(101),
  });
  const away = generateSquad({
    nationality: 'india',
    quality: 48,
    idPrefix: 'school-opposition',
    rng: makeRng(202),
  });
  let wins = 0;
  let runDifference = 0;
  for (let seed = 1; seed <= 80; seed += 1) {
    const live = new LiveMatch({
      id: `${difficulty}-${seed}`,
      seed,
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      home: { teamId: 'user', players: home },
      away: { teamId: 'opposition', players: away },
      userTeamId: 'user',
      difficulty,
    });
    while (!live.matchDone) live.nextBall();
    const match = live.finalizeMatch();
    if (match.result?.winnerTeamId === 'user') wins += 1;
    const userRuns = match.innings.find((innings) => innings.battingTeamId === 'user')?.runs ?? 0;
    const opponentRuns =
      match.innings.find((innings) => innings.battingTeamId === 'opposition')?.runs ?? 0;
    runDifference += userRuns - opponentRuns;
  }
  return { wins, runDifference };
}

describe('difficulty aggression tuning', () => {
  it('makes easy mode clearly easier than normal without changing other tiers', () => {
    expect(difficultyAggression('EASY')).toBe(0.78);
    expect(difficultyAggression('NORMAL')).toBe(1);
    expect(difficultyAggression('HARD')).toBe(1.08);
    expect(difficultyAggression('PRO')).toBe(1.15);
  });
});

describe('difficulty outcome balance', () => {
  it('gives Normal a measured user-side edge without changing the Hard baseline', () => {
    expect(difficultyOutcomeBalance('NORMAL', true)).toEqual({ wicket: 0.82, scoring: 1.09 });
    expect(difficultyOutcomeBalance('NORMAL', false)).toEqual({ wicket: 1.16, scoring: 0.92 });
    expect(difficultyOutcomeBalance('HARD', true)).toEqual({ wicket: 1, scoring: 1 });
    expect(difficultyOutcomeBalance('HARD', false)).toEqual({ wicket: 1, scoring: 1 });
  });

  it('keeps Easy more forgiving and Pro less forgiving than Normal', () => {
    expect(difficultyOutcomeBalance('EASY', true).wicket).toBeLessThan(
      difficultyOutcomeBalance('NORMAL', true).wicket,
    );
    expect(difficultyOutcomeBalance('PRO', true).wicket).toBeGreaterThan(
      difficultyOutcomeBalance('NORMAL', true).wicket,
    );
  });

  it('turns the multipliers into a meaningful School-strength match advantage', () => {
    const easy = difficultySample('EASY');
    const normal = difficultySample('NORMAL');
    const hard = difficultySample('HARD');

    expect(easy.wins).toBeGreaterThanOrEqual(normal.wins);
    expect(normal.wins).toBeGreaterThan(hard.wins);
    expect(easy.runDifference).toBeGreaterThan(normal.runDifference);
    expect(normal.runDifference).toBeGreaterThan(hard.runDifference);
  });
});
