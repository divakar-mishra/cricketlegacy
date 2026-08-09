import { generateSquad } from '../../generation/players';
import { LiveMatch } from '../liveMatch';
import { makeRng, Rng } from '../rng';
import { resolveToss } from '../toss';

function fixedRng(values: number[]): Rng {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

describe('toss decisions', () => {
  it('lets the controlled toss winner choose to bowl', () => {
    const toss = resolveToss({
      rng: fixedRng([0.1, 0.5]),
      format: 'T20',
      conditions: { pitch: 'FLAT', weather: 'CLEAR' },
      homeTeamId: 'home',
      awayTeamId: 'away',
      userTeamId: 'home',
      userChoice: 'BOWL',
    });

    expect(toss).toMatchObject({
      winnerTeamId: 'home',
      choice: 'BOWL',
      battingFirstTeamId: 'away',
      userMayChoose: true,
    });
  });

  it('uses conditions for an AI decision instead of always batting', () => {
    const toss = resolveToss({
      rng: fixedRng([0.1, 0.5]),
      format: 'T20',
      conditions: { pitch: 'GREEN', weather: 'OVERCAST' },
      homeTeamId: 'home',
      awayTeamId: 'away',
    });

    expect(toss.choice).toBe('BOWL');
    expect(toss.battingFirstTeamId).toBe('away');
  });

  it('resolves a real Heads/Tails call for the controlled captain', () => {
    const won = resolveToss({
      rng: fixedRng([0.8, 0.5]),
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      homeTeamId: 'home',
      awayTeamId: 'away',
      userTeamId: 'home',
      userCall: 'TAILS',
      userChoice: 'BAT',
    });
    const lost = resolveToss({
      rng: fixedRng([0.8, 0.5]),
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      homeTeamId: 'home',
      awayTeamId: 'away',
      userTeamId: 'home',
      userCall: 'HEADS',
      userChoice: 'BAT',
    });

    expect(won).toMatchObject({
      coinFace: 'TAILS',
      userCall: 'TAILS',
      winnerTeamId: 'home',
      userMayChoose: true,
    });
    expect(lost).toMatchObject({
      coinFace: 'TAILS',
      userCall: 'HEADS',
      winnerTeamId: 'away',
      userMayChoose: false,
    });
  });

  it('can rebuild a live match choice only before the first ball', () => {
    const home = generateSquad({
      nationality: 'india',
      quality: 60,
      idPrefix: 'home',
      rng: makeRng(10),
    });
    const away = generateSquad({
      nationality: 'india',
      quality: 60,
      idPrefix: 'away',
      rng: makeRng(20),
    });
    let live: LiveMatch | undefined;
    for (let seed = 1; seed < 50; seed += 1) {
      const candidate = new LiveMatch({
        id: `toss-${seed}`,
        seed,
        format: 'T20',
        conditions: { pitch: 'DRY', weather: 'CLEAR' },
        home: { teamId: 'home', players: home },
        away: { teamId: 'away', players: away },
        userTeamId: 'home',
      });
      if (candidate.tossDecision.userMayChoose) {
        live = candidate;
        break;
      }
    }
    expect(live).toBeDefined();
    expect(live!.setTossCall(live!.tossDecision.coinFace)).toBe(true);
    expect(live!.setTossChoice('BOWL')).toBe(true);
    expect(live!.battingTeamId).toBe('away');
    live!.nextBall();
    expect(live!.setTossChoice('BAT')).toBe(false);
  });

  it('keeps player interaction without granting a non-captain toss control', () => {
    const home = generateSquad({
      nationality: 'india',
      quality: 60,
      idPrefix: 'home',
      rng: makeRng(30),
    });
    const away = generateSquad({
      nationality: 'india',
      quality: 60,
      idPrefix: 'away',
      rng: makeRng(40),
    });

    const live = new LiveMatch({
      id: 'player-without-armband',
      seed: 4,
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      home: { teamId: 'home', players: home },
      away: { teamId: 'away', players: away },
      userTeamId: 'home',
      tossControllerTeamId: null,
      interactiveBatterId: home[0].id,
    });

    expect(live.controlledTeamId).toBe('home');
    expect(live.tossDecision.userMayChoose).toBe(false);
    expect(live.setTossChoice('BOWL')).toBe(false);
  });
});
