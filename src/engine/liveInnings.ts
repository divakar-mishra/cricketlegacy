/**
 * Stepwise innings controller for the advanced text-based match experience.
 *
 * It advances one delivery at a time via `nextBall(intent?)` so the UI can stream
 * commentary, pause for the player's intent when the user is on strike, and render
 * a live scorecard. It reuses the verified engine primitives (resolveBall, AI,
 * config) — the auto-sim path in simulateInnings.ts is left untouched.
 */
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
import { battingAggression, requiredAllRounderBowler, selectBowler } from './ai';
import { BowlerPlan, FieldSetting, Intent, intentToAggression, legalFieldSetting } from './intent';
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
import { DifficultyOutcomeBalance } from './difficulty';

export interface LiveInningsInput {
  battingTeamId: string;
  bowlingTeamId: string;
  battingOrder: Player[];
  bowlingXI: Player[];
  format: Format;
  conditions: Conditions;
  difficulty: Difficulty;
  target?: number;
  oversCap?: number;
  /** When the striker's id matches this, nextBall() honours the supplied intent. */
  interactiveBatterId?: string;
  /** When the bowler's id matches this, the over honours the chosen bowling plan. */
  interactiveBowlerId?: string;
  /** Team batting tactic bias added to every batter's aggression this innings. */
  battingBias?: number;
  /** Team bowling tactic applied to every bowler this innings (unless overridden). */
  defaultBowlerPlan?: BowlerPlan;
  /** Bowling side's field setting for this innings (default = no-op). */
  fieldSetting?: FieldSetting;
  /** Overs bowled in the whole match before this innings (Test pitch wear). */
  matchOversOffset?: number;
  /** User-side difficulty adjustment for this innings. Hard is the 1.0 baseline. */
  outcomeBalance?: DifficultyOutcomeBalance;
  /** Team-wide for Manager; protagonist-only for Player Career. */
  outcomeBalanceScope?: 'TEAM' | 'STRIKER' | 'BOWLER';
  outcomeBalancePlayerId?: string;
  /** Match-only captaincy effects; zero outside high-pressure passages. */
  battingLeadershipBonus?: number;
  fieldingLeadershipBonus?: number;
}

export interface LiveScore {
  runs: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  crr: number;
  target?: number;
  runsToWin?: number;
  ballsRemaining?: number;
  requiredRunRate?: number;
}

export interface BallStep {
  event: BallEvent;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  score: LiveScore;
  overComplete: boolean;
  inningsComplete: boolean;
  milestone?: { playerId: string; kind: 'FIFTY' | 'HUNDRED' };
  wicketOf?: string;
  newBatterId?: string;
}

const oversText = (balls: number, bpo: number): string =>
  `${Math.floor(balls / bpo)}.${balls % bpo}`;

/** Full pre-delivery state, captured each ball to support a DRS overturn rewind. */
interface InningsSnapshot {
  runs: number;
  wickets: number;
  legalBalls: number;
  strikerIdx: number;
  nonStrikerIdx: number;
  nextBatterIdx: number;
  overIndex: number;
  overStarted: boolean;
  currentBowlerId: string;
  staminaNow: number;
  legalThisOver: number;
  runsThisOver: number;
  ballInOver: number;
  lastBowlerId: string | undefined;
  currentPlan: BowlerPlan | undefined;
  finished: boolean;
  batting: BatterCard[];
  bowlerCards: Record<string, BowlerCard>;
  oversBowled: Record<string, number>;
  eventsLen: number;
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
  if (chance(0.12, rng)) return bowler;
  const others = fielders.filter((f) => f.id !== bowler.id);
  return pick(others.length ? others : fielders, rng);
}

export class LiveInnings {
  readonly battingTeamId: string;
  readonly bowlingTeamId: string;
  readonly format: Format;
  readonly target?: number;

  private readonly input: LiveInningsInput;
  private readonly rng: Rng;
  private readonly fmt: (typeof FORMATS)[Format];
  private readonly maxOvers: number;
  private readonly totalBalls: number;
  private readonly batting: BatterCard[];
  private readonly bowlerCards: Record<string, BowlerCard> = {};
  private readonly effectiveBowlers: Player[];
  private readonly fielders: Player[];
  private readonly keeper: Player;
  private readonly fieldingQuality: number;
  private readonly fieldingRunOutQuality: number;
  private readonly keeperQuality: number;
  private readonly chasing: boolean;
  private readonly oversBowled: Record<string, number> = {};
  private readonly totalBatters: number;
  private readonly events: BallEvent[] = [];
  private readonly byId: Record<string, Player> = {};

