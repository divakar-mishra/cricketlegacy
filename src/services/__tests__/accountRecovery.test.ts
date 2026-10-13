import { create } from 'zustand';
import { GameMode, SaveGame, SAVE_SCHEMA_VERSION } from '../../domain/types';
import { BackupBinding } from '../../storage/accountBackupJournal';
import { RemoteCareer } from '../accountCareerCloud';
const mockAuth = create<{ user: { provider: string; remoteId: string } | null }>(() => ({ user: null }));
const mockRows = new Map<string, unknown>();
const mockLocal = new Map<string, SaveGame>();
const mockRemote = new Map<string, { row: RemoteCareer; save: SaveGame }>();
let mockOnline = true;
let mockUnavailable: string | null = null;
const mockUpload = jest.fn();
const mockFetch = jest.fn();
const mockRestore = jest.fn();
const mockLastPlayed = jest.fn();
jest.mock('../auth', () => ({ useAuth: (...args: unknown[]) => mockAuth(...args as []) }));
jest.mock('../../storage/storage', () => ({
  getJSONStrict: async (key: string) => mockRows.has(key) ? structuredClone(mockRows.get(key)) : null,
  setJSON: async (key: string, value: unknown) => { mockRows.set(key, structuredClone(value)); },
}));
jest.mock('../../storage/saveGames', () => ({
  listSlots: async (mode: GameMode) => Array.from({ length: 6 }, (_, i) => ({
    slot: i + 1, save: structuredClone(mockLocal.get(`${mode}:${i + 1}`) ?? null),
    unavailable: mockUnavailable === `${mode}:${i + 1}`,
  })),
  loadSave: async (mode: GameMode, slot: number) => structuredClone(mockLocal.get(`${mode}:${slot}`) ?? null),
  recoverSaveToEmptySlot: (...args: unknown[]) => mockRestore(...args),
  setLastPlayed: (...args: unknown[]) => mockLastPlayed(...args),
}));
jest.mock('../accountCareerCloud', () => ({
  backupIdentity: async () => { if (!mockOnline) throw new Error('offline'); },
  listAccountCareers: async () => [...mockRemote.values()].map((entry) => entry.row),
  fetchAccountCareer: (...args: unknown[]) => mockFetch(...args),
  uploadAccountCareer: (...args: unknown[]) => mockUpload(...args),
  removeAccountCareer: jest.fn(),
}));
import { checksumOf } from '../../storage/integrity';
import { backupBindings, markBackupDirty } from '../../storage/accountBackupJournal';
import { startAccountRecovery, syncAccountCareers, useAccountBackup } from '../accountRecovery';

