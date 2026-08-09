import { generateSquad } from '../../generation/players';
import { simulateMatch, TeamSide } from '../simulateMatch';
import { makeRng } from '../rng';

describe('T20 season distributions', () => {
  it('keeps a 14-match league believable without clipping individual performances', () => {
    const teams: TeamSide[] = Array.from({ length: 8 }, (_, index) => ({
      teamId: `team-${index + 1}`,
      players: generateSquad({
        nationality: 'india',
        quality: 54 + index * 2,
        idPrefix: `team-${index + 1}`,
        rng: makeRng(1_000 + index),
      }),
    }));
    const seasonRuns: Record<string, number> = {};
    const seasonWickets: Record<string, number> = {};
    const inningsTotals: number[] = [];
    const inningsHighScores: number[] = [];
    let matchIndex = 0;

    for (let home = 0; home < teams.length; home += 1) {
      for (let away = home + 1; away < teams.length; away += 1) {
        for (let leg = 0; leg < 2; leg += 1) {
          const first = leg === 0 ? teams[home] : teams[away];
          const second = leg === 0 ? teams[away] : teams[home];
          const match = simulateMatch({
            id: `season-${matchIndex}`,
            seed: 20_000 + matchIndex++,
            format: 'T20',
            conditions: {
              pitch: ['GREEN', 'DRY', 'DUSTY', 'FLAT'][matchIndex % 4] as
                'GREEN' | 'DRY' | 'DUSTY' | 'FLAT',
              weather: ['CLEAR', 'OVERCAST', 'HUMID'][matchIndex % 3] as
                'CLEAR' | 'OVERCAST' | 'HUMID',
            },
            home: first,
            away: second,
            difficulty: 'HARD',
          });
          for (const innings of match.innings) {
            inningsTotals.push(innings.runs);
            inningsHighScores.push(Math.max(...innings.batting.map((card) => card.runs)));
            for (const card of innings.batting) {
              seasonRuns[card.playerId] = (seasonRuns[card.playerId] ?? 0) + card.runs;
            }
            for (const card of innings.bowling) {
              seasonWickets[card.playerId] = (seasonWickets[card.playerId] ?? 0) + card.wickets;
            }
          }
        }
      }
    }

    const averageTotal =
      inningsTotals.reduce((sum, value) => sum + value, 0) / inningsTotals.length;
    const highestSeasonRuns = Math.max(...Object.values(seasonRuns));
    const highestSeasonWickets = Math.max(...Object.values(seasonWickets));

    expect(matchIndex).toBe(56);
    expect(averageTotal).toBeGreaterThan(105);
    expect(averageTotal).toBeLessThan(210);
    expect(Math.max(...inningsTotals)).toBeLessThan(300);
    expect(Math.max(...inningsHighScores)).toBeLessThan(220);
    expect(highestSeasonRuns).toBeGreaterThan(250);
    expect(highestSeasonRuns).toBeLessThan(1_100);
    expect(highestSeasonWickets).toBeGreaterThan(8);
    expect(highestSeasonWickets).toBeLessThan(45);
    expect(Object.values(seasonRuns).filter((runs) => runs >= 200).length).toBeGreaterThan(6);
    expect(Object.values(seasonWickets).filter((wickets) => wickets >= 8).length).toBeGreaterThan(
      6,
    );
  });
});
