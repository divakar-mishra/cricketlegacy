import { GameMode, SaveGame } from '../domain/types';
import { isSeasonPassActive } from '../game/seasonPass';
import { syncVipArchive } from '../services/vipArchive';
import { deleteSaveKey, markSaveSealed, openSave, sealSave, verifySaveIdentity } from './saveEncryption';
import { runMigrations } from './migrate';
import { getJSON, getJSONStrict, removeKey, setJSON } from './storage';

export const BASE_MAX_SLOTS = 5;
export const MAX_SLOTS = 6;
const LAST_PLAYED_KEY = 'sg:lastPlayed';
const slotKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}`;
const bakKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}:bak`;
const slotOperationQueues = new Map<string, Promise<unknown>>();
const traceSaveTiming = () => (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_QA_TOOLS === 'true';

function enqueueSlotOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = slotOperationQueues.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(operation);
  slotOperationQueues.set(key, queued);
  const cleanup = () => {
    if (slotOperationQueues.get(key) === queued) slotOperationQueues.delete(key);
  };
  void queued.then(cleanup, cleanup);
  return queued;
}

export interface SlotView {
  slot: number;
  save: SaveGame | null;
  unavailable?: boolean;
}
export interface LastPlayed {
  mode: GameMode;
  slot: number;
}

async function readCopy(key: string, context: string) {
  try {
    const raw = await getJSONStrict<unknown>(key);
    return { raw, save: await openSave(raw, context), occupied: raw !== null };
  } catch {
    return { raw: null, save: null, occupied: true };
  }
}

async function readBackupCandidate(key: string, context: string) {
  try {
    // Read actual storage even on the fast path. Only byte-identical, previously
    // authenticated ciphertext can bypass repeated decryption/checksumming.
    const raw = await getJSONStrict<unknown>(key);
    return { raw, save: await verifySaveIdentity(raw, context), occupied: raw !== null };
  } catch {
    return { raw: null, save: null, occupied: true };
  }
}

export class SaveUnavailableError extends Error {
  constructor() {
    super(
      'This save could not be verified or decrypted. Your data has been kept. Retry or recover your cloud backup; do not uninstall the app.',
    );
    this.name = 'SaveUnavailableError';
  }
}

export function loadSave(mode: GameMode, slot: number): Promise<SaveGame | null> {
  const key = slotKey(mode, slot);
  return enqueueSlotOperation(key, async () => {
    const primary = await readCopy(key, key);
    const backup = await readCopy(bakKey(mode, slot), key);
    const saved = primary.save ?? backup.save;
    if (!saved) {
      if (primary.occupied || backup.occupied) throw new SaveUnavailableError();
      return null;
    }
    // Migrate both readable copies before closing the legacy-format gate.
    // No timestamps/progress are changed by encryption migration.
    if (backup.save && (backup.raw as { __env?: number })?.__env !== 2) {
      await setJSON(bakKey(mode, slot), await sealSave(backup.save, key));
    }
    if (primary.save && (primary.raw as { __env?: number })?.__env !== 2) {
      await setJSON(key, await sealSave(primary.save, key));
    }
    await markSaveSealed(key);
    const migrated = runMigrations(saved);
    if (migrated) {
      try { await syncVipArchive(migrated); }
      catch { console.warn('VIP archive unavailable; existing save data preserved.'); }
    }
    return migrated;
  });
}

