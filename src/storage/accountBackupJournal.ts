/** Device-side sync metadata only. Never a purchase/reward authority. */
import { GameMode } from '../domain/types';
import { getJSONStrict, setJSON } from './storage';

export interface BackupBinding {
  saveId: string;
  ownerId: string;
  mode: GameMode;
  slot: number;
  revision: number;
  generation: number;
  pending: boolean;
  deleted: boolean;
  checksum?: string;
  confirmedAt?: number;
}
const KEY = 'account-career-backups:v1';
let owner: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let dirtyListener: (() => void) | undefined;
let failureListener: (() => void) | undefined;
let writeVersion = 0;
let deletionHandler: ((binding: BackupBinding) => Promise<void>) | undefined;

export function setBackupOwner(id: string | null) { owner = id; }
export function backupOwner() { return owner; }
export function backupWriteVersion() { return writeVersion; }
export function reportBackupWriteFailure() { failureListener?.(); }
export function setBackupHooks(hooks: {
  dirty?: () => void;
  failure?: () => void;
  deleteRemote?: (binding: BackupBinding) => Promise<void>;
}) {
  dirtyListener = hooks.dirty;
  failureListener = hooks.failure;
  deletionHandler = hooks.deleteRemote;
}

async function read(): Promise<BackupBinding[]> {
  const raw = await getJSONStrict<{ version: number; entries: BackupBinding[] }>(KEY);
  if (raw === null) return [];
  if (raw.version !== 1 || !Array.isArray(raw.entries) || raw.entries.some((entry) =>
    !entry || typeof entry.saveId !== 'string' || typeof entry.ownerId !== 'string' ||
    !['career', 'manager'].includes(entry.mode) || !Number.isInteger(entry.slot) ||
    entry.slot < 1 || entry.slot > 6 || !Number.isSafeInteger(entry.revision) || entry.revision < 0 ||
    !Number.isSafeInteger(entry.generation) || entry.generation < 0 ||
    typeof entry.pending !== 'boolean' || typeof entry.deleted !== 'boolean')) {
    throw new Error('Backup metadata needs recovery. Local careers have not been removed.');
  }
  return raw.entries;
}
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(operation);
  queue = next;
  return next;
}
export function backupBindings(): Promise<BackupBinding[]> { return serial(read); }

export function markBackupDirty(saveId: string, mode: GameMode, slot: number, capturedOwner: string | null): Promise<void> {
  writeVersion += 1;
  return serial(async () => {
    const entries = await read();
    let entry = entries.find((item) => item.saveId === saveId);
    if (entry?.deleted) throw new Error('This backed-up career was permanently deleted.');
    // An already bound career can never move to another account on sign-in.
    if (!entry) {
      if (!capturedOwner) return;
      entry = { saveId, ownerId: capturedOwner, mode, slot, revision: 0,
        generation: 0, pending: false, deleted: false };
      entries.push(entry);
    }
    if (entry.mode !== mode) throw new Error('Backup career mode does not match.');
    entry.slot = slot;
    entry.generation += 1;
    entry.pending = true;
    await setJSON(KEY, { version: 1, entries });
    dirtyListener?.();
  });
}

/** A newer local write remains pending even if an older upload finishes late. */
export function confirmBackup(binding: BackupBinding, revision: number, checksum: string): Promise<void> {
  return serial(async () => {
    const entries = await read();
    const current = entries.find((item) => item.saveId === binding.saveId && item.ownerId === binding.ownerId);
    if (!current || current.deleted || revision < current.revision) return;
    current.revision = revision;
    current.checksum = checksum;
    current.confirmedAt = Date.now();
    if (current.generation === binding.generation) current.pending = false;
    await setJSON(KEY, { version: 1, entries });
  });
}

/** Register a restored snapshot before exposing it to subsequent autosaves. */
export function bindRecoveredSave(binding: BackupBinding): Promise<void> {
  return serial(async () => {
    const entries = await read();
    const existing = entries.find((item) => item.saveId === binding.saveId);
    if (existing && (existing.ownerId !== binding.ownerId || existing.deleted)) {
      throw new Error('This career belongs to another account or was deleted.');
    }
    if (existing && (existing.pending || existing.revision > binding.revision)) {
      throw new Error('This device has an unfinished or newer backup for that career. Nothing was overwritten.');
    }
    if (existing) Object.assign(existing, binding, { pending: false });
    else entries.push({ ...binding, pending: false, generation: 0 });
    await setJSON(KEY, { version: 1, entries });
  });
}

/** Never delete only the device copy of an account-backed career. */
export async function deleteAccountBackup(saveId: string): Promise<void> {
  const binding = (await backupBindings()).find((entry) => entry.saveId === saveId);
  if (!binding || binding.deleted) return;
  if (owner !== binding.ownerId || !deletionHandler) {
    throw new Error('Sign in to the career’s backup account and connect to the internet before deleting it.');
  }
  await deletionHandler(binding);
  await serial(async () => {
    const entries = await read();
    const current = entries.find((item) => item.saveId === saveId);
    if (current) { current.deleted = true; current.pending = false; }
    await setJSON(KEY, { version: 1, entries });
  });
}