  private runs = 0;
  private wickets = 0;
  private legalBalls = 0;
  private strikerIdx = 0;
  private nonStrikerIdx = 1;
  private nextBatterIdx = 2;
  private overIndex = 0;

  private overStarted = false;
  private currentBowlerId = '';
  private staminaNow = 100;
  private legalThisOver = 0;
  private runsThisOver = 0;
  private ballInOver = 0;
  private lastBowlerId: string | undefined;
  private currentPlan: BowlerPlan | undefined;
  private finished = false;
  /** Snapshot of state immediately before the most recent delivery (DRS rewind). */
  private preBall: InningsSnapshot | undefined;

  constructor(input: LiveInningsInput, rng: Rng) {
    this.input = input;
    this.rng = rng;
    this.battingTeamId = input.battingTeamId;
    this.bowlingTeamId = input.bowlingTeamId;
    this.format = input.format;
    this.target = input.target;
    this.fmt = FORMATS[input.format];
    this.maxOvers = input.oversCap ?? this.fmt.overs;
    this.totalBalls = this.maxOvers * this.fmt.ballsPerOver;

    for (const p of input.battingOrder) this.byId[p.id] = p;
    for (const p of input.bowlingXI) this.byId[p.id] = p;

    this.batting = input.battingOrder.map((p, i) => ({
      playerId: p.id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      battedOrder: i,
    }));

    const canBowlList = input.bowlingXI.filter(canBowl);
    this.effectiveBowlers = canBowlList.length >= 2 ? canBowlList : input.bowlingXI.slice(0, 5);
    this.fielders = input.bowlingXI;
    this.keeper = input.bowlingXI.find((p) => p.role === 'WK_BATTER') ?? input.bowlingXI[0];
    this.fieldingQuality = fieldingQualityOf(input.bowlingXI);
    this.fieldingRunOutQuality = runOutFieldingQualityOf(input.bowlingXI);
    this.keeperQuality = keeperQualityOf(input.bowlingXI);
    this.chasing = input.target != null;
    this.totalBatters = input.battingOrder.length;
  }

  get complete(): boolean {
    return this.finished;
  }

  get scoreState(): LiveScore {
    return this.buildScore();
  }

  private isAllOut(): boolean {
    return this.wickets >= this.totalBatters - 1;
  }

  private chaseWon(): boolean {
    return this.target != null && this.runs >= this.target;
  }

  private getBowlerCard(id: string): BowlerCard {
    if (!this.bowlerCards[id]) {
      this.bowlerCards[id] = { playerId: id, balls: 0, maidens: 0, runs: 0, wickets: 0 };
    }
    return this.bowlerCards[id];
  }

  private ensureOverStarted(): void {
    if (this.overStarted || this.finished) return;
    const selectionContext = {
      format: this.format,
      conditions: this.input.conditions,
      lastBowlerId: this.lastBowlerId,
      oversBowled: this.oversBowled,
      over: this.overIndex,
      striker: this.input.battingOrder[this.strikerIdx],
      inningsOvers: this.maxOvers,
      bowlingFigures: this.bowlerCards,
      preferredPlayerId: this.input.interactiveBowlerId,
    };
    const bowler =
      requiredAllRounderBowler(
        this.effectiveBowlers,
        selectionContext,
        this.input.interactiveBowlerId,
      ) ?? selectBowler(this.effectiveBowlers, selectionContext, this.rng);
    this.currentBowlerId = bowler.id;
    this.lastBowlerId = bowler.id;
    this.staminaNow = clamp(
      bowler.bowling.stamina - (this.oversBowled[bowler.id] ?? 0) * 6,
      20,
      100,
    );
    this.legalThisOver = 0;
    this.runsThisOver = 0;
    this.ballInOver = 0;
    this.currentPlan = undefined;
    this.getBowlerCard(bowler.id);
    this.overStarted = true;
  }

  private endOver(): void {
    const bc = this.getBowlerCard(this.currentBowlerId);
    if (this.runsThisOver === 0 && this.legalThisOver === this.fmt.ballsPerOver) bc.maidens++;
    this.oversBowled[this.currentBowlerId] = (this.oversBowled[this.currentBowlerId] ?? 0) + 1;
    const tmp = this.strikerIdx;
    this.strikerIdx = this.nonStrikerIdx;
    this.nonStrikerIdx = tmp;
    this.overStarted = false;
    this.overIndex++;
  }

