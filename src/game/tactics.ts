import { Innings, MatchDecisionImpact, MatchState, Tactics } from '../domain/types';

function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function runRate(innings: Innings): string {
  if (innings.balls <= 0) return '0.0';
  return ((innings.runs * 6) / innings.balls).toFixed(1);
}

function boundaryCount(innings: Innings): number {
  return innings.batting.reduce((sum, batter) => sum + batter.fours + batter.sixes, 0);
}

function dotCount(innings: Innings): number {
  return innings.events.filter((event) => event.outcome === 'DOT').length;
}

function bowlingWickets(innings: Innings): number {
  return innings.bowling.reduce((sum, bowler) => sum + bowler.wickets, 0);
}

export function tacticIntentSummary(tactics: Tactics): string {
  const batting =
    tactics.batting === 'AGGRESSIVE'
      ? 'Aggressive batting chased boundaries but carried extra wicket risk.'
      : tactics.batting === 'DEFENSIVE'
        ? 'Defensive batting protected wickets but reduced boundary pressure.'
        : 'Balanced batting kept risk and scoring intent neutral.';
  const bowling =
    tactics.bowling === 'ATTACK'
      ? 'Attack bowling created more wicket chances while leaking more release shots.'
      : tactics.bowling === 'VARY'
        ? 'Variation bowling mixed pace and lengths to unsettle set batters.'
        : 'Contain bowling pushed dots and protected the boundary.';
  const field =
    tactics.field === 'CATCHING' || tactics.field === 'ATTACKING'
      ? 'The field stayed attacking, trading boundary protection for catching chances.'
      : tactics.field === 'DEFENSIVE' || tactics.field === 'SWEEPER'
        ? 'The field protected the rope and made boundaries harder.'
        : 'The field shape stayed balanced.';
  return `${batting} ${bowling} ${field}`;
}

export function tacticalImpactSummary(
  tactics: Tactics,
  match?: Pick<MatchState, 'innings'>,
  userTeamId?: string,
): string {
  if (!match || !userTeamId) return tacticIntentSummary(tactics);

  const battingInnings = match.innings.filter((innings) => innings.battingTeamId === userTeamId);
  const bowlingInnings = match.innings.filter((innings) => innings.bowlingTeamId === userTeamId);
  const lines: string[] = [];

  if (battingInnings.length > 0) {
    const runs = battingInnings.reduce((sum, innings) => sum + innings.runs, 0);
    const balls = battingInnings.reduce((sum, innings) => sum + innings.balls, 0);
    const wickets = battingInnings.reduce((sum, innings) => sum + innings.wickets, 0);
    const boundaries = battingInnings.reduce((sum, innings) => sum + boundaryCount(innings), 0);
    const battingTone =
      tactics.batting === 'AGGRESSIVE'
        ? 'Aggressive'
        : tactics.batting === 'DEFENSIVE'
          ? 'Defensive'
          : 'Balanced';

    lines.push(
      `${battingTone} batting produced ${runs}/${wickets} in ${oversText(balls)} overs at ${(
        (runs * 6) /
        Math.max(1, balls)
      ).toFixed(1)} RPO with ${boundaries} boundaries.`,
    );
  }

  if (bowlingInnings.length > 0) {
    const runs = bowlingInnings.reduce((sum, innings) => sum + innings.runs, 0);
    const balls = bowlingInnings.reduce((sum, innings) => sum + innings.balls, 0);
    const wickets = bowlingInnings.reduce((sum, innings) => sum + bowlingWickets(innings), 0);
    const dots = bowlingInnings.reduce((sum, innings) => sum + dotCount(innings), 0);
    const bowlingTone =
      tactics.bowling === 'ATTACK'
        ? 'Attack'
        : tactics.bowling === 'VARY'
          ? 'Variation'
          : 'Contain';

    lines.push(
      `${bowlingTone} bowling conceded ${runs} at ${runRate({
        ...bowlingInnings[0],
        runs,
        balls,
      })} RPO, taking ${wickets} wickets and forcing ${dots} dots.`,
    );
  }

  return lines.length > 0 ? lines.join(' ') : tacticIntentSummary(tactics);
}

