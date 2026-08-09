import { FORMATS } from '../data/gameConfig';
import {
  Conditions,
  Difficulty,
  Format,
  Innings,
  MatchResult,
  MatchState,
  Player,
} from '../domain/types';
import { BowlerPlan, FieldSetting } from './intent';
import { planRain } from './rain';
import { simulateInnings } from './simulateInnings';
import { makeRng, Rng } from './rng';
import { resolveToss, TossCall, TossChoice } from './toss';

export interface TeamTactics {
  battingBias: number;
  bowlerPlan: BowlerPlan;
  field?: FieldSetting;
}

export interface TeamSide {
  teamId: string;
  players: Player[]; // XI in batting order
  tactics?: TeamTactics; // optional; when absent the AI plays a neutral game
}

export interface MatchInput {
  id: string;
  seed: number;
  format: Format;
  conditions: Conditions;
  home: TeamSide;
  away: TeamSide;
  difficulty?: Difficulty;
  /** Allow rain (DLS) to shorten the chase — opt-in for the season auto-sim. */
  rain?: boolean;
  /** Career protagonist used for role-fair all-rounder bowling allocation. */
  focusPlayerId?: string;
  userTeamId?: string;
  tossCall?: TossCall;
  tossChoice?: TossChoice;
}

export function pickPlayerOfMatch(innings: Innings[], winnerTeamId?: string): string | undefined {
  const score: Record<string, number> = {};
  const teamOf: Record<string, string> = {};
  const add = (playerId: string | undefined, teamId: string | undefined, points: number) => {
    if (!playerId || !Number.isFinite(points)) return;
    if (teamId) teamOf[playerId] = teamId;
    score[playerId] = (score[playerId] ?? 0) + points;
  };

  for (const inn of innings) {
    for (const b of inn.batting) {
      if (b.balls === 0 && !b.out) continue;
      const strikeRate = b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
      const tempoBonus = b.balls >= 10 ? Math.max(-8, Math.min(16, (strikeRate - 90) / 8)) : 0;
      const notOutBonus = !b.out && b.runs >= 35 ? 8 : 0;
      const milestoneBonus =
        b.runs >= 150 ? 50 : b.runs >= 100 ? 32 : b.runs >= 75 ? 18 : b.runs >= 50 ? 10 : 0;
      add(
        b.playerId,
        inn.battingTeamId,
        b.runs + b.fours * 1.5 + b.sixes * 3 + tempoBonus + notOutBonus + milestoneBonus,
      );
    }

    for (const bw of inn.bowling) {
      if (bw.balls === 0) continue;
      const overs = bw.balls / FORMATS.T20.ballsPerOver;
      const economy = overs > 0 ? bw.runs / overs : bw.runs;
      const wicketHaulBonus = bw.wickets >= 5 ? 32 : bw.wickets >= 4 ? 18 : bw.wickets >= 3 ? 8 : 0;
      const economyBonus = Math.max(-18, Math.min(18, (7.2 - economy) * 3));
      add(
        bw.playerId,
        inn.bowlingTeamId,
        Math.max(
          0,
          bw.wickets * 30 + bw.maidens * 6 + wicketHaulBonus + economyBonus - bw.runs * 0.12,
        ),
      );
    }

    for (const ev of inn.events) {
      if (!ev.isWicket || !ev.dismissal?.fielderId) continue;
      const fieldingPoints =
        ev.dismissal.type === 'STUMPED'
          ? 14
          : ev.dismissal.type === 'RUN_OUT'
            ? 12
            : ev.dismissal.type === 'CAUGHT'
              ? 8
              : 0;
      add(ev.dismissal.fielderId, inn.bowlingTeamId, fieldingPoints);
    }
  }
  let bestId: string | undefined;
  let best = -Infinity;
  for (const id of Object.keys(score)) {
    const v = score[id] + (winnerTeamId && teamOf[id] === winnerTeamId ? 8 : 0);
    if (v > best) {
      best = v;
      bestId = id;
    }
  }
  return bestId;
}

export function decideLimited(
  first: TeamSide,
  second: TeamSide,
  inn1: Innings,
  inn2: Innings,
): MatchResult {
  if (inn2.runs > inn1.runs) {
    const wktsLeft = second.players.length - 1 - inn2.wickets;
    return { winnerTeamId: second.teamId, margin: `${Math.max(1, wktsLeft)} wickets` };
  }
  if (inn2.runs === inn1.runs) return { tie: true, margin: 'Match tied' };
  return { winnerTeamId: first.teamId, margin: `${inn1.runs - inn2.runs} runs` };
}