// The auth mock needs Zustand's subscription methods, as well as the React hook.
const mockedAuthModule = jest.requireMock('../auth');
Object.assign(mockedAuthModule.useAuth, { getState: mockAuth.getState, subscribe: mockAuth.subscribe });
function save(mode: GameMode, id: string): SaveGame {
  return { id, mode, schemaVersion: SAVE_SCHEMA_VERSION, createdAt: 100, updatedAt: 200,
    wallet: { coins: 1700, gems: 31 }, premiumInventory: { recoveryTokens: 2 },
    entitlements: { removeAdsUntil: 1_800_000_000_000 },
    flags: { 'iap:tx:unique-order': true }, firstPurchaseDone: true,
    players: {}, teams: {}, seasons: {}, leagues: {}, fixtures: {}, difficulty: 'normal',
  } as unknown as SaveGame;
}
function remote(snapshot: SaveGame, slot = 1) {
  const row: RemoteCareer = { save_id: snapshot.id, mode: snapshot.mode, slot, revision: 3,
    deleted: false, checksum: checksumOf(JSON.stringify(snapshot)), updated_at: new Date(1000).toISOString() };
  mockRemote.set(snapshot.id, { row, save: structuredClone(snapshot) });
}
let stop: () => void;
beforeEach(() => {
  jest.useFakeTimers();
  mockAuth.setState({ user: null });
  mockRows.clear(); mockLocal.clear(); mockRemote.clear();
  mockOnline = true; mockUnavailable = null;
  mockUpload.mockReset(); mockFetch.mockReset(); mockRestore.mockReset(); mockLastPlayed.mockReset();
  useAccountBackup.setState({ phase: 'signed_out', message: '', confirmedAt: null, recovered: 0, refresh: 0 });
  mockFetch.mockImplementation(async (_owner: string, row: RemoteCareer) => structuredClone(mockRemote.get(row.save_id)!.save));
  mockRestore.mockImplementation(async (snapshot: SaveGame, binding: BackupBinding, active: () => boolean) => {
    if (!active()) throw new Error('account changed');
    if (mockLocal.has(`${binding.mode}:${binding.slot}`)) throw new Error('occupied');
    const { bindRecoveredSave } = jest.requireActual('../../storage/accountBackupJournal');
    await bindRecoveredSave(binding);
    mockLocal.set(`${binding.mode}:${binding.slot}`, structuredClone(snapshot));
  });
  mockUpload.mockImplementation(async (binding: BackupBinding, snapshot: SaveGame) => ({
    revision: binding.revision + 1, checksum: checksumOf(JSON.stringify(snapshot)),
  }));
  stop = startAccountRecovery();
});
afterEach(() => { stop(); jest.useRealTimers(); });
async function login() {
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  await syncAccountCareers(true);
}
it('recovers both modes after reinstall without new grants, timer extension, or loss of transaction markers', async () => {
  const player = save('career', 'player-a');
  const manager = save('manager', 'manager-a');
  remote(player); remote(manager);
  await login();
  expect(mockLocal.get('career:1')).toEqual(player);
  expect(mockLocal.get('manager:1')).toEqual(manager);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockLastPlayed).toHaveBeenCalledWith('career', 1);
  expect(useAccountBackup.getState().phase).toBe('confirmed');
});
it('backs up existing local careers prospectively when first linked', async () => {
  const player = save('career', 'local-player');
  mockLocal.set('career:1', player);
  await login();
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockUpload.mock.calls[0][1]).toEqual(player);
  expect((await backupBindings())[0]).toMatchObject({ ownerId: 'owner-a', pending: false, revision: 1 });
});
it('never overwrites a local version with an older remote snapshot', async () => {
  const older = save('career', 'player-a');
  remote(older);
  const newer = { ...older, updatedAt: 300, wallet: { ...older.wallet, coins: 99, gems: 5 } };
  mockLocal.set('career:1', newer);
  mockUpload.mockRejectedValue(new Error('CONFLICT'));
  await expect(login()).rejects.toThrow('CONFLICT');
  expect(mockLocal.get('career:1')).toEqual(newer);
  expect(mockRestore).not.toHaveBeenCalled();
  expect(useAccountBackup.getState().phase).toBe('error');
});
it('uses another empty slot rather than replacing an occupied preferred slot', async () => {
  mockLocal.set('career:1', save('career', 'other-career'));
  remote(save('career', 'player-a'));
  await login();
  expect(mockLocal.get('career:1')!.id).toBe('other-career');
  expect(mockLocal.get('career:2')!.id).toBe('player-a');
});
it('does not overwrite unreadable local data or report every career backed up', async () => {
  mockUnavailable = 'career:1';
  remote(save('career', 'player-a'));
  await login();
  expect(mockLocal.has('career:1')).toBe(false);
  expect(mockLocal.get('career:2')!.id).toBe('player-a');
  expect(useAccountBackup.getState().phase).toBe('error');
});
it('keeps local progress and reports no confirmation when backend is missing or offline', async () => {
  mockLocal.set('career:1', save('career', 'local-player'));
  mockOnline = false;
  await expect(login()).rejects.toThrow('offline');
  expect(mockLocal.get('career:1')!.wallet.coins).toBe(1700);
  expect(useAccountBackup.getState()).toMatchObject({ phase: 'error', confirmedAt: null });
});
it('ignores a late download after switching to a different Google account', async () => {
  remote(save('career', 'player-a'));
  mockFetch.mockImplementationOnce(async () => {
    mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-b' } });
    mockRemote.clear();
    return save('career', 'player-a');
  });
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  await syncAccountCareers(true);
  expect(mockRestore).not.toHaveBeenCalled();
  expect(mockLocal.size).toBe(0);
});
it('never uploads an already-bound save into a different account', async () => {
  mockLocal.set('career:1', save('career', 'player-a'));
  await markBackupDirty('player-a', 'career', 1, 'owner-b');
  await login();
  expect(mockUpload).not.toHaveBeenCalled();
  expect((await backupBindings())[0].ownerId).toBe('owner-b');
});
it('leaves newer rewards pending when an older upload finishes', async () => {
  mockLocal.set('career:1', save('career', 'player-a'));
  mockUpload.mockImplementationOnce(async (_binding: BackupBinding, snapshot: SaveGame) => {
    mockLocal.set('career:1', { ...snapshot, wallet: { ...snapshot.wallet, coins: 2300, gems: 31 } });
    await markBackupDirty('player-a', 'career', 1, 'owner-a');
    return { revision: 1, checksum: checksumOf(JSON.stringify(snapshot)) };
  });
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  // Await the automatic sign-in job without enqueueing a second sync.
  for (let n = 0; n < 100; n += 1) await Promise.resolve();
  expect((await backupBindings())[0]).toMatchObject({ pending: true, revision: 1 });
  expect(useAccountBackup.getState().phase).toBe('pending');
  await syncAccountCareers(false);
  expect(mockUpload.mock.calls[1][1].wallet.coins).toBe(2300);
  expect((await backupBindings())[0].pending).toBe(false);
});
it('does not recover server-deleted careers', async () => {
  const snapshot = save('career', 'deleted-player');
  remote(snapshot);
  mockRemote.get(snapshot.id)!.row.deleted = true;
  await login();
  expect(mockLocal.size).toBe(0);
  expect(mockFetch).not.toHaveBeenCalled();
});
it('does not replace an unreadable bound career with an older cloud copy in another slot', async () => {
  remote(save('career', 'player-a'));
  await markBackupDirty('player-a', 'career', 1, 'owner-a');
  mockUnavailable = 'career:1';
  await login();
  expect(mockRestore).not.toHaveBeenCalled();
  expect(useAccountBackup.getState().phase).toBe('error');
});
it('repeated foreground recovery does not grant or download the same paid snapshot twice', async () => {
  const player = save('career', 'repeat-recovery-player');
  player.entitlements.removeAdsUntil = 50; // Expired time remains expired.
  remote(player);
  await login();
  await Promise.all(Array.from({ length: 5 }, () => syncAccountCareers(true)));
  expect(mockRestore).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockLocal.get('career:1')).toEqual(player);
});
it('a full mode never replaces a career or takes a slot in the other mode', async () => {
  for (let slot = 1; slot <= 6; slot++) mockLocal.set(`career:${slot}`, save('career', `occupied-${slot}`));
  const before = structuredClone([...mockLocal]);
  remote(save('career', 'cloud-player'));
  await login();
  expect([...mockLocal]).toEqual(before);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockRestore).not.toHaveBeenCalled();
  expect(useAccountBackup.getState().phase).toBe('error');
});
it('a corrupt remote payload does not remove the local career or report confirmed backup', async () => {
  mockLocal.set('manager:1', save('manager', 'retained-manager'));
  remote(save('career', 'corrupt-cloud-player'));
  mockFetch.mockRejectedValue(new Error('Backup integrity check failed'));
  await expect(login()).rejects.toThrow('integrity');
  expect(mockLocal.size).toBe(1);
  expect(mockLocal.get('manager:1')!.id).toBe('retained-manager');
  expect(mockRestore).not.toHaveBeenCalled();
  expect(useAccountBackup.getState()).toMatchObject({ phase: 'error', confirmedAt: null });
});
it('sign-out during a download cannot restore another account’s career', async () => {
  remote(save('career', 'late-download'));
  mockFetch.mockImplementationOnce(async () => {
    mockAuth.setState({ user: null });
    return save('career', 'late-download');
  });
  await expect(login()).rejects.toThrow('Sign in');
  expect(mockRestore).not.toHaveBeenCalled();
  expect(mockLocal.size).toBe(0);
  expect(useAccountBackup.getState().phase).toBe('signed_out');
});
it('a career created during an upload leaves confirmation pending until that new career is backed up', async () => {
  mockLocal.set('career:1', save('career', 'first-player'));
  mockUpload.mockImplementationOnce(async (binding: BackupBinding, snapshot: SaveGame) => {
    mockLocal.set('manager:1', save('manager', 'new-manager'));
    await markBackupDirty('new-manager', 'manager', 1, 'owner-a');
    return { revision: binding.revision + 1, checksum: checksumOf(JSON.stringify(snapshot)) };
  });
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  for (let n = 0; n < 100; n++) await Promise.resolve();
  expect(useAccountBackup.getState().phase).toBe('pending');
  expect((await backupBindings()).find((entry) => entry.saveId === 'new-manager')!.pending).toBe(true);
  await syncAccountCareers(false);
  expect((await backupBindings()).find((entry) => entry.saveId === 'new-manager')!.pending).toBe(false);
  expect(useAccountBackup.getState().phase).toBe('confirmed');
});
it('a failed recovery write can retry without inventing a reward or changing last-played', async () => {
  const player = save('career', 'retry-player');
  remote(player);
  mockRestore.mockRejectedValueOnce(new Error('disk full'));
  // Test only the automatic sign-in job, to avoid a second queued recovery.
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  for (let n = 0; n < 100; n++) await Promise.resolve();
  expect(useAccountBackup.getState().phase).toBe('error');
  expect(mockLocal.size).toBe(0);
  expect(mockLastPlayed).not.toHaveBeenCalled();
  await syncAccountCareers(true);
  expect(mockLocal.get('career:1')).toEqual(player);
  expect(mockUpload).not.toHaveBeenCalled();
});
