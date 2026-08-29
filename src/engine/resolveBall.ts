import {
  BALL_WEIGHTS,
  EXTRAS,
  FORMATS,
  PITCH_MODIFIERS,
  WEATHER_MODIFIERS,
} from '../data/gameConfig';
import { BallEvent, BallOutcome, Conditions, Dismissal, Format, Player } from '../domain/types';
import { clamp } from '../utils/math';
import { ballCommentary, collapseLine, lastOverThrillerLine, tailenderLine } from './commentary';
import { selectDelivery } from './deliveries';
import { BowlerPlan, FieldSetting, FIELD_EFFECTS } from './intent';
import { isSpinner } from './rating';
import { chance, Rng, weightedSample } from './rng';
import { selectShot } from './shots';
import { DifficultyOutcomeBalance } from './difficulty';

export interface BallContext {
  format: Format;
  conditions: Conditions;
  over: number; // 0-indexed
  ballInOver: number; // 1-indexed legal-ball number for display
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  bowlerStaminaNow: number; // 0..100
  pressure: number; // 0..1
  aggression: number; // 0..1 from batting AI
  bowlerPlan?: BowlerPlan; // interactive bowling plan (no-op when undefined)
  fieldSetting?: FieldSetting; // bowling side's field (no-op when undefined/BALANCED)
  // ---- Deepening (all optional; each is a no-op when undefined so unit tests
  // that build a bare context are unaffected, and only the innings loops that
  // supply the data activate them) ----
  /** Balls the striker has already faced — drives the "settling"/partnership model. */
  strikerBallsFaced?: number;
  /** Average catching skill (0..1) of the fielding side — drives dropped catches. */
  fieldingQuality?: number;
  /** Average throwing/agility skill (0..1) of the fielding side. */
  fieldingRunOutQuality?: number;
  /** Wicketkeeper quality (0..1) for byes, stumpings and spin pressure. */
  keeperQuality?: number;
  /** True in the chasing innings of a limited-overs game — drives dew. */
  chasing?: boolean;
  /** Overs bowled in the whole match before this innings — drives Test pitch wear. */
  matchOversOffset?: number;
  /** Wickets fallen: ≥ 4 in quick succession triggers collapse commentary. */
  recentWicketCount?: number;
  /** True on the last over of a limited-overs game — triggers thriller commentary. */
  isLastOver?: boolean;
  /** Batting position ≥ 9 — triggers tailender commentary. */
  isTailender?: boolean;
  /** Current partnership runs — used for milestone detection. */
  partnershipRuns?: number;
  /** Difficulty tuning applied only to the user's watched match. */
  outcomeBalance?: DifficultyOutcomeBalance;
  /** Match-only captaincy bonuses, deliberately tiny and pressure-gated. */
  battingLeadershipBonus?: number;
  fieldingLeadershipBonus?: number;
}

export function isLegalDelivery(outcome: BallOutcome): boolean {
  return outcome !== 'WD' && outcome !== 'NB';
}

function outcomeRuns(o: BallOutcome): number {
  switch (o) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '6':
      return 6;
    default:
      return 0;
  }
}

/**
 * Bowler-credited dismissal (the ball beat the bat). Run-outs are modelled
 * separately (a function of running + risk) so they are not the bowler's wicket.
 */
function pickDismissal(ctx: BallContext, rng: Rng): Dismissal {
  const spin = isSpinner(ctx.bowler);
  const keeper = ctx.keeperQuality ?? 0.55;
  const footworkWeakness = clamp(62 - ctx.striker.batting.footwork, 0, 45);
  const weights = {
    BOWLED: 23,
    CAUGHT: 48,
    LBW: 18,
    STUMPED: spin ? 2 + keeper * 7 + footworkWeakness * 0.07 : 0,
    HIT_WICKET: 2,
  };
  const type = weightedSample(weights, rng) as Dismissal['type'];
  return { type, bowlerId: ctx.bowler.id };
}

/** Average running skill of the two batters at the crease (0..1). */
function runningSkill(striker: Player, nonStriker: Player): number {
  const score = (p: Player): number =>
    0.58 * p.batting.running + 0.24 * p.fielding.agility + 0.18 * p.meta.fitness;
  return clamp((score(striker) + score(nonStriker)) / 200, 0, 1);
}