async function writeSaveNow(mode: GameMode, slot: number, save: SaveGame): Promise<void> {
  const trace = traceSaveTiming();
  const startedAt = trace ? performance.now() : 0;
  const key = slotKey(mode, slot);
  // Roll the last-known-good primary into the backup before overwriting it, so a
  // failure mid-write leaves a recoverable previous state.
  const previous = await readBackupCandidate(key, key);
  // A verified primary is already the next rolling backup. Only decrypt the
  // existing backup when recovery is actually needed.
  const backup = previous.save
    ? { raw: null, save: null, occupied: false }
    : await readBackupCandidate(bakKey(mode, slot), key);
  if (!previous.save && !backup.save && (previous.occupied || backup.occupied)) {
    throw new SaveUnavailableError();
  }
  if (previous.save && previous.save.id !== save.id) throw new Error('Save slot is occupied.');
  if (backup.save && !previous.save && backup.save.id !== save.id)
    throw new Error('Save slot is occupied.');
  const verifiedAt = trace ? performance.now() : 0;
  const next = await sealSave(save, key);
  const sealedAt = trace ? performance.now() : 0;
  const lastGood = previous.save ?? backup.save;
  if (lastGood) {
    const lastGoodRaw = previous.save ? previous.raw : backup.raw;
    // The authenticated ciphertext is bound to this slot (not the :bak key).
    // Copy it unchanged; only new plaintext needs a fresh encryption nonce.
    if ((lastGoodRaw as { __env?: number })?.__env === 2) {
      await setJSON(bakKey(mode, slot), lastGoodRaw);
    } else {
      const legacySave = await openSave(lastGoodRaw, key);
      if (!legacySave) throw new SaveUnavailableError();
      await setJSON(bakKey(mode, slot), await sealSave(legacySave, key));
    }
  }
  const backedUpAt = trace ? performance.now() : 0;
  await setJSON(key, next);
  const writtenAt = trace ? performance.now() : 0;
  await markSaveSealed(key);
  if (trace) console.info('[save stages]', {
    verifyPreviousMs: Math.round(verifiedAt - startedAt),
    sealMs: Math.round(sealedAt - verifiedAt),
    backupWriteMs: Math.round(backedUpAt - sealedAt),
    primaryWriteMs: Math.round(writtenAt - backedUpAt),
    sealMarkerMs: Math.round(performance.now() - writtenAt),
  });
}

/**
 * Serialize writes per slot. Gameplay can request several saves in quick
 * succession; without a queue, an older AsyncStorage write may finish after a
 * newer one and roll the slot backwards.
 */
export function writeSave(mode: GameMode, slot: number, save: SaveGame): Promise<void> {
  const key = slotKey(mode, slot);
  const trace = traceSaveTiming();
  const startedAt = trace ? performance.now() : 0;
  save.updatedAt = Date.now();
  const snapshot = JSON.parse(JSON.stringify(save)) as SaveGame;
  const snapshotAt = trace ? performance.now() : 0;
  return enqueueSlotOperation(key, () => {
    if (trace) console.info('[save queue]', {
      snapshotMs: Math.round(snapshotAt - startedAt),
      waitMs: Math.round(performance.now() - snapshotAt),
    });
    return writeSaveNow(mode, slot, snapshot);
  });
}

export function deleteSave(mode: GameMode, slot: number): Promise<void> {
  const key = slotKey(mode, slot);
  return enqueueSlotOperation(key, async () => {
    // Wait behind any pending save for this slot so a late write cannot
    // resurrect a career after the player confirms deletion.
    await removeKey(key);
    await removeKey(bakKey(mode, slot));
    await deleteSaveKey(key);
  });
}

export async function listSlots(mode: GameMode): Promise<SlotView[]> {
  const out: SlotView[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    try {
      out.push({ slot, save: await loadSave(mode, slot) });
    } catch {
      console.warn(`Save ${mode} slot ${slot} unavailable; data preserved.`);
      out.push({ slot, save: null, unavailable: true });
    }
  }
  return out;
}

export function firstFreeSlot(slots: SlotView[]): number | null {
  const premiumSlotUnlocked = slots.some((entry) => isSeasonPassActive(entry.save ?? undefined));
  return (
    slots.find(
      (entry) =>
        !entry.save && !entry.unavailable && (entry.slot <= BASE_MAX_SLOTS || premiumSlotUnlocked),
    )?.slot ?? null
  );
}

export async function setLastPlayed(mode: GameMode, slot: number): Promise<void> {
  await setJSON(LAST_PLAYED_KEY, { mode, slot } satisfies LastPlayed);
}

export interface ResolvedSave {
  mode: GameMode;
  slot: number;
  save: SaveGame;
}

export async function getLastPlayed(): Promise<ResolvedSave | null> {
  const ptr = await getJSON<LastPlayed>(LAST_PLAYED_KEY);
  if (!ptr) return null;
  const save = await loadSave(ptr.mode, ptr.slot).catch(() => {
    console.warn('Last-played save unavailable; inspect Saved Games for recovery.');
    return null;
  });
  return save ? { mode: ptr.mode, slot: ptr.slot, save } : null;
}

export async function listAllSaves(): Promise<ResolvedSave[]> {
  const modes: GameMode[] = ['career', 'manager'];
  const out: ResolvedSave[] = [];
  for (const mode of modes) {
    for (const { slot, save } of await listSlots(mode)) {
      if (save) out.push({ mode, slot, save });
    }
  }
  return out.sort((a, b) => b.save.updatedAt - a.save.updatedAt);
}
