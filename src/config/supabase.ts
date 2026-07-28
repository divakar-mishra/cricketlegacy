const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const SUPABASE_CONFIG = {
  enabled:
    process.env.EXPO_PUBLIC_SUPABASE_ENABLED === 'true' &&
    SUPABASE_URL.length > 0 &&
    SUPABASE_PUBLISHABLE_KEY.length > 0,
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
} as const;
