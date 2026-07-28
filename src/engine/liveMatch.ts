/**
 * Orchestrates a full limited-overs match as a stream of deliveries the UI drives
 * ball-by-ball. Innings 2 chases innings 1. Interactive intent is honoured only
 * for the innings where the user's team bats. Test matches fall back to auto-sim.
 */
import { FORMATS } from '../data/gameConfig';
import { Conditions, Difficulty, Format, Innings, MatchState } from '../domain/types';
import { BowlerPlan, FieldSetting } from './intent';
import { LiveInnings, BallStep } from './liveInnings';
import { makeRng, Rng } from './rng';
import {
  decideLimited,
  decideTest,
  declarationCap,
  pickPlayerOfMatch,
  TeamSide,
  TEST_INNINGS_CAP,
  testRemaining,
} from './simulateMatch';
import { difficultyOutcomeBalance } from './difficulty';

export interface LiveMatchInput {
  id: string;
  seed: number;
  format: Format;
  conditions: Conditions;
  home: TeamSide;
  away: TeamSide;
  difficulty?: Difficulty;
  userTeamId?: string;
  /** The user's player id — interactive only while their team bats. */
  interactiveBatterId?: string;
  /** Manager tactics applied to the user's team only. */
  tactics?: { battingBias: number; bowlingPlan: BowlerPlan; field?: FieldSetting };
}

export interface MatchBallStep extends BallStep {
  inningsIndex: number;
  inningsBreak: boolean;
  matchComplete: boolean;
}

/** Match simulateTest's per-innings cap flooring so live == auto-sim. */
const testCap = (cap: number): number => Math.max(1, Math.floor(cap));

export class LiveMatch {
  readonly id: string;
  readonly seed: number;
  readonly format: Format;
  readonly conditions: Conditions;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly isTest: boolean;

  private readonly input: LiveMatchInput;
  private readonly rng: Rng;
  private readonly difficulty: Difficulty;
  private readonly first: TeamSide;
  private readonly second: TeamSide;
  private readonly completed: Innings[] = [];

  private current: LiveInnings;
  private index = 0;
  private done = false;
  /** Test only: overs bowled across the match so far (feeds the draw/over budget). */
  private oversUsed = 0;

  constructor(input: LiveMatchInput) {
    this.input = input;
    this.id = input.id;
    this.seed = input.seed;
    this.format = input.format;
    this.conditions = input.conditions;
    this.homeTeamId = input.home.teamId;
    this.awayTeamId = input.away.teamId;
    this.difficulty = input.difficulty ?? 'NORMAL';
    this.rng = makeRng(input.seed);
    this.isTest = input.format === 'TEST';

    // Deterministic toss: winner elects to bat first.
    const homeWonToss = this.rng() < 0.5;
    this.first = homeWonToss ? input.home : input.away;
    this.second = homeWonToss ? input.away : input.home;

    // Test innings are over-capped (min of the per-innings cap and the budget).
    const firstCap = this.isTest ? testCap(Math.min(TEST_INNINGS_CAP, testRemaining(0))) : undefined;
    this.current = this.makeInnings(this.first, this.second, undefined, firstCap);
  }

  private interactiveFor(side: TeamSide): string | undefined {
    if (!this.input.interactiveBatterId || !this.input.userTeamId) return undefined;
    return side.teamId === this.input.userTeamId ? this.input.interactiveBatterId : undefined;
  }

  private makeInnings(bat: TeamSide, field: TeamSide, target?: number, oversCap?: number): LiveInnings {
    return new LiveInnings(
      {
        battingTeamId: bat.teamId,
        bowlingTeamId: field.teamId,
        battingOrder: bat.players,
        bowlingXI: field.players,
        format: this.format,
        conditions: this.conditions,
        difficulty: this.difficulty,
        target,
        oversCap,
        interactiveBatterId: this.interactiveFor(bat),
        interactiveBowlerId: this.interactiveFor(field),
        battingBias: bat.teamId === this.input.userTeamId ? this.input.tactics?.battingBias : undefined,
        defaultBowlerPlan:
          field.teamId === this.input.userTeamId ? this.input.tactics?.bowlingPlan : undefined,
        fieldSetting: field.teamId === this.input.userTeamId ? this.input.tactics?.field : undefined,
        matchOversOffset: this.isTest ? this.oversUsed : undefined,
        outcomeBalance: this.input.userTeamId
          ? difficultyOutcomeBalance(this.difficulty, bat.teamId === this.input.userTeamId)
          : undefined,
      },
      this.rng,
    );
  }

