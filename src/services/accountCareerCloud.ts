/** Real account backups only: no device-local fallback masquerading as cloud. */
import { GameMode, SaveGame, SAVE_SCHEMA_VERSION } from '../domain/types';
import { checksumOf } from '../storage/integrity';
import { runMigrations } from '../storage/migrate';
import { BackupBinding } from '../storage/accountBackupJournal';
import { backupContentHash } from '../storage/backupFingerprint';
import { currentRecoverableSupabaseUserId, getSupabaseClient } from './supabaseClient';

export interface RemoteCareer {
  save_id: string;
  mode: GameMode;
  slot: number;
  revision: number;
  deleted: boolean;
  checksum: string | null;
  updated_at: string;
}
const TIMEOUT_MS = 10_000;
type CareerClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
export interface PreparedCareerBackup {
  json: string;
  checksum: string;
  contentHash?: string;
}
export async function prepareAccountCareer(save: SaveGame): Promise<PreparedCareerBackup> {
  const json = JSON.stringify(save);
  const checksum = checksumOf(json);
  const contentHash = await backupContentHash(save);
  return { json, checksum, contentHash };
}
export async function backupIdentity(ownerId: string) {
  const client = getSupabaseClient();
  const id = await withTimeout(currentRecoverableSupabaseUserId());
  if (!client || id !== ownerId) throw new Error('Sign in again to confirm the backup account.');
  return client;
}
function withTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Backup connection timed out. Your local progress is safe.')), TIMEOUT_MS);
    Promise.resolve(operation).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
function failure() { return new Error('Account backup unavailable. Keep the app installed and retry when online.'); }

/** One server-validated identity per short-lived sync, never a global auth cache. */
export async function openAccountCareerSession(ownerId: string, isCurrent: () => boolean) {
  const client = await backupIdentity(ownerId);
  let closed = false;
  const check = () => {
    if (closed || !isCurrent()) throw new Error('The backup account changed.');
  };
  check();
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    check();
    const result = await operation();
    check();
    return result;
  };
  const ownBinding = (binding: BackupBinding) => {
    if (binding.ownerId !== ownerId) throw new Error('The backup account changed.');
  };
  return {
    list: () => run(() => listCareers(client, ownerId)),
    fetch: (remote: RemoteCareer) => run(() => fetchCareer(client, ownerId, remote)),
    upload: (binding: BackupBinding, save: SaveGame, payload?: PreparedCareerBackup) => run(async () => {
      ownBinding(binding);
      const prepared = payload ?? await prepareAccountCareer(save);
      check();
      return uploadCareer(client, binding, save, prepared);
    }),
    remove: (binding: BackupBinding) => run(async () => {
      ownBinding(binding);
      return removeCareer(client, binding);
    }),
    close: () => { closed = true; },
  };
}

async function withAccountSession<T>(ownerId: string, operation: (session: Awaited<ReturnType<typeof openAccountCareerSession>>) => Promise<T>): Promise<T> {
  const session = await openAccountCareerSession(ownerId, () => true);
  try { return await operation(session); } finally { session.close(); }
}
export function listAccountCareers(ownerId: string): Promise<RemoteCareer[]> {
  return withAccountSession(ownerId, (session) => session.list());
}
async function listCareers(client: CareerClient, ownerId: string): Promise<RemoteCareer[]> {
  const { data, error } = await withTimeout(client.rpc('list_account_career_backups', { p_owner_id: ownerId }));
  if (error || !Array.isArray(data)) throw failure();
  if (data.some((row: RemoteCareer) => !row || typeof row.save_id !== 'string' ||
    !['career', 'manager'].includes(row.mode) || !Number.isInteger(row.slot) || row.slot < 1 || row.slot > 6 ||
    !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.deleted !== 'boolean' ||
    !Number.isFinite(Date.parse(row.updated_at)))) throw failure();
  return data as RemoteCareer[];
}

