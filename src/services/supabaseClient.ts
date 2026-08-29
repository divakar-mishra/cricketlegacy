import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { BUILD_INFO } from '../config/buildInfo';
import { SUPABASE_CONFIG } from '../config/supabase';

let client: SupabaseClient | null | undefined;
let urlPolyfillInstalled = false;

export interface SupabaseUserSession {
  userId: string;
  isAnonymous: boolean;
}

export interface OnlineDailyVerification {
  userId: string;
  serverTimeMs: number;
  expiresAtMs: number;
}

export function isSupabaseBackendEnabled(): boolean {
  return SUPABASE_CONFIG.enabled;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_CONFIG.enabled) return null;
  if (client !== undefined) return client;

  if (!urlPolyfillInstalled) {
    try {
      // Loaded lazily so Jest and local disabled-backend tests do not parse the
      // polyfill's ESM entrypoint unless a real Supabase client is created.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-url-polyfill/auto');
    } catch {
      /* React Native usually provides URL globals; the polyfill is best-effort. */
    }
    urlPolyfillInstalled = true;
  }

  client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
  return client;
}

function isAnonymousUser(user: unknown): boolean {
  if (!user || typeof user !== 'object') return true;
  const record = user as {
    is_anonymous?: unknown;
    app_metadata?: { provider?: unknown; providers?: unknown };
  };
  if (record.is_anonymous === true) return true;
  if (record.app_metadata?.provider === 'anonymous') return true;
  return (
    Array.isArray(record.app_metadata?.providers) &&
    record.app_metadata.providers.includes('anonymous')
  );
}

function hasRecoverableUserIdentity(user: unknown): boolean {
  if (!user || typeof user !== 'object' || isAnonymousUser(user)) return false;
  const record = user as {
    email?: unknown;
    phone?: unknown;
    identities?: { provider?: unknown }[] | null;
  };
  if (typeof record.email === 'string' && record.email.length > 0) return true;
  if (typeof record.phone === 'string' && record.phone.length > 0) return true;
  return (record.identities ?? []).some(
    (identity) => typeof identity?.provider === 'string' && identity.provider !== 'anonymous',
  );
}

export async function currentSupabaseSession(): Promise<SupabaseUserSession | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  return { userId: data.session.user.id, isAnonymous: isAnonymousUser(data.session.user) };
}

/**
 * Returns a server-validated, recoverable account ID for paid-provider identity.
 * Anonymous/device-only Supabase users are deliberately ineligible for IAP.
 */
export async function currentRecoverableSupabaseUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !hasRecoverableUserIdentity(data.user)) return null;
  return data.user.id;
}

export async function ensureAnonymousSupabaseUser(): Promise<SupabaseUserSession> {
  const existing = await currentSupabaseSession();
  if (existing) return existing;

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase backend is not enabled.');

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Supabase anonymous sign-in failed.');
  }

  return { userId: data.user.id, isAnonymous: isAnonymousUser(data.user) };
}

function parseVerificationRow(data: unknown): OnlineDailyVerification {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Daily verification returned no row.');

  const record = row as { user_id?: unknown; server_time?: unknown; expires_at?: unknown };
  const userId = typeof record.user_id === 'string' ? record.user_id : '';
  const serverTimeMs =
    typeof record.server_time === 'string' ? Date.parse(record.server_time) : Number.NaN;
  const expiresAtMs =
    typeof record.expires_at === 'string' ? Date.parse(record.expires_at) : Number.NaN;

  if (!userId || Number.isNaN(serverTimeMs) || Number.isNaN(expiresAtMs)) {
    throw new Error('Daily verification returned malformed timestamps.');
  }

  return { userId, serverTimeMs, expiresAtMs };
}

export async function verifyDailyAuthorization(at = new Date()): Promise<OnlineDailyVerification> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase backend is not enabled.');

  const session = await currentSupabaseSession();
  if (!session) throw new Error('Supabase auth session is required before daily verification.');

  const { data, error } = await supabase.rpc('record_daily_verification', {
    p_client_seen_at: at.toISOString(),
    p_app_version: BUILD_INFO.appVersion,
    p_build_commit: BUILD_INFO.gitCommit,
  });

  if (error) throw new Error(error.message);
  return parseVerificationRow(data);
}
