import {
  CareerArchetype,
  CareerExperienceState,
  ClubCulture,
  CoachPersonality,
  Conditions,
  ManagerPhilosophy,
  MatchImpactSummary,
  MatchState,
  Player,
  SaveGame,
} from '../domain/types';
import { tacticalDecisionImpacts } from './tactics';

const ARCHETYPE_LABELS: Record<CareerArchetype, string> = {
  PRODIGY: 'Prodigy',
  LATE_BLOOMER: 'Late Bloomer',
  SPECIALIST: 'Specialist',
  COMEBACK: 'Comeback Story',
};

const COACH_LABELS: Record<CoachPersonality, string> = {
  DEVELOPER: 'Development Coach',
  TACTICIAN: 'Tactical Coach',
  DISCIPLINARIAN: 'Demanding Coach',
  MENTOR: 'Player-first Mentor',
};

const CULTURE_LABELS: Record<ClubCulture, string> = {
  ACADEMY: 'Academy Pathway',
  ANALYTICAL: 'Data-led Club',
  FEARLESS: 'Fearless Cricket',
  TRADITIONAL: 'Proud Tradition',
};

const PHILOSOPHY_LABELS: Record<ManagerPhilosophy, string> = {
  DEVELOPER: 'Squad Developer',
  TACTICIAN: 'Matchday Tactician',
  MOTIVATOR: 'Dressing-room Motivator',
  PRAGMATIST: 'Results Pragmatist',
};