/** Average catching skill (0..1) of a fielding side — feeds the dropped-catch model. */
export function fieldingQualityOf(players: Player[]): number {
  if (!players.length) return 0.6;
  const sum = players.reduce(
    (s, p) =>
      s + 0.72 * p.fielding.catching + 0.18 * p.fielding.agility + 0.1 * p.fielding.throwing,
    0,
  );
  return clamp(sum / players.length / 100, 0, 1);
}

export function runOutFieldingQualityOf(players: Player[]): number {
  if (!players.length) return 0.55;
  const sum = players.reduce(
    (s, p) => s + 0.62 * p.fielding.throwing + 0.38 * p.fielding.agility,
    0,
  );
  return clamp(sum / players.length / 100, 0, 1);
}

export function keeperQualityOf(players: Player[]): number {
  if (!players.length) return 0.55;
  const keeper =
    players.find((p) => p.role === 'WK_BATTER') ??
    [...players].sort((a, b) => b.fielding.keeping - a.fielding.keeping)[0];
  const quality =
    0.72 * keeper.fielding.keeping +
    0.18 * keeper.fielding.agility +
    0.1 * keeper.fielding.catching;
  return clamp(quality / 100, 0, 1);
}

/**
 * Chance a run attempt ends in a run-out, as a function of how many runs are
 * being attempted, the batters' running, and match pressure. Deliberately low
 * so it adds realistic drama (~0.4–0.9 run-outs/innings) without skewing totals.
 */
function runOutChance(
  attemptedRuns: number,
  running: number,
  pressure: number,
  fielding = 0.55,
): number {
  const attemptFactor = attemptedRuns >= 3 ? 2.1 : attemptedRuns === 2 ? 1.5 : 1;
  const fieldingFactor = 0.72 + clamp(fielding, 0, 1) * 0.72;
  const raw = 0.011 * attemptFactor * (1.15 - running) * (1 + pressure * 0.8) * fieldingFactor;
  return clamp(raw, 0, 0.06);
}

/**
 * Resolve a single delivery attempt (PART 3.3). May return an extra (WD/NB),
 * which the innings loop re-bowls. All randomness is from the injected rng.
 */
