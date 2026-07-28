import { MatchState, Tactics } from '../../domain/types';
import { tacticalImpactSummary, tacticIntentSummary } from '../tactics';

const tactics: Tactics = {
  batting: 'AGGRESSIVE',
  bowling: 'ATTACK',
  field: 'CATCHING',
};

const match: MatchState = {
  id: 'm1',
  seed: 1,
  format: 'T20',
  conditions: { pitch: 'DRY', weather: 'CLEAR' },
  homeTeamId: 'user',
  awayTeamId: 'opp',
  innings: [
    {
      battingTeamId: 'user',
      bowlingTeamId: 'opp',
      runs: 164,
      wickets: 6,
      overs: 20,
      balls: 120,
      target: undefined,
      batting: [
        {
          playerId: 'u1',
          runs: 72,
          balls: 42,
          fours: 7,
          sixes: 3,
          out: true,
          battedOrder: 0,
        },
        {
          playerId: 'u2',
          runs: 38,
          balls: 25,
          fours: 4,
          sixes: 1,
          out: true,
          battedOrder: 1,
        },
      ],
      bowling: [],
      events: [],
    },
    {
      battingTeamId: 'opp',
      bowlingTeamId: 'user',
      runs: 151,
      wickets: 8,
      overs: 20,
      balls: 120,
      target: 165,
      batting: [],
      bowling: [
        { playerId: 'u3', balls: 24, maidens: 0, runs: 31, wickets: 3 },
        { playerId: 'u4', balls: 24, maidens: 0, runs: 28, wickets: 2 },
      ],
      events: [
        {
          over: 0,
          ballInOver: 1,
          strikerId: 'o1',
          nonStrikerId: 'o2',
          bowlerId: 'u3',
          outcome: 'DOT',
          runs: 0,
          isWicket: false,
          commentary: 'Dot.',
        },
        {
          over: 0,
          ballInOver: 2,
          strikerId: 'o1',
          nonStrikerId: 'o2',
          bowlerId: 'u3',
          outcome: 'DOT',
          runs: 0,
          isWicket: false,
          commentary: 'Dot.',
        },
      ],
    },
  ],
  result: { winnerTeamId: 'user', margin: 'user won by 13 runs' },
};

describe('tacticalImpactSummary', () => {
  it('summarizes tactical impact from the actual scorecard', () => {
    const summary = tacticalImpactSummary(tactics, match, 'user');

    expect(summary).toContain('Aggressive batting produced 164/6');
    expect(summary).toContain('15 boundaries');
    expect(summary).toContain('Attack bowling conceded 151');
    expect(summary).toContain('taking 5 wickets');
    expect(summary).toContain('forcing 2 dots');
  });

  it('falls back to intent text when there is no match context', () => {
    expect(tacticalImpactSummary(tactics)).toBe(tacticIntentSummary(tactics));
  });
});