  /**
   * Decide the next innings after one completes (or return null to end the
   * match). Limited overs = a single chase. Test = A1 → B1 → A2 (declaration) →
   * B2 (chase), mirroring the auto-sim exactly so a watched Test equals an
   * instant-simmed one.
   */
  private planNextInnings(): LiveInnings | null {
    if (!this.isTest) {
      if (this.index === 0) {
        const target = this.completed[0].runs + 1;
        return this.makeInnings(this.second, this.first, target);
      }
      return null;
    }

    const bpo = FORMATS.TEST.ballsPerOver;
    this.oversUsed = this.completed.reduce((s, inn) => s + inn.balls / bpo, 0);
    const rem = testRemaining(this.oversUsed);

    if (this.index === 0) {
      // B1: second side's first innings.
      return this.makeInnings(this.second, this.first, undefined, testCap(Math.min(TEST_INNINGS_CAP, rem)));
    }
    if (this.index === 1) {
      // A2: first side bats again, declaring per the lead.
      const leadBefore = this.completed[0].runs - this.completed[1].runs;
      return this.makeInnings(this.first, this.second, undefined, testCap(declarationCap(leadBefore, rem)));
    }
    if (this.index === 2) {
      // B2: chase the target.
      const target = this.completed[0].runs + this.completed[2].runs - this.completed[1].runs + 1;
      return this.makeInnings(this.second, this.first, target > 0 ? target : undefined, testCap(Math.min(TEST_INNINGS_CAP, rem)));
    }
    return null;
  }

  get matchDone(): boolean {
    return this.done;
  }

  get inningsIndex(): number {
    return this.index;
  }

  /** Side currently batting (for headers). */
  get battingTeamId(): string {
    return this.current.battingTeamId;
  }

  get bowlingTeamId(): string {
    return this.current.bowlingTeamId;
  }

  needsIntent(): boolean {
    return !this.done && this.current.needsIntent();
  }

  needsBowlingPlan(): boolean {
    return !this.done && this.current.needsBowlingPlan();
  }

  setBowlingPlan(plan: BowlerPlan): void {
    this.current.setBowlingPlan(plan);
  }

  /**
   * Reverse the most recent delivery in the current innings (DRS overturn).
   * Only valid for a wicket that did not end the innings/match. Returns whether
   * the reversal was applied.
   */
  overturnLastWicket(): boolean {
    if (this.done) return false;
    return this.current.overturnLastWicket();
  }

  /** Which side the user is on in the current innings (for the in-match UI). */
  get userRole(): 'BATTING' | 'BOWLING' | 'NONE' {
    if (!this.input.userTeamId) return 'NONE';
    if (this.current.battingTeamId === this.input.userTeamId) return 'BATTING';
    if (this.current.bowlingTeamId === this.input.userTeamId) return 'BOWLING';
    return 'NONE';
  }

  /**
   * Mid-match tactical intervention (manager/career). Applies to the current
   * innings for the side the user controls, and persists for later innings.
   */
  setTactics(t: { battingBias?: number; bowlerPlan?: BowlerPlan; field?: FieldSetting }): void {
    if (this.done) return;
    const userBatting = this.current.battingTeamId === this.input.userTeamId;
    const userBowling = this.current.bowlingTeamId === this.input.userTeamId;
    this.current.updateTactics({
      battingBias: userBatting ? t.battingBias : undefined,
      bowlerPlan: userBowling ? t.bowlerPlan : undefined,
      field: userBowling ? t.field : undefined,
    });
    if (!this.input.tactics) this.input.tactics = { battingBias: 0, bowlingPlan: 'CONTAIN' };
    if (t.battingBias !== undefined) this.input.tactics.battingBias = t.battingBias;
    if (t.bowlerPlan !== undefined) this.input.tactics.bowlingPlan = t.bowlerPlan;
    if (t.field !== undefined) this.input.tactics.field = t.field;
  }

  peek(): ReturnType<LiveInnings['peek']> {
    return this.current.peek();
  }

  get scoreState() {
    return this.current.scoreState;
  }

  nextBall(intent?: Parameters<LiveInnings['nextBall']>[0]): MatchBallStep {
    if (this.done) throw new Error('Match already complete');
    const step = this.current.nextBall(intent);
    let inningsBreak = false;

    if (step.inningsComplete) {
      this.completed.push(this.current.finalize());
      const next = this.planNextInnings();
      if (next) {
        this.current = next;
        this.index += 1;
        inningsBreak = true;
      } else {
        this.done = true;
      }
    }

    return {
      ...step,
      inningsIndex: this.index,
      inningsBreak,
      matchComplete: this.done,
    };
  }

  /** Build the final MatchState from the innings actually played live. */
  finalizeMatch(): MatchState {
    let result;
    if (this.isTest) {
      result = decideTest(this.first, this.second, this.completed);
    } else {
      const [inn1, inn2] = this.completed;
      result = decideLimited(this.first, this.second, inn1, inn2);
      result.playerOfMatchId = pickPlayerOfMatch(this.completed, result.winnerTeamId);
    }
    return {
      id: this.id,
      seed: this.seed,
      format: this.format,
      conditions: this.conditions,
      homeTeamId: this.homeTeamId,
      awayTeamId: this.awayTeamId,
      innings: this.completed,
      result,
    };
  }
}
