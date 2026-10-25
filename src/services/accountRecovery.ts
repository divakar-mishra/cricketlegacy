import { create } from 'zustand';
import { GameMode } from '../domain/types';
import { checksumOf } from '../storage/integrity';
import {
  backupBindings, backupOwner, backupWriteVersion, confirmBackup, confirmUnchangedBackup, hasCheckedLocalSnapshot, hasConfirmedContentHash,
  markBackupDirty, noteBackupSnapshot, setBackupHooks, setBackupOwner,
} from '../storage/accountBackupJournal';
import { listSlotSummaries, loadSaveSnapshot, recoverSaveToEmptySlot, setLastPlayed } from '../storage/saveGames';
import { summarizeSave } from '../storage/saveSummary';
import { useAuth } from './auth';
import { openAccountCareerSession, prepareAccountCareer, RemoteCareer, removeAccountCareer } from './accountCareerCloud';

interface BackupStatus {
  phase: 'signed_out' | 'pending' | 'syncing' | 'confirmed' | 'error';
  message: string;
  confirmedAt: number | null;
  recovered: number;
  refresh: number;
}
export const useAccountBackup = create<BackupStatus>(() => ({
  phase: 'signed_out', message: 'Sign in to back up both careers.',
  confirmedAt: null, recovered: 0, refresh: 0,
}));
let epoch = 0;
let queue: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
const MODES: GameMode[] = ['career', 'manager'];
interface SyncJob { ownerId: string; epoch: number; recover: boolean; promise: Promise<void> }
let queuedJob: SyncJob | undefined;

function scheduleBackup() {
  if (!started || !backupOwner()) return;
  if (useAccountBackup.getState().phase !== 'syncing') {
    useAccountBackup.setState({ phase: 'pending', message: 'Changes are saved on this device; account backup is pending.' });
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void syncAccountCareers(false).catch(() => undefined);
  }, 2_000);
}

/** Call after a local critical save for a user-requested Backup now. */
export function syncAccountCareers(recover = true): Promise<void> {
  const ownerId = backupOwner();
  if (!ownerId) return Promise.reject(new Error('Sign in before using account backups.'));
  // A requested pass supersedes the trailing autosave timer. Writes arriving
  // during that pass still schedule their own follow-up with the same delay.
  if (timer) { clearTimeout(timer); timer = undefined; }
  if (queuedJob?.ownerId === ownerId && queuedJob.epoch === epoch) {
    queuedJob.recover ||= recover;
    return queuedJob.promise;
  }
  const job: SyncJob = { ownerId, epoch, recover, promise: Promise.resolve() };
  job.promise = queue.catch(() => undefined).then(() => {
    if (queuedJob === job) queuedJob = undefined;
    return runBackup(job);
  });
  queuedJob = job;
  queue = job.promise;
  return job.promise;
}

