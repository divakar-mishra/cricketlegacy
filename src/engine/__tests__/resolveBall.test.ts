import { BallOutcome, Conditions, Player } from '../../domain/types';
import { generatePlayer } from '../../generation/players';
import {
  resolveBall,
  BallContext,
  fieldingQualityOf,
  keeperQualityOf,
  runOutFieldingQualityOf,
} from '../resolveBall';
import { makeRng } from '../rng';

const RUN_MAP: Record<string, number> = { DOT: 0, '1': 1, '2': 2, '3': 3, '4': 4, '6': 6 };
const ALL_OUTCOMES: BallOutcome[] = ['DOT', '1', '2', '3', '4', '6', 'W', 'WD', 'NB', 'BYE', 'LB'];

function makeCtx(): BallContext {
  const gen = makeRng(1);
  return {
    format: 'T20',
    conditions: { pitch: 'DRY', weather: 'CLEAR' } as Conditions,
    over: 5,
    ballInOver: 1,
    striker: generatePlayer({
      id: 's',
      nationality: 'india',
      role: 'BATTER',
      quality: 72,
      rng: gen,
    }),
    nonStriker: generatePlayer({
      id: 'ns',
      nationality: 'india',
      role: 'BATTER',
      quality: 60,
      rng: gen,
    }),
    bowler: generatePlayer({
      id: 'bw',
      nationality: 'australia',
      role: 'BOWLER',
      quality: 72,
      rng: gen,
    }),
    bowlerStaminaNow: 80,
    pressure: 0.2,
    aggression: 0.5,
  };
}

function withBatting(p: Player, v: number): Player {
  return {
    ...p,
    batting: { technique: v, timing: v, power: v, footwork: v, temperament: v, running: v },
    meta: { ...p.meta, confidence: v, aggression: v, discipline: v },
  };
}

function withBowling(p: Player, v: number): Player {
  return {
    ...p,
    bowling: { paceOrSpin: v, accuracy: v, movement: v, variations: v, stamina: v },
  };
}

function outcomeSample(ctx: BallContext, seed: number, n = 18000): Record<string, number> {
  const rng = makeRng(seed);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const ev = resolveBall(ctx, rng);
    counts[ev.outcome] = (counts[ev.outcome] ?? 0) + 1;
  }
  return counts;
}

describe('resolveBall', () => {
  it('always returns a valid outcome with consistent, finite runs', () => {
    const ctx = makeCtx();
    const rng = makeRng(5);
    for (let i = 0; i < 8000; i++) {
      const ev = resolveBall(ctx, rng);
      expect(ALL_OUTCOMES).toContain(ev.outcome);
      expect(Number.isFinite(ev.runs)).toBe(true);
      expect(ev.runs).toBeGreaterThanOrEqual(0);
      if (ev.outcome in RUN_MAP) expect(ev.runs).toBe(RUN_MAP[ev.outcome]);
      if (ev.isWicket) {
        expect(ev.outcome).toBe('W');
        expect(ev.dismissal).toBeDefined();
      }
    }
  });

  it('produces extras, wickets and boundaries across many samples', () => {
    const ctx = makeCtx();
    const rng = makeRng(3);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 30000; i++) {
      const ev = resolveBall(ctx, rng);
      counts[ev.outcome] = (counts[ev.outcome] ?? 0) + 1;
    }
    expect(counts.WD ?? 0).toBeGreaterThan(0);
    expect(counts.NB ?? 0).toBeGreaterThan(0);
    expect(counts.W ?? 0).toBeGreaterThan(0);
    expect(counts['4'] ?? 0).toBeGreaterThan(0);
    expect(counts['6'] ?? 0).toBeGreaterThan(0);
  });

  it('batting and bowling allocations shift outcomes statistically', () => {
    const base = makeCtx();
    const strongBatter = outcomeSample({ ...base, striker: withBatting(base.striker, 90) }, 10);
    const weakBatter = outcomeSample({ ...base, striker: withBatting(base.striker, 30) }, 10);
    expect((strongBatter['4'] ?? 0) + (strongBatter['6'] ?? 0)).toBeGreaterThan(
      (weakBatter['4'] ?? 0) + (weakBatter['6'] ?? 0),
    );
    expect(strongBatter.W ?? 0).toBeLessThan(weakBatter.W ?? 0);

    const strongBowler = outcomeSample({ ...base, bowler: withBowling(base.bowler, 90) }, 11);
    const weakBowler = outcomeSample({ ...base, bowler: withBowling(base.bowler, 30) }, 11);
    expect(strongBowler.W ?? 0).toBeGreaterThan(weakBowler.W ?? 0);
    expect((strongBowler['4'] ?? 0) + (strongBowler['6'] ?? 0)).toBeLessThan(
      (weakBowler['4'] ?? 0) + (weakBowler['6'] ?? 0),
    );
  });

  it('fielding, throwing and keeping allocations feed match quality helpers', () => {
    const gen = makeRng(21);
    const low = Array.from({ length: 11 }, (_, i) =>
      generatePlayer({
        id: `l${i}`,
        nationality: 'india',
        role: i === 0 ? 'WK_BATTER' : 'BATTER',
        quality: 40,
        rng: gen,
      }),
    ).map((p) => ({
      ...p,
      fielding: {
        catching: 25,
        throwing: 25,
        agility: 25,
        keeping: p.role === 'WK_BATTER' ? 25 : 10,
      },
    }));
    const high = low.map((p) => ({
      ...p,
      fielding: {
        catching: 90,
        throwing: 90,
        agility: 90,
        keeping: p.role === 'WK_BATTER' ? 90 : 35,
      },
    }));

    expect(fieldingQualityOf(high)).toBeGreaterThan(fieldingQualityOf(low));
    expect(runOutFieldingQualityOf(high)).toBeGreaterThan(runOutFieldingQualityOf(low));
    expect(keeperQualityOf(high)).toBeGreaterThan(keeperQualityOf(low));
  });
});
