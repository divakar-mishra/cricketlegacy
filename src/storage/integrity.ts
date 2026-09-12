/**
 * Save integrity: a checksum envelope so a half-written or corrupted blob is
 * detected on load (and the caller can fall back to a backup) instead of a save
 * silently vanishing. Pure + dependency-free so it's fully unit-testable.
 */
import { SaveGame } from '../domain/types';

export interface SaveEnvelope {
  __env: 1;
  checksum: string;
  save: SaveGame;
}

/** Deterministic FNV-1a checksum of a value's JSON form. */
export function checksumOf(value: unknown): string {
  return checksumJSON(JSON.stringify(value) ?? '');
}

function checksumJSON(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Wrap a save in a checksum envelope for writing. */
export function wrapSave(save: SaveGame): SaveEnvelope {
  return { __env: 1, checksum: checksumOf(save), save };
}

/** Same envelope bytes as JSON.stringify(wrapSave(save)), with one save traversal. */
export function serializeSaveEnvelope(save: SaveGame): string {
  const json = JSON.stringify(save);
  return `{"__env":1,"checksum":"${checksumJSON(json)}","save":${json}}`;
}

export function isEnvelope(raw: unknown): raw is SaveEnvelope {
  return Boolean(raw) && typeof raw === 'object' && (raw as { __env?: unknown }).__env === 1;
}

/**
 * Recover a save from a stored blob: verifies the checksum for enveloped saves
 * (returns null if it doesn't match → corrupt), and transparently accepts a
 * legacy pre-envelope raw save. Returns null for anything unusable.
 */
export function unwrapSave(raw: unknown): SaveGame | null {
  if (!raw || typeof raw !== 'object') return null;
  if (isEnvelope(raw)) {
    if (checksumOf(raw.save) !== raw.checksum) return null; // tampered / truncated
    return raw.save;
  }
  // Legacy raw save written before the envelope existed.
  if (typeof (raw as { schemaVersion?: unknown }).schemaVersion === 'number') {
    return raw as SaveGame;
  }
  return null;
}
