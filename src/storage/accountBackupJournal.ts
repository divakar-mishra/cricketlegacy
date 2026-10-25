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
  /** Optional v1-compatible cache, populated only after a remote acknowledgement. */
  contentHash?: string;
  contentHashBinding?: string;
  localChecksum?: string;
  /** Authenticated local sidecar token checked against this exact generation. */
  localSaveToken?: string;
  localSaveTokenBinding?: string;
}
const tokenBinding = (entry: BackupBinding) => JSON.stringify([entry.ownerId, entry.mode, entry.slot, entry.saveId,
  entry.generation, entry.revision, entry.checksum ?? null, entry.localChecksum ?? null]);
export function hasCheckedLocalSnapshot(binding: BackupBinding, token: string): boolean {
  return Boolean(token && !binding.pending && binding.localSaveToken === token && binding.localSaveTokenBinding === tokenBinding(binding));
}
export function hasConfirmedContentHash(binding: BackupBinding): boolean {
  return Boolean(binding.revision > 0 && binding.contentHash && /^[a-f0-9]{64}$/.test(binding.contentHash) &&
    binding.contentHashBinding === `${binding.revision}:${binding.checksum}`);
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

export function noteBackupSnapshot(binding: BackupBinding, token: string): Promise<void> {
  return serial(async () => {
    const entries = await read();
    const current = entries.find(entry => entry.saveId === binding.saveId && entry.ownerId === binding.ownerId);
    if (!current || current.deleted || current.mode !== binding.mode || current.slot !== binding.slot ||
      current.generation !== binding.generation) return;
    current.localSaveToken = token;
    current.localSaveTokenBinding = tokenBinding(current);
    await setJSON(KEY, { version: 1, entries });
  });
}

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
export function confirmBackup(binding: BackupBinding, revision: number, checksum: string, contentHash?: string): Promise<void> {
  return serial(async () => {
    const entries = await read();
    const current = entries.find((item) => item.saveId === binding.saveId && item.ownerId === binding.ownerId);
    if (!current || current.deleted || revision < current.revision) return;
    current.revision = revision;
    current.checksum = checksum;
    current.localChecksum = checksum;
    // Clear any older hash when its acknowledged payload was replaced without
    // hashing support; never pair an old content hash with a new remote row.
    current.contentHash = contentHash && /^[a-f0-9]{64}$/.test(contentHash) ? contentHash : undefined;
    current.contentHashBinding = current.contentHash ? `${revision}:${checksum}` : undefined;
    current.confirmedAt = Date.now();
    if (current.generation === binding.generation) current.pending = false;
    await setJSON(KEY, { version: 1, entries });
  });
}

/** Caller has just verified the same remote revision/checksum still exists. */
export function confirmUnchangedBackup(binding: BackupBinding, contentHash: string, localChecksum: string): Promise<void> {
  return serial(async () => {
    const entries = await read();
    const current = entries.find((item) => item.saveId === binding.saveId && item.ownerId === binding.ownerId);
    if (!current || current.deleted || current.mode !== binding.mode || current.slot !== binding.slot ||
      current.revision !== binding.revision || current.checksum !== binding.checksum ||
      !hasConfirmedContentHash(current) || current.contentHash !== contentHash || !/^[a-f0-9]{64}$/.test(contentHash)) {
      throw new Error('The backup changed while checking unchanged progress. Retry Backup now.');
    }
    current.localChecksum = localChecksum;
    if (current.generation === binding.generation) current.pending = false;
    // Keep the time/checksum of the actual remote snapshot, not a fabricated
    // new upload acknowledgement. Newer local writes remain pending as usual.
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
    if (existing) Object.assign(existing, binding, { pending: false,
      contentHash: binding.contentHash, contentHashBinding: binding.contentHashBinding, localChecksum: binding.localChecksum,
      localSaveToken: undefined, localSaveTokenBinding: undefined });
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
