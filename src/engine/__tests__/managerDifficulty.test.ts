import { generateSquad } from '../../generation/players';
import { Difficulty } from '../../domain/types';
import { LiveMatch } from '../liveMatch';
import { makeRng } from '../rng';
import { aiTacticsFor, managerStyleFor } from '../../game/season';

function managerWinRate(
  userQuality: number,
  oppositionQuality: number,
  count = 400,
  difficulty: Difficulty = 'NORMAL',
): number {
  const home = generateSquad({
    nationality: 'india',
    quality: userQuality,
    idPrefix: `user-${userQuality}`,
    rng: makeRng(1000 + userQuality),
  });
  const away = generateSquad({
    nationality: 'india',
    quality: oppositionQuality,
    idPrefix: `opposition-${oppositionQuality}`,
    rng: makeRng(2000 + oppositionQuality),
  });
  let wins = 0;
  for (let seed = 1; seed <= count; seed += 1) {
    const live = new LiveMatch({
      id: `manager-${userQuality}-${oppositionQuality}-${seed}`,
      seed,
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      home: { teamId: 'user', players: home },
      away: { teamId: 'opposition', players: away },
      userTeamId: 'user',
      difficulty,
      difficultyBalanceProfile: 'MANAGER',
    });
    while (!live.matchDone) live.nextBall();
    if (live.finalizeMatch().result?.winnerTeamId === 'user') wins += 1;
  }
  return (wins / count) * 100;
}

describe('Manager match balance', () => {
  it('keeps Normal neutral while preserving a meaningful team-strength curve', () => {
    const equal = managerWinRate(64, 64);
    const minusFour = managerWinRate(64, 68);
    const minusEight = managerWinRate(64, 72);

    expect(equal).toBeGreaterThanOrEqual(35);
    expect(equal).toBeLessThanOrEqual(50);
    expect(minusFour).toBeGreaterThanOrEqual(18);
    expect(minusFour).toBeLessThanOrEqual(30);
    expect(minusEight).toBeGreaterThanOrEqual(10);
    expect(minusEight).toBeLessThanOrEqual(22);
    expect(equal).toBeGreaterThan(minusFour);
    expect(minusFour).toBeGreaterThan(minusEight);
  });

  it('applies modest Easy help and the approved Hard/Pro opposition edges', () => {
    const home = generateSquad({
      nationality: 'india',
      quality: 64,
      idPrefix: 'mirror-home',
      rng: makeRng(321),
    });
    const away = home.map((player, index) => ({
      ...player,
      id: `mirror-away-${index}`,
      batting: { ...player.batting },
      bowling: { ...player.bowling },
      fielding: { ...player.fielding },
      meta: { ...player.meta },
    }));
    const rate = (difficulty: Difficulty) => {
      let wins = 0;
      for (let seed = 1; seed <= 400; seed += 1) {
        const live = new LiveMatch({
          id: `mirror-${difficulty}-${seed}`,
          seed,
          format: 'T20',
          conditions: { pitch: 'DRY', weather: 'CLEAR' },
          home: { teamId: 'user', players: home },
          away: { teamId: 'opposition', players: away },
          userTeamId: 'user',
          difficulty,
          difficultyBalanceProfile: 'MANAGER',
        });
        while (!live.matchDone) live.nextBall();
        if (live.finalizeMatch().result?.winnerTeamId === 'user') wins += 1;
      }
      return wins / 4;
    };
    const easy = rate('EASY');
    const normal = rate('NORMAL');
    const hard = rate('HARD');
    const pro = rate('PRO');

    expect(easy).toBeGreaterThanOrEqual(50);
    expect(easy).toBeLessThanOrEqual(65);
    expect(normal).toBeGreaterThanOrEqual(42);
    expect(normal).toBeLessThanOrEqual(55);
    expect(hard).toBeGreaterThanOrEqual(38);
    expect(hard).toBeLessThanOrEqual(50);
    expect(pro).toBeGreaterThanOrEqual(30);
    expect(pro).toBeLessThanOrEqual(42);
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThan(pro);
  });

  it('does not give the default Manager plan an edge over AI personalities', () => {
    const home = generateSquad({
      nationality: 'india',
      quality: 70,
      idPrefix: 'tactics-home',
      rng: makeRng(963),
    });
    const away = home.map((player, index) => ({
      ...player,
      id: `tactics-away-${index}`,
      batting: { ...player.batting },
      bowling: { ...player.bowling },
      fielding: { ...player.fielding },
      meta: { ...player.meta },
    }));
    const styleIds = new Map<string, string>();
    for (let index = 0; index < 100 && styleIds.size < 4; index += 1) {
      const id = `national-tactics-${index}`;
      styleIds.set(managerStyleFor(id), id);
    }

    let wins = 0;
    let matches = 0;
    const styleWinRates: Record<string, number> = {};
    for (const [style, teamId] of styleIds) {
      let styleWins = 0;
      for (let seed = 1; seed <= 100; seed += 1) {
        const live = new LiveMatch({
          id: `personality-${teamId}-${seed}`,
          seed,
          format: 'T20',
          conditions: { pitch: 'DRY', weather: 'CLEAR' },
          home: {
            teamId: 'user',
            players: home,
            tactics: { battingBias: 0, bowlerPlan: 'CONTAIN', field: 'BALANCED' },
          },
          away: {
            teamId,
            players: away,
            tactics: aiTacticsFor({ id: teamId, reputation: 70 }),
          },
          userTeamId: 'user',
          difficulty: 'NORMAL',
          difficultyBalanceProfile: 'MANAGER',
          tactics: { battingBias: 0, bowlingPlan: 'CONTAIN', field: 'BALANCED' },
        });
        while (!live.matchDone) live.nextBall();
        if (live.finalizeMatch().result?.winnerTeamId === 'user') {
          wins += 1;
          styleWins += 1;
        }
        matches += 1;
      }
      styleWinRates[style] = styleWins;
    }

    const winRate = (wins / matches) * 100;
    expect(winRate).toBeGreaterThanOrEqual(35);
    expect(winRate).toBeLessThanOrEqual(55);
    for (const [style, styleWinRate] of Object.entries(styleWinRates)) {
      if (styleWinRate < 35 || styleWinRate > 65) {
        throw new Error(
          `${style} gave the default plan a ${styleWinRate}% win rate (${JSON.stringify(styleWinRates)}).`,
        );
      }
    }
  });
});
