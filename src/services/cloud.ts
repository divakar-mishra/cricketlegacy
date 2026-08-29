/**
 * Cloud-save synchronization foundation.
 *
 * With Supabase enabled, payloads are stored in `public.cloud_saves` under RLS
 * and scoped to the authenticated Supabase user. The AsyncStorage path remains
 * available for local development and deterministic tests.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentSupabaseSession, getSupabaseClient, isSupabaseBackendEnabled } from './supabaseClient';

export interface CloudSlot {
  slot: number;
  mode: string;
  updatedAt: number;
  checksum: string;
}

const DATA_PREFIX = 'cloud:data:';
const META_PREFIX = 'cloud:meta:';
const LAST_SYNC_KEY = 'cloud:lastSyncAt';

let lastSync: number | null = null;

/** Deterministic 32-bit djb2 checksum returned as eight hexadecimal characters. */
export function checksum(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index++) {
    hash = (Math.imul(hash, 33) + input.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Canonical JSON representation so object-key ordering cannot invalidate a remote checksum. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`)
    .join(',')}}`;
}

function parseSlot(key: string): { slot: number; mode: string } {
  const match = /(?:^|:)(career|manager):(\d+)$/.exec(key);
  if (match) return { mode: match[1], slot: Number(match[2]) };
  return { mode: 'unknown', slot: 0 };
}

function buildMeta(key: string, json: string): CloudSlot {
  const { slot, mode } = parseSlot(key);
  return { slot, mode, updatedAt: Date.now(), checksum: checksum(json) };
}

function schemaVersionOf(json: string): number | null {
  try {
    const parsed = JSON.parse(json) as { schemaVersion?: unknown };
    return typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : null;
  } catch {
    return null;
  }
}

function updatedAtOf(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { updatedAt?: unknown };
    return typeof parsed.updatedAt === 'number' ? new Date(parsed.updatedAt).toISOString() : null;
  } catch {
    return null;
  }
}

async function remoteIdentity() {
  if (!isSupabaseBackendEnabled()) return null;
  const [client, session] = await Promise.all([Promise.resolve(getSupabaseClient()), currentSupabaseSession()]);
  if (!client || !session) return null;
  return { client, userId: session.userId };
}

/** Upload a serialized save payload. */
export async function pushSave(key: string, json: string): Promise<{ ok: boolean }> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const saveJson = JSON.parse(json) as Record<string, unknown>;
      const meta = buildMeta(key, canonicalJSON(saveJson));
      const { error } = await remote.client.from('cloud_saves').upsert(
        {
          user_id: remote.userId,
          save_key: key,
          slot: meta.slot,
          mode: meta.mode,
          save_json: saveJson,
          checksum: meta.checksum,
          schema_version: schemaVersionOf(json),
          local_updated_at: updatedAtOf(json),
          remote_updated_at: new Date(meta.updatedAt).toISOString(),
        },
        { onConflict: 'user_id,save_key' },
      );
      if (error) return { ok: false };
      lastSync = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, String(lastSync));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  try {
    const meta = buildMeta(key, json);
    await AsyncStorage.setItem(DATA_PREFIX + key, json);
    await AsyncStorage.setItem(META_PREFIX + key, JSON.stringify(meta));
    lastSync = Date.now();
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(lastSync));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Download a serialized save payload. */
export async function pullSave(key: string): Promise<{ ok: boolean; json?: string }> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const { data, error } = await remote.client
        .from('cloud_saves')
        .select('save_json, checksum')
        .eq('save_key', key)
        .single();
      if (error || !data) return { ok: false };
      const row = data as { save_json?: unknown; checksum?: unknown };
      if (!row.save_json || typeof row.checksum !== 'string') return { ok: false };
      const normalizedJson = JSON.stringify(row.save_json);
      return checksum(canonicalJSON(row.save_json)) === row.checksum
        ? { ok: true, json: normalizedJson }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  try {
    const json = await AsyncStorage.getItem(DATA_PREFIX + key);
    if (json == null) return { ok: false };
    const metaRaw = await AsyncStorage.getItem(META_PREFIX + key);
    if (!metaRaw) return { ok: false };
    const meta = JSON.parse(metaRaw) as Partial<CloudSlot>;
    return typeof meta.checksum === 'string' && checksum(json) === meta.checksum
      ? { ok: true, json }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** List available remote slot metadata, newest first. */
export async function listRemote(): Promise<CloudSlot[]> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const { data, error } = await remote.client
        .from('cloud_saves')
        .select('slot, mode, remote_updated_at, checksum')
        .order('remote_updated_at', { ascending: false });
      if (error || !data) return [];
      return (data as { slot?: unknown; mode?: unknown; remote_updated_at?: unknown; checksum?: unknown }[]).map(
        (row) => ({
          slot: typeof row.slot === 'number' ? row.slot : 0,
          mode: typeof row.mode === 'string' ? row.mode : 'unknown',
          updatedAt: typeof row.remote_updated_at === 'string' ? Date.parse(row.remote_updated_at) : 0,
          checksum: typeof row.checksum === 'string' ? row.checksum : '',
        }),
      );
    } catch {
      return [];
    }
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    const metaKeys = keys.filter((key) => key.startsWith(META_PREFIX));
    if (metaKeys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(metaKeys);
    const slots: CloudSlot[] = [];
    for (const [, value] of entries) {
      if (!value) continue;
      try {
        slots.push(JSON.parse(value) as CloudSlot);
      } catch {
        // Ignore corrupt metadata while keeping other slots available.
      }
    }
    return slots.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function lastSyncAt(): number | null {
  return lastSync;
}

void (async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (raw != null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) lastSync = parsed;
    }
  } catch {
    // Last-sync metadata is informational and must never block app startup.
  }
})();