export function resolveBall(ctx: BallContext, rng: Rng): BallEvent {
  const { striker, nonStriker, bowler } = ctx;
  const base = {
    over: ctx.over,
    ballInOver: ctx.ballInOver,
    strikerId: striker.id,
    nonStrikerId: nonStriker.id,
    bowlerId: bowler.id,
  };

  if (chance(EXTRAS.wideRate, rng)) {
    return {
      ...base,
      outcome: 'WD',
      runs: 1,
      isWicket: false,
      commentary: ballCommentary({ outcome: 'WD', rng }),
    };
  }
  if (chance(EXTRAS.noBallRate, rng)) {
    return {
      ...base,
      outcome: 'NB',
      runs: 1,
      isWicket: false,
      commentary: ballCommentary({ outcome: 'NB', rng }),
    };
  }

  const fmt = FORMATS[ctx.format];
  const inPowerplay = ctx.over < fmt.powerplayOvers;
  const limitedOvers = fmt.overs < 200;
  const inDeath = limitedOvers && ctx.over >= fmt.overs * 0.8;

  // The bowler picks a delivery (stock ball or a variation). Its gentle,
  // roughly mean-neutral multipliers add real matchup texture to the weights.
  const delivery = selectDelivery(
    {
      bowler,
      inPowerplay,
      inDeath,
      attacking: ctx.bowlerPlan === 'ATTACK',
      containing: ctx.bowlerPlan === 'CONTAIN',
      varying: ctx.bowlerPlan === 'VARY',
    },
    rng,
  );

  const formFactor = 0.9 + 0.2 * (striker.meta.form / 100);
  const attack =
    (0.4 * striker.batting.power + 0.4 * striker.batting.timing + 0.2 * striker.meta.aggression) *
    formFactor;
  const control =
    0.5 * bowler.bowling.accuracy +
    0.3 * (0.6 * bowler.bowling.paceOrSpin + 0.4 * bowler.bowling.movement) +
    0.2 * ctx.bowlerStaminaNow;
  const edge = clamp((attack - control) / 100, -1, 1);

  const w: Record<string, number> = { ...BALL_WEIGHTS[ctx.format] };

  // Batter dominance (edge)
  w['4'] *= 1 + edge * 0.8;
  w['6'] *= 1 + edge * 1.0;
  w.DOT *= 1 - edge * 0.5;
  w.W *= 1 + Math.max(0, -edge) * 0.6 + ctx.pressure * 0.5;
  w.W *= 1 - Math.max(0, edge) * 0.48;

  // AI target aggression (risk/reward)
  const agg = ctx.aggression - 0.5;
  const shotControl = clamp(
    (0.42 * striker.batting.technique +
      0.34 * striker.batting.timing +
      0.24 * striker.batting.temperament) /
      100,
    0,
    1,
  );
  w['4'] *= 1 + agg * 0.5;
  w['6'] *= 1 + agg * 0.75;
  w.DOT *= 1 - agg * 0.4;
  w.W *= 1 + Math.max(0, agg) * 0.5 * (1 - shotControl * 0.62);

  // Mental/physical attributes matter under pressure: high temperament,
  // confidence and discipline protect the batter from panic shots, while low
  // composure makes dots and wickets more likely in tense passages.
  const composure =
    (0.45 * striker.batting.temperament +
      0.25 * striker.meta.confidence +
      0.3 * striker.meta.discipline) /
    100;
  const pressureTilt = (0.55 - composure) * ctx.pressure;
  w.W *= 1 + pressureTilt * 0.5;
  w.DOT *= 1 + pressureTilt * 0.35;
  w['1'] *= 1 - pressureTilt * 0.18;

  // Captaincy never rewrites attributes or OVR. Its small effect appears only
  // in demanding passages and is identical in watched and simulated matches.
  const battingLeadership = clamp(ctx.battingLeadershipBonus ?? 0, 0, 0.0175) * ctx.pressure;
  const fieldingLeadership = clamp(ctx.fieldingLeadershipBonus ?? 0, 0, 0.0175) * ctx.pressure;
  w.W *= (1 - battingLeadership) * (1 + fieldingLeadership);
  const leadershipScoring = (1 + battingLeadership * 0.5) * (1 - fieldingLeadership * 0.5);
  w['1'] *= leadershipScoring;
  w['2'] *= leadershipScoring;
  w['3'] *= leadershipScoring;
  w['4'] *= leadershipScoring;
  w['6'] *= leadershipScoring;

  // Conditions
  const pm = PITCH_MODIFIERS[ctx.conditions.pitch];
  const wm = WEATHER_MODIFIERS[ctx.conditions.weather];
  w['4'] *= pm.boundary * wm.boundary;
  w['6'] *= pm.boundary * wm.boundary;
  w.DOT *= pm.dot * wm.dot;
  w.W *= pm.wicket * wm.wicket;

  // Matchup: weak footwork punished by spin, weak technique by pace
  if (isSpinner(bowler)) {
    w.W *= 1 + (60 - clamp(striker.batting.footwork, 0, 100)) / 300;
    const keeper = ctx.keeperQuality ?? 0.55;
    const stumpingThreat =
      (keeper - 0.55) * 0.1 + clamp(58 - striker.batting.footwork, 0, 40) / 500;
    w.W *= 1 + clamp(stumpingThreat, -0.04, 0.12);
  } else {
    w.W *= 1 + (60 - clamp(striker.batting.technique, 0, 100)) / 300;
  }

  // Phase / ball age
  if (inPowerplay) {
    w.W *= 1.12;
    w.DOT *= 1.05;
  }
  if (inDeath) {
    w['4'] *= 1.15;
    w['6'] *= 1.22;
    w.W *= 1.12;
    w.DOT *= 0.9;
  }

  // Traits
  if (striker.traits.includes('FRAGILE')) w.W *= 1.15;
  if (striker.traits.includes('BIG_HITTER')) w['6'] *= 1.2;
  if (striker.traits.includes('DEATH_SPECIALIST') && inDeath) {
    w['4'] *= 1.15;
    w['6'] *= 1.2;
  }
  if (bowler.traits.includes('WICKET_TAKER')) w.W *= 1.12;

  // Interactive bowling plan (only applied when the user is bowling this over).
  if (ctx.bowlerPlan === 'ATTACK') {
    w.W *= 1.2;
    w['4'] *= 1.08;
    w['6'] *= 1.08;
    w.DOT *= 0.95;
  } else if (ctx.bowlerPlan === 'CONTAIN') {
    w.DOT *= 1.14;
    w['4'] *= 0.82;
    w['6'] *= 0.78;
    w.W *= 0.95;
  } else if (ctx.bowlerPlan === 'VARY') {
    w.W *= 1.12;
    w.DOT *= 1.05;
    w['4'] *= 0.95;
  }

  // Field setting (bowling side). Off by default — BALANCED is a no-op so the
  // verified AI-vs-AI balance is preserved. Five presets from all-out attack
  // (catchers everywhere) to a boundary ring (sweepers out).
  if (ctx.fieldSetting) {
    const fe = FIELD_EFFECTS[ctx.fieldSetting];
    w['4'] *= fe.four;
    w['6'] *= fe.six;
    w.DOT *= fe.dot;
    w.W *= fe.wicket;
    w['1'] *= fe.one;
  }

  if (ctx.outcomeBalance) {
    w.W *= ctx.outcomeBalance.wicket;
    w['1'] *= ctx.outcomeBalance.scoring;
    w['2'] *= ctx.outcomeBalance.scoring;
    w['3'] *= ctx.outcomeBalance.scoring;
    w['4'] *= ctx.outcomeBalance.scoring;
    w['6'] *= ctx.outcomeBalance.scoring;
    w.DOT *= 2 - ctx.outcomeBalance.scoring;
  }

  // Delivery effect (applied last so it colours the fully-modified weights).
  const de = delivery.effect;
  w['4'] *= de.four;
  w['6'] *= de.six;
  w.DOT *= de.dot;
  w.W *= de.wicket;
  if (de.one) w['1'] *= de.one;

  // Batter settling / partnerships: a fresh batter is watchful and vulnerable;
  // a well-set batter dominates. Centred so the *average* over an innings is
  // roughly mean-neutral (fewer boundaries early, more once set).
  if (ctx.strikerBallsFaced != null) {
    const settle = clamp(ctx.strikerBallsFaced / 22, 0, 1); // 0 = fresh .. 1 = set (>=22 balls)
    const freshRisk = 0.44 * (1 - settle) * (1 - shotControl * 0.48);
    w.W *= 0.9 + freshRisk;
    w['4'] *= 0.9 + 0.16 * settle; // fresh 0.90× → set 1.06×
    w['6'] *= 0.84 + 0.22 * settle;
    w.DOT *= 1 + 0.06 * (1 - settle);
  }

  // Ball age: reverse swing (pace, old ball) and Test pitch deterioration.
  const matchOversNow = (ctx.matchOversOffset ?? 0) + ctx.over;
  if (limitedOvers) {
    if (!isSpinner(bowler) && ctx.over >= fmt.overs * 0.66) {
      w.W *= 1.08; // reverse swing in the back third
      w.DOT *= 1.03;
      w['4'] *= 0.97;
    }
  } else {
    // A Test pitch wears over ~4 days: spin bites, batting hardens, edges carry.
    const wear = clamp(matchOversNow / 240, 0, 1);
    w.W *= 1 + wear * (isSpinner(bowler) ? 0.5 : 0.22);
    w.DOT *= 1 + wear * 0.06;
    w['4'] *= 1 - wear * 0.05;
  }

  // Dew (limited-overs chase): the ball skids on, harder to grip → the chase
  // gets marginally easier. Off in the first innings and in Tests.
  if (limitedOvers && ctx.chasing) {
    w.W *= 0.95;
    w.DOT *= 0.96;
    w['4'] *= 1.03;
    w['1'] *= 1.02;
  }

  // Conditions, tactics, fresh-batter risk, traits and difficulty all matter,
  // but their multiplicative stack must not make sub-70 collapses routine for
  // evenly matched limited-overs teams. This caps wicket probability rather
  // than enforcing a score floor, so rare collapses remain possible.
  if (limitedOvers) {
    const baseWicketWeight = BALL_WEIGHTS[ctx.format].W;
    const maxWicketMultiplier = ctx.format === 'ODI' ? 1.6 : 1.75;
    w.W = Math.min(w.W, baseWicketWeight * maxWicketMultiplier);
  }

  for (const k of Object.keys(w)) if (w[k] < 0) w[k] = 0;

  let outcome = weightedSample(w, rng) as BallOutcome;
  const style = striker.battingStyle;

  if (outcome === 'W') {
    const dismissal = pickDismissal(ctx, rng);
    // Fielding matters: a catchable chance can go down. The drop rate is a
    // function of the fielding side's catching skill (better sides drop less).
    if (dismissal.type === 'CAUGHT' && ctx.fieldingQuality != null) {
      const dropChance = clamp(0.22 * (1 - ctx.fieldingQuality), 0, 0.22);
      if (chance(dropChance, rng)) {
        // A let-off — the miss yields runs off the bat instead of a wicket.
        outcome = weightedSample({ DOT: 3, '1': 4, '2': 1.2, '4': 1.4 }, rng) as BallOutcome;
        const dropRuns = outcomeRuns(outcome);
        const { shot, angleDeg } = selectShot(
          outcome,
          false,
          ctx.aggression,
          delivery.type,
          style,
          rng,
        );
        return {
          ...base,
          outcome,
          runs: dropRuns,
          isWicket: false,
          delivery: delivery.type,
          shot,
          shotAngleDeg: angleDeg,
          commentary: `Dropped! ${ballCommentary({ outcome, rng, delivery, shot })}`,
        };
      }
    }
    const { shot, angleDeg } = selectShot('W', true, ctx.aggression, delivery.type, style, rng);
    return {
      ...base,
      outcome: 'W',
      runs: 0,
      isWicket: true,
      dismissal,
      delivery: delivery.type,
      shot,
      shotAngleDeg: angleDeg,
      commentary: ballCommentary({ outcome: 'W', rng, dismissal, delivery, shot }),
    };
  }

  // Occasional byes / leg-byes off a beaten delivery.
  let finalOutcome = outcome;
  let runs = outcomeRuns(outcome);
  if (outcome === 'DOT') {
    const keeper = ctx.keeperQuality ?? 0.55;
    const byeRate = EXTRAS.byeRate * clamp(1.35 - keeper, 0.45, 1.35);
    const extrasRate = EXTRAS.legByeRate + byeRate;
    if (chance(extrasRate, rng)) {
      const byeShare = byeRate / extrasRate;
      finalOutcome = chance(byeShare, rng) ? 'BYE' : 'LB';
      runs = 1;
    }
  }

  // Run-out on a running attempt — a function of running skill + risk, not the
  // bowler's wicket. The completed runs still count; the striker is dismissed.
  if (finalOutcome === '1' || finalOutcome === '2' || finalOutcome === '3') {
    const p = runOutChance(
      runs,
      runningSkill(striker, nonStriker),
      ctx.pressure,
      ctx.fieldingRunOutQuality,
    );
    if (chance(p, rng)) {
      const completed = Math.max(0, runs - 1);
      const desc = (completed > 0 ? String(completed) : 'DOT') as BallOutcome;
      const { shot, angleDeg } = selectShot(desc, false, ctx.aggression, delivery.type, style, rng);
      const dismissal: Dismissal = { type: 'RUN_OUT' };
      return {
        ...base,
        outcome: 'W',
        runs: completed,
        isWicket: true,
        dismissal,
        delivery: delivery.type,
        shot,
        shotAngleDeg: angleDeg,
        commentary: ballCommentary({ outcome: 'W', rng, dismissal, delivery, shot, runOut: true }),
      };
    }
  }

  const { shot, angleDeg } = selectShot(
    finalOutcome,
    false,
    ctx.aggression,
    delivery.type,
    style,
    rng,
  );

  // ── Contextual commentary enrichment ──────────────────────────────────────
  // For non-wicket balls, occasionally inject a situation line from the new pools
  // (10% chance each, only when the relevant context flag is set)
  let enrichedCommentary = ballCommentary({ outcome: finalOutcome, rng, delivery, shot });
  const hasEnrichment = ctx.recentWicketCount || ctx.isLastOver || ctx.isTailender;
  if (hasEnrichment && chance(0.12, rng)) {
    if (ctx.recentWicketCount && ctx.recentWicketCount >= 3) {
      enrichedCommentary = collapseLine(rng);
    } else if (ctx.isLastOver) {
      enrichedCommentary = lastOverThrillerLine(rng);
    } else if (ctx.isTailender) {
      enrichedCommentary = tailenderLine(rng);
    }
  }

  return {
    ...base,
    outcome: finalOutcome,
    runs,
    isWicket: false,
    delivery: delivery.type,
    shot,
    shotAngleDeg: angleDeg,
    commentary: enrichedCommentary,
  };
}
