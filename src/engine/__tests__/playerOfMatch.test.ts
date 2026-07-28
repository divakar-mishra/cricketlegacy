import { Innings } from '../../domain/types';
import { pickPlayerOfMatch } from '../simulateMatch';

function innings(overrides: Partial<Innings>): Innings {
  return {
    battingTeamId: 'team-a',
    bowlingTeamId: 'team-b',
    runs: 0,
    wickets: 0,
    overs: 20,
    balls: 120,
    events: [],
    batting: [],
    bowling: [],
    ...overrides,
  };
}

describe('pickPlayerOfMatch', () => {
  it('rewards a decisive all-round contribution from the winning team', () => {
    const match = [
      innings({
        battingTeamId: 'team-a',
        bowlingTeamId: 'team-b',
        batting: [
          { playerId: 'all-rounder', runs: 48, balls: 34, fours: 5, sixes: 1, out: true, battedOrder: 5 },
          { playerId: 'opener', runs: 62, balls: 55, fours: 6, sixes: 0, out: true, battedOrder: 1 },
        ],
      }),
      innings({
        battingTeamId: 'team-b',
        bowlingTeamId: 'team-a',
        batting: [{ playerId: 'chaser', runs: 51, balls: 47, fours: 5, sixes: 1, out: true, battedOrder: 2 }],
        bowling: [
          { playerId: 'all-rounder', balls: 24, maidens: 1, runs: 24, wickets: 3 },
          { playerId: 'expensive-two', balls: 24, maidens: 0, runs: 52, wickets: 2 },
        ],
      }),
    ];

    expect(pickPlayerOfMatch(match, 'team-a')).toBe('all-rounder');
  });

  it('can choose an exceptional losing performance over a modest winner', () => {
    const match = [
      innings({
        battingTeamId: 'team-a',
        bowlingTeamId: 'team-b',
        batting: [{ playerId: 'losing-hero', runs: 122, balls: 78, fours: 12, sixes: 4, out: true, battedOrder: 3 }],
      }),
      innings({
        battingTeamId: 'team-b',
        bowlingTeamId: 'team-a',
        batting: [{ playerId: 'winning-finisher', runs: 58, balls: 42, fours: 6, sixes: 2, out: false, battedOrder: 4 }],
      }),
    ];

    expect(pickPlayerOfMatch(match, 'team-b')).toBe('losing-hero');
  });

  it('does not pick an expensive two-wicket spell over a century', () => {
    const match = [
      innings({
        battingTeamId: 'team-a',
        bowlingTeamId: 'team-b',
        batting: [{ playerId: 'centurion', runs: 104, balls: 91, fours: 10, sixes: 2, out: true, battedOrder: 1 }],
      }),
      innings({
        battingTeamId: 'team-b',
        bowlingTeamId: 'team-a',
        bowling: [{ playerId: 'leaky-bowler', balls: 24, maidens: 0, runs: 68, wickets: 2 }],
      }),
    ];

    expect(pickPlayerOfMatch(match, 'team-a')).toBe('centurion');
  });

  it('counts wicketkeeper and fielder impact from dismissal events', () => {
    const match = [
      innings({
        battingTeamId: 'team-a',
        bowlingTeamId: 'team-b',
        batting: [{ playerId: 'solid-bat', runs: 20, balls: 27, fours: 2, sixes: 0, out: true, battedOrder: 3 }],
      }),
      innings({
        battingTeamId: 'team-b',
        bowlingTeamId: 'team-a',
        events: [
          {
            over: 3,
            ballInOver: 2,
            strikerId: 'b1',
            nonStrikerId: 'b2',
            bowlerId: 'spinner',
            outcome: 'W',
            runs: 0,
            isWicket: true,
            dismissal: { type: 'STUMPED', bowlerId: 'spinner', fielderId: 'keeper' },
            commentary: 'Stumped.',
          },
          {
            over: 5,
            ballInOver: 4,
            strikerId: 'b3',
            nonStrikerId: 'b2',
            bowlerId: 'seamer',
            outcome: 'W',
            runs: 0,
            isWicket: true,
            dismissal: { type: 'CAUGHT', bowlerId: 'seamer', fielderId: 'keeper' },
            commentary: 'Caught.',
          },
          {
            over: 7,
            ballInOver: 1,
            strikerId: 'b4',
            nonStrikerId: 'b2',
            bowlerId: 'seamer',
            outcome: 'W',
            runs: 0,
            isWicket: true,
            dismissal: { type: 'RUN_OUT', fielderId: 'keeper' },
            commentary: 'Run out.',
          },
        ],
        bowling: [{ playerId: 'spinner', balls: 24, maidens: 0, runs: 48, wickets: 0 }],
      }),
    ];

    expect(pickPlayerOfMatch(match, 'team-a')).toBe('keeper');
  });
});