/** Result for a rain-shortened chase, judged against the DLS-revised target. */
export function decideLimitedDLS(
  first: TeamSide,
  second: TeamSide,
  inn2: Innings,
  target: number,
): MatchResult {
  if (inn2.runs >= target) {
    const wktsLeft = second.players.length - 1 - inn2.wickets;
    return { winnerTeamId: second.teamId, margin: `${Math.max(1, wktsLeft)} wickets (D/L)` };
  }
  if (inn2.runs === target - 1) return { tie: true, margin: 'Match tied (D/L)' };
  return { winnerTeamId: first.teamId, margin: `${target - 1 - inn2.runs} runs (D/L)` };
}

function simulateLimited(
  input: MatchInput,
  first: TeamSide,
  second: TeamSide,
  rng: Rng,
): MatchState {
  const difficulty = input.difficulty ?? 'NORMAL';
  const inn1 = simulateInnings(
    {
      battingTeamId: first.teamId,
      bowlingTeamId: second.teamId,
      battingOrder: first.players,
      bowlingXI: second.players,
      format: input.format,
      conditions: input.conditions,
      difficulty,
      battingBias: first.tactics?.battingBias,
      bowlerPlan: second.tactics?.bowlerPlan,
      fieldSetting: second.tactics?.field,
      preferredAllRounderId: second.players.some((p) => p.id === input.focusPlayerId)
        ? input.focusPlayerId
        : undefined,
    },
    rng,
  );
  // Rain (DLS) can shorten the chase in the season auto-sim (never in the
  // determinism/live tests, which always play under clear skies).
  const fmt = FORMATS[input.format];
  const rain = input.rain
    ? planRain(input.seed, input.conditions.weather, fmt.overs, inn1.runs)
    : null;
  const inn2 = simulateInnings(
    {
      battingTeamId: second.teamId,
      bowlingTeamId: first.teamId,
      battingOrder: second.players,
      bowlingXI: first.players,
      format: input.format,
      conditions: input.conditions,
      difficulty,
      target: rain ? rain.revisedTarget : inn1.runs + 1,
      oversCap: rain ? rain.reducedOvers : undefined,
      battingBias: second.tactics?.battingBias,
      bowlerPlan: first.tactics?.bowlerPlan,
      fieldSetting: first.tactics?.field,
      preferredAllRounderId: first.players.some((p) => p.id === input.focusPlayerId)
        ? input.focusPlayerId
        : undefined,
    },
    rng,
  );
  const result = rain
    ? decideLimitedDLS(first, second, inn2, rain.revisedTarget)
    : decideLimited(first, second, inn1, inn2);
  result.playerOfMatchId = pickPlayerOfMatch([inn1, inn2], result.winnerTeamId);
  return {
    id: input.id,
    seed: input.seed,
    format: input.format,
    conditions: input.conditions,
    homeTeamId: input.home.teamId,
    awayTeamId: input.away.teamId,
    innings: [inn1, inn2],
    result,
  };
}

/** Overs available across the whole Test; when they run out, it's a draw. */
export const TEST_MATCH_OVERS = 320;
export const TEST_INNINGS_CAP = 90;

/** Overs still to be bowled in the match given how many have been used. */
export function testRemaining(oversUsed: number): number {
  return Math.max(0, TEST_MATCH_OVERS - oversUsed);
}

/**
 * Declaration logic for the side batting a second time: with a healthy lead,
 * bat on only long enough to leave time to bowl the opposition out — otherwise
 * a big first-innings lead always draws. Shared by the auto-sim and the live
 * Test so a watched Test matches an instant-simmed one.
 */
export function declarationCap(leadBefore: number, remaining: number): number {
  let cap = Math.min(TEST_INNINGS_CAP, remaining);
  if (leadBefore > 180) cap = Math.min(cap, 30);
  else if (leadBefore > 90) cap = Math.min(cap, 55);
  else if (leadBefore > 0) cap = Math.min(cap, 75);
  return cap;
}

