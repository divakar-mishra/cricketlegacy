/**
 * Cloud-save sync abstraction.
 *
 * When Supabase is enabled this talks to `public.cloud_saves` under RLS, scoped
 * to the signed-in Supabase Auth user. When Supabase is disabled, it falls back
 * to the old local-only AsyncStorage simulation for development tests only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentSupabaseSession, getSupabaseClient, isSupabaseBackendEnabled } from './supabaseClient';

export interface CloudSlot {
  slot: number;
  mode: string;
  updatedAt: number;
  /** Checksum of the stored payload (see {@link checksum}). */
  checksum: string;
}

const DATA_PREFIX = 'cloud:data:';
const META_PREFIX = 'cloud:meta:';
const LAST_SYNC_KEY = 'cloud:lastSyncAt';

let lastSync: number | null = null;

/**
 * Deterministic 32-bit djb2 checksum of a string, returned as 8 hex chars.
 * Used to detect divergence between local and remote payloads.
 */
export function checksum(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + char, kept within 32 bits via Math.imul.
    hash = (Math.imul(hash, 33) + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Best-effort parse of `mode`/`slot` from a `sg:<mode>:<slot>`-style key. */
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
    const parsed = JSON.parse(json) as { schemaVersion?: unknown; updatedAt?: unknown };
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

/** Uploads a save payload to the (simulated) remote. */
export async function pushSave(key: string, json: string): Promise<{ ok: boolean }> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const meta = buildMeta(key, json);
      const saveJson = JSON.parse(json) as Record<string, unknown>;
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

/** Downloads a save payload from the (simulated) remote. */
export async function pullSave(key: string): Promise<{ ok: boolean; json?: string }> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const { data, error } = await remote.client.from('cloud_saves').select('save_json').eq('save_key', key).single();
      if (error || !data) return { ok: false };
      const row = data as { save_json?: unknown };
      return row.save_json ? { ok: true, json: JSON.stringify(row.save_json) } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  try {
    const json = await AsyncStorage.getItem(DATA_PREFIX + key);
    if (json == null) return { ok: false };
    return { ok: true, json };
  } catch {
    return { ok: false };
  }
}

/** Lists metadata for all remote slots, most-recently-updated first. */
export async function listRemote(): Promise<CloudSlot[]> {
  const remote = await remoteIdentity();
  if (remote) {
    try {
      const { data, error } = await remote.client
        .from('cloud_saves')
        .select('slot, mode, remote_updated_at, checksum')
        .order('remote_updated_at', { ascending: false });
      if (error || !data) return [];
      return (data as { slot?: unknown; mode?: unknown; remote_updated_at?: unknown; checksum?: unknown }[]).map((row) => ({
        slot: typeof row.slot === 'number' ? row.slot : 0,
        mode: typeof row.mode === 'string' ? row.mode : 'unknown',
        updatedAt: typeof row.remote_updated_at === 'string' ? Date.parse(row.remote_updated_at) : 0,
        checksum: typeof row.checksum === 'string' ? row.checksum : '',
      }));
    } catch {
      return [];
    }
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    const metaKeys = keys.filter((k) => k.startsWith(META_PREFIX));
    if (metaKeys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(metaKeys);
    const slots: CloudSlot[] = [];
    for (const [, value] of entries) {
      if (!value) continue;
      try {
        slots.push(JSON.parse(value) as CloudSlot);
      } catch {
        /* skip corrupt metadata */
      }
    }
    return slots.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Epoch millis of the last successful push, or `null` if never synced. */
export function lastSyncAt(): number | null {
  return lastSync;
}

// Hydrate the in-memory lastSync from storage on load (guarded, never throws).
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (raw != null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) lastSync = parsed;
    }
  } catch {
    /* ignore */
  }
})();
