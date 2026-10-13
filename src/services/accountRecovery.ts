import { create } from 'zustand';
import { GameMode } from '../domain/types';
import { checksumOf } from '../storage/integrity';
import {
  backupBindings, backupOwner, backupWriteVersion, confirmBackup, markBackupDirty, setBackupHooks, setBackupOwner,
} from '../storage/accountBackupJournal';
import { listSlots, loadSave, recoverSaveToEmptySlot, setLastPlayed } from '../storage/saveGames';
import { useAuth } from './auth';
import { backupIdentity, fetchAccountCareer, listAccountCareers, removeAccountCareer, uploadAccountCareer } from './accountCareerCloud';

interface BackupStatus {
  phase: 'signed_out' | 'pending' | 'syncing' | 'confirmed' | 'error';
  message: string;
  confirmedAt: number | null;
  recovered: number;
  refresh: number;
}
export const useAccountBackup = create<BackupStatus>(() => ({
  phase: 'signed_out', message: 'Sign in with Google to back up both careers.',
  confirmedAt: null, recovered: 0, refresh: 0,
}));
let epoch = 0;
let queue: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
const MODES: GameMode[] = ['career', 'manager'];

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
  const request = queue.catch(() => undefined).then(async () => {
    const ownerId = backupOwner();
    if (!ownerId) throw new Error('Sign in with Google or email before using account backups.');
    const capturedEpoch = epoch;
    const active = () => backupOwner() === ownerId && epoch === capturedEpoch;
    const check = () => { if (!active()) throw new Error('The backup account changed.'); };
    useAccountBackup.setState({ phase: 'syncing', message: 'Checking account backups…' });
    try {
      await backupIdentity(ownerId);
      check();
      let observedWrites = backupWriteVersion();
      const local = new Map(await Promise.all(MODES.map(async (mode) => [mode, await listSlots(mode)] as const)));
      check();
      let bindings = await backupBindings();
      let recovered = 0;
      let blocked = [...local.values()].flat().filter((slot) => slot.unavailable).length;
      if (recover) {
        const remote = await listAccountCareers(ownerId);
        check();
        for (const row of remote) {
          if (row.deleted) continue;
          const slots = local.get(row.mode)!;
          if (slots.some((slot) => slot.save?.id === row.save_id)) continue;
          const bound = bindings.find((entry) => entry.saveId === row.save_id);
          if (bound?.deleted || (bound && bound.ownerId !== ownerId)) continue;
          if (bound && (bound.pending || slots.some((slot) => slot.slot === bound.slot && slot.unavailable))) {
            blocked += 1;
            continue;
          }
          const destination = slots.find((slot) => slot.slot === row.slot && !slot.save && !slot.unavailable)
            ?? slots.find((slot) => !slot.save && !slot.unavailable);
          if (!destination) { blocked += 1; continue; }
          const save = await fetchAccountCareer(ownerId, row);
          check();
          await recoverSaveToEmptySlot(save, { saveId: row.save_id, ownerId, mode: row.mode,
            slot: destination.slot, revision: row.revision, generation: 0, pending: false, deleted: false,
            checksum: row.checksum ?? undefined, confirmedAt: Date.parse(row.updated_at) }, active);
          check();
          destination.save = save;
          recovered += 1;
          // Newest remote row is first. Do not change an existing Continue choice.
          if (recovered === 1 && ![...local.values()].flat().some((slot) => slot.save && slot.save.id !== save.id)) {
            await setLastPlayed(row.mode, destination.slot);
          }
        }
      }
      bindings = await backupBindings();
      for (const [mode, slots] of local) {
        for (const { slot, save } of slots) {
          if (!save) continue;
          check();
          const binding = bindings.find((entry) => entry.saveId === save.id);
          if (binding && (binding.ownerId !== ownerId || binding.deleted)) { blocked += 1; continue; }
          // Do not adopt a legacy local career with known ownership elsewhere.
          if (!binding && save.entitlements.modeVip?.accountId && save.entitlements.modeVip.accountId !== ownerId) { blocked += 1; continue; }
          if (!binding || (!binding.pending && binding.checksum !== checksumOf(JSON.stringify(save)))) {
            await markBackupDirty(save.id, mode, slot, ownerId);
            observedWrites += 1;
          }
        }
      }
      bindings = await backupBindings();
      for (const binding of bindings) {
        if (binding.ownerId !== ownerId || binding.deleted || !binding.pending) continue;
        const save = await loadSave(binding.mode, binding.slot);
        check();
        // A manual import/replacement never sends the new career as the old one.
        if (!save || save.id !== binding.saveId) continue;
        const result = await uploadAccountCareer(binding, save);
        check();
        await confirmBackup(binding, result.revision, result.checksum);
      }
      check();
      const entries = (await backupBindings()).filter((entry) => entry.ownerId === ownerId && !entry.deleted);
      const pending = backupWriteVersion() !== observedWrites || entries.some((entry) =>
        entry.pending && local.get(entry.mode)?.some((slot) => slot.save?.id === entry.saveId));
      useAccountBackup.setState((state) => ({
        phase: blocked ? 'error' : pending ? 'pending' : 'confirmed',
        message: blocked ? 'Some careers need recovery, belong to another account, or could not fit into empty slots. Your local saves were not overwritten. Keep the app installed.'
          : pending ? 'New changes are waiting for backup. Keep the app installed until confirmation.'
          : entries.length ? 'Account backup confirmed. Remaining balances and original ad-free expiry are saved.'
          : 'No careers on this account to back up yet.',
        confirmedAt: entries.length ? Math.min(...entries.map((entry) => entry.confirmedAt ?? 0)) || null : null,
        recovered, refresh: state.refresh + 1,
      }));
    } catch (error) {
      if (active()) useAccountBackup.setState((state) => ({ phase: 'error',
        message: error instanceof Error ? error.message : 'Backup failed. Keep the app installed and retry.',
        refresh: state.refresh + 1 }));
      throw error;
    }
  });
  queue = request;
  return request;
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
      message: id ? 'Account backup is being checked. Do not uninstall until confirmed.' : 'Sign in with Google to back up both careers.' });
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
