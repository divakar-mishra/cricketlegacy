import { GameMode, SaveGame } from '../domain/types';
import { isSeasonPassActive } from '../game/seasonPass';
import { syncVipArchive } from '../services/vipArchive';
import { assertNoPendingPurchaseForSlot } from '../services/purchaseRecovery';
import { deleteSaveKey, markSaveSealed, openSave, openSaveSummary, sealSave, sealSaveSummary, verifySaveIdentity } from './saveEncryption';
import { SaveSummary, summarizeSave, validSummary } from './saveSummary';
import { checksumOf } from './integrity';
import { runMigrations } from './migrate';
import { getJSON, getJSONStrict, hasStoredValue, removeKey, setJSON } from './storage';
import { backupBindings, backupOwner, BackupBinding, bindRecoveredSave, deleteAccountBackup, markBackupDirty, reportBackupWriteFailure } from './accountBackupJournal';

export const BASE_MAX_SLOTS = 5;
export const MAX_SLOTS = 6;
const LAST_PLAYED_KEY = 'sg:lastPlayed';
const slotKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}`;
const bakKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}:bak`;
const summaryKey = (mode: GameMode, slot: number): string => `sg:summary:v1:${mode}:${slot}`;
const slotOperationQueues = new Map<string, Promise<unknown>>();
// Revokes references still held by a screen or an in-flight autosave. A newly
// created career has a different identity and can still reuse the slot.
const deletedSaveIds = new Map<string, Set<string>>();
export class SaveDeletedError extends Error {
  constructor() { super('This career has been deleted.'); this.name = 'SaveDeletedError'; }
}
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
export interface SummarySlot { slot: number; summary: SaveSummary | null; unavailable?: boolean }
export interface ReadOptions { signal?: AbortSignal; isCurrent?: () => boolean }
function checkRead(options?: ReadOptions) {
  if (options?.signal?.aborted || options?.isCurrent?.() === false) {
    const error = new Error('Save loading cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
function copyToken(raw: unknown): string {
  const data = (raw as { data?: string } | null)?.data;
  // AES-GCM's authenticated tag identifies the committed encrypted snapshot.
  return typeof data === 'string' ? data.slice(-32) : '';
}
async function publishSummary(mode: GameMode, slot: number, save: SaveGame, token: string, checkedChecksum?: string) {
  if (!token) return;
  const summary = { ...summarizeSave(save, token), checkedChecksum };
  try {
    await setJSON(summaryKey(mode, slot), await sealSaveSummary(summary, slotKey(mode, slot)));
  } catch {
    // Derived metadata must never turn a durable save/purchase into a failure.
    console.warn('Career summary pending; full verified loading remains available.');
  }
  return summary;
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

async function loadSnapshotNow(mode: GameMode, slot: number, options?: ReadOptions, forIndex = false) {
  const key = slotKey(mode, slot);
  checkRead(options);
  const primary = await readCopy(key, key);
  checkRead(options);
  const backup = await readCopy(bakKey(mode, slot), key);
  checkRead(options);
  const saved = primary.save ?? backup.save;
  if (!saved) {
    if (primary.occupied || backup.occupied) throw new SaveUnavailableError();
    return { save: null, token: '', summary: undefined };
  }
  // Migrate both readable copies before closing the legacy-format gate.
  // No timestamps/progress are changed by encryption migration.
  if (backup.save && (backup.raw as { __env?: number })?.__env !== 2) {
    backup.raw = await sealSave(backup.save, key);
    await setJSON(bakKey(mode, slot), backup.raw);
  }
  if (primary.save && (primary.raw as { __env?: number })?.__env !== 2) {
    primary.raw = await sealSave(primary.save, key);
    await setJSON(key, primary.raw);
  }
  await markSaveSealed(key);
  const migrated = runMigrations(saved);
  if (!migrated) throw new SaveUnavailableError();
  try { await syncVipArchive(migrated); }
  catch { console.warn('VIP archive unavailable; existing save data preserved.'); }
  checkRead(options);
  const summary = await publishSummary(mode, slot, migrated, copyToken(primary.save ? primary.raw : backup.raw),
    forIndex ? checksumOf(JSON.stringify(migrated)) : undefined);
  return { save: migrated, token: copyToken(primary.save ? primary.raw : backup.raw), summary };
}

export function loadSaveSnapshot(mode: GameMode, slot: number, options?: ReadOptions) {
  return enqueueSlotOperation(slotKey(mode, slot), () => loadSnapshotNow(mode, slot, options));
}

export async function loadSave(mode: GameMode, slot: number, options?: ReadOptions): Promise<SaveGame | null> {
  return (await loadSaveSnapshot(mode, slot, options)).save;
}

async function readSlotSummary(mode: GameMode, slot: number, options?: ReadOptions): Promise<SummarySlot> {
  return enqueueSlotOperation(slotKey(mode, slot), async () => {
    checkRead(options);
    try {
      // Never trust an index entry as evidence that a slot is empty.
      const occupied = await hasStoredValue(slotKey(mode, slot)) || await hasStoredValue(bakKey(mode, slot));
      checkRead(options);
      if (!occupied) return { slot, summary: null };
      let cached: unknown;
      try { cached = await openSaveSummary(await getJSONStrict(summaryKey(mode, slot)), slotKey(mode, slot)); }
      catch { /* Missing, old, corrupt or key-lost indexes use the verified fallback. */ }
      checkRead(options);
      if (validSummary(cached, mode)) return { slot, summary: cached };
      const { save, token, summary } = await loadSnapshotNow(mode, slot, options, true);
      return { slot, summary: summary ?? (save ? summarizeSave(save, token) : null) };
    } catch (error) {
      checkRead(options);
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return { slot, summary: null, unavailable: true };
    }
  });
}

/** At most one cold verified scan; subsequent focus/tab/backup refreshes read only small encrypted metadata. */
export async function listSlotSummaries(mode: GameMode, options?: ReadOptions): Promise<SummarySlot[]> {
  const result: SummarySlot[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    checkRead(options);
    result.push(await readSlotSummary(mode, slot, options));
    // Let Back/input and already queued critical saves run between slots.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  checkRead(options);
  return result;
}

async function writeSaveNow(mode: GameMode, slot: number, save: SaveGame, expectedId?: string): Promise<void> {
  const trace = traceSaveTiming();
  const startedAt = trace ? performance.now() : 0;
  const key = slotKey(mode, slot);
  if (deletedSaveIds.get(key)?.has(save.id)) throw new SaveDeletedError();
  const bindings = await backupBindings().catch(() => null);
  if (bindings?.some((entry) => entry.saveId === save.id && entry.deleted)) throw new SaveDeletedError();
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
  const occupiedId = (previous.save ?? backup.save)?.id;
  if (expectedId !== undefined && occupiedId !== expectedId)
    throw new Error('The destination career changed. Reopen it before importing.');
  if (occupiedId && occupiedId !== save.id && occupiedId !== expectedId)
    throw new Error('Save slot is occupied.');
  const verifiedAt = trace ? performance.now() : 0;
  const next = await sealSave(save, key);
  const sealedAt = trace ? performance.now() : 0;
  // Invalidate BEFORE touching either copy. Interrupted/failed writes can never
  // leave an older sidecar claiming to describe a newly committed snapshot.
  await removeKey(summaryKey(mode, slot));
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
  await publishSummary(mode, slot, save, copyToken(next));
  if (trace) console.info('[save stages]', {
    verifyPreviousMs: Math.round(verifiedAt - startedAt),
    sealMs: Math.round(sealedAt - verifiedAt),
    backupWriteMs: Math.round(backedUpAt - sealedAt),
    primaryWriteMs: Math.round(writtenAt - backedUpAt),
    sealMarkerMs: Math.round(performance.now() - writtenAt),
  });
}

/** Explicit Player Life replacement, never the ordinary autosave path. */
export function replaceSave(mode: GameMode, slot: number, save: SaveGame, expectedId: string): Promise<void> {
  const key = slotKey(mode, slot);
  const snapshot = JSON.parse(JSON.stringify(save)) as SaveGame;
  const capturedOwner = backupOwner();
  return enqueueSlotOperation(key, async () => {
    await assertNoPendingPurchaseForSlot(mode, slot);
    await writeSaveNow(mode, slot, snapshot, expectedId);
    await recordBackupWrite(snapshot, slot, capturedOwner);
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
  const capturedOwner = backupOwner();
  return enqueueSlotOperation(key, async () => {
    if (trace) console.info('[save queue]', {
      snapshotMs: Math.round(snapshotAt - startedAt),
      waitMs: Math.round(performance.now() - snapshotAt),
    });
    await writeSaveNow(mode, slot, snapshot);
    await recordBackupWrite(snapshot, slot, capturedOwner);
  });
}

async function recordBackupWrite(save: SaveGame, slot: number, capturedOwner: string | null) {
  // Reserved QA capture slots are device-only. They are not account careers
  // and must never poison the six-slot backup journal or reach the server.
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) return;
  try { await markBackupDirty(save.id, save.mode, slot, capturedOwner); }
  catch {
    // Local persistence has succeeded. A network/metadata failure must not turn
    // a fulfilled purchase into a failed purchase or block offline progression.
    console.warn('Account backup pending; local career retained. Retry backup from Account.');
    reportBackupWriteFailure();
  }
}

/** Recovery only fills an authenticated, empty slot; it never rolls back an active career. */
export function recoverSaveToEmptySlot(save: SaveGame, binding: BackupBinding, stillSignedIn: () => boolean): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(save)) as SaveGame;
  const key = slotKey(binding.mode, binding.slot);
  return enqueueSlotOperation(key, async () => {
    if (!stillSignedIn() || snapshot.mode !== binding.mode || snapshot.id !== binding.saveId) {
      throw new Error('The backup account changed.');
    }
    const primary = await readCopy(key, key);
    const backup = await readCopy(bakKey(binding.mode, binding.slot), key);
    if (primary.occupied || backup.occupied) throw new Error('Recovery destination is no longer empty. Nothing was overwritten.');
    await assertNoPendingPurchaseForSlot(binding.mode, binding.slot);
    const sealed = await sealSave(snapshot, key);
    if (!stillSignedIn()) throw new Error('The backup account changed.');
    await bindRecoveredSave(binding);
    // Binding is another asynchronous write. Sign-out/account switching during
    // it must invalidate recovery before the career becomes visible on disk.
    if (!stillSignedIn()) throw new Error('The backup account changed.');
    // Keep the original updatedAt and absolute ad-free expiry. This is a state
    // restore, not a new purchase, grant, or extension of a paid timer.
    await removeKey(summaryKey(binding.mode, binding.slot));
    await setJSON(key, sealed);
    await markSaveSealed(key);
    await publishSummary(binding.mode, binding.slot, snapshot, copyToken(sealed));
  });
}

export function deleteSave(mode: GameMode, slot: number, expectedSaveId?: string): Promise<void> {
  const key = slotKey(mode, slot);
  return enqueueSlotOperation(key, async () => {
    // Wait behind any pending save for this slot so a late write cannot
    // resurrect a career after the player confirms deletion.
    await assertNoPendingPurchaseForSlot(mode, slot);
    const primary = await readBackupCandidate(key, key);
    const backup = await readBackupCandidate(bakKey(mode, slot), key);
    const existingId = (primary.save ?? backup.save)?.id;
    if (expectedSaveId !== undefined && existingId && existingId !== expectedSaveId) {
      throw new Error('This slot now contains a different career. Reopen Saved Games before deleting.');
    }
    if (existingId || expectedSaveId) await deleteAccountBackup(existingId ?? expectedSaveId!);
    await removeKey(summaryKey(mode, slot));
    await removeKey(key);
    await removeKey(bakKey(mode, slot));
    const revoked = deletedSaveIds.get(key) ?? new Set<string>();
    if (primary.save) revoked.add(primary.save.id);
    if (backup.save) revoked.add(backup.save.id);
    if (expectedSaveId) revoked.add(expectedSaveId);
    deletedSaveIds.set(key, revoked);
    await deleteSaveKey(key);
  });
}

export async function listSlots(mode: GameMode, options?: ReadOptions): Promise<SlotView[]> {
  const out: SlotView[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    checkRead(options);
    try {
      out.push({ slot, save: await loadSave(mode, slot, options) });
    } catch {
      checkRead(options);
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

/**
 * Find an empty creation destination without opening every existing cricket world.
 * writeSave still re-checks identity inside the per-slot queue before committing,
 * so a concurrent creation/recovery cannot silently be overwritten.
 */
export async function findCreationSlot(mode: GameMode, requestedSlot?: number): Promise<number | null> {
  if (requestedSlot !== undefined &&
    (!Number.isInteger(requestedSlot) || requestedSlot < 1 || requestedSlot > MAX_SLOTS)) return null;
  const empty = (slot: number) => enqueueSlotOperation(slotKey(mode, slot), async () => {
    try {
      return !(await hasStoredValue(slotKey(mode, slot))) && !(await hasStoredValue(bakKey(mode, slot)));
    } catch {
      // Storage failure, including an unreadable oversized legacy row, is occupied.
      return false;
    }
  });
  if (requestedSlot !== undefined && requestedSlot <= BASE_MAX_SLOTS)
    return await empty(requestedSlot) ? requestedSlot : null;
  if (requestedSlot === undefined) {
    for (let slot = 1; slot <= BASE_MAX_SLOTS; slot++) {
      if (await empty(slot)) return slot;
    }
  }
  if (!(await empty(MAX_SLOTS))) return null;
  // Slot six keeps the existing mode-scoped, verified pass rule. Only this
  // uncommon case needs full save loading/migration; no cached entitlement guess.
  const slots = await listSlots(mode);
  if (requestedSlot === MAX_SLOTS) {
    const premium = slots.some(entry => isSeasonPassActive(entry.save ?? undefined));
    const unoccupied = slots.some(entry => entry.slot === MAX_SLOTS && !entry.save && !entry.unavailable);
    return premium && unoccupied ? MAX_SLOTS : null;
  }
  return firstFreeSlot(slots);
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

export interface ResolvedSummary extends LastPlayed { summary: SaveSummary }
export async function getLastPlayedSummary(options?: ReadOptions): Promise<ResolvedSummary | null> {
  checkRead(options);
  const ptr = await getJSON<LastPlayed>(LAST_PLAYED_KEY);
  if (!ptr || !['career', 'manager'].includes(ptr.mode) || !Number.isInteger(ptr.slot) || ptr.slot < 1 || ptr.slot > MAX_SLOTS) return null;
  const row = await readSlotSummary(ptr.mode, ptr.slot, options);
  return row.summary ? { ...ptr, summary: row.summary } : null;
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
