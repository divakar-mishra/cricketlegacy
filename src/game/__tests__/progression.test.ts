import { MatchState, Player, SaveGame } from '../../domain/types';
import { computeOverall } from '../../engine/rating';
import { makeRng } from '../../engine/rng';
import {
  applyTraining,
  canTrainGroup,
  developPlayer,
  matchObjective,
  matchRating,
  MatchPerformance,
  objectiveMet,
  seasonAwards,
  sessionsDone,
  trainingCost,
  trainingGroupsForRole,
  updateFormAfterMatch,
  userPerformance,
} from '../progression';
import { emptyStats } from '../stats';

function makePlayer(over: Partial<Player> = {}): Player {
  const p: Player = {
    id: 'user',
    name: 'Tester',
    nationality: 'india',
    age: 22,
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 50, timing: 50, power: 50, footwork: 50, temperament: 50, running: 50 },
    bowling: { paceOrSpin: 50, accuracy: 50, movement: 50, variations: 50, stamina: 50 },
    fielding: { catching: 50, throwing: 50, agility: 50, keeping: 50 },
    meta: { fitness: 50, form: 60, confidence: 50, aggression: 50, discipline: 50 },
    potential: 80,
    traits: [],
    overall: 0,
    isUserPlayer: true,
    ...over,
  };
  p.overall = computeOverall(p);
  return p;
}

const perf = (over: Partial<MatchPerformance>): MatchPerformance => ({
  batted: false,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  out: false,
  bowled: false,
  wickets: 0,
  runsConceded: 0,
  ballsBowled: 0,
  ...over,
});

describe('developPlayer (age curve)', () => {
  it('young players grow toward potential and age up', () => {
    const p = makePlayer({ age: 20, potential: 85 });
    const before = p.overall;
    developPlayer(p, makeRng(1));
    expect(p.age).toBe(21);
    expect(p.overall).toBeGreaterThan(before);
  });

  it('veterans decline', () => {
    const p = makePlayer({ age: 36 });
    const before = p.overall;
    developPlayer(p, makeRng(2));
    expect(p.age).toBe(37);
    expect(p.overall).toBeLessThan(before);
  });
});

describe('training', () => {
  it('only exposes training disciplines that match the player role', () => {
    const batter = makePlayer({ role: 'BATTER' });
    const keeper = makePlayer({ role: 'WK_BATTER' });
    const allrounder = makePlayer({ role: 'ALLROUNDER' });

    expect(trainingGroupsForRole('BATTER')).toEqual(['batting', 'fielding', 'fitness', 'mental']);
    expect(trainingGroupsForRole('BOWLER')).toEqual(['bowling', 'fielding', 'fitness', 'mental']);
    expect(trainingGroupsForRole('WK_BATTER')).toEqual(['batting', 'wicketkeeping', 'fielding', 'fitness']);
    expect(trainingGroupsForRole('ALLROUNDER')).toEqual(['batting', 'bowling']);
    expect(canTrainGroup(batter, 'bowling')).toBe(false);
    expect(canTrainGroup(keeper, 'fielding')).toBe(true);
    expect(canTrainGroup(keeper, 'mental')).toBe(false);
    expect(canTrainGroup(keeper, 'fitness')).toBe(true);
    expect(canTrainGroup(allrounder, 'bowling')).toBe(true);
    expect(canTrainGroup(allrounder, 'fielding')).toBe(false);
  });

  it('rejects hidden training disciplines without spending a session', () => {
    const p = makePlayer({ role: 'BATTER' });
    const bowlingBefore = { ...p.bowling };
    const gains = applyTraining(p, 'bowling', makeRng(8));

    expect(gains).toEqual([]);
    expect(p.bowling).toEqual(bowlingBefore);
    expect(p.trainingSessionsThisSeason).toBeUndefined();
    expect(sessionsDone(p, 'bowling')).toBe(0);
  });

  it('improves the two weakest attributes and costs more each session', () => {
    const p = makePlayer({ batting: { technique: 30, timing: 70, power: 70, footwork: 40, temperament: 70, running: 70 } });
    const gains = applyTraining(p, 'batting', makeRng(5));
    expect(gains).toHaveLength(2);
    for (const g of gains) expect(g.to).toBeGreaterThan(g.from);
    expect(p.trainingSessionsThisSeason).toBe(1);
    // weakest two were technique(30) & footwork(40)
    expect(p.batting.technique).toBeGreaterThan(30);
    expect(p.batting.footwork).toBeGreaterThan(40);
  });

  it('tracks costs per training discipline', () => {
    const p = makePlayer({ role: 'ALLROUNDER' });
    applyTraining(p, 'batting', makeRng(9));

    expect(sessionsDone(p, 'batting')).toBe(1);
    expect(sessionsDone(p, 'bowling')).toBe(0);
    expect(trainingCost(sessionsDone(p, 'batting'))).toBe(400);
    expect(trainingCost(sessionsDone(p, 'bowling'))).toBe(250);
  });

  it('trains fielding, wicketkeeping, fitness, and mental as separate role focuses', () => {
    const batter = makePlayer({
      role: 'BATTER',
      fielding: { catching: 30, throwing: 40, agility: 70, keeping: 20 },
    });
    const keeper = makePlayer({
      role: 'WK_BATTER',
      fielding: { catching: 70, throwing: 70, agility: 70, keeping: 20 },
      meta: { fitness: 30, confidence: 20, aggression: 20, discipline: 20, form: 60 },
    });

    applyTraining(batter, 'fielding', makeRng(4));
    expect(batter.fielding.catching).toBeGreaterThan(30);
    expect(batter.fielding.throwing).toBeGreaterThan(40);
    expect(batter.fielding.keeping).toBe(20);

    applyTraining(keeper, 'wicketkeeping', makeRng(4));
    expect(keeper.fielding.keeping).toBeGreaterThan(20);
    expect(keeper.fielding.catching).toBe(70);

    applyTraining(keeper, 'fitness', makeRng(4));
    expect(keeper.meta.fitness).toBeGreaterThan(30);
    expect(keeper.meta.confidence).toBe(20);
  });

  it('caps youth training at the career-stage ceiling', () => {
    const school = makePlayer({
      role: 'BATTER',
      batting: { technique: 61, timing: 61, power: 80, footwork: 80, temperament: 80, running: 80 },
    });
    const u19 = makePlayer({
      role: 'BATTER',
      batting: { technique: 75, timing: 75, power: 80, footwork: 80, temperament: 80, running: 80 },
    });

    applyTraining(school, 'batting', makeRng(1), 'SCHOOL');
    applyTraining(u19, 'batting', makeRng(1), 'U19');

    expect(school.batting.technique).toBeLessThanOrEqual(62);
    expect(school.batting.timing).toBeLessThanOrEqual(62);
    expect(u19.batting.technique).toBeLessThanOrEqual(76);
    expect(u19.batting.timing).toBeLessThanOrEqual(76);
  });

  it('multiplies accelerator gains while retaining the attribute ceiling', () => {
    const normal = makePlayer({ role: 'BATTER' });
    const accelerated = JSON.parse(JSON.stringify(normal)) as Player;
    const normalGains = applyTraining(normal, 'batting', makeRng(33), 'DOMESTIC');
    const acceleratedGains = applyTraining(accelerated, 'batting', makeRng(33), 'DOMESTIC', 3);

    expect(acceleratedGains).toHaveLength(normalGains.length);
    for (let index = 0; index < normalGains.length; index += 1) {
      expect(acceleratedGains[index].to - acceleratedGains[index].from).toBe(
        (normalGains[index].to - normalGains[index].from) * 3,
      );
    }
  });

  it('cost scales with sessions done', () => {
    expect(trainingCost(0)).toBe(250);
    expect(trainingCost(2)).toBe(250 + 2 * 150);
  });
});