  private buildScore(): LiveScore {
    const bpo = this.fmt.ballsPerOver;
    const crr = this.legalBalls > 0 ? this.runs / (this.legalBalls / bpo) : 0;
    const score: LiveScore = {
      runs: this.runs,
      wickets: this.wickets,
      legalBalls: this.legalBalls,
      oversText: oversText(this.legalBalls, bpo),
      crr,
    };
    if (this.target != null) {
      const ballsRemaining = Math.max(0, this.totalBalls - this.legalBalls);
      const runsToWin = Math.max(0, this.target - this.runs);
      score.target = this.target;
      score.runsToWin = runsToWin;
      score.ballsRemaining = ballsRemaining;
      score.requiredRunRate = ballsRemaining > 0 ? runsToWin / (ballsRemaining / bpo) : 0;
    }
    return score;
  }

  /** Snapshot of who is at the crease/bowling (selects the bowler for a fresh over). */
  peek(): {
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    strikerRuns: number;
    strikerBalls: number;
    nonStrikerRuns: number;
    nonStrikerBalls: number;
    bowlerRuns: number;
    bowlerWickets: number;
    bowlerBalls: number;
  } {
    this.ensureOverStarted();
    const s = this.batting[this.strikerIdx];
    const ns = this.batting[this.nonStrikerIdx];
    const bc = this.getBowlerCard(this.currentBowlerId);
    return {
      strikerId: s.playerId,
      nonStrikerId: ns.playerId,
      bowlerId: this.currentBowlerId,
      strikerRuns: s.runs,
      strikerBalls: s.balls,
      nonStrikerRuns: ns.runs,
      nonStrikerBalls: ns.balls,
      bowlerRuns: bc.runs,
      bowlerWickets: bc.wickets,
      bowlerBalls: bc.balls,
    };
  }

  /** True when the upcoming striker is the interactive (user) batter. */
  needsIntent(): boolean {
    if (this.finished || !this.input.interactiveBatterId) return false;
    return this.input.battingOrder[this.strikerIdx].id === this.input.interactiveBatterId;
  }

  /** True when the user is bowling this over and hasn't set a plan yet. */
  needsBowlingPlan(): boolean {
    if (this.finished || !this.input.interactiveBowlerId) return false;
    this.ensureOverStarted();
    return (
      this.currentBowlerId === this.input.interactiveBowlerId && this.currentPlan === undefined
    );
  }

  setBowlingPlan(plan: BowlerPlan): void {
    this.currentPlan = plan;
  }

  /** Mid-innings tactical intervention — only the provided fields change. */
  updateTactics(t: { battingBias?: number; bowlerPlan?: BowlerPlan; field?: FieldSetting }): void {
    if (t.battingBias !== undefined) this.input.battingBias = t.battingBias;
    if (t.bowlerPlan !== undefined) this.input.defaultBowlerPlan = t.bowlerPlan;
    if (t.field !== undefined) this.input.fieldSetting = t.field;
  }

