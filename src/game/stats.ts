import { Format, MatchState, PlayerStats, SaveGame } from '../domain/types';

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

/** Career + season stat objects for a player (both created on demand). */
function statTargets(save: SaveGame, playerId: string, format?: Format): PlayerStats[] {
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
  const counted = new Set<string>();
  const countMatch = (playerId: string) => {
    if (counted.has(playerId)) return;
    const targets = statTargets(save, playerId, format);
    if (targets.length) {
      targets.forEach((s) => s.matches++);
      counted.add(playerId);
    }
  };

  for (const inn of match.innings) {
    for (const b of inn.batting) {
      if (b.balls === 0 && !b.out) continue; // did not bat
      const targets = statTargets(save, b.playerId, format);
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
      const targets = statTargets(save, bw.playerId, format);
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
      const targets = statTargets(save, ev.dismissal.fielderId);
      if (!targets.length) continue;
      if (ev.dismissal.type === 'CAUGHT') targets.forEach((s) => s.catches++);
      else if (ev.dismissal.type === 'STUMPED') targets.forEach((s) => s.stumpings++);
    }
  }
}

/** Wipe every player's season stats (called on a new season). */
export function resetSeasonStats(save: SaveGame): void {
  for (const p of Object.values(save.players)) p.seasonStats = emptyStats();
}