export function decodeCareerBackup(json: string, remote: RemoteCareer): SaveGame {
  if (checksumOf(json) !== remote.checksum) throw new Error('Backup integrity check failed. No local save was changed.');
  const raw = JSON.parse(json) as SaveGame;
  if (!raw || raw.id !== remote.save_id || raw.mode !== remote.mode ||
    !Number.isInteger(raw.schemaVersion) || raw.schemaVersion > SAVE_SCHEMA_VERSION ||
    !Number.isFinite(raw.createdAt) || !Number.isFinite(raw.updatedAt) ||
    !raw.wallet || !Number.isFinite(raw.wallet.coins) || !Number.isFinite(raw.wallet.gems) ||
    !raw.entitlements || !raw.flags || !raw.players || !raw.teams || !raw.fixtures || !raw.leagues || !raw.seasons ||
    (raw.mode === 'career' && (!raw.userPlayerId || !raw.players[raw.userPlayerId])) ||
    (raw.mode === 'manager' && (!raw.userTeamId || !raw.teams[raw.userTeamId]))) {
    throw new Error('This career backup is invalid or needs a newer app version. Nothing was overwritten.');
  }
  const migrated = runMigrations(raw);
  if (!migrated) throw new Error('This career backup needs a newer app version.');
  return migrated;
}

export function fetchAccountCareer(ownerId: string, remote: RemoteCareer): Promise<SaveGame> {
  return withAccountSession(ownerId, (session) => session.fetch(remote));
}
async function fetchCareer(client: CareerClient, ownerId: string, remote: RemoteCareer): Promise<SaveGame> {
  const { data, error } = await withTimeout(client.rpc('read_account_career_backup', {
    p_owner_id: ownerId, p_save_id: remote.save_id, p_revision: remote.revision,
  }));
  if (error || typeof data !== 'string') throw failure();
  return decodeCareerBackup(data, remote);
}

export function uploadAccountCareer(binding: BackupBinding, save: SaveGame): Promise<{ revision: number; checksum: string }> {
  return withAccountSession(binding.ownerId, (session) => session.upload(binding, save));
}
async function uploadCareer(client: CareerClient, binding: BackupBinding, save: SaveGame, prepared?: PreparedCareerBackup): Promise<{ revision: number; checksum: string }> {
  if (save.id !== binding.saveId || save.mode !== binding.mode) throw failure();
  const { json, checksum } = prepared ?? await prepareAccountCareer(save);
  const { data, error } = await withTimeout(client.rpc('write_account_career_backup', {
    p_owner_id: binding.ownerId, p_save_id: save.id, p_mode: save.mode, p_slot: binding.slot,
    p_expected_revision: binding.revision, p_save_json: json, p_checksum: checksum, p_delete: false,
  }));
  if (error) throw failure();
  if (data?.status === 'CONFLICT') throw new Error('Another device changed this career backup. Neither copy was overwritten. Contact support before uninstalling.');
  if (data?.status === 'DELETED') throw new Error('This career’s cloud backup was permanently deleted. It cannot be uploaded again.');
  if (data?.status !== 'SAVED' || !Number.isSafeInteger(data.revision) || data.revision < 1) throw failure();
  return { revision: data.revision, checksum };
}

export function removeAccountCareer(binding: BackupBinding): Promise<void> {
  return withAccountSession(binding.ownerId, (session) => session.remove(binding));
}
async function removeCareer(client: CareerClient, binding: BackupBinding): Promise<void> {
  const { data, error } = await withTimeout(client.rpc('write_account_career_backup', {
    p_owner_id: binding.ownerId, p_save_id: binding.saveId, p_mode: binding.mode, p_slot: binding.slot,
    p_expected_revision: binding.revision, p_save_json: null, p_checksum: null, p_delete: true,
  }));
  if (error || data?.status !== 'DELETED') {
    throw new Error('Cloud deletion was not confirmed. Keep this save and retry online after backups finish.');
  }
}