function hash(value: string): number {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

export function defaultCareerArchetype(player?: Player): CareerArchetype {
  if (!player) return 'SPECIALIST';
  if (player.age <= 16) return 'PRODIGY';
  if (player.age >= 21) return 'LATE_BLOOMER';
  if (player.meta.form < 45 || player.meta.fitness < 55) return 'COMEBACK';
  return 'SPECIALIST';
}

export function ensureCareerExperience(save: SaveGame): CareerExperienceState {
  const seed = hash(`${save.id}:${save.userTeamId ?? ''}`);
  const experience = save.experience ?? {};
  if (save.mode === 'career') {
    const player = save.userPlayerId ? save.players?.[save.userPlayerId] : undefined;
    experience.playerArchetype ??= defaultCareerArchetype(player);
    experience.coachPersonality ??= pick(
      ['DEVELOPER', 'TACTICIAN', 'DISCIPLINARIAN', 'MENTOR'] as const,
      seed,
    );
  } else {
    experience.clubCulture ??= pick(
      ['ACADEMY', 'ANALYTICAL', 'FEARLESS', 'TRADITIONAL'] as const,
      seed,
    );
    experience.managerPhilosophy ??= pick(
      ['DEVELOPER', 'TACTICIAN', 'MOTIVATOR', 'PRAGMATIST'] as const,
      seed >>> 3,
    );
  }
  save.experience = experience;
  return experience;
}

export function playerIdentityLine(save: SaveGame): string {
  const experience = ensureCareerExperience(save);
  const archetype = ARCHETYPE_LABELS[experience.playerArchetype ?? 'SPECIALIST'];
  const coach = COACH_LABELS[experience.coachPersonality ?? 'DEVELOPER'];
  return `${archetype} | ${coach}`;
}

export function managerIdentityLine(save: SaveGame): string {
  const experience = ensureCareerExperience(save);
  const culture = CULTURE_LABELS[experience.clubCulture ?? 'TRADITIONAL'];
  const philosophy = PHILOSOPHY_LABELS[experience.managerPhilosophy ?? 'PRAGMATIST'];
  return `${culture} | ${philosophy}`;
}

export interface ExperienceSnapshot {
  coins: number;
  energy: number;
  form?: number;
  confidence?: number;
  nationalRep?: number;
  pathMatches?: number;
  boardConfidence?: number;
  teamMorale?: number;
}

export function squadMorale(save: SaveGame): number | undefined {
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  if (!team) return undefined;
  const values = team.playerIds
    .map((id) => save.players[id]?.morale)
    .filter((value): value is number => value != null);
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function captureExperienceSnapshot(save: SaveGame): ExperienceSnapshot {
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  return {
    coins: save.wallet.coins,
    energy: save.wallet.energy,
    form: player?.meta.form,
    confidence: player?.meta.confidence,
    nationalRep: save.nationalRep,
    pathMatches: save.careerPathMatches,
    boardConfidence: save.boardConfidence,
    teamMorale: squadMorale(save),
  };
}

function matchNarrative(match: MatchState, won: boolean, tie: boolean): string {
  if (tie) return 'A match that stayed alive until the last ball and refused to choose a winner.';
  const chase = match.innings[1];
  if (chase && chase.runs > match.innings[0].runs) {
    const regulationBalls = match.format === 'T20' ? 120 : match.format === 'ODI' ? 300 : undefined;
    if (regulationBalls && chase.balls >= regulationBalls - 6) {
      return won
        ? 'The chase reached the final over, where composure turned pressure into a win.'
        : 'The contest reached the final over before the opposition held its nerve.';
    }
    const wicketsLeft = Math.max(0, 10 - chase.wickets);
    return wicketsLeft <= 2
      ? `${won ? 'You survived' : 'The opposition survived'} a pressure chase with only ${wicketsLeft} wickets in hand.`
      : `${won ? 'Your side controlled' : 'The opposition controlled'} the chase and absorbed the required-rate pressure.`;
  }
  const innings = match.innings[match.innings.length - 1];
  if (innings?.wickets >= 8) {
    return won
      ? 'Wickets created the decisive collapse and closed the match.'
      : 'A late collapse changed the shape of the contest.';
  }
  return won
    ? 'The result was built by holding the advantage through the key phases.'
    : 'The match turned in the key phases, where pressure was not converted into control.';
}

function archetypeReflection(save: SaveGame, won: boolean): string {
  switch (save.experience?.playerArchetype) {
    case 'PRODIGY':
      return won
        ? 'It met the expectation surrounding a young prospect.'
        : 'Expectation now becomes part of the response to the setback.';
    case 'LATE_BLOOMER':
      return won
        ? 'Another performance made the selectors reconsider what they overlooked.'
        : 'One difficult result does not erase a career built through persistence.';
    case 'COMEBACK':
      return won
        ? 'This is another chapter in the comeback, built under pressure.'
        : 'The setback becomes part of the comeback rather than its ending.';
    case 'SPECIALIST':
      return won
        ? 'The specialist identity became clearer in a winning performance.'
        : 'The next response must come through the skill this career is built around.';
    default:
      return '';
  }
}

function playerContribution(
  match: MatchState,
  playerId: string,
): { runs: number; balls: number; wickets: number; conceded: number; bowlBalls: number } {
  let runs = 0;
  let balls = 0;
  let wickets = 0;
  let conceded = 0;
  let bowlBalls = 0;
  for (const innings of match.innings) {
    const batting = innings.batting.find((row) => row.playerId === playerId);
    const bowling = innings.bowling.find((row) => row.playerId === playerId);
    if (batting) {
      runs += batting.runs;
      balls += batting.balls;
    }
    if (bowling) {
      wickets += bowling.wickets;
      conceded += bowling.runs;
      bowlBalls += bowling.balls;
    }
  }
  return { runs, balls, wickets, conceded, bowlBalls };
}

export function playerOfMatchExplanation(
  match: MatchState,
  nameOf: (id: string) => string,
): string | undefined {
  const id = match.result?.playerOfMatchId;
  if (!id) return undefined;
  const contribution = playerContribution(match, id);
  const parts: string[] = [];
  if (contribution.runs > 0) {
    const strikeRate =
      contribution.balls > 0 ? Math.round((contribution.runs * 100) / contribution.balls) : 0;
    parts.push(`${contribution.runs} runs at a strike rate of ${strikeRate}`);
  }
  if (contribution.wickets > 0) {
    const economy =
      contribution.bowlBalls > 0 ? (contribution.conceded * 6) / contribution.bowlBalls : 0;
    parts.push(`${contribution.wickets} wickets at ${economy.toFixed(1)} economy`);
  }
  return parts.length > 0
    ? `${nameOf(id)} earned Player of the Match for ${parts.join(' and ')}.`
    : `${nameOf(id)} had the strongest overall impact on the result.`;
}

function addChange(
  changes: MatchImpactSummary['changes'],
  label: string,
  before: number | undefined,
  after: number | undefined,
): void {
  if (before == null || after == null || before === after) return;
  changes.push({
    label,
    before: Math.round(before),
    after: Math.round(after),
    delta: Math.round(after - before),
  });
}

export function buildMatchImpactSummary(
  save: SaveGame,
  match: MatchState,
  before: ExperienceSnapshot,
  context: { won: boolean; tie: boolean; selected?: boolean; rating?: number },
  now = Date.now(),
): MatchImpactSummary {
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const changes: MatchImpactSummary['changes'] = [];
  addChange(changes, 'Coins', before.coins, save.wallet.coins);
  addChange(changes, 'Training energy', before.energy, save.wallet.energy);
  addChange(changes, 'Form', before.form, player?.meta.form);
  addChange(changes, 'Confidence', before.confidence, player?.meta.confidence);
  addChange(changes, 'Selection reputation', before.nationalRep, save.nationalRep);
  addChange(changes, 'Pathway matches', before.pathMatches, save.careerPathMatches);
  addChange(changes, 'Board confidence', before.boardConfidence, save.boardConfidence);
  addChange(changes, 'Squad morale', before.teamMorale, squadMorale(save));

  const nameOf = (id: string) => save.players[id]?.name ?? id;
  const decisions = [...(match.decisionImpacts ?? [])];
  if (save.tactics && save.userTeamId) {
    for (const impact of tacticalDecisionImpacts(save.tactics, match, save.userTeamId)) {
      if (!decisions.some((existing) => existing.id === impact.id)) decisions.push(impact);
    }
  }
  const teamTalk = save.experience?.pendingTeamTalk;
  if (teamTalk) {
    decisions.unshift({
      id: `team-talk-${teamTalk.tone.toLowerCase()}`,
      decision:
        teamTalk.tone === 'FIRE_UP'
          ? 'Fire Them Up'
          : teamTalk.tone === 'CALM'
            ? 'Stay Calm'
            : teamTalk.tone === 'TRUST'
              ? 'Show Trust'
              : 'Demand More',
      outcome: `${teamTalk.formDelta >= 0 ? '+' : ''}${teamTalk.formDelta} average XI form before the match.`,
      evidence: `${teamTalk.result}${teamTalk.volatility > 0 ? ` Volatility increased by ${Math.round(teamTalk.volatility * 100)}%.` : ''}`,
      confidence: 'OBSERVED',
      tone: teamTalk.formDelta > 0 ? 'POSITIVE' : teamTalk.formDelta < 0 ? 'NEGATIVE' : 'NEUTRAL',
    });
    delete save.experience?.pendingTeamTalk;
  }
  const why = [
    match.result?.margin ? `Result: ${match.result.margin}` : 'The result was recorded.',
  ];
  if (context.selected === false)
    why.push('You were outside the XI, so personal progression was limited.');
  if (context.rating != null) why.push(`Your match rating was ${context.rating.toFixed(1)}.`);
  why.push(
    `Conditions: ${match.conditions.pitch.toLowerCase()} pitch, ${match.conditions.weather.toLowerCase()} weather.`,
  );

  return {
    matchId: match.id,
    createdAt: now,
    headline: context.tie ? 'Match tied' : context.won ? 'Match won' : 'Match lost',
    narrative: [
      matchNarrative(match, context.won, context.tie),
      archetypeReflection(save, context.won),
    ]
      .filter(Boolean)
      .join(' '),
    why,
    changes,
    playerOfMatchReason: playerOfMatchExplanation(match, nameOf),
    decisions,
  };
}

export interface MatchupInsight {
  edge: 'BATTER' | 'BOWLER' | 'EVEN';
  label: string;
  detail: string;
}

export function describeMatchup(
  batter: Player | undefined,
  bowler: Player | undefined,
  conditions: Conditions,
  requiredRunRate?: number,
): MatchupInsight | null {
  if (!batter || !bowler) return null;
  const pressure = requiredRunRate != null && requiredRunRate >= 10 ? 4 : 0;
  const pitchBowling = conditions.pitch === 'GREEN' || conditions.pitch === 'DUSTY' ? 3 : 0;
  const batterScore = batter.overall + batter.meta.form / 10 - pressure;
  const bowlerScore = bowler.overall + bowler.meta.form / 10 + pitchBowling;
  const difference = batterScore - bowlerScore;
  const edge: MatchupInsight['edge'] =
    difference > 5 ? 'BATTER' : difference < -5 ? 'BOWLER' : 'EVEN';
  const conditionText =
    conditions.pitch === 'GREEN'
      ? 'The green surface is helping seam movement.'
      : conditions.pitch === 'DUSTY'
        ? 'The dry surface is offering grip.'
        : 'The surface is keeping the contest balanced.';
  return {
    edge,
    label:
      edge === 'EVEN'
        ? 'Matchup level'
        : `${edge === 'BATTER' ? batter.name : bowler.name} has the edge`,
    detail: `${conditionText}${pressure ? ' Chase pressure currently favours the bowler.' : ''}`,
  };
}
