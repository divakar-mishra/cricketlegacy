import type { ScoreType } from './onlineLeaderboard';

export type SanitySeverity = 'clean' | 'review' | 'shadowban';

export interface LeaderboardSanityInput {
  scoreType: ScoreType;
  score: number;
  season?: number;
  seasonsCompleted?: number;
  walletCoins?: number;
  walletGems?: number;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  ties?: number;
}

export interface SanityVerdict {
  severity: SanitySeverity;
  reasons: string[];
}

const SCORE_LIMITS: Record<ScoreType, number> = {
  career_runs: 40_000,
  career_wickets: 2_000,
  career_centuries: 150,
  career_fifties: 350,
  manager_titles: 80,
  gamerscore: 100_000,
  hof_legacy: 1_000_000,
};

const SCORE_PER_MATCH_LIMITS: Partial<Record<ScoreType, number>> = {
  career_runs: 260,
  career_wickets: 10,
  career_centuries: 1,
  career_fifties: 1,
};

const ABSOLUTE_WALLET_LIMITS = {
  coins: 1_000_000_000,
  gems: 250_000,
};

function winRate(input: LeaderboardSanityInput): number | null {
  const played = input.matchesPlayed ?? (input.wins ?? 0) + (input.losses ?? 0) + (input.ties ?? 0);
  if (!played || played < 12 || input.wins == null) return null;
  return input.wins / played;
}

export function leaderboardSanityCheck(input: LeaderboardSanityInput): SanityVerdict {
  const reasons: string[] = [];
  const seasons = input.seasonsCompleted ?? input.season ?? 0;
  const limit = SCORE_LIMITS[input.scoreType];
  const matches = input.matchesPlayed ?? 0;

  if (!Number.isFinite(input.score) || input.score < 0) {
    reasons.push('invalid_score');
  }
  if ((input.walletCoins ?? 0) < 0 || (input.walletGems ?? 0) < 0) {
    reasons.push('negative_wallet_balance_impossible');
  }
  if ((input.walletCoins ?? 0) > ABSOLUTE_WALLET_LIMITS.coins) {
    reasons.push('coin_balance_above_global_limit');
  }
  if ((input.walletGems ?? 0) > ABSOLUTE_WALLET_LIMITS.gems) {
    reasons.push('gem_balance_above_global_limit');
  }
  if (input.score > limit) {
    reasons.push(`score_above_global_limit:${limit}`);
  }
  const perMatchLimit = SCORE_PER_MATCH_LIMITS[input.scoreType];
  if (perMatchLimit != null && matches > 0 && input.score > matches * perMatchLimit) {
    reasons.push(`score_above_match_limit:${perMatchLimit}`);
  }
  if (input.scoreType === 'manager_titles' && seasons > 0 && input.score > seasons) {
    reasons.push('manager_titles_above_seasons_impossible');
  }
  if (seasons <= 1 && input.scoreType === 'career_runs' && input.score > 2_500) {
    reasons.push('season_one_runs_impossible');
  }
  if (seasons <= 1 && input.scoreType === 'career_wickets' && input.score > 120) {
    reasons.push('season_one_wickets_impossible');
  }
  if (seasons <= 1 && (input.walletCoins ?? 0) > 50_000_000) {
    reasons.push('season_one_coin_balance_impossible');
  }
  if (seasons <= 1 && (input.walletGems ?? 0) > 50_000) {
    reasons.push('season_one_gem_balance_impossible');
  }

  const rate = winRate(input);
  if (rate != null && rate >= 0.98 && (input.matchesPlayed ?? 0) >= 25) {
    reasons.push('suspicious_near_perfect_win_rate');
  }

  if (
    reasons.length >= 2 ||
    reasons.some(
      (r) =>
        r.includes('impossible') ||
        r.includes('above_global_limit') ||
        r.includes('above_match_limit') ||
        r.includes('suspicious_near_perfect_win_rate'),
    )
  ) {
    return { severity: 'shadowban', reasons };
  }
  if (reasons.length === 1) {
    return { severity: 'review', reasons };
  }
  return { severity: 'clean', reasons };
}
