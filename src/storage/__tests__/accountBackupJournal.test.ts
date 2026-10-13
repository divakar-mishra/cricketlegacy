const mockRows = new Map<string, unknown>();
let mockFailure = false;
jest.mock('../storage', () => ({
  getJSONStrict: async (key: string) => mockRows.has(key) ? structuredClone(mockRows.get(key)) : null,
  setJSON: async (key: string, value: unknown) => {
    if (mockFailure) throw new Error('disk full');
    mockRows.set(key, structuredClone(value));
  },
}));
import {
  backupBindings, bindRecoveredSave, confirmBackup, deleteAccountBackup, markBackupDirty,
  setBackupHooks, setBackupOwner,
} from '../accountBackupJournal';

beforeEach(() => { mockRows.clear(); mockFailure = false; setBackupOwner(null); setBackupHooks({}); });
it('does not back up a guest under an invented identity', async () => {
  await markBackupDirty('a', 'career', 1, null);
  expect(await backupBindings()).toEqual([]);
});
it('never rebinds an existing career on another account’s sign-in', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await markBackupDirty('a', 'career', 1, 'owner-b');
  expect((await backupBindings())[0]).toMatchObject({ ownerId: 'owner-a', generation: 2 });
});
it('does not clear a newer pending write when an older upload is acknowledged', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  const first = (await backupBindings())[0];
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await confirmBackup(first, 1, 'old-checksum');
  expect((await backupBindings())[0]).toMatchObject({ revision: 1, generation: 2, pending: true });
  const latest = (await backupBindings())[0];
  await confirmBackup(latest, 2, 'new-checksum');
  expect((await backupBindings())[0]).toMatchObject({ revision: 2, pending: false });
});
it('serializes rapid dirty markers instead of dropping increments', async () => {
  await Promise.all(Array.from({ length: 20 }, () => markBackupDirty('a', 'manager', 2, 'owner-a')));
  expect((await backupBindings())[0].generation).toBe(20);
});
it('does not treat corrupt metadata as no existing owner', async () => {
  mockRows.set('account-career-backups:v1', { version: 900, entries: [] });
  await expect(markBackupDirty('a', 'career', 1, 'owner-b')).rejects.toThrow('metadata');
});
it('requires confirmed remote deletion, and rejects late writes and recovery after deletion', async () => {
  setBackupOwner('owner-a');
  await markBackupDirty('a', 'career', 1, 'owner-a');
  const binding = (await backupBindings())[0];
  const remove = jest.fn(async (): Promise<void> => { throw new Error('offline'); });
  setBackupHooks({ deleteRemote: remove });
  await expect(deleteAccountBackup('a')).rejects.toThrow('offline');
  expect((await backupBindings())[0].deleted).toBe(false);
  remove.mockImplementation(async () => {});
  await deleteAccountBackup('a');
  expect((await backupBindings())[0]).toMatchObject({ deleted: true, pending: false });
  await expect(markBackupDirty('a', 'career', 1, 'owner-a')).rejects.toThrow('deleted');
  await expect(bindRecoveredSave(binding)).rejects.toThrow('deleted');
});
it('prevents another signed-in account from deleting the original owner’s backup', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  setBackupOwner('owner-b');
  const remove = jest.fn();
  setBackupHooks({ deleteRemote: remove });
  await expect(deleteAccountBackup('a')).rejects.toThrow('backup account');
  expect(remove).not.toHaveBeenCalled();
});
it('does not confirm a backup whose metadata acknowledgement could not persist', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  mockFailure = true;
  await expect(confirmBackup((await backupBindings())[0], 1, 'hash')).rejects.toThrow('disk full');
  expect((await backupBindings())[0].pending).toBe(true);
});