/** Decide a completed 4-innings Test (innings order: A1, B1, A2, B2). */
export function decideTest(first: TeamSide, second: TeamSide, innings: Innings[]): MatchResult {
  const [a1, b1, a2, b2] = innings;
  const lead = a1.runs + a2.runs - b1.runs;
  const target = lead + 1;
  const firstTotal = a1.runs + a2.runs;
  const secondTotal = b1.runs + b2.runs;
  const squad = second.players.length;
  const b2AllOut = b2.wickets >= squad - 1;
  const b2Chased = target > 0 && b2.runs >= target;

  let result: MatchResult;
  if (b2Chased) {
    const wktsLeft = squad - 1 - b2.wickets;
    result = { winnerTeamId: second.teamId, margin: `${Math.max(1, wktsLeft)} wickets` };
  } else if (b2AllOut && firstTotal > secondTotal) {
    const byInnings = b1.runs + b2.runs < firstTotal && b2.wickets >= squad - 1 && lead > b2.runs;
    result = byInnings
      ? { winnerTeamId: first.teamId, margin: `an innings and ${firstTotal - secondTotal} runs` }
      : { winnerTeamId: first.teamId, margin: `${firstTotal - secondTotal} runs` };
  } else if (b2AllOut && secondTotal > firstTotal) {
    result = { winnerTeamId: second.teamId, margin: 'an innings' };
  } else {
    result = { margin: 'Match drawn' };
  }
  result.playerOfMatchId = pickPlayerOfMatch(innings, result.winnerTeamId);
  return result;
}

function simulateTest(input: MatchInput, first: TeamSide, second: TeamSide, rng: Rng): MatchState {
  const difficulty = input.difficulty ?? 'NORMAL';
  let oversUsed = 0;
  const sim = (
    bat: TeamSide,
    field: TeamSide,
    target: number | undefined,
    cap: number,
  ): Innings => {
    const inn = simulateInnings(
      {
        battingTeamId: bat.teamId,
        bowlingTeamId: field.teamId,
        battingOrder: bat.players,
        bowlingXI: field.players,
        format: 'TEST',
        conditions: input.conditions,
        difficulty,
        target,
        oversCap: Math.max(1, Math.floor(cap)),
        battingBias: bat.tactics?.battingBias,
        bowlerPlan: field.tactics?.bowlerPlan,
        fieldSetting: field.tactics?.field,
        matchOversOffset: oversUsed,
        preferredAllRounderId: field.players.some((p) => p.id === input.focusPlayerId)
          ? input.focusPlayerId
          : undefined,
      },
      rng,
    );
    oversUsed += inn.balls / FORMATS.TEST.ballsPerOver;
    return inn;
  };

  const a1 = sim(first, second, undefined, Math.min(TEST_INNINGS_CAP, testRemaining(oversUsed)));
  const b1 = sim(second, first, undefined, Math.min(TEST_INNINGS_CAP, testRemaining(oversUsed)));
  const a2 = sim(
    first,
    second,
    undefined,
    declarationCap(a1.runs - b1.runs, testRemaining(oversUsed)),
  );
  const target = a1.runs + a2.runs - b1.runs + 1;
  const b2 = sim(
    second,
    first,
    target > 0 ? target : undefined,
    Math.min(TEST_INNINGS_CAP, testRemaining(oversUsed)),
  );

  const innings = [a1, b1, a2, b2];
  const result = decideTest(first, second, innings);
  return {
    id: input.id,
    seed: input.seed,
    format: input.format,
    conditions: input.conditions,
    homeTeamId: input.home.teamId,
    awayTeamId: input.away.teamId,
    innings,
    result,
  };
}

/** Deterministic full-match simulation. Same (seed, inputs) => identical MatchState. */
export function simulateMatch(input: MatchInput): MatchState {
  const rng = makeRng(input.seed);
  const fmt = FORMATS[input.format];

  const toss = resolveToss({
    rng,
    format: input.format,
    conditions: input.conditions,
    homeTeamId: input.home.teamId,
    awayTeamId: input.away.teamId,
    userTeamId: input.userTeamId,
    userCall: input.tossCall,
    userChoice: input.tossChoice,
  });
  const first = toss.battingFirstTeamId === input.home.teamId ? input.home : input.away;
  const second = first.teamId === input.home.teamId ? input.away : input.home;

  return fmt.inningsPerSide === 2
    ? simulateTest(input, first, second, rng)
    : simulateLimited(input, first, second, rng);
}
