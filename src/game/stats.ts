import {
  CareerCompetitionStatScope,
  Format,
  MatchState,
  Player,
  PlayerStats,
  SaveGame,
} from '../domain/types';

type CareerScope = 'domestic' | 'international';

export function emptyStats(): PlayerStats {
  return {
    matches: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highScore: 0,
    notOuts: 0,
    fifties: 0,
    hundreds: 0,
    wickets: 0,
    ballsBowled: 0,
    runsConceded: 0,
    bestBowling: '-',
    catches: 0,
    stumpings: 0,
  };
}

const ADDITIVE_STAT_FIELDS = [
  'matches',
  'runs',
  'balls',
  'fours',
  'sixes',
  'notOuts',
  'fifties',
  'hundreds',
  'wickets',
  'ballsBowled',
  'runsConceded',
  'catches',
  'stumpings',
] as const satisfies readonly (keyof PlayerStats)[];

/**
 * Old saves have complete career totals but no competition split. Keep those
 * matches visible as one honest combined row instead of showing a wall of zeroes
 * or guessing which formats they belonged to.
 */
export function earlierCareerStats(
  player: Pick<Player, 'careerStats' | 'competitionStats'>,
): PlayerStats {
  const career = player.careerStats ?? emptyStats();
  const tracked = Object.values(player.competitionStats ?? {});
  const earlier = emptyStats();
  for (const field of ADDITIVE_STAT_FIELDS) {
    const trackedTotal = tracked.reduce((sum, stats) => sum + (stats?.[field] ?? 0), 0);
    earlier[field] = Math.max(0, career[field] - trackedTotal);
  }
  const trackedHighScore = tracked.reduce(
    (highest, stats) => Math.max(highest, stats?.highScore ?? 0),
    0,
  );
  earlier.highScore = career.highScore > trackedHighScore ? career.highScore : 0;
  earlier.bestBowling = '-';
  return earlier;
}

/** Career + season stat objects for a player (both created on demand). */
function matchScope(save: SaveGame, match: MatchState): CareerScope {
  const fixture = save.fixtures[match.id];
  return fixture?.competition === 'BILATERAL_SERIES' || fixture?.competition === 'INTL_TOURNAMENT'
    ? 'international'
    : 'domestic';
}

export const CAREER_COMPETITION_STAT_LABELS: Readonly<Record<CareerCompetitionStatScope, string>> =
  {
    GRADE_A: 'Grade A',
    U19: 'Under-19',
    U19_WORLD_CUP: 'U19 World Cup',
    DOMESTIC_T20: 'Domestic T20',
    LIST_A: 'List A',
    FIRST_CLASS: 'First Class',
    HUNDRED: 'Hundred',
    T10: 'T10',
    T20I: 'T20I',
    ODI: 'ODI',
    TEST: 'Test',
  };

function competitionStatScope(save: SaveGame, match: MatchState): CareerCompetitionStatScope {
  const fixture = save.fixtures[match.id];
  if (fixture?.competitionId === 'youth-u14') return 'GRADE_A';
  if (fixture?.competition === 'U19_WORLDCUP') return 'U19_WORLD_CUP';
  if (fixture?.competitionId === 'youth-u19') return 'U19';
  if (matchScope(save, match) === 'international') {
    if (match.format === 'TEST') return 'TEST';
    if (match.format === 'ODI') return 'ODI';
    return 'T20I';
  }
  if (match.format === 'TEST') return 'FIRST_CLASS';
  if (match.format === 'ODI') return 'LIST_A';
  if (match.format === 'HUNDRED') return 'HUNDRED';
  if (match.format === 'T10') return 'T10';
  return 'DOMESTIC_T20';
}

