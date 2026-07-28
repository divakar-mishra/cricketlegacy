import { currentUser, rehydrateAuth } from './auth';
import { isOnline } from './connectivity';
import { isSupabaseBackendEnabled, verifyDailyAuthorization } from './supabaseClient';
import { getJSON, setJSON } from '../storage/storage';

const DAILY_LOGIN_KEY = 'auth:lastDailyLoginDay';
const DAILY_VERIFICATION_KEY = 'auth:lastDailyVerification';
export const OFFLINE_AUTH_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

interface DailyVerification {
  verifiedAtMs: number;
  expiresAtMs: number;
  lastSeenAtMs: number;
  source?: 'local' | 'supabase';
  deviceVerifiedAtMs?: number;
  userId?: string;
}

export interface DailySessionStatus {
  allowed: boolean;
  online: boolean;
  signedIn: boolean;
  validToday: boolean;
  today: string;
  lastLoginDay: string | null;
  validUntilMs: number | null;
  reason?: 'LOGIN_REQUIRED' | 'OFFLINE_LOGIN_REQUIRED' | 'CLOCK_ROLLBACK_DETECTED';
}

/** Local calendar day key. This keeps the once-per-day gate understandable to players. */
export function localDayKey(at = new Date()): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function lastDailyLoginDay(): Promise<string | null> {
  return getJSON<string>(DAILY_LOGIN_KEY);
}

async function lastDailyVerification(): Promise<DailyVerification | null> {
  const verification = await getJSON<DailyVerification>(DAILY_VERIFICATION_KEY);
  if (
    !verification ||
    typeof verification.verifiedAtMs !== 'number' ||
    typeof verification.expiresAtMs !== 'number' ||
    typeof verification.lastSeenAtMs !== 'number'
  ) {
    return null;
  }
  return verification;
}

export async function recordDailyLogin(at = new Date()): Promise<string> {
  const deviceNowMs = at.getTime();
  const onlineVerification = isSupabaseBackendEnabled() ? await verifyDailyAuthorization(at) : null;
  const verifiedAtMs = onlineVerification?.serverTimeMs ?? deviceNowMs;
  const today = localDayKey(new Date(verifiedAtMs));
  await setJSON(DAILY_LOGIN_KEY, today);
  await setJSON(DAILY_VERIFICATION_KEY, {
    verifiedAtMs,
    expiresAtMs: onlineVerification?.expiresAtMs ?? verifiedAtMs + OFFLINE_AUTH_WINDOW_MS,
    lastSeenAtMs: deviceNowMs,
    source: onlineVerification ? 'supabase' : 'local',
    deviceVerifiedAtMs: deviceNowMs,
    userId: onlineVerification?.userId,
  });
  return today;
}

function effectiveAuthorizationNowMs(verification: DailyVerification | null, deviceNowMs: number): number {
  if (verification?.source === 'supabase' && typeof verification.deviceVerifiedAtMs === 'number') {
    const elapsedLocalMs = Math.max(0, deviceNowMs - verification.deviceVerifiedAtMs);
    return verification.verifiedAtMs + elapsedLocalMs;
  }
  return deviceNowMs;
}

export async function dailySessionStatus(at = new Date()): Promise<DailySessionStatus> {
  const [online, lastLoginDay, verification] = await Promise.all([isOnline(), lastDailyLoginDay(), lastDailyVerification()]);
  const user = currentUser() ?? (await rehydrateAuth());
  const today = localDayKey(at);
  const nowMs = at.getTime();
  const signedIn = Boolean(user);
  const clockRolledBack = Boolean(verification && nowMs + CLOCK_ROLLBACK_TOLERANCE_MS < verification.lastSeenAtMs);
  const authorizationNowMs = effectiveAuthorizationNowMs(verification, nowMs);
  const withinWindow = Boolean(verification && authorizationNowMs <= verification.expiresAtMs);
  const validToday = signedIn && withinWindow && !clockRolledBack;

  if (validToday) {
    await setJSON(DAILY_VERIFICATION_KEY, {
      ...(verification as DailyVerification),
      lastSeenAtMs: Math.max(nowMs, (verification as DailyVerification).lastSeenAtMs),
    });
    return { allowed: true, online, signedIn, validToday, today, lastLoginDay, validUntilMs: verification?.expiresAtMs ?? null };
  }

  return {
    allowed: false,
    online,
    signedIn,
    validToday,
    today,
    lastLoginDay,
    validUntilMs: verification?.expiresAtMs ?? null,
    reason: clockRolledBack ? 'CLOCK_ROLLBACK_DETECTED' : online ? 'LOGIN_REQUIRED' : 'OFFLINE_LOGIN_REQUIRED',
  };
}