  nextBall(intent?: Intent): BallStep {
    if (this.finished) throw new Error('Innings already complete');
    this.ensureOverStarted();
    // Capture a full rewind point so a DRS review can undo this delivery.
    this.preBall = this.captureSnapshot();

    const striker = this.input.battingOrder[this.strikerIdx];
    const nonStriker = this.input.battingOrder[this.nonStrikerIdx];
    const bowler = this.byId[this.currentBowlerId];
    const strikerCard = this.batting[this.strikerIdx];

    const pressure = computePressure(
      this.target,
      this.runs,
      this.wickets,
      this.legalBalls,
      this.totalBalls,
      this.fmt.ballsPerOver,
    );

    const isUser = this.input.interactiveBatterId === striker.id;
    const aggression =
      isUser && intent
        ? intentToAggression(intent)
        : clamp(
            battingAggression({
              format: this.format,
              ballsBowledLegal: this.legalBalls,
              wicketsLost: this.wickets,
              scoreNow: this.runs,
              target: this.target,
              batter: striker,
              difficulty: this.input.difficulty,
            }) + (this.input.battingBias ?? 0),
            0.06,
            0.98,
          );

    const bowlerPlan =
      this.input.interactiveBowlerId && this.currentBowlerId === this.input.interactiveBowlerId
        ? (this.currentPlan ?? this.input.defaultBowlerPlan)
        : this.input.defaultBowlerPlan;

    const ctx: BallContext = {
      format: this.format,
      conditions: this.input.conditions,
      over: this.overIndex,
      ballInOver: this.ballInOver + 1,
      striker,
      nonStriker,
      bowler,
      bowlerStaminaNow: this.staminaNow,
      pressure,
      aggression,
      bowlerPlan,
      fieldSetting: legalFieldSetting(this.input.fieldSetting, this.format, this.overIndex),
      strikerBallsFaced: strikerCard.balls,
      fieldingQuality: this.fieldingQuality,
      fieldingRunOutQuality: this.fieldingRunOutQuality,
      keeperQuality: this.keeperQuality,
      chasing: this.chasing,
      matchOversOffset: this.input.matchOversOffset,
      outcomeBalance:
        this.input.outcomeBalanceScope === 'TEAM' ||
        (this.input.outcomeBalanceScope === 'STRIKER' &&
          striker.id === this.input.outcomeBalancePlayerId) ||
        (this.input.outcomeBalanceScope === 'BOWLER' &&
          bowler.id === this.input.outcomeBalancePlayerId)
          ? this.input.outcomeBalance
          : undefined,
      battingLeadershipBonus: this.input.battingLeadershipBonus,
      fieldingLeadershipBonus: this.input.fieldingLeadershipBonus,
    };

    const ev = resolveBall(ctx, this.rng);
    this.events.push(ev);

    const bc = this.getBowlerCard(this.currentBowlerId);
    this.runs += ev.runs;
    this.runsThisOver += ev.runs;
    bc.runs += ev.runs;

    let milestone: BallStep['milestone'];

    if (isLegalDelivery(ev.outcome)) {
      this.legalBalls++;
      this.legalThisOver++;
      this.ballInOver++;
      bc.balls++;
      strikerCard.balls++;
      if (ev.outcome === '4') strikerCard.fours++;
      if (ev.outcome === '6') strikerCard.sixes++;
      // Credit runs off the bat — including runs completed before a run-out.
      if (
        ev.outcome !== 'BYE' &&
        ev.outcome !== 'LB' &&
        (!ev.isWicket || ev.dismissal?.type === 'RUN_OUT')
      ) {
        const before = strikerCard.runs;
        strikerCard.runs += ev.runs;
        if (before < 50 && strikerCard.runs >= 50) {
          milestone = { playerId: striker.id, kind: 'FIFTY' };
        }
        if (before < 100 && strikerCard.runs >= 100) {
          milestone = { playerId: striker.id, kind: 'HUNDRED' };
        }
      }
    }

    let wicketOf: string | undefined;
    let newBatterId: string | undefined;

    if (ev.isWicket) {
      this.wickets++;
      if (ev.dismissal?.type !== 'RUN_OUT') bc.wickets++;
      const d: Dismissal = ev.dismissal!;
      if (d.type === 'CAUGHT') d.fielderId = randomFielder(this.fielders, bowler, this.rng).id;
      else if (d.type === 'STUMPED') d.fielderId = this.keeper.id;
      else if (d.type === 'RUN_OUT')
        d.fielderId = randomFielder(this.fielders, bowler, this.rng).id;
      strikerCard.out = true;
      strikerCard.dismissal = d;
      wicketOf = striker.id;
      if (this.nextBatterIdx < this.totalBatters) {
        this.strikerIdx = this.nextBatterIdx;
        newBatterId = this.input.battingOrder[this.nextBatterIdx].id;
        this.nextBatterIdx++;
      }
    } else if (ev.runs % 2 === 1) {
      const tmp = this.strikerIdx;
      this.strikerIdx = this.nonStrikerIdx;
      this.nonStrikerIdx = tmp;
    }

    let overComplete = false;
    const overFilled = this.legalThisOver >= this.fmt.ballsPerOver;
    if (this.isAllOut() || this.chaseWon()) {
      // If the innings-ending ball also completed the over, still credit a maiden
      // so a live innings is byte-identical to the auto-sim (which reaches its
      // end-of-over maiden check when it exits the ball loop normally).
      if (overFilled && this.runsThisOver === 0) this.getBowlerCard(this.currentBowlerId).maidens++;
      this.finished = true;
    } else if (overFilled) {
      this.endOver();
      overComplete = true;
      if (this.overIndex >= this.maxOvers) this.finished = true;
    }

    return {
      event: ev,
      strikerId: striker.id,
      nonStrikerId: nonStriker.id,
      bowlerId: bowler.id,
      score: this.buildScore(),
      overComplete,
      inningsComplete: this.finished,
      milestone,
      wicketOf,
      newBatterId,
    };
  }

