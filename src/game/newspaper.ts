import type { MatchImpactSummary, MatchState, NewspaperStory, SaveGame } from '../domain/types';

export interface NewspaperPerformance {
  selected: boolean;
  runs: number;
  balls: number;
  wickets: number;
  calledUp?: boolean;
}

function articleResult(match: MatchState, userTeamId: string): NewspaperStory['result'] {
  if (match.result?.tie || !match.result?.winnerTeamId) return 'TIE';
  return match.result.winnerTeamId === userTeamId ? 'WIN' : 'LOSS';
}

function trophyNameForMatch(save: SaveGame, match: MatchState): string | undefined {
  const fixture = save.fixtures[match.id];
  const isFinal =
    fixture?.cupRound === 'Final' ||
    (fixture?.playoff === true && fixture.venue.trim().toLowerCase() === 'final');
  if (!isFinal) return undefined;
  if (fixture.competition === 'CUP') return 'National Knockout Cup';
  if (fixture.competition === 'INTL_TOURNAMENT') {
    return (
      save.internationalCalendar?.events.find((event) => event.id === fixture.competitionId)?.name ??
      fixture.venue.split(' - ')[0] ??
      'International Championship'
    );
  }
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const competition = season?.competitions?.find((item) => item.id === fixture.competitionId);
  return competition?.name ?? Object.values(save.leagues)[0]?.name ?? 'League Championship';
}

export interface TrophyNewspaperOptions {
  year: number;
  trophyNames: string[];
  sourceId?: string;
  format?: NewspaperStory['format'];
  now?: number;
}

/** Build a shareable champions edition for trophies settled outside a played Final. */
export function buildTrophyNewspaperStory(
  save: SaveGame,
  options: TrophyNewspaperOptions,
): NewspaperStory | null {
  if (
    save.mode !== 'career' ||
    !save.userPlayerId ||
    !save.userTeamId ||
    options.trophyNames.length === 0
  ) {
    return null;
  }
  const player = save.players[save.userPlayerId];
  const team = save.teams[save.userTeamId];
  if (!player || !team) return null;

  const now = options.now ?? Date.now();
  const trophyLabel =
    options.trophyNames.length === 1
      ? options.trophyNames[0]
      : `${options.trophyNames.length} trophies`;
  return {
    id: `paper-trophy-${options.sourceId ?? options.year}-${now}`,
    matchId: `trophy-${options.sourceId ?? options.year}`,
    createdAt: now,
    season: options.year,
    kind: 'TROPHY',
    trophyNames: [...options.trophyNames],
    format: options.format ?? Object.values(save.leagues)[0]?.format ?? 'T20',
    edition: `THE CRICKET CHRONICLE | SEASON ${options.year}`,
    kicker: 'CHAMPIONS EDITION',
    headline:
      options.trophyNames.length === 1
        ? `${player.name.toUpperCase()} LIFTS THE TROPHY`
        : `${player.name.toUpperCase()} COMPLETES A GOLDEN SEASON`,
    subheadline: `${player.name} and ${team.name} celebrate ${trophyLabel}.`,
    body:
      `${team.name} finished the campaign as champions, with ${player.name} at the heart of the squad. ` +
      `The silverware now has a permanent place in the club's history.`,
    playerName: player.name,
    opponentName: trophyLabel,
    result: 'WIN',
    runs: 0,
    balls: 0,
    wickets: 0,
  };
}

