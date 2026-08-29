import type {
  CareerPathLevel,
  Fixture,
  Format,
  MatchImpactSummary,
  MatchState,
  NewspaperStory,
  SaveGame,
} from '../domain/types';
import type {
  NewspaperTemplateCategory,
  NewspaperPlaceholder,
} from '../content/newspaperTemplates';
import { EVT, logEvent } from '../services/analytics';
import { type NewspaperFactMap, selectNewspaperTemplate } from './newspaperContent';

export interface NewspaperPerformance {
  selected: boolean;
  runs: number;
  balls: number;
  wickets: number;
  calledUp?: boolean;
}

interface VerifiedPerformance {
  runs: number;
  balls: number;
  wickets: number;
  hasScorecardRow: boolean;
}

interface MatchFacts {
  facts: NewspaperFactMap;
  playerName: string;
  teamName: string;
  opponentName: string;
  teamScore?: string;
  opponentScore?: string;
  resultLine: string;
  competitionName?: string;
  venueName?: string;
  season: number;
  result: NewspaperStory['result'];
  playerId: string;
  userTeamId: string;
  performance: VerifiedPerformance;
  chase: boolean;
}

const PATH_LABEL: Record<CareerPathLevel, string> = {
  SCHOOL: 'Grade A Cricket',
  U19: 'Under-19',
  DOMESTIC: 'Domestic Professional',
  INTERNATIONAL: 'International',
};

const CATEGORY_KICKER: Record<NewspaperTemplateCategory, string> = {
  CENTURY_STANDARD: 'MATCH REPORT',
  CENTURY_CHASE: 'THE CHASE',
  FIFTY_WIN: 'WINNING CONTRIBUTION',
  FIFTY_LOSS: 'IN DEFEAT',
  WICKET_SPELL: 'WITH THE BALL',
  FIVE_WICKET: 'FIVE-WICKET HAUL',
  ALL_ROUND: 'ALL-ROUND PERFORMANCE',
  CLOSE_WIN: 'CLOSE CONTEST',
  CLOSE_LOSS: 'CLOSE CONTEST',
  PLAYER_OF_MATCH: 'PLAYER OF THE MATCH',
  TROPHY: 'CHAMPIONS EDITION',
  PROMOTION: 'CAREER NEWS',
  ELIMINATION: 'TOURNAMENT EXIT',
  MILESTONE_RECORD: 'MILESTONE EDITION',
};

function existingStory(save: SaveGame, matchId: string): NewspaperStory | undefined {
  return save.experience?.mediaScrapbook?.find((story) => story.matchId === matchId);
}

function storySeason(save: SaveGame, fixture?: Fixture, fallback = 2026): number {
  if (fixture) return save.seasons[fixture.seasonId]?.year ?? fallback;
  return save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? fallback) : fallback;
}

function verifiedPerformance(match: MatchState, playerId: string): VerifiedPerformance {
  let runs = 0;
  let balls = 0;
  let wickets = 0;
  let hasScorecardRow = false;
  for (const innings of match.innings) {
    for (const batter of innings.batting) {
      if (batter.playerId !== playerId) continue;
      hasScorecardRow = true;
      runs += batter.runs;
      balls += batter.balls;
    }
    for (const bowler of innings.bowling) {
      if (bowler.playerId !== playerId) continue;
      hasScorecardRow = true;
      wickets += bowler.wickets;
    }
  }
  return { runs, balls, wickets, hasScorecardRow };
}

function playerMatchTeamId(
  save: SaveGame,
  match: MatchState,
  playerId: string,
): string | undefined {
  for (const innings of match.innings) {
    if (innings.batting.some((card) => card.playerId === playerId)) return innings.battingTeamId;
    if (innings.bowling.some((card) => card.playerId === playerId)) return innings.bowlingTeamId;
  }
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    const team = save.teams[teamId];
    const selected = team?.xi?.length ? team.xi : team?.playerIds.slice(0, 11);
    if (selected?.includes(playerId)) return teamId;
  }
  const u19TeamId = save.u19WorldCup?.controlledTeamId;
  if (u19TeamId === match.homeTeamId || u19TeamId === match.awayTeamId) return u19TeamId;
  if (save.userTeamId === match.homeTeamId || save.userTeamId === match.awayTeamId) {
    return save.userTeamId;
  }
  return undefined;
}

