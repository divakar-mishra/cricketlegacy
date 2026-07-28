/**
 * Online Leaderboard Service — backed by Supabase.
 *
 * Handles global score submission and fetching with offline fallback.
 * All calls are fire-and-forget safe — network errors are swallowed and
 * logged to the crash service.
 *
 * ─── Supabase Setup (one-time) ────────────────────────────────────────────────
 *  1. Create a free project at https://supabase.com
 *  2. Run the SQL below in the Supabase SQL Editor to create the table:
 *
 *     CREATE TABLE leaderboard (
 *       id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *       player_name TEXT NOT NULL,
 *       user_id     TEXT NOT NULL,
 *       score_type  TEXT NOT NULL,  -- 'career_runs' | 'career_wickets' | 'manager_titles' | 'gamerscore'
 *       score       INTEGER NOT NULL,
 *       country     TEXT,
 *       created_at  TIMESTAMPTZ DEFAULT NOW(),
 *       updated_at  TIMESTAMPTZ DEFAULT NOW()
 *     );
 *
 *     -- Unique constraint: one entry per user per score type
 *     CREATE UNIQUE INDEX leaderboard_user_type ON leaderboard(user_id, score_type);
 *
 *     -- Public read, authenticated write
 *     ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
 *     CREATE POLICY "Anyone can read" ON leaderboard FOR SELECT USING (true);
 *     CREATE POLICY "Users can upsert own row" ON leaderboard FOR INSERT WITH CHECK (true);
 *     CREATE POLICY "Users can update own row" ON leaderboard FOR UPDATE USING (true);
 *
 *     -- Hidden review table for impossible uploads. The client still receives
 *     -- a normal success path; these rows are excluded from public rankings.
 *     CREATE TABLE shadow_leaderboard (
 *       id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *       player_name TEXT NOT NULL,
 *       user_id     TEXT NOT NULL,
 *       score_type  TEXT NOT NULL,
 *       score       INTEGER NOT NULL,
 *       country     TEXT,
 *       reasons     TEXT[] NOT NULL DEFAULT '{}',
 *       created_at  TIMESTAMPTZ DEFAULT NOW()
 *     );
 *
 *  3. Copy your project URL + anon key into app.json extra.supabaseUrl / extra.supabaseAnonKey
 *  4. Set SUPABASE_ENABLED = true below and rebuild.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { leaderboardSanityCheck, LeaderboardSanityInput } from './antiCheat';
import { captureException, addBreadcrumb } from './crash';
import { SUPABASE_CONFIG } from '../config/supabase';
import { getSupabaseClient } from './supabaseClient';

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Supabase stays disabled until .env.local provides URL/key and
// EXPO_PUBLIC_SUPABASE_ENABLED=true. Do not ship service_role/secret keys.

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Supabase client (lazy) ───────────────────────────────────────────────────

function getClient() {
  return getSupabaseClient();
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
  const client = getClient();
  if (!client) return;

  addBreadcrumb(`leaderboard.submit: ${params.scoreType}=${params.score}`);

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
  } catch (e) {
    captureException(e, { context: 'leaderboard.submit' });
  }
}

/**
 * Fetch the top N players for a given score type, along with the requesting
 * user's rank. Returns empty result on network error (offline safe).
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

  const client = getClient();
  if (!client) return empty;

  try {
    // Top N
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

    const entries: LeaderboardEntry[] = data.map((row: any, idx: number) => ({
      rank: idx + 1,
      playerName: row.player_name,
      userId: row.user_id,
      score: row.score,
      country: row.country,
      updatedAt: row.updated_at,
    }));

    // Find user's position
    let userRank: number | null = null;
    let userScore: number | null = null;

    if (userId) {
      const userEntry = entries.find((e) => e.userId === userId);
      if (userEntry) {
        userRank = userEntry.rank;
        userScore = userEntry.score;
      } else {
        // User not in top N — fetch their actual rank
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
  } catch (e) {
    captureException(e, { context: 'leaderboard.fetch' });
    return empty;
  }
}

/** Check if Supabase connectivity is available. */
export function isOnlineLeaderboardEnabled(): boolean {
  return SUPABASE_CONFIG.enabled;
}
