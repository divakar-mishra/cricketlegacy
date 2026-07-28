import { FORMATS } from '../data/gameConfig';
import {
  BallEvent,
  BatterCard,
  BowlerCard,
  Conditions,
  Difficulty,
  Dismissal,
  Format,
  Innings,
  Player,
} from '../domain/types';
import { clamp } from '../utils/math';
import { battingAggression, selectBowler } from './ai';
import { BowlerPlan, FieldSetting } from './intent';
import { canBowl } from './rating';
import { chance, pick, Rng } from './rng';
import {
  BallContext,
  fieldingQualityOf,
  isLegalDelivery,
  keeperQualityOf,
  resolveBall,
  runOutFieldingQualityOf,
} from './resolveBall';

export interface InningsInput {
  battingTeamId: string;
  bowlingTeamId: string;
  battingOrder: Player[]; // full XI in batting order
  bowlingXI: Player[];
  format: Format;
  conditions: Conditions;
  difficulty: Difficulty;
  target?: number; // chase target (win when runs >= target)
  oversCap?: number; // optional override (e.g. Test innings cap)
  /** Team batting tactic bias added to every batter's aggression (default 0 = no-op). */
  battingBias?: number;
  /** Team bowling plan applied to every delivery this innings (default = no-op). */
  bowlerPlan?: BowlerPlan;
  /** Bowling side's field setting (default = no-op). */
  fieldSetting?: FieldSetting;
  /** Overs bowled in the whole match before this innings (Test pitch wear). */
  matchOversOffset?: number;
}

function computePressure(
  target: number | undefined,
  runs: number,
  wickets: number,
  legalBalls: number,
  totalBalls: number,
  ballsPerOver: number,
): number {
  if (target != null) {
    const ballsLeft = Math.max(1, totalBalls - legalBalls);
    const runsNeeded = Math.max(0, target - runs);
    const reqRate = (runsNeeded / ballsLeft) * ballsPerOver;
    return clamp(clamp((reqRate - 7) / 8, 0, 1) * 0.7 + (wickets / 10) * 0.3, 0, 1);
  }
  const phase = legalBalls / totalBalls;
  return clamp((wickets / 10) * 0.5 + (phase > 0.8 ? 0.2 : 0), 0, 1);
}

function randomFielder(fielders: Player[], bowler: Player, rng: Rng): Player {
  if (chance(0.12, rng)) return bowler; // caught & bowled
  const others = fielders.filter((f) => f.id !== bowler.id);
  return pick(others.length ? others : fielders, rng);
}

