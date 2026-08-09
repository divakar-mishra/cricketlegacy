/**
 * Save-local leaderboards for runs, wickets, and overall rating.
 *
 * This is also the offline shape used while the public Supabase leaderboard is
 * unavailable.
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

function metricValue(player: Player, metric: LeaderMetric, scope: LeaderScope): number {
  if (metric === 'overall') return player.overall;
  const stats = (scope === 'season' ? player.seasonStats : player.careerStats) ?? emptyStats();
  return metric === 'runs' ? stats.runs : stats.wickets;
}

function teamNameOf(save: SaveGame, playerId: string): string {
  for (const team of Object.values(save.teams)) {
    if (team.playerIds.includes(playerId)) return team.shortName;
  }
  return '-';
}

/** Ranked leaderboard (best first). Hidden youth prospects are excluded. */
export function leaderboard(
  save: SaveGame,
  metric: LeaderMetric,
  scope: LeaderScope,
  limit = 10,
): LeaderRow[] {
  const rows = Object.values(save.players)
    .filter((player) => !player.hidden)
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      teamName: teamNameOf(save, player.id),
      value: metricValue(player, metric, scope),
      isUser: player.id === save.userPlayerId,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .map((row, index) => ({ rank: index + 1, ...row }));
  return rows.slice(0, limit);
}

/** The user's rank on a metric (1-based), or 0 if not applicable. */
export function userRank(save: SaveGame, metric: LeaderMetric, scope: LeaderScope): number {
  if (!save.userPlayerId) return 0;
  const full = leaderboard(save, metric, scope, Number.MAX_SAFE_INTEGER);
  return full.find((row) => row.isUser)?.rank ?? 0;
}