function articleResult(match: MatchState, userTeamId: string): NewspaperStory['result'] {
  if (match.result?.tie || !match.result?.winnerTeamId) return 'TIE';
  return match.result.winnerTeamId === userTeamId ? 'WIN' : 'LOSS';
}

function formatInningsScore(runs: number, wickets: number): string {
  return wickets >= 10 ? `${runs}` : `${runs}/${wickets}`;
}

function aggregateScore(match: MatchState, teamId: string): string | undefined {
  const innings = match.innings.filter((item) => item.battingTeamId === teamId);
  if (innings.length === 0) return undefined;
  return innings.map((item) => formatInningsScore(item.runs, item.wickets)).join(' & ');
}

function competitionName(save: SaveGame, fixture: Fixture | undefined): string | undefined {
  if (!fixture) return undefined;
  if (fixture.competition === 'U19_WORLDCUP') return 'U19 World Cup';
  if (fixture.competition === 'CUP') return 'National Knockout Cup';
  if (fixture.competition === 'INTL_TOURNAMENT') {
    return (
      save.internationalCalendar?.events.find((event) => event.id === fixture.competitionId)
        ?.name ??
      (fixture.competitionId
        ? save.internationalTournaments?.[fixture.competitionId]?.name
        : undefined)
    );
  }
  const season = save.seasons[fixture.seasonId];
  const competition = season?.competitions?.find((item) => item.id === fixture.competitionId);
  if (competition?.name) return competition.name;
  if (fixture.competitionId) {
    const league = Object.values(save.leagues).find((item) => item.id === fixture.competitionId);
    if (league?.name) return league.name;
  }
  if (fixture.competition === 'BILATERAL_SERIES') return fixture.cupRound?.trim() || undefined;
  return undefined;
}

function trophyNameForMatch(save: SaveGame, match: MatchState): string | undefined {
  const fixture = save.fixtures[match.id];
  if (!fixture) return undefined;
  const cupRound = fixture.cupRound?.trim();
  const isFinal =
    cupRound === 'Final' ||
    Boolean(cupRound?.endsWith(' Final')) ||
    (fixture.playoff === true && fixture.venue.trim().toLowerCase() === 'final');
  if (!isFinal) return undefined;
  if (fixture.competition === 'CUP') return 'National Knockout Cup';
  if (fixture.competition === 'U19_WORLDCUP') return 'U19 World Cup';
  if (fixture.competition === 'INTL_TOURNAMENT') {
    return competitionName(save, fixture) ?? 'International Championship';
  }
  return competitionName(save, fixture) ?? Object.values(save.leagues)[0]?.name;
}

