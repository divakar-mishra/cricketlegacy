const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const SUPABASE_ENABLED =
  process.env.EXPO_PUBLIC_SUPABASE_ENABLED === 'true' &&
  SUPABASE_URL.length > 0 &&
  SUPABASE_PUBLISHABLE_KEY.length > 0;

export const SUPABASE_CONFIG = {
  enabled: SUPABASE_ENABLED,
  /** Keep public rankings off until the hardened RPC migration is deployed. */
  leaderboardsEnabled:
    SUPABASE_ENABLED && process.env.EXPO_PUBLIC_LEADERBOARDS_ENABLED === 'true',
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
} as const;
