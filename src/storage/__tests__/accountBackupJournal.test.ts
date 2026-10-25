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
  backupBindings, bindRecoveredSave, confirmBackup, confirmUnchangedBackup, deleteAccountBackup, hasConfirmedContentHash, markBackupDirty,
  hasCheckedLocalSnapshot, noteBackupSnapshot, setBackupHooks, setBackupOwner,
} from '../accountBackupJournal';

beforeEach(() => { mockRows.clear(); mockFailure = false; setBackupOwner(null); setBackupHooks({}); });
it('records a checked local token only for the exact inspected generation and binding', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  const inspected = (await backupBindings())[0];
  await noteBackupSnapshot(inspected, 'checked-token');
  expect((await backupBindings())[0].localSaveToken).toBe('checked-token');
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await noteBackupSnapshot(inspected, 'stale-token');
  expect((await backupBindings())[0]).toMatchObject({ localSaveToken: 'checked-token', pending: true, generation: 2 });
  const current = (await backupBindings())[0];
  for (const change of [{ ownerId: 'other' }, { mode: 'manager' as const }, { slot: 2 }]) {
    await noteBackupSnapshot({ ...current, ...change }, 'wrong-binding');
    expect((await backupBindings())[0].localSaveToken).toBe('checked-token');
  }
});
it('invalidates a local snapshot token when an older client changes its remote acknowledgement', async () => {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await confirmBackup((await backupBindings())[0], 1, 'first');
  await noteBackupSnapshot((await backupBindings())[0], 'local-token');
  const checked = (await backupBindings())[0];
  expect(hasCheckedLocalSnapshot(checked, 'local-token')).toBe(true);
  expect(hasCheckedLocalSnapshot({ ...checked, revision: 2, checksum: 'older-client-update' }, 'local-token')).toBe(false);
  expect(hasCheckedLocalSnapshot({ ...checked, generation: checked.generation + 1 }, 'local-token')).toBe(false);
  expect(hasCheckedLocalSnapshot({ ...checked, pending: true }, 'local-token')).toBe(false);
});
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
const contentHash = 'a'.repeat(64);
async function acknowledged() {
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await confirmBackup((await backupBindings())[0], 1, 'remote-bytes', contentHash);
  return (await backupBindings())[0];
}
it('acknowledges a checked no-op without inventing a remote revision or newer upload time', async () => {
  const previous = await acknowledged();
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await confirmUnchangedBackup((await backupBindings())[0], contentHash, 'timestamp-only-bytes');
  expect((await backupBindings())[0]).toMatchObject({ pending: false, revision: 1,
    checksum: 'remote-bytes', localChecksum: 'timestamp-only-bytes', confirmedAt: previous.confirmedAt });
});
it('does not clear a newer generation behind a no-op acknowledgement', async () => {
  await acknowledged();
  await markBackupDirty('a', 'career', 1, 'owner-a');
  const checked = (await backupBindings())[0];
  await markBackupDirty('a', 'career', 1, 'owner-a');
  await confirmUnchangedBackup(checked, contentHash, 'checked-old-local-bytes');
  expect((await backupBindings())[0]).toMatchObject({ pending: true, generation: 3, revision: 1 });
});
it.each([{ revision: 2 }, { ownerId: 'other-owner' }, { slot: 2 }, { mode: 'manager' as const }])(
  'rejects stale or mismatched no-op acknowledgements: %p', async (change) => {
    const previous = await acknowledged();
    await expect(confirmUnchangedBackup({ ...previous, ...change }, contentHash, 'new')).rejects.toThrow('backup changed');
  },
);
it('does not reuse a content hash across an un-hashed upload or a recovered revision', async () => {
  const previous = await acknowledged();
  await confirmBackup(previous, 2, 'next-remote');
  expect((await backupBindings())[0].contentHash).toBeUndefined();
  await confirmBackup((await backupBindings())[0], 3, 'third-remote', contentHash);
  await bindRecoveredSave({ ...previous, revision: 4, checksum: 'recovered', contentHash: undefined,
    contentHashBinding: undefined, localChecksum: undefined });
  expect((await backupBindings())[0]).toMatchObject({ revision: 4, checksum: 'recovered' });
  expect((await backupBindings())[0].contentHash).toBeUndefined();
  expect((await backupBindings())[0].localChecksum).toBeUndefined();
  expect((await backupBindings())[0].contentHashBinding).toBeUndefined();
});
it('invalidates cached hashes when an older client updates only the revision/checksum', async () => {
  const previous = await acknowledged();
  expect(hasConfirmedContentHash(previous)).toBe(true);
  const oldClientAck = { ...previous, revision: 2, checksum: 'written-by-old-client' };
  expect(hasConfirmedContentHash(oldClientAck)).toBe(false);
  mockRows.set('account-career-backups:v1', { version: 1, entries: [oldClientAck] });
  await expect(confirmUnchangedBackup(oldClientAck, contentHash, 'new')).rejects.toThrow('backup changed');
});
it('never resurrects a career deleted while a no-op check was in flight', async () => {
  setBackupOwner('owner-a');
  const previous = await acknowledged();
  setBackupHooks({ deleteRemote: async () => {} });
  await deleteAccountBackup('a');
  await expect(confirmUnchangedBackup(previous, contentHash, 'new')).rejects.toThrow('backup changed');
  expect((await backupBindings())[0]).toMatchObject({ deleted: true, pending: false });
});
it('keeps a no-op pending if its journal acknowledgement cannot be persisted', async () => {
  await acknowledged();
  await markBackupDirty('a', 'career', 1, 'owner-a');
  mockFailure = true;
  await expect(confirmUnchangedBackup((await backupBindings())[0], contentHash, 'new')).rejects.toThrow('disk full');
  expect((await backupBindings())[0].pending).toBe(true);
});
