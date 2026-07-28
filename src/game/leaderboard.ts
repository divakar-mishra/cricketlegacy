/**
 * Local leaderboards — rank the user against the whole world of players on a
 * chosen metric (runs, wickets, or overall rating), for this season or the whole
 * career. Pure functions over the save; a natural hook for a future online board
 * (the same shape can be filled from a backend). Unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { emptyStats } from './stats';

export type LeaderMetric = 'runs' | 'wickets' | 'overall';
export type LeaderScope = 'season' | 'career';

export interface LeaderRow {
  rank: number;
  playerId: string;
  name: string;
  teamName: string;
  value: number;
  isUser: boolean;
}

export const METRIC_LABEL: Record<LeaderMetric, string> = {
  runs: 'Most Runs',
  wickets: 'Most Wickets',
  overall: 'Top Rated',
};

function metricValue(p: Player, metric: LeaderMetric, scope: LeaderScope): number {
  if (metric === 'overall') return p.overall;
  const s = (scope === 'season' ? p.seasonStats : p.careerStats) ?? emptyStats();
  return metric === 'runs' ? s.runs : s.wickets;
}

function teamNameOf(save: SaveGame, playerId: string): string {
  for (const t of Object.values(save.teams)) {
    if (t.playerIds.includes(playerId)) return t.shortName;
  }
  return '—';
}

/** Ranked leaderboard (best first). Hidden youth prospects are excluded. */
export function leaderboard(
  save: SaveGame,
  metric: LeaderMetric,
  scope: LeaderScope,
  limit = 10,
): LeaderRow[] {
  const rows = Object.values(save.players)
    .filter((p) => !p.hidden)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      teamName: teamNameOf(save, p.id),
      value: metricValue(p, metric, scope),
      isUser: p.id === save.userPlayerId,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .map((r, i) => ({ rank: i + 1, ...r }));
  return rows.slice(0, limit);
}

/** The user's rank on a metric (1-based), or 0 if not applicable. */
export function userRank(save: SaveGame, metric: LeaderMetric, scope: LeaderScope): number {
  if (!save.userPlayerId) return 0;
  const full = leaderboard(save, metric, scope, Number.MAX_SAFE_INTEGER);
  return full.find((r) => r.isUser)?.rank ?? 0;
}