async function runBackup(job: SyncJob): Promise<void> {
  const { ownerId, epoch: capturedEpoch, recover } = job;
  const active = () => backupOwner() === ownerId && epoch === capturedEpoch;
  const check = () => { if (!active()) throw new Error('The backup account changed.'); };
  check();
  useAccountBackup.setState({ phase: 'syncing', message: 'Checking account backups…' });
  let access: Awaited<ReturnType<typeof openAccountCareerSession>> | undefined;
  try {
    const session = await openAccountCareerSession(ownerId, active);
    access = session;
    check();
    let observedWrites = backupWriteVersion();
    // Sign-out, account switching and lifecycle teardown stop queued slot work,
    // not merely discard a whole scan after it eventually completes.
    const local = new Map(await Promise.all(MODES.map(async (mode) => [mode,
      await listSlotSummaries(mode, { isCurrent: active })] as const)));
    check();
    let bindings = await backupBindings();
    let recovered = 0;
    let blocked = [...local.values()].flat().filter((slot) => slot.unavailable).length;
    let remote: RemoteCareer[] | undefined;
    if (recover) {
      remote = await session.list();
      check();
      for (const row of remote) {
        if (row.deleted) continue;
        const slots = local.get(row.mode)!;
        if (slots.some((slot) => slot.summary?.id === row.save_id)) continue;
        const bound = bindings.find((entry) => entry.saveId === row.save_id);
        if (bound?.deleted || (bound && bound.ownerId !== ownerId)) continue;
        if (bound && (bound.pending || slots.some((slot) => slot.slot === bound.slot && slot.unavailable))) {
          blocked += 1;
          continue;
        }
        const destination = slots.find((slot) => slot.slot === row.slot && !slot.summary && !slot.unavailable)
          ?? slots.find((slot) => !slot.summary && !slot.unavailable);
        if (!destination) { blocked += 1; continue; }
        const save = await session.fetch(row);
        check();
        await recoverSaveToEmptySlot(save, { saveId: row.save_id, ownerId, mode: row.mode,
          slot: destination.slot, revision: row.revision, generation: 0, pending: false, deleted: false,
          checksum: row.checksum ?? undefined, confirmedAt: Date.parse(row.updated_at) }, active);
        check();
        // Occupancy/identity for this pass; recovery has published its sidecar.
        destination.summary = summarizeSave(save, '');
        recovered += 1;
        // Newest remote row is first. Do not change an existing Continue choice.
        if (recovered === 1 && ![...local.values()].flat().some((slot) => slot.summary && slot.summary.id !== save.id)) {
          await setLastPlayed(row.mode, destination.slot);
        }
      }
    }
    bindings = await backupBindings();
    for (const [mode, slots] of local) {
      for (const { slot, summary } of slots) {
        if (!summary) continue;
        check();
        const binding = bindings.find((entry) => entry.saveId === summary.id);
        if (binding && (binding.ownerId !== ownerId || binding.deleted)) { blocked += 1; continue; }
        // Already dirty: the upload loop opens this exact slot once, rather
        // than opening it here and immediately opening it again for upload.
        if (binding?.pending) continue;
        if (binding && hasCheckedLocalSnapshot(binding, summary.token)) continue;
        const checkedChecksum = binding && hasConfirmedContentHash(binding)
          ? binding.localChecksum ?? binding.checksum : binding?.checksum;
        if (binding && summary.token && summary.checkedChecksum && summary.checkedChecksum === checkedChecksum) {
          await noteBackupSnapshot(binding, summary.token);
          continue;
        }
        const snapshot = await loadSaveSnapshot(mode, slot, { isCurrent: active });
        check();
        const save = snapshot.save;
        if (!save || save.id !== summary.id) { blocked += 1; continue; }
        // Do not adopt a legacy local career with known ownership elsewhere.
        if (!binding && save.entitlements.modeVip?.accountId && save.entitlements.modeVip.accountId !== ownerId) { blocked += 1; continue; }
        if (!binding || (!binding.pending && checkedChecksum !== checksumOf(JSON.stringify(save)))) {
          await markBackupDirty(save.id, mode, slot, ownerId);
          observedWrites += 1;
        } else if (!binding.pending) {
          await noteBackupSnapshot(binding, snapshot.token);
        }
      }
    }
    bindings = await backupBindings();
    for (const binding of bindings) {
      if (binding.ownerId !== ownerId || binding.deleted || !binding.pending) continue;
      const snapshot = await loadSaveSnapshot(binding.mode, binding.slot, { isCurrent: active });
      const save = snapshot.save;
      check();
      // A manual import/replacement never sends the new career as the old one.
      if (!save || save.id !== binding.saveId) continue;
      const payload = await prepareAccountCareer(save);
      check();
      if (hasConfirmedContentHash(binding) && payload.contentHash && payload.contentHash === binding.contentHash) {
        // A semantic match alone is not confirmation: another device may
        // have updated/deleted/moved the remote row since our last upload.
        remote ??= await session.list();
        check();
        const row = remote.find((entry) => entry.save_id === binding.saveId);
        if (row && !row.deleted && row.mode === binding.mode && row.slot === binding.slot &&
          row.revision === binding.revision && row.checksum === binding.checksum) {
          await confirmUnchangedBackup(binding, payload.contentHash, payload.checksum);
          await noteBackupSnapshot(binding, snapshot.token);
          check();
          continue;
        }
      }
      const result = await session.upload(binding, save, payload);
      check();
      await confirmBackup(binding, result.revision, result.checksum, payload.contentHash);
      await noteBackupSnapshot(binding, snapshot.token);
    }
    check();
    const entries = (await backupBindings()).filter((entry) => entry.ownerId === ownerId && !entry.deleted);
    const pending = backupWriteVersion() !== observedWrites || entries.some((entry) =>
      entry.pending && local.get(entry.mode)?.some((slot) => slot.summary?.id === entry.saveId));
    useAccountBackup.setState((state) => ({
      phase: blocked ? 'error' : pending ? 'pending' : 'confirmed',
      message: blocked ? 'Some careers need recovery, belong to another account, or could not fit into empty slots. Your local saves were not overwritten. Keep the app installed.'
        : pending ? 'New changes are waiting for backup. Keep the app installed until confirmation.'
        : entries.length ? 'Account backup confirmed. Remaining balances and original ad-free expiry are saved.'
        : 'No careers on this account to back up yet.',
      confirmedAt: entries.length ? Math.min(...entries.map((entry) => entry.confirmedAt ?? 0)) || null : null,
      recovered, refresh: state.refresh + 1,
    }));
    if (!pending && !blocked && active() && backupWriteVersion() === observedWrites && timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  } catch (error) {
    if (active()) useAccountBackup.setState((state) => ({ phase: 'error',
      message: error instanceof Error ? error.message : 'Backup failed. Keep the app installed and retry.',
      refresh: state.refresh + 1 }));
    throw error;
  } finally {
    access?.close();
  }
}

/** App-owned lifecycle; auth changes invalidate all in-flight recovery results. */
export function startAccountRecovery(): () => void {
  started = true;
  const onIdentity = () => {
    const user = useAuth.getState().user;
    const id = user && user.provider !== 'guest' ? user.remoteId ?? null : null;
    if (id === backupOwner()) return;
    epoch += 1;
    setBackupOwner(id);
    if (timer) clearTimeout(timer);
    useAccountBackup.setState({ phase: id ? 'pending' : 'signed_out', confirmedAt: null, recovered: 0,
      message: id ? 'Account backup is being checked. Do not uninstall until confirmed.' : 'Sign in to back up both careers.' });
    if (id) void syncAccountCareers(true).catch(() => undefined);
  };
  setBackupHooks({ dirty: scheduleBackup, failure: () => {
    scheduleBackup();
    useAccountBackup.setState({ phase: 'error', message: 'Local progress was saved, but backup tracking failed. Do not uninstall. Retry Backup now.' });
  }, deleteRemote: async (binding) => {
    await removeAccountCareer(binding);
  } });
  const unsubscribe = useAuth.subscribe(onIdentity);
  onIdentity();
  return () => {
    started = false;
    epoch += 1;
    unsubscribe();
    if (timer) clearTimeout(timer);
    setBackupOwner(null);
    setBackupHooks({});
  };
}