describe('form & rating', () => {
  it('good innings lifts form, a cheap dismissal drops it', () => {
    const good = makePlayer();
    updateFormAfterMatch(good, perf({ batted: true, runs: 60, balls: 40, out: true }));
    expect(good.meta.form).toBeGreaterThan(60);

    const bad = makePlayer();
    updateFormAfterMatch(bad, perf({ batted: true, runs: 2, balls: 5, out: true }));
    expect(bad.meta.form).toBeLessThan(60);
  });

  it('rating rewards runs and wickets', () => {
    const star = matchRating(perf({ batted: true, runs: 80, balls: 45, fours: 8, sixes: 3, bowled: true, wickets: 2, runsConceded: 20, ballsBowled: 24 }));
    const duck = matchRating(perf({ batted: true, runs: 0, balls: 2, out: true }));
    expect(star).toBeGreaterThan(duck);
    expect(star).toBeLessThanOrEqual(10);
    expect(duck).toBeGreaterThanOrEqual(1);
  });
});

describe('objectives', () => {
  it('evaluates run/wicket/either targets', () => {
    expect(objectiveMet(perf({ batted: true, runs: 35 }), matchObjective('BATTER'))).toBe(true);
    expect(objectiveMet(perf({ batted: true, runs: 20 }), matchObjective('BATTER'))).toBe(false);
    expect(objectiveMet(perf({ bowled: true, wickets: 2 }), matchObjective('BOWLER'))).toBe(true);
    expect(objectiveMet(perf({ batted: true, runs: 25 }), matchObjective('ALLROUNDER'))).toBe(true);
  });
});

describe('userPerformance & awards', () => {
  it('aggregates batting and bowling from a match', () => {
    const match: MatchState = {
      id: 'x',
      seed: 1,
      format: 'T20',
      conditions: { pitch: 'DRY', weather: 'CLEAR' },
      homeTeamId: 'h',
      awayTeamId: 'a',
      innings: [
        {
          battingTeamId: 'h',
          bowlingTeamId: 'a',
          runs: 160,
          wickets: 5,
          overs: 20,
          balls: 120,
          events: [],
          batting: [{ playerId: 'user', runs: 45, balls: 30, fours: 4, sixes: 2, out: true, battedOrder: 0 }],
          bowling: [],
        },
        {
          battingTeamId: 'a',
          bowlingTeamId: 'h',
          runs: 150,
          wickets: 8,
          overs: 20,
          balls: 120,
          events: [],
          batting: [],
          bowling: [{ playerId: 'user', balls: 24, maidens: 0, runs: 30, wickets: 3 }],
        },
      ],
    };
    const p = userPerformance(match, 'user');
    expect(p.runs).toBe(45);
    expect(p.out).toBe(true);
    expect(p.wickets).toBe(3);
    expect(p.bowled).toBe(true);
  });

  it('season awards pick the leaders', () => {
    const save = {
      players: {
        a: { ...makePlayer({ id: 'a' }), seasonStats: { ...emptyStats(), runs: 400, wickets: 2 } },
        b: { ...makePlayer({ id: 'b' }), seasonStats: { ...emptyStats(), runs: 100, wickets: 15 } },
      },
    } as unknown as SaveGame;
    const awards = seasonAwards(save);
    expect(awards.topScorer?.playerId).toBe('a');
    expect(awards.topWicketTaker?.playerId).toBe('b');
  });
});