  private captureSnapshot(): InningsSnapshot {
    return {
      runs: this.runs,
      wickets: this.wickets,
      legalBalls: this.legalBalls,
      strikerIdx: this.strikerIdx,
      nonStrikerIdx: this.nonStrikerIdx,
      nextBatterIdx: this.nextBatterIdx,
      overIndex: this.overIndex,
      overStarted: this.overStarted,
      currentBowlerId: this.currentBowlerId,
      staminaNow: this.staminaNow,
      legalThisOver: this.legalThisOver,
      runsThisOver: this.runsThisOver,
      ballInOver: this.ballInOver,
      lastBowlerId: this.lastBowlerId,
      currentPlan: this.currentPlan,
      finished: this.finished,
      batting: this.batting.map((c) => ({ ...c })),
      bowlerCards: Object.fromEntries(
        Object.entries(this.bowlerCards).map(([k, v]) => [k, { ...v }]),
      ),
      oversBowled: { ...this.oversBowled },
      eventsLen: this.events.length,
    };
  }

  /**
   * Reverse the most recent delivery — used when a DRS review overturns the
   * on-field dismissal. It rewinds the innings to exactly before that ball, so
   * the (not-out) batter resumes and the next delivery is bowled afresh. Only
   * valid immediately after a wicket that did NOT end the innings. Returns false
   * if there is nothing to overturn.
   */
  overturnLastWicket(): boolean {
    const s = this.preBall;
    if (!s || this.finished) return false;
    const lastEv = this.events[this.events.length - 1];
    if (!lastEv || !lastEv.isWicket) return false;

    this.runs = s.runs;
    this.wickets = s.wickets;
    this.legalBalls = s.legalBalls;
    this.strikerIdx = s.strikerIdx;
    this.nonStrikerIdx = s.nonStrikerIdx;
    this.nextBatterIdx = s.nextBatterIdx;
    this.overIndex = s.overIndex;
    this.overStarted = s.overStarted;
    this.currentBowlerId = s.currentBowlerId;
    this.staminaNow = s.staminaNow;
    this.legalThisOver = s.legalThisOver;
    this.runsThisOver = s.runsThisOver;
    this.ballInOver = s.ballInOver;
    this.lastBowlerId = s.lastBowlerId;
    this.currentPlan = s.currentPlan;
    this.finished = s.finished;

    for (let i = 0; i < this.batting.length; i++) {
      const src = s.batting[i];
      if (src) Object.assign(this.batting[i], src);
    }
    for (const k of Object.keys(this.bowlerCards)) {
      if (!(k in s.bowlerCards)) delete this.bowlerCards[k];
    }
    for (const [k, v] of Object.entries(s.bowlerCards)) {
      if (this.bowlerCards[k]) Object.assign(this.bowlerCards[k], v);
      else this.bowlerCards[k] = { ...v };
    }
    for (const k of Object.keys(this.oversBowled)) {
      if (!(k in s.oversBowled)) delete this.oversBowled[k];
    }
    Object.assign(this.oversBowled, s.oversBowled);
    this.events.length = s.eventsLen; // drop the reviewed delivery from the log
    this.preBall = undefined; // a review can only overturn once
    return true;
  }

  /** Drive the innings to completion (AI decides every ball). */
  runToEnd(): Innings {
    while (!this.finished) this.nextBall();
    return this.finalize();
  }

  finalize(): Innings {
    const bpo = this.fmt.ballsPerOver;
    const completedOvers = Math.floor(this.legalBalls / bpo);
    const remBalls = this.legalBalls % bpo;
    return {
      battingTeamId: this.battingTeamId,
      bowlingTeamId: this.bowlingTeamId,
      runs: this.runs,
      wickets: this.wickets,
      overs: completedOvers + remBalls / 10,
      balls: this.legalBalls,
      events: this.events,
      batting: this.batting,
      bowling: Object.values(this.bowlerCards),
      target: this.target,
    };
  }
}