export function simulateInnings(input: InningsInput, rng: Rng): Innings {
  const fmt = FORMATS[input.format];
  const maxOvers = input.oversCap ?? fmt.overs;
  const totalBalls = maxOvers * fmt.ballsPerOver;

  const batting: BatterCard[] = input.battingOrder.map((p, i) => ({
    playerId: p.id,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    battedOrder: i,
  }));

  const bowlerCards: Record<string, BowlerCard> = {};
  const getBowlerCard = (id: string): BowlerCard => {
    if (!bowlerCards[id])
      bowlerCards[id] = { playerId: id, balls: 0, maidens: 0, runs: 0, wickets: 0 };
    return bowlerCards[id];
  };

  const canBowlList = input.bowlingXI.filter(canBowl);
  const effectiveBowlers = canBowlList.length >= 2 ? canBowlList : input.bowlingXI.slice(0, 5);
  const fielders = input.bowlingXI;
  const keeper = input.bowlingXI.find((p) => p.role === 'WK_BATTER') ?? input.bowlingXI[0];
  const fieldingQuality = fieldingQualityOf(input.bowlingXI);
  const fieldingRunOutQuality = runOutFieldingQualityOf(input.bowlingXI);
  const keeperQuality = keeperQualityOf(input.bowlingXI);
  const chasing = input.target != null;
  const oversBowled: Record<string, number> = {};

  const totalBatters = input.battingOrder.length;
  const events: BallEvent[] = [];
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;
  let lastBowlerId: string | undefined;

  const isAllOut = () => wickets >= totalBatters - 1;
  const chaseWon = () => input.target != null && runs >= input.target;

  overLoop: for (let over = 0; over < maxOvers; over++) {
    if (isAllOut() || chaseWon()) break;

    const bowler = selectBowler(
      effectiveBowlers,
      {
        format: input.format,
        conditions: input.conditions,
        lastBowlerId,
        oversBowled,
        over,
        striker: input.battingOrder[strikerIdx],
      },
      rng,
    );
    lastBowlerId = bowler.id;
    const bc = getBowlerCard(bowler.id);
    const staminaNow = clamp(bowler.bowling.stamina - (oversBowled[bowler.id] ?? 0) * 6, 20, 100);

    let ballInOver = 0;
    let runsThisOver = 0;
    let legalThisOver = 0;
    let safety = 0;

    while (legalThisOver < fmt.ballsPerOver) {
      if (++safety > fmt.ballsPerOver + 50) break;
      if (isAllOut() || chaseWon()) break overLoop;

      const striker = input.battingOrder[strikerIdx];
      const nonStriker = input.battingOrder[nonStrikerIdx];
      const pressure = computePressure(
        input.target,
        runs,
        wickets,
        legalBalls,
        totalBalls,
        fmt.ballsPerOver,
      );
      const aggression = clamp(
        battingAggression({
          format: input.format,
          ballsBowledLegal: legalBalls,
          wicketsLost: wickets,
          scoreNow: runs,
          target: input.target,
          batter: striker,
          difficulty: input.difficulty,
        }) + (input.battingBias ?? 0),
        0.06,
        0.98,
      );

      const ctx: BallContext = {
        format: input.format,
        conditions: input.conditions,
        over,
        ballInOver: ballInOver + 1,
        striker,
        nonStriker,
        bowler,
        bowlerStaminaNow: staminaNow,
        pressure,
        aggression,
        bowlerPlan: input.bowlerPlan,
        fieldSetting: input.fieldSetting,
        strikerBallsFaced: batting[strikerIdx].balls,
        fieldingQuality,
        fieldingRunOutQuality,
        keeperQuality,
        chasing,
        matchOversOffset: input.matchOversOffset,
      };

      const ev = resolveBall(ctx, rng);
      events.push(ev);

      runs += ev.runs;
      runsThisOver += ev.runs;
      bc.runs += ev.runs;
      const strikerCard = batting[strikerIdx];

      if (isLegalDelivery(ev.outcome)) {
        legalBalls++;
        legalThisOver++;
        ballInOver++;
        bc.balls++;
        strikerCard.balls++;
        if (ev.outcome === '4') strikerCard.fours++;
        if (ev.outcome === '6') strikerCard.sixes++;
        // Credit runs off the bat — including runs completed before a run-out.
        if (
          ev.outcome !== 'BYE' &&
          ev.outcome !== 'LB' &&
          (!ev.isWicket || ev.dismissal?.type === 'RUN_OUT')
        )
          strikerCard.runs += ev.runs;
      }

      if (ev.isWicket) {
        wickets++;
        if (ev.dismissal?.type !== 'RUN_OUT') bc.wickets++; // run-outs are not the bowler's wicket
        const d: Dismissal = ev.dismissal!;
        if (d.type === 'CAUGHT') d.fielderId = randomFielder(fielders, bowler, rng).id;
        else if (d.type === 'STUMPED') d.fielderId = keeper.id;
        else if (d.type === 'RUN_OUT') d.fielderId = randomFielder(fielders, bowler, rng).id;
        strikerCard.out = true;
        strikerCard.dismissal = d;

        if (nextBatterIdx < totalBatters) {
          strikerIdx = nextBatterIdx;
          nextBatterIdx++;
        }
      } else if (ev.runs % 2 === 1) {
        const tmp = strikerIdx;
        strikerIdx = nonStrikerIdx;
        nonStrikerIdx = tmp;
      }

      if (chaseWon()) break overLoop;
    }

    if (runsThisOver === 0 && legalThisOver === fmt.ballsPerOver) bc.maidens++;
    oversBowled[bowler.id] = (oversBowled[bowler.id] ?? 0) + 1;

    // swap strike at end of over
    const tmp = strikerIdx;
    strikerIdx = nonStrikerIdx;
    nonStrikerIdx = tmp;
  }

  const completedOvers = Math.floor(legalBalls / fmt.ballsPerOver);
  const remBalls = legalBalls % fmt.ballsPerOver;

  return {
    battingTeamId: input.battingTeamId,
    bowlingTeamId: input.bowlingTeamId,
    runs,
    wickets,
    overs: completedOvers + remBalls / 10,
    balls: legalBalls,
    events,
    batting,
    bowling: Object.values(bowlerCards),
    target: input.target,
  };
}

/** True when the batting side has lost all available wickets. */
export function inningsAllOut(innings: Innings, squadSize: number): boolean {
  return innings.wickets >= squadSize - 1;
}