function completedMatchFacts(
  save: SaveGame,
  match: MatchState,
  selected: boolean,
): MatchFacts | null {
  if (!selected || !save.userPlayerId || !match.result || match.innings.length === 0) return null;
  if (
    match.innings.some(
      (innings) =>
        !Number.isFinite(innings.runs) ||
        !Number.isFinite(innings.wickets) ||
        !Number.isFinite(innings.balls),
    )
  ) {
    return null;
  }
  const player = save.players[save.userPlayerId];
  if (!player) return null;
  const userTeamId = playerMatchTeamId(save, match, player.id);
  if (!userTeamId) return null;
  const opponentId = match.homeTeamId === userTeamId ? match.awayTeamId : match.homeTeamId;
  const teamName = save.teams[userTeamId]?.name;
  const opponentName = save.teams[opponentId]?.name;
  if (!teamName || !opponentName) return null;

  const fixture = save.fixtures[match.id];
  const performance = verifiedPerformance(match, player.id);
  const result = articleResult(match, userTeamId);
  const margin = match.result.margin?.trim();
  const resultLine =
    result === 'TIE'
      ? `${teamName} and ${opponentName} finished level`
      : match.result.winnerTeamId
        ? `${save.teams[match.result.winnerTeamId]?.name ?? (result === 'WIN' ? teamName : opponentName)} beat ${result === 'WIN' ? opponentName : teamName}${margin ? ` by ${margin}` : ''}`
        : `${teamName} and ${opponentName} finished level`;
  const userInningsIndex = match.innings.findIndex(
    (innings) => innings.battingTeamId === userTeamId,
  );
  const chase = userInningsIndex > 0;
  const previousInningsRuns = chase ? match.innings[userInningsIndex - 1]?.runs : undefined;
  const target = chase
    ? (match.innings[userInningsIndex]?.target ??
      (previousInningsRuns !== undefined ? previousInningsRuns + 1 : undefined))
    : undefined;
  const teamScore = aggregateScore(match, userTeamId);
  const opponentScore = aggregateScore(match, opponentId);
  const resolvedCompetition = competitionName(save, fixture);
  const venueName = fixture?.venue.trim() || undefined;
  const season = storySeason(save, fixture);
  const performanceLine = [
    performance.runs > 0
      ? performance.balls > 0
        ? `${performance.runs} from ${performance.balls}`
        : `${performance.runs} runs`
      : undefined,
    performance.wickets > 0
      ? `${performance.wickets} wicket${performance.wickets === 1 ? '' : 's'}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' and ');

  const facts: NewspaperFactMap = {
    PLAYER: player.name,
    TEAM: teamName,
    OPPONENT: opponentName,
    FORMAT: match.format,
    SEASON: String(season),
    OUTCOME_LINE: resultLine,
  };
  const optionalFacts: Partial<Record<NewspaperPlaceholder, string | number | undefined>> = {
    RUNS: performance.runs > 0 ? performance.runs : undefined,
    BALLS: performance.balls > 0 ? performance.balls : undefined,
    WICKETS: performance.wickets > 0 ? performance.wickets : undefined,
    PERFORMANCE_LINE: performanceLine || undefined,
    TEAM_SCORE: teamScore,
    OPPONENT_SCORE: opponentScore,
    TARGET: target,
    MARGIN: margin || undefined,
    COMPETITION: resolvedCompetition,
    VENUE: venueName,
  };
  for (const [key, value] of Object.entries(optionalFacts)) {
    if (value !== undefined && String(value).trim()) {
      facts[key as NewspaperPlaceholder] = String(value);
    }
  }

  return {
    facts,
    playerName: player.name,
    teamName,
    opponentName,
    teamScore,
    opponentScore,
    resultLine,
    competitionName: resolvedCompetition,
    venueName,
    season,
    result,
    playerId: player.id,
    userTeamId,
    performance,
    chase,
  };
}

function closeLimitedOversResult(match: MatchState): boolean {
  if (match.format === 'TEST') return false;
  const margin = match.result?.margin?.toLowerCase() ?? '';
  const runs = margin.match(/(\d+)\s*runs?/);
  if (runs && Number(runs[1]) <= 10) return true;
  const wickets = margin.match(/(\d+)\s*wickets?/);
  if (wickets && Number(wickets[1]) <= 2) return true;
  const balls = margin.match(/(\d+)\s*balls?/);
  return Boolean(balls && Number(balls[1]) <= 6);
}

function matchCategory(
  match: MatchState,
  facts: MatchFacts,
  trophyName?: string,
): NewspaperTemplateCategory | null {
  if (trophyName) return 'TROPHY';
  const { runs, wickets } = facts.performance;
  const potm = match.result?.playerOfMatchId === facts.playerId;
  if (runs >= 50 && wickets >= 3) return 'ALL_ROUND';
  if (runs >= 100 && facts.chase && facts.result === 'WIN') return 'CENTURY_CHASE';
  if (runs >= 100) return 'CENTURY_STANDARD';
  if (wickets >= 5) return 'FIVE_WICKET';
  if (wickets >= 3) return 'WICKET_SPELL';
  if (runs >= 50 && runs < 100 && facts.result === 'WIN') return 'FIFTY_WIN';
  if (runs >= 50 && runs < 100 && facts.result === 'LOSS') return 'FIFTY_LOSS';
  if (potm && closeLimitedOversResult(match) && facts.result === 'WIN') return 'CLOSE_WIN';
  if (potm && closeLimitedOversResult(match) && facts.result === 'LOSS') return 'CLOSE_LOSS';
  if (potm) return 'PLAYER_OF_MATCH';
  return null;
}

function makeStory(
  save: SaveGame,
  input: {
    matchId: string;
    now: number;
    season: number;
    kind: NewspaperStory['kind'];
    category: NewspaperTemplateCategory;
    format: Format;
    facts: NewspaperFactMap;
    playerName: string;
    teamName?: string;
    opponentName: string;
    result: NewspaperStory['result'];
    runs?: number;
    balls?: number;
    wickets?: number;
    trophyNames?: string[];
    promotionFrom?: CareerPathLevel;
    promotionTo?: CareerPathLevel;
    teamScore?: string;
    opponentScore?: string;
    resultLine?: string;
    competitionName?: string;
    venueName?: string;
  },
): NewspaperStory | null {
  const archived = existingStory(save, input.matchId);
  if (archived) return archived;
  const rendered = selectNewspaperTemplate(save, input.matchId, input.category, input.facts);
  if (!rendered) return null;
  logEvent(EVT.NEWSPAPER_TEMPLATE_SELECTED, {
    category: input.category,
    template_id: rendered.template.id,
  });
  return {
    id: `paper-${input.matchId}-${input.now}`,
    matchId: input.matchId,
    createdAt: input.now,
    season: input.season,
    kind: input.kind,
    templateId: rendered.template.id,
    newspaperCategory: input.category,
    headlineFamily: rendered.template.headlineFamily,
    trophyNames: input.trophyNames,
    promotionFrom: input.promotionFrom,
    promotionTo: input.promotionTo,
    format: input.format,
    edition: `THE CRICKET CHRONICLE | SEASON ${input.season}`,
    kicker: CATEGORY_KICKER[input.category],
    headline: rendered.headline,
    subheadline: rendered.deck,
    body: rendered.body,
    playerName: input.playerName,
    teamName: input.teamName,
    opponentName: input.opponentName,
    result: input.result,
    runs: input.runs ?? 0,
    balls: input.balls ?? 0,
    wickets: input.wickets ?? 0,
    teamScore: input.teamScore,
    opponentScore: input.opponentScore,
    resultLine: input.resultLine,
    competitionName: input.competitionName,
    venueName: input.venueName,
  };
}

export interface TrophyNewspaperOptions {
  year: number;
  trophyNames: string[];
  sourceId?: string;
  format?: NewspaperStory['format'];
  now?: number;
}

export interface TournamentEliminationNewspaperOptions {
  competitionId: string;
  tournamentName: string;
  format: NewspaperStory['format'];
  year: number;
  position: number;
  groupSize: number;
  stage?: string;
  opponentName?: string;
  margin?: string;
  now?: number;
}

export interface MilestoneNewspaperOptions {
  sourceId: string;
  year: number;
  format: Format;
  competition: string;
  count: number | string;
  milestone?: string;
  record?: string;
  teamId?: string;
  now?: number;
}

function promotionTeamName(save: SaveGame, destination: CareerPathLevel): string | undefined {
  if (destination === 'INTERNATIONAL') {
    const country =
      save.playerCareerResources?.cappedCountry ?? save.players[save.userPlayerId!]?.nationality;
    return Object.values(save.teams).find((team) => team.isNationalTeam && team.country === country)
      ?.name;
  }
  const teamId =
    destination === 'SCHOOL' || destination === 'U19' ? save.careerPathTeamId : save.userTeamId;
  return teamId ? save.teams[teamId]?.name : undefined;
}

/** Build the breaking-news edition shown immediately after a verified pathway move. */
export function buildPromotionNewspaperStory(
  save: SaveGame,
  from: CareerPathLevel,
  to: CareerPathLevel,
  now = Date.now(),
): NewspaperStory | null {
  if (save.mode !== 'career' || !save.userPlayerId) return null;
  const player = save.players[save.userPlayerId];
  if (!player) return null;
  const season = storySeason(save);
  const matchId = `promotion-${from.toLowerCase()}-${to.toLowerCase()}`;
  const teamName = promotionTeamName(save, to);
  const facts: NewspaperFactMap = {
    PLAYER: player.name,
    FROM_LEVEL: PATH_LABEL[from],
    TO_LEVEL: PATH_LABEL[to],
    SEASON: String(season),
    FORMAT: to === 'SCHOOL' ? 'T20' : 'ODI',
  };
  if (teamName) facts.TEAM = teamName;
  return makeStory(save, {
    matchId,
    now,
    season,
    kind: 'PROMOTION',
    category: 'PROMOTION',
    format: to === 'SCHOOL' ? 'T20' : 'ODI',
    facts,
    playerName: player.name,
    teamName,
    opponentName: PATH_LABEL[to],
    result: 'NEUTRAL',
    promotionFrom: from,
    promotionTo: to,
  });
}

/** Build an explicit exit edition only from the persisted final tournament state. */
export function buildTournamentEliminationNewspaperStory(
  save: SaveGame,
  options: TournamentEliminationNewspaperOptions,
): NewspaperStory | null {
  if (save.mode !== 'career' || !save.userPlayerId) return null;
  const player = save.players[save.userPlayerId];
  if (!player) return null;
  const tournament = save.internationalTournaments?.[options.competitionId];
  const teamName = tournament?.controlledTeamId
    ? save.teams[tournament.controlledTeamId]?.name
    : undefined;
  if (!teamName) return null;
  const stage = options.stage?.trim() || 'Group Stage';
  const matchId = `elimination-${options.competitionId}`;
  const facts: NewspaperFactMap = {
    PLAYER: player.name,
    TEAM: teamName,
    TOURNAMENT: options.tournamentName,
    STAGE: stage,
    SEASON: String(options.year),
    POSITION: ordinal(options.position),
    GROUP_SIZE: String(options.groupSize),
    FORMAT: options.format,
  };
  if (options.opponentName?.trim()) facts.OPPONENT = options.opponentName.trim();
  if (options.margin?.trim()) facts.MARGIN = options.margin.trim();
  return makeStory(save, {
    matchId,
    now: options.now ?? Date.now(),
    season: options.year,
    kind: 'ELIMINATION',
    category: 'ELIMINATION',
    format: options.format,
    facts,
    playerName: player.name,
    teamName,
    opponentName: options.opponentName ?? options.tournamentName,
    result: 'LOSS',
    competitionName: options.tournamentName,
  });
}

function ordinal(value: number): string {
  const absolute = Math.abs(Math.trunc(value));
  const suffix =
    absolute % 100 >= 11 && absolute % 100 <= 13
      ? 'th'
      : absolute % 10 === 1
        ? 'st'
        : absolute % 10 === 2
          ? 'nd'
          : absolute % 10 === 3
            ? 'rd'
            : 'th';
  return `${value}${suffix}`;
}

/** Build a champions edition for trophies settled outside a played final. */
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
  const trophy = options.trophyNames.join(' & ');
  const matchId = `trophy-${options.sourceId ?? options.year}`;
  const format = options.format ?? Object.values(save.leagues)[0]?.format ?? 'T20';
  const facts: NewspaperFactMap = {
    PLAYER: player.name,
    TEAM: team.name,
    TROPHY: trophy,
    COMPETITION: trophy,
    FORMAT: format,
    SEASON: String(options.year),
  };
  return makeStory(save, {
    matchId,
    now: options.now ?? Date.now(),
    season: options.year,
    kind: 'TROPHY',
    category: 'TROPHY',
    format,
    facts,
    playerName: player.name,
    teamName: team.name,
    opponentName: trophy,
    result: 'WIN',
    trophyNames: [...options.trophyNames],
    competitionName: trophy,
  });
}

/** Build a milestone/record edition from an already-confirmed persisted fact. */
export function buildMilestoneNewspaperStory(
  save: SaveGame,
  options: MilestoneNewspaperOptions,
): NewspaperStory | null {
  if (
    save.mode !== 'career' ||
    !save.userPlayerId ||
    (!options.milestone?.trim() && !options.record?.trim())
  ) {
    return null;
  }
  const player = save.players[save.userPlayerId];
  if (!player) return null;
  const teamName = options.teamId ? save.teams[options.teamId]?.name : undefined;
  const facts: NewspaperFactMap = {
    PLAYER: player.name,
    FORMAT: options.format,
    COMPETITION: options.competition,
    COUNT: String(options.count),
    SEASON: String(options.year),
  };
  if (options.milestone?.trim()) facts.MILESTONE = options.milestone.trim();
  if (options.record?.trim()) facts.RECORD = options.record.trim();
  if (teamName) facts.TEAM = teamName;
  return makeStory(save, {
    matchId: `milestone-${options.sourceId}`,
    now: options.now ?? Date.now(),
    season: options.year,
    kind: 'MILESTONE',
    category: 'MILESTONE_RECORD',
    format: options.format,
    facts,
    playerName: player.name,
    teamName,
    opponentName: options.competition,
    result: 'NEUTRAL',
    competitionName: options.competition,
  });
}

/** Build a report only from verified rows and totals in a completed match. */
export function buildNewspaperStory(
  save: SaveGame,
  match: MatchState,
  performance: NewspaperPerformance,
  _impact?: MatchImpactSummary,
  now = Date.now(),
): NewspaperStory | null {
  const facts = completedMatchFacts(save, match, performance.selected);
  if (!facts || !save.userPlayerId) return null;
  const trophyName = facts.result === 'WIN' ? trophyNameForMatch(save, match) : undefined;
  const category = matchCategory(match, facts, trophyName);
  if (!category) return null;
  if (trophyName) {
    facts.facts.TROPHY = trophyName;
    facts.facts.COMPETITION ??= trophyName;
  }
  return makeStory(save, {
    matchId: match.id,
    now,
    season: facts.season,
    kind: trophyName ? 'TROPHY' : 'MATCH',
    category,
    format: match.format,
    facts: facts.facts,
    playerName: facts.playerName,
    teamName: facts.teamName,
    opponentName: facts.opponentName,
    result: facts.result,
    runs: facts.performance.runs,
    balls: facts.performance.balls,
    wickets: facts.performance.wickets,
    trophyNames: trophyName ? [trophyName] : undefined,
    teamScore: facts.teamScore,
    opponentScore: facts.opponentScore,
    resultLine: facts.resultLine,
    competitionName: facts.competitionName,
    venueName: facts.venueName,
  });
}

/** Keep one article per event and cap the archive so saves stay small. */
export function archiveNewspaperStory(
  save: SaveGame,
  story: NewspaperStory | null | undefined,
): void {
  if (!story) return;
  save.experience ??= {};
  const pending = (save.experience.mediaScrapbook ?? []).find(
    (item) => item.id === save.experience?.pendingNewspaperId,
  );
  const withoutDuplicate = (save.experience.mediaScrapbook ?? []).filter(
    (item) => item.matchId !== story.matchId,
  );
  save.experience.mediaScrapbook = [...withoutDuplicate, story].slice(-40);
  const pendingHasPriority = pending?.kind === 'ELIMINATION' || pending?.kind === 'PROMOTION';
  save.experience.pendingNewspaperId =
    pendingHasPriority && story.kind !== 'ELIMINATION' && story.kind !== 'PROMOTION'
      ? pending.id
      : story.id;
}

export function markNewspaperSeen(save: SaveGame, storyId: string): void {
  if (save.experience?.pendingNewspaperId === storyId) {
    save.experience.pendingNewspaperId = undefined;
  }
}