function statTargets(
  save: SaveGame,
  playerId: string,
  format?: Format,
  scope?: CareerScope,
  competitionScope?: CareerCompetitionStatScope,
): PlayerStats[] {
  const p = save.players[playerId];
  if (!p) return [];
  if (!p.careerStats) p.careerStats = emptyStats();
  if (!p.seasonStats) p.seasonStats = emptyStats();
  const targets: PlayerStats[] = [p.careerStats, p.seasonStats];
  // Also track per-format career stats (Feature 4).
  if (format) {
    if (!p.formatStats) p.formatStats = {};
    if (!p.formatStats[format]) p.formatStats[format] = emptyStats();
    targets.push(p.formatStats[format]!);
    if (!p.seasonFormatStats) p.seasonFormatStats = {};
    if (!p.seasonFormatStats[format]) p.seasonFormatStats[format] = emptyStats();
    targets.push(p.seasonFormatStats[format]!);
  }
  if (scope === 'domestic') {
    if (!p.domesticStats) p.domesticStats = emptyStats();
    targets.push(p.domesticStats);
  } else if (scope === 'international') {
    if (!p.internationalStats) p.internationalStats = emptyStats();
    targets.push(p.internationalStats);
  }
  if (competitionScope) {
    if (!p.competitionStats) p.competitionStats = {};
    if (!p.competitionStats[competitionScope]) {
      p.competitionStats[competitionScope] = emptyStats();
    }
    targets.push(p.competitionStats[competitionScope]!);
  }
  return targets;
}

function updateBest(s: PlayerStats, wickets: number, runs: number): void {
  if (wickets <= 0) return;
  if (s.bestBowling === '-') {
    s.bestBowling = `${wickets}/${runs}`;
    return;
  }
  const [bw, br] = s.bestBowling.split('/').map(Number);
  if (wickets > bw || (wickets === bw && runs < br)) s.bestBowling = `${wickets}/${runs}`;
}

/** Merge a completed match into every involved player's career + season stats. */
export function applyMatchToStats(save: SaveGame, match: MatchState): void {
  const format = match.format;
  const scope = matchScope(save, match);
  const competitionScope = competitionStatScope(save, match);
  save.competitionStatsTrackingStartedAt ??= Date.now();
  const counted = new Set<string>();
  const countMatch = (playerId: string) => {
    if (counted.has(playerId)) return;
    const targets = statTargets(save, playerId, format, scope, competitionScope);
    if (targets.length) {
      targets.forEach((s) => s.matches++);
      counted.add(playerId);
    }
  };

  // An appearance belongs to every selected XI member, including a batter who
  // was not required and a fielder who did not bowl.
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    const team = save.teams[teamId];
    const matchXI = teamId === match.homeTeamId ? match.homePlayerIds : match.awayPlayerIds;
    const selected = matchXI?.length
      ? matchXI
      : team?.xi?.length
        ? team.xi
        : (team?.playerIds.slice(0, 11) ?? []);
    selected.forEach(countMatch);
  }

  for (const inn of match.innings) {
    for (const b of inn.batting) {
      if (b.balls === 0 && !b.out) continue; // did not bat
      const targets = statTargets(save, b.playerId, format, scope, competitionScope);
      if (!targets.length) continue;
      countMatch(b.playerId);
      for (const s of targets) {
        s.runs += b.runs;
        s.balls += b.balls;
        s.fours += b.fours;
        s.sixes += b.sixes;
        if (b.runs > s.highScore) s.highScore = b.runs;
        if (!b.out) s.notOuts++;
        if (b.runs >= 100) s.hundreds++;
        else if (b.runs >= 50) s.fifties++;
      }
    }

    for (const bw of inn.bowling) {
      const targets = statTargets(save, bw.playerId, format, scope, competitionScope);
      if (!targets.length) continue;
      countMatch(bw.playerId);
      for (const s of targets) {
        s.wickets += bw.wickets;
        s.ballsBowled += bw.balls;
        s.runsConceded += bw.runs;
        updateBest(s, bw.wickets, bw.runs);
      }
    }

    for (const ev of inn.events) {
      if (!ev.isWicket || !ev.dismissal?.fielderId) continue;
      const targets = statTargets(save, ev.dismissal.fielderId, format, scope, competitionScope);
      if (!targets.length) continue;
      if (ev.dismissal.type === 'CAUGHT') targets.forEach((s) => s.catches++);
      else if (ev.dismissal.type === 'STUMPED') targets.forEach((s) => s.stumpings++);
    }
  }

}

/** Wipe season stats at rollover, optionally preserving an inactive retained club. */
export function resetSeasonStats(
  save: SaveGame,
  options: { preservePlayerIds?: ReadonlySet<string> } = {},
): void {
  for (const p of Object.values(save.players)) {
    if (options.preservePlayerIds?.has(p.id)) continue;
    p.seasonStats = emptyStats();
    p.seasonFormatStats = {};
  }
}
