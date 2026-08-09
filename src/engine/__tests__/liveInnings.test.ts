import { BowlerPlan } from '../intent';
import { selectBowler } from '../ai';
import { simulateInnings, InningsInput } from '../simulateInnings';
import { LiveInnings } from '../liveInnings';
import { LiveMatch } from '../liveMatch';
import { makeRng } from '../rng';
import { makeTeams, NEUTRAL_CONDITIONS, seedFor } from './_helpers';

const { home, away } = makeTeams();

function inningsInput(): InningsInput {
  return {
    battingTeamId: 'home',
    bowlingTeamId: 'away',
    battingOrder: home.players,
    bowlingXI: away.players,
    format: 'T20',
    conditions: NEUTRAL_CONDITIONS,
    difficulty: 'NORMAL',
  };
}

describe('LiveInnings (stepwise controller)', () => {
  it('is a faithful refactor: AI-driven live innings == simulateInnings for the same seed', () => {
    for (let i = 1; i <= 40; i++) {
      const seed = seedFor(i);
      const auto = simulateInnings(inningsInput(), makeRng(seed));
      const live = new LiveInnings(inningsInput(), makeRng(seed)).runToEnd();
      expect(JSON.stringify(live)).toBe(JSON.stringify(auto));
    }
  });

  it('keeps runs = sum of events and 6 legal balls per completed over', () => {
    const live = new LiveInnings(inningsInput(), makeRng(seedFor(7)));
    while (!live.complete) live.nextBall();
    const inn = live.finalize();

    expect(inn.runs).toBe(inn.events.reduce((a, e) => a + e.runs, 0));

    const legal = inn.events.filter((e) => e.outcome !== 'WD' && e.outcome !== 'NB');
    expect(inn.balls).toBe(legal.length);
    const perOver: Record<number, number> = {};
    for (const e of legal) perOver[e.over] = (perOver[e.over] ?? 0) + 1;
    const overs = Object.keys(perOver)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 0; i < overs.length - 1; i++) expect(perOver[overs[i]]).toBe(6);
  });

  it('gives a selected T20 all-rounder at least two overs in auto and live play', () => {
    const allRounder = { ...away.players[4], role: 'ALLROUNDER' as const };
    const input = {
      ...inningsInput(),
      bowlingXI: away.players.map((player, index) => (index === 4 ? allRounder : player)),
      preferredAllRounderId: allRounder.id,
    };
    const seed = seedFor(47);
    const auto = simulateInnings(input, makeRng(seed));
    const live = new LiveInnings(
      { ...input, interactiveBowlerId: allRounder.id },
      makeRng(seed),
    ).runToEnd();

    expect(
      auto.bowling.find((card) => card.playerId === allRounder.id)?.balls,
    ).toBeGreaterThanOrEqual(12);
    expect(
      live.bowling.find((card) => card.playerId === allRounder.id)?.balls,
    ).toBeGreaterThanOrEqual(12);
  });

  it('treats an all-rounder minimum spell as a floor rather than an overs cap', () => {
    const elite = {
      ...away.players[4],
      role: 'ALLROUNDER' as const,
      bowlingStyle: 'PACE' as const,
      bowling: {
        paceOrSpin: 94,
        accuracy: 96,
        movement: 93,
        variations: 92,
        stamina: 95,
      },
      meta: { ...away.players[4].meta, form: 95 },
    };
    const support = away.players.slice(5, 10).map((player) => ({
      ...player,
      role: 'BOWLER' as const,
      bowlingStyle: 'MEDIUM' as const,
      bowling: {
        paceOrSpin: 45,
        accuracy: 45,
        movement: 45,
        variations: 45,
        stamina: 55,
      },
      meta: { ...player.meta, form: 50 },
    }));

    const selected = selectBowler(
      [elite, ...support],
      {
        format: 'T20',
        conditions: NEUTRAL_CONDITIONS,
        lastBowlerId: support[0].id,
        oversBowled: {
          [elite.id]: 2,
          [support[0].id]: 2,
          [support[1].id]: 2,
          [support[2].id]: 2,
          [support[3].id]: 2,
          [support[4].id]: 2,
        },
        over: 14,
        inningsOvers: 20,
        striker: home.players[0],
        bowlingFigures: {
          [elite.id]: { balls: 12, runs: 8, wickets: 3 },
        },
        preferredPlayerId: elite.id,
      },
      () => 0,
    );

    expect(selected.id).toBe(elite.id);
  });

  it('honours batting intent: aggressive intent produces more sixes than defensive', () => {
    const interactiveBatterId = home.players[0].id;
    let bigSixes = 0;
    let blockSixes = 0;

    for (let i = 0; i < 60; i++) {
      const bigLi = new LiveInnings(
        { ...inningsInput(), interactiveBatterId },
        makeRng(seedFor(i + 300)),
      );
      while (!bigLi.complete) bigLi.nextBall(bigLi.needsIntent() ? 'BIG' : undefined);
      bigSixes += bigLi.finalize().batting.find((b) => b.playerId === interactiveBatterId)!.sixes;

      const blockLi = new LiveInnings(
        { ...inningsInput(), interactiveBatterId },
        makeRng(seedFor(i + 300)),
      );
      while (!blockLi.complete) blockLi.nextBall(blockLi.needsIntent() ? 'BLOCK' : undefined);
      blockSixes += blockLi
        .finalize()
        .batting.find((b) => b.playerId === interactiveBatterId)!.sixes;
    }

    expect(bigSixes).toBeGreaterThan(blockSixes);
  });
});

describe('LiveMatch (orchestrator)', () => {
  it('produces a complete, valid limited-overs MatchState', () => {
    const lm = new LiveMatch({
      id: 'm1',
      seed: seedFor(500),
      format: 'T20',
      conditions: NEUTRAL_CONDITIONS,
      home,
      away,
      difficulty: 'NORMAL',
    });
    let guard = 0;
    while (!lm.matchDone && guard++ < 10_000) lm.nextBall();
    const match = lm.finalizeMatch();

    expect(match.innings).toHaveLength(2);
    expect(Number.isFinite(match.innings[0].runs)).toBe(true);
    expect(Number.isFinite(match.innings[1].runs)).toBe(true);
    expect(match.result).toBeDefined();
    expect(Boolean(match.result?.winnerTeamId) || Boolean(match.result?.tie)).toBe(true);
  });

  it('chases: innings 2 has a target of innings 1 + 1', () => {
    const lm = new LiveMatch({
      id: 'm2',
      seed: seedFor(501),
      format: 'T20',
      conditions: NEUTRAL_CONDITIONS,
      home,
      away,
      difficulty: 'NORMAL',
    });
    let guard = 0;
    while (!lm.matchDone && guard++ < 10_000) lm.nextBall();
    const match = lm.finalizeMatch();
    expect(match.innings[1].target).toBe(match.innings[0].runs + 1);
  });
});

describe('tactics feed the engine', () => {
  const aggregateRuns = (bias: number, plan?: BowlerPlan): number => {
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const li = new LiveInnings(
        { ...inningsInput(), battingBias: bias, defaultBowlerPlan: plan },
        makeRng(seedFor(i + 700)),
      );
      total += li.runToEnd().runs;
    }
    return total;
  };

  it('aggressive batting bias scores more than a defensive one', () => {
    expect(aggregateRuns(0.15)).toBeGreaterThan(aggregateRuns(-0.15));
  });

  it('a containing bowling plan concedes fewer runs than an attacking one', () => {
    expect(aggregateRuns(0, 'CONTAIN')).toBeLessThan(aggregateRuns(0, 'ATTACK'));
  });
});
