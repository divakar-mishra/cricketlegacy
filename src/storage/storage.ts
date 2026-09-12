import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';

const CHUNK_THRESHOLD = 512 * 1024;
const CHUNK_SIZE = 256 * 1024;
const CHUNK_MANIFEST_SUFFIX = ':__chunk_manifest';
let chunkGeneration = 0;

interface ChunkManifest {
  __chunked: 1;
  generation: string;
  chunkCount: number;
  length: number;
}

interface OversizedStorageMigrationModule {
  migrateLegacyValue(key: string, chunkSize: number): Promise<boolean>;
}

const oversizedStorageMigration = requireOptionalNativeModule<OversizedStorageMigrationModule>(
  'OversizedStorageMigrationModule',
);

function manifestKey(key: string): string {
  return `${key}${CHUNK_MANIFEST_SUFFIX}`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${key}:__chunk:${generation}:${index}`;
}

function parseManifest(raw: string | null): ChunkManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkManifest>;
    if (
      parsed.__chunked !== 1 ||
      typeof parsed.generation !== 'string' ||
      !Number.isInteger(parsed.chunkCount) ||
      (parsed.chunkCount ?? 0) <= 0 ||
      !Number.isInteger(parsed.length) ||
      (parsed.length ?? -1) < 0
    ) {
      return null;
    }
    return parsed as ChunkManifest;
  } catch {
    return null;
  }
}

async function readManifest(key: string): Promise<ChunkManifest | null> {
  return parseManifest(await AsyncStorage.getItem(manifestKey(key)));
}

async function readChunkedValue(key: string, manifest: ChunkManifest): Promise<string> {
  const keys = Array.from({ length: manifest.chunkCount },
    (_, index) => chunkKey(key, manifest.generation, index));
  const rows = new Map(await AsyncStorage.multiGet(keys));
  const chunks: string[] = [];
  for (let index = 0; index < manifest.chunkCount; index += 1) {
    // Reconstruct in manifest order, never in the database's result order.
    const chunk = rows.get(keys[index]);
    if (chunk == null)
      throw new Error(`Missing storage chunk ${index + 1}/${manifest.chunkCount}.`);
    chunks.push(chunk);
  }
  const raw = chunks.join('');
  if (raw.length !== manifest.length) throw new Error('Chunked storage length mismatch.');
  return raw;
}

async function readStoredValue(key: string): Promise<string | null> {
  const rawManifest = await AsyncStorage.getItem(manifestKey(key));
  const manifest = parseManifest(rawManifest);
  if (rawManifest !== null && !manifest) throw new Error('Invalid storage manifest.');
  if (manifest) return readChunkedValue(key, manifest);
  return AsyncStorage.getItem(key);
}

function oversizedRowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Row too big|CursorWindow|SQLiteBlobTooBig/i.test(message);
}

async function migrateOversizedLegacyRow(key: string, error: unknown): Promise<boolean> {
  if (!oversizedStorageMigration || !oversizedRowError(error)) return false;
  return oversizedStorageMigration.migrateLegacyValue(key, CHUNK_SIZE);
}

function splitIntoChunks(raw: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < raw.length) {
    let end = Math.min(raw.length, start + CHUNK_SIZE);
    // Do not separate a UTF-16 surrogate pair across two native string writes.
    if (
      end < raw.length &&
      end > start &&
      /[\uD800-\uDBFF]/.test(raw.charAt(end - 1)) &&
      /[\uDC00-\uDFFF]/.test(raw.charAt(end))
    ) {
      end -= 1;
    }
    chunks.push(raw.slice(start, end));
    start = end;
  }
  return chunks;
}

async function removeManifestChunks(key: string, manifest: ChunkManifest | null): Promise<void> {
  if (!manifest) return;
  await AsyncStorage.multiRemove(Array.from({ length: manifest.chunkCount },
    (_, index) => chunkKey(key, manifest.generation, index)));
}

/** Thin typed JSON wrapper around AsyncStorage. */
export async function getJSONStrict<T>(key: string): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await readStoredValue(key);
  } catch (error) {
    if (!(await migrateOversizedLegacyRow(key, error))) throw error;
    raw = await readStoredValue(key);
  }
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as T;
  if (parsed === null) throw new Error('Stored JSON null is not an empty slot.');
  return parsed;
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await readStoredValue(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    try {
      if (await migrateOversizedLegacyRow(key, err)) {
        const raw = await readStoredValue(key);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch (migrationError) {
      console.warn(`storage oversized-row migration failed for ${key}`, migrationError);
    }
    console.warn(`storage.getJSON failed for ${key}`, err);
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    const previousManifest = await readManifest(key);
    if (raw.length <= CHUNK_THRESHOLD) {
      await AsyncStorage.setItem(key, raw);
      // Removing the manifest is the commit point: readers use the new raw row
      // only after it succeeds. Old chunks are then harmless cleanup work.
      await AsyncStorage.removeItem(manifestKey(key));
      try {
        await removeManifestChunks(key, previousManifest);
      } catch (cleanupError) {
        console.warn(`storage chunk cleanup failed for ${key}`, cleanupError);
      }
      return;
    }

    const generation = `${Date.now().toString(36)}-${(chunkGeneration += 1).toString(36)}`;
    const chunks = splitIntoChunks(raw);
    // One native batch/SQLite transaction, instead of a round trip and
    // transaction for every chunk. Publish the manifest only after success.
    await AsyncStorage.multiSet(chunks.map((chunk, index) =>
      [chunkKey(key, generation, index), chunk] as [string, string]));
    const nextManifest: ChunkManifest = {
      __chunked: 1,
      generation,
      chunkCount: chunks.length,
      length: raw.length,
    };
    // The small manifest is the atomic pointer swap. Until it succeeds, the
    // previous raw/manifest representation remains authoritative.
    await AsyncStorage.setItem(manifestKey(key), JSON.stringify(nextManifest));
    try {
      await AsyncStorage.removeItem(key);
      await removeManifestChunks(key, previousManifest);
    } catch (cleanupError) {
      console.warn(`storage chunk cleanup failed for ${key}`, cleanupError);
    }
  } catch (err) {
    console.warn(`storage.setJSON failed for ${key}`, err);
    throw err;
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    const manifest = await readManifest(key);
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(manifestKey(key));
    await removeManifestChunks(key, manifest);
  } catch (err) {
    console.warn(`storage.removeKey failed for ${key}`, err);
    throw err;
  }
}

/** Remove every AsyncStorage value owned by this app. Used only by the explicit delete-data flow. */
export async function clearAllLocalData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.warn('storage.clearAllLocalData failed', err);
    throw err;
  }
}