/** Structured, evidence-labelled attribution for the post-match review. */
export function tacticalDecisionImpacts(
  tactics: Tactics,
  match: Pick<MatchState, 'innings'>,
  userTeamId: string,
): MatchDecisionImpact[] {
  const impacts: MatchDecisionImpact[] = [];
  const batting = match.innings.filter((innings) => innings.battingTeamId === userTeamId);
  const bowling = match.innings.filter((innings) => innings.bowlingTeamId === userTeamId);

  if (batting.length) {
    const runs = batting.reduce((sum, innings) => sum + innings.runs, 0);
    const wickets = batting.reduce((sum, innings) => sum + innings.wickets, 0);
    const boundaries = batting.reduce((sum, innings) => sum + boundaryCount(innings), 0);
    if (tactics.batting === 'AGGRESSIVE') {
      const estimatedLift = Math.max(1, Math.round(runs - runs / 1.09));
      impacts.push({
        id: 'batting-aggressive',
        decision: 'Aggressive batting',
        outcome: `Estimated +${estimatedLift} runs; ${wickets} wickets fell while the aggressive plan was active.`,
        evidence: `${runs} runs and ${boundaries} boundaries were observed. The run lift is a model estimate, not a counterfactual replay.`,
        confidence: 'ESTIMATED',
        tone: wickets >= 7 ? 'MIXED' : 'POSITIVE',
      });
    } else if (tactics.batting === 'DEFENSIVE') {
      impacts.push({
        id: 'batting-defensive',
        decision: 'Defensive batting',
        outcome: `${10 - Math.min(10, wickets)} wickets remained, with scoring held to ${runs}.`,
        evidence: 'Wickets and runs are observed; the share caused by the plan cannot be isolated without a replay.',
        confidence: 'OBSERVED',
        tone: wickets <= 5 ? 'POSITIVE' : 'MIXED',
      });
    }
  }

  if (bowling.length) {
    const runs = bowling.reduce((sum, innings) => sum + innings.runs, 0);
    const wickets = bowling.reduce((sum, innings) => sum + bowlingWickets(innings), 0);
    const dots = bowling.reduce((sum, innings) => sum + dotCount(innings), 0);
    impacts.push({
      id: `bowling-${tactics.bowling.toLowerCase()}`,
      decision: `${tactics.bowling === 'ATTACK' ? 'Attacking' : tactics.bowling === 'VARY' ? 'Variation' : 'Contain'} bowling plan`,
      outcome: `${wickets} wickets, ${dots} dot balls and ${runs} runs conceded.`,
      evidence: 'These are observed outcomes during the selected bowling plan.',
      confidence: 'OBSERVED',
      tone: wickets >= 6 || dots >= 40 ? 'POSITIVE' : runs > 190 ? 'NEGATIVE' : 'MIXED',
    });
  }

  return impacts;
}

/** One-line description of what changed when the manager switches tactics. */
export function tacticChangeImpact(before: Tactics, after: Tactics): string | null {
  const parts: string[] = [];

  if (before.batting !== after.batting) {
    const label =
      after.batting === 'AGGRESSIVE'
        ? 'Aggressive — more boundaries, more risk'
        : after.batting === 'DEFENSIVE'
          ? 'Defensive — protect wickets, fewer boundaries'
          : 'Balanced — neutral risk and reward';
    parts.push(`Batting → ${label}`);
  }

  if (before.bowling !== after.bowling) {
    const label =
      after.bowling === 'ATTACK'
        ? 'Attack — wicket-hunting, may leak runs'
        : after.bowling === 'VARY'
          ? 'Variation — unsettle batters with pace changes'
          : 'Contain — dot-ball pressure, boundary protection';
    parts.push(`Bowling → ${label}`);
  }

  if (before.field !== after.field) {
    const label =
      after.field === 'CATCHING' || after.field === 'ATTACKING'
        ? 'Attacking — slips in, catching chances up'
        : after.field === 'DEFENSIVE' || after.field === 'SWEEPER'
          ? 'Defensive — boundary saved, fewer catching slips'
          : 'Balanced — standard field positions';
    parts.push(`Field → ${label}`);
  }

  return parts.length > 0 ? parts.join('. ') : null;
}