/** Build a context-aware back-page story only for genuinely notable matches. */
export function buildNewspaperStory(
  save: SaveGame,
  match: MatchState,
  performance: NewspaperPerformance,
  impact?: MatchImpactSummary,
  now = Date.now(),
): NewspaperStory | null {
  if (!performance.selected || !save.userPlayerId || !save.userTeamId) return null;
  const player = save.players[save.userPlayerId];
  if (!player) return null;

  const userMatchTeamId =
    match.homeTeamId === save.userTeamId || match.awayTeamId === save.userTeamId
      ? save.userTeamId
      : match.homeTeamId;
  const result = articleResult(match, userMatchTeamId);
  const trophyName = result === 'WIN' ? trophyNameForMatch(save, match) : undefined;
  const potm = match.result?.playerOfMatchId === player.id;
  const notable =
    performance.runs >= 50 ||
    performance.wickets >= 3 ||
    potm ||
    Boolean(trophyName) ||
    Boolean(performance.calledUp);
  if (!notable) return null;

  const opponentId =
    match.homeTeamId === userMatchTeamId ? match.awayTeamId : match.homeTeamId;
  const opponentName = save.teams[opponentId]?.name ?? opponentId;
  const userInningsIndex = match.innings.findIndex(
    (innings) => innings.battingTeamId === userMatchTeamId,
  );
  const chase = userInningsIndex > 0;
  const chaseWon = chase && result === 'WIN';
  const name = player.name.toUpperCase();

  let kicker = potm ? 'PLAYER OF THE MATCH' : 'BACK PAGE';
  let headline: string;
  if (trophyName) {
    kicker = 'CHAMPIONS EDITION';
    headline = `${name} LIFTS THE TROPHY`;
  } else if (performance.calledUp) {
    kicker = 'BREAKING: NATIONAL CALL-UP';
    headline = `${name} GETS THE CALL`;
  } else if (performance.runs >= 200) {
    headline = `${name} MAKES IT A DOUBLE`;
  } else if (performance.runs >= 100 && chaseWon) {
    headline = `${name} MASTERS THE CHASE`;
  } else if (performance.runs >= 100) {
    headline = `${name} STANDS TALL`;
  } else if (performance.wickets >= 5) {
    headline = `${name} TEARS THROUGH ${opponentName.toUpperCase()}`;
  } else if (performance.runs >= 50 && performance.wickets >= 3) {
    headline = `${name} DOES IT ALL`;
  } else if (performance.runs >= 50) {
    headline = result === 'LOSS' ? `${name} SHINES IN DEFEAT` : `${name} SETS THE TONE`;
  } else {
    headline = `${name} DELIVERS THE BREAKTHROUGH`;
  }

  const performanceLine = [
    performance.runs > 0 ? `${performance.runs} from ${performance.balls}` : '',
    performance.wickets > 0
      ? `${performance.wickets} wicket${performance.wickets === 1 ? '' : 's'}`
      : '',
  ]
    .filter(Boolean)
    .join(' and ');
  const outcomeLine =
    result === 'WIN'
      ? chaseWon
        ? 'to seal a pressure chase'
        : 'in a winning cause'
      : result === 'LOSS'
        ? 'despite the result'
        : 'as the contest finished level';
  const subheadline = trophyName
    ? `${player.name} and ${save.teams[userMatchTeamId]?.name ?? 'the team'} are ${trophyName} champions.`
    : `${performanceLine} ${outcomeLine} against ${opponentName}.`;
  const body =
    impact?.narrative ??
    (trophyName
      ? `${player.name} helped deliver the season's defining victory. The final whistle confirmed the trophy and a permanent place in club history.`
      : `${player.name} produced the defining individual performance of the match. ` +
        `Selectors and supporters will remember how the innings shifted when the pressure rose.`);
  const season = save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
    : 2026;

  return {
    id: `paper-${match.id}-${now}`,
    matchId: match.id,
    createdAt: now,
    season,
    kind: trophyName ? 'TROPHY' : 'MATCH',
    trophyNames: trophyName ? [trophyName] : undefined,
    format: match.format,
    edition: `THE CRICKET CHRONICLE | SEASON ${season}`,
    kicker,
    headline,
    subheadline,
    body,
    playerName: player.name,
    opponentName,
    result,
    runs: performance.runs,
    balls: performance.balls,
    wickets: performance.wickets,
  };
}

/** Keep one article per match and cap the archive so saves stay small. */
export function archiveNewspaperStory(save: SaveGame, story: NewspaperStory): void {
  save.experience ??= {};
  const withoutDuplicate = (save.experience.mediaScrapbook ?? []).filter(
    (item) => item.matchId !== story.matchId,
  );
  save.experience.mediaScrapbook = [...withoutDuplicate, story].slice(-40);
  save.experience.pendingNewspaperId = story.id;
}

export function markNewspaperSeen(save: SaveGame, storyId: string): void {
  if (save.experience?.pendingNewspaperId === storyId) {
    save.experience.pendingNewspaperId = undefined;
  }
}
