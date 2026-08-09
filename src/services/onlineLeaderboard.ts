/**
 * Online leaderboard service backed by Supabase.
 *
 * Score submissions pass through the local sanity filter before entering the
 * public table. Implausible rows are kept in the private review table instead.
 * All network failures are non-fatal so careers remain playable offline.
 */

import { SUPABASE_CONFIG } from '../config/supabase';
import { leaderboardSanityCheck, type LeaderboardSanityInput } from './antiCheat';
import { captureException } from './crash';
import { getSupabaseClient } from './supabaseClient';

export type ScoreType =
  | 'career_runs'
  | 'career_wickets'
  | 'career_centuries'
  | 'career_fifties'
  | 'manager_titles'
  | 'gamerscore'
  | 'hof_legacy';

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  userId: string;
  score: number;
  country?: string;
  updatedAt: string;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  userRank: number | null;
  userScore: number | null;
  totalPlayers: number;
}

interface LeaderboardRow {
  player_name: string;
  user_id: string;
  score: number;
  country?: string;
  updated_at: string;
}

/**
 * Submit or update a user's score. Call after season rollover, retirement, or
 * whenever the score improves.
 */
export async function submitScore(params: {
  userId: string;
  playerName: string;
  scoreType: ScoreType;
  score: number;
  country?: string;
  sanity?: Partial<LeaderboardSanityInput>;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const verdict = leaderboardSanityCheck({
      scoreType: params.scoreType,
      score: params.score,
      ...params.sanity,
    });
    if (verdict.severity === 'shadowban') {
      await client.from('shadow_leaderboard').insert({
        user_id: params.userId,
        player_name: params.playerName,
        score_type: params.scoreType,
        score: params.score,
        country: params.country,
        reasons: verdict.reasons,
      });
      return;
    }

    const { error } = await client.from('leaderboard').upsert(
      {
        user_id: params.userId,
        player_name: params.playerName,
        score_type: params.scoreType,
        score: params.score,
        country: params.country,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,score_type', ignoreDuplicates: false },
    );

    if (error) {
      captureException(error, { context: 'leaderboard.submit' });
    }
  } catch (error) {
    captureException(error, { context: 'leaderboard.submit' });
  }
}

/**
 * Fetch the top players for a score type, plus the requesting user's rank.
 * Returns an empty result on network errors.
 */
export async function fetchLeaderboard(
  scoreType: ScoreType,
  limit = 50,
  userId?: string,
): Promise<LeaderboardResult> {
  const empty: LeaderboardResult = {
    entries: [],
    userRank: null,
    userScore: null,
    totalPlayers: 0,
  };

  const client = getSupabaseClient();
  if (!client) return empty;

  try {
    const { data, error, count } = await client
      .from('leaderboard')
      .select('player_name, user_id, score, country, updated_at', { count: 'exact' })
      .eq('score_type', scoreType)
      .order('score', { ascending: false })
      .limit(limit);

    if (error || !data) {
      captureException(error, { context: 'leaderboard.fetch' });
      return empty;
    }

    const entries: LeaderboardEntry[] = (data as LeaderboardRow[]).map((row, index) => ({
      rank: index + 1,
      playerName: row.player_name,
      userId: row.user_id,
      score: row.score,
      country: row.country,
      updatedAt: row.updated_at,
    }));

    let userRank: number | null = null;
    let userScore: number | null = null;

    if (userId) {
      const userEntry = entries.find((entry) => entry.userId === userId);
      if (userEntry) {
        userRank = userEntry.rank;
        userScore = userEntry.score;
      } else {
        const { data: rankData } = await client
          .from('leaderboard')
          .select('score')
          .eq('score_type', scoreType)
          .eq('user_id', userId)
          .single();

        if (rankData) {
          userScore = rankData.score;
          const { count: higherCount } = await client
            .from('leaderboard')
            .select('*', { count: 'exact', head: true })
            .eq('score_type', scoreType)
            .gt('score', rankData.score);
          userRank = (higherCount ?? 0) + 1;
        }
      }
    }

    return {
      entries,
      userRank,
      userScore,
      totalPlayers: count ?? entries.length,
    };
  } catch (error) {
    captureException(error, { context: 'leaderboard.fetch' });
    return empty;
  }
}

export function isOnlineLeaderboardEnabled(): boolean {
  return SUPABASE_CONFIG.enabled;
}
