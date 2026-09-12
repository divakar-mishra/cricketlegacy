/* eslint-disable @typescript-eslint/no-require-imports -- native modules are intentionally lazy */
import { Platform } from 'react-native';
import { QA_TOOLS_ENABLED } from '../config/qa';
import { ensureAnonymousSupabaseUser, getSupabaseClient } from './supabaseClient';

export type AppIntegrityStatus = 'VERIFIED' | 'REJECTED' | 'UNAVAILABLE' | 'OFFLINE' | 'SKIPPED';
const CACHE_KEY = 'cricket.integrity.lastVerdict.v1';
let pending: Promise<AppIntegrityStatus> | undefined;
let rejectedThisSession = false;
let lastVerifiedAt = 0;

async function verifyOnline(): Promise<'VERIFIED' | 'REJECTED' | 'UNAVAILABLE'> {
  const project = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER;
  if (!project || !/^\d+$/.test(project)) return 'UNAVAILABLE';
  const client = getSupabaseClient();
  if (!client) return 'UNAVAILABLE';
  await ensureAnonymousSupabaseUser();
  const integrity: typeof import('@expo/app-integrity') = require('@expo/app-integrity');
  await integrity.prepareIntegrityTokenProviderAsync(project);
  const challenge = await client.functions.invoke('verify-play-integrity', {
    body: { action: 'challenge' },
  });
  const requestHash = challenge.data?.requestHash;
  if (challenge.error || typeof requestHash !== 'string' || !/^[a-f0-9]{64}$/.test(requestHash))
    return 'UNAVAILABLE';
  const token = await integrity.requestIntegrityCheckAsync(requestHash);
  const result = await client.functions.invoke('verify-play-integrity', {
    body: { action: 'verify', token, requestHash },
  });
  if (result.error) return 'UNAVAILABLE';
  return result.data?.status === 'VERIFIED' || result.data?.status === 'REJECTED'
    ? result.data.status
    : 'UNAVAILABLE';
}

async function check(): Promise<AppIntegrityStatus> {
  if (
    Platform.OS !== 'android' ||
    QA_TOOLS_ENABLED ||
    process.env.EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED !== 'true'
  )
    return 'SKIPPED';
  const secure: typeof import('expo-secure-store') = require('expo-secure-store');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const status = await Promise.race([
      verifyOnline(),
      new Promise<'UNAVAILABLE'>((resolve) => {
        timer = setTimeout(() => resolve('UNAVAILABLE'), 25_000);
      }),
    ]);
    if (status !== 'UNAVAILABLE') {
      rejectedThisSession = status === 'REJECTED';
      lastVerifiedAt = status === 'VERIFIED' ? Date.now() : 0;
      // A cache write failure must never turn a fresh rejection into an old pass.
      await secure.setItemAsync(CACHE_KEY, status).catch(() => undefined);
      return status;
    }
  } catch {
    // Missing Play services / offline / server outage are not proof of cheating.
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (rejectedThisSession) return 'REJECTED';
  const last = await secure.getItemAsync(CACHE_KEY).catch(() => null);
  return last === 'REJECTED' ? 'REJECTED' : last === 'VERIFIED' ? 'OFFLINE' : 'UNAVAILABLE';
}

export function checkAppIntegrity(reuseRecentVerification = false): Promise<AppIntegrityStatus> {
  // A checkout immediately after launch must not hit the challenge issue throttle.
  // Only reuse a live pass in this process, never an offline persisted verdict.
  if (
    !pending &&
    reuseRecentVerification &&
    !rejectedThisSession &&
    lastVerifiedAt > 0 &&
    Date.now() - lastVerifiedAt < 15_000
  )
    return Promise.resolve('VERIFIED');
  if (!pending) {
    pending = check()
      .catch((): AppIntegrityStatus => 'UNAVAILABLE')
      .finally(() => {
        pending = undefined;
      });
  }
  return pending;
}
