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
const mockOpen = jest.fn();
const mockList = jest.fn();
const mockClose = jest.fn();
const mockSnapshot = jest.fn();
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
    jest.requireActual('node:crypto').createHash('sha256').update(value).digest('hex')),
}));
jest.mock('../auth', () => ({ useAuth: (...args: unknown[]) => mockAuth(...args as []) }));
jest.mock('../../storage/storage', () => ({
  getJSONStrict: async (key: string) => mockRows.has(key) ? structuredClone(mockRows.get(key)) : null,
  setJSON: async (key: string, value: unknown) => { mockRows.set(key, structuredClone(value)); },
}));
jest.mock('../../storage/saveGames', () => ({
  listSlotSummaries: async (mode: GameMode) => Array.from({ length: 6 }, (_, i) => ({
    slot: i + 1, summary: mockLocal.has(`${mode}:${i + 1}`) ?
      jest.requireActual('../../storage/saveSummary').summarizeSave(mockLocal.get(`${mode}:${i + 1}`),
        JSON.stringify(mockLocal.get(`${mode}:${i + 1}`))) : null,
    unavailable: mockUnavailable === `${mode}:${i + 1}`,
  })),
  loadSaveSnapshot: (...args: unknown[]) => mockSnapshot(...args),
  recoverSaveToEmptySlot: (...args: unknown[]) => mockRestore(...args),
  setLastPlayed: (...args: unknown[]) => mockLastPlayed(...args),
}));
jest.mock('../accountCareerCloud', () => ({
  openAccountCareerSession: (...args: unknown[]) => mockOpen(...args),
  prepareAccountCareer: async (snapshot: SaveGame) => {
    const json = JSON.stringify(snapshot);
    return { json, checksum: jest.requireActual('../../storage/integrity').checksumOf(json),
      contentHash: await jest.requireActual('../../storage/backupFingerprint').backupContentHash(snapshot) };
  },
  removeAccountCareer: jest.fn(),
}));
import { checksumOf } from '../../storage/integrity';
import { backupBindings, markBackupDirty } from '../../storage/accountBackupJournal';
import { startAccountRecovery, syncAccountCareers, useAccountBackup } from '../accountRecovery';
import { synchronizeSchema14State } from '../../storage/schema14';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';

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
  mockOpen.mockReset(); mockList.mockReset(); mockClose.mockReset();
  mockSnapshot.mockReset().mockImplementation(async (mode: GameMode, slot: number) => {
    const snapshot = structuredClone(mockLocal.get(`${mode}:${slot}`) ?? null);
    return { save: snapshot, token: snapshot ? JSON.stringify(snapshot) : '' };
  });
  jest.requireMock('expo-crypto').digestStringAsync.mockImplementation(async (_algorithm: string, value: string) =>
    jest.requireActual('node:crypto').createHash('sha256').update(value).digest('hex'));
  mockList.mockImplementation(async () => [...mockRemote.values()].map((entry) => entry.row));
  mockOpen.mockImplementation(async (ownerId: string) => {
    if (!mockOnline) throw new Error('offline');
    return { list: mockList, fetch: (row: RemoteCareer) => mockFetch(ownerId, row), upload: mockUpload, close: mockClose };
  });
  useAccountBackup.setState({ phase: 'signed_out', message: '', confirmedAt: null, recovered: 0, refresh: 0 });
  mockFetch.mockImplementation(async (_owner: string, row: RemoteCareer) => structuredClone(mockRemote.get(row.save_id)!.save));
  mockRestore.mockImplementation(async (snapshot: SaveGame, binding: BackupBinding, active: () => boolean) => {
    if (!active()) throw new Error('account changed');
    if (mockLocal.has(`${binding.mode}:${binding.slot}`)) throw new Error('occupied');
    const { bindRecoveredSave } = jest.requireActual('../../storage/accountBackupJournal');
    await bindRecoveredSave(binding);
    mockLocal.set(`${binding.mode}:${binding.slot}`, structuredClone(snapshot));
  });
  mockUpload.mockImplementation(async (binding: BackupBinding, snapshot: SaveGame) => {
    const revision = binding.revision + 1;
    const checksum = checksumOf(JSON.stringify(snapshot));
    mockRemote.set(snapshot.id, { row: { save_id: snapshot.id, mode: snapshot.mode,
      slot: binding.slot, revision, checksum, deleted: false, updated_at: new Date().toISOString() },
      save: structuredClone(snapshot) });
    return { revision, checksum };
  });
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
it('skips unchanged full worlds after confirmation, including UI refresh overlap, but still recovers remote careers', async () => {
  mockLocal.set('career:1', save('career', 'indexed-player'));
  mockLocal.set('manager:1', save('manager', 'indexed-manager'));
  await login();
  mockSnapshot.mockClear(); mockUpload.mockClear();
  await Promise.all([syncAccountCareers(false), syncAccountCareers(false)]);
  expect(mockSnapshot).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  remote(save('career', 'fresh-device-remote'), 2);
  await syncAccountCareers(true);
  expect(mockFetch).toHaveBeenCalled();
  expect(mockLocal.get('career:2')?.id).toBe('fresh-device-remote');
});
it('opens a dirty bound save once, and never skips a write whose journal hook failed', async () => {
  const original = save('career', 'dirty-indexed');
  mockLocal.set('career:1', original);
  await login();
  mockSnapshot.mockClear(); mockUpload.mockClear();
  mockLocal.set('career:1', { ...original, updatedAt: 300 });
  await markBackupDirty(original.id, 'career', 1, 'owner-a');
  await syncAccountCareers(false);
  expect(mockSnapshot).toHaveBeenCalledTimes(1);
  mockSnapshot.mockClear();
  mockLocal.set('career:1', { ...original, updatedAt: 400, wallet: { ...original.wallet, coins: 800, gems: 2 } });
  // Simulate a durable write whose journal hook failed: sidecar token changed,
  // but there is no pending flag. The mismatch must trigger verified checking.
  await syncAccountCareers(false);
  expect(mockSnapshot).toHaveBeenCalled();
  expect(mockRemote.get(original.id)?.save.wallet.coins).toBe(800);
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
  await expect(syncAccountCareers(true)).rejects.toThrow('account changed');
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
  await expect(login()).rejects.toThrow('account changed');
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

async function linkedCareer() {
  const snapshot = save('career', 'optimized-player');
  mockLocal.set('career:1', snapshot);
  await login();
  mockUpload.mockClear(); mockOpen.mockClear(); mockList.mockClear(); mockClose.mockClear();
  return snapshot;
}
async function dirty(snapshot: SaveGame) {
  mockLocal.set('career:1', snapshot);
  await markBackupDirty(snapshot.id, snapshot.mode, 1, 'owner-a');
}

it('merges 25 equivalent queued requests into one identity check/list/upload pass', async () => {
  mockLocal.set('career:1', save('career', 'burst-player'));
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-a' } });
  const requests = Array.from({ length: 25 }, () => syncAccountCareers(true));
  expect(new Set(requests).size).toBe(1);
  await Promise.all(requests);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it('promotes a queued upload-only pass when any caller requests recovery', async () => {
  await login(); mockOpen.mockClear(); mockList.mockClear();
  remote(save('manager', 'arrived-remotely'));
  const uploadOnly = syncAccountCareers(false);
  const recovery = syncAccountCareers(true);
  expect(uploadOnly).toBe(recovery);
  await recovery;
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockLocal.get('manager:1')!.id).toBe('arrived-remotely');
});
it('a manual request during an upload waits for its newer writes in one merged follow-up', async () => {
  const initial = await linkedCareer();
  const first = { ...initial, wallet: { ...initial.wallet, coins: 1800, gems: 31 } };
  await dirty(first);
  let enter!: () => void; let release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const uploadNormally = mockUpload.getMockImplementation()!;
  mockUpload.mockImplementationOnce(async (...args: unknown[]) => {
    enter(); await gate; return uploadNormally(...args);
  });
  const inFlight = syncAccountCareers(false);
  await entered;
  await dirty({ ...first, wallet: { ...first.wallet, coins: 1900, gems: 31 } });
  const followUps = Array.from({ length: 25 }, () => syncAccountCareers(false));
  expect(new Set(followUps).size).toBe(1);
  let finished = false;
  void followUps[0].then(() => { finished = true; });
  await Promise.resolve();
  expect(finished).toBe(false);
  release();
  await Promise.all([inFlight, ...followUps]);
  expect(mockOpen).toHaveBeenCalledTimes(2);
  expect(mockUpload).toHaveBeenCalledTimes(2);
  expect(mockRemote.get(initial.id)!.save.wallet.coins).toBe(1900);
  expect((await backupBindings())[0].pending).toBe(false);
});
it('skips a timestamp-only upload after checking remote metadata and preserves the actual backup time', async () => {
  const initial = await linkedCareer();
  const before = (await backupBindings())[0];
  await dirty({ ...initial, updatedAt: initial.updatedAt + 10 });
  await syncAccountCareers(false);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockList).toHaveBeenCalledTimes(1);
  expect((await backupBindings())[0]).toMatchObject({ revision: before.revision,
    checksum: before.checksum, confirmedAt: before.confirmedAt, pending: false });
  expect(mockRemote.get(initial.id)!.save).toEqual(initial);
  expect(useAccountBackup.getState().phase).toBe('confirmed');
  await syncAccountCareers(false);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockList).toHaveBeenCalledTimes(1); // the accepted local timestamp is cached
});
it.each(['career', 'manager'] as const)('deduplicates real %s save normalization but uploads a genuine wallet change', async mode => {
  const initial = mode === 'career' ? makeCareerSave() : makeManagerSave();
  initial.wallet.coins = 11000;
  initial.wallet.gems = 75;
  initial.inventory = { ...initial.inventory, squad_recovery_token: 1 };
  initial.flags['purchaseToken:clock-regression'] = true;
  synchronizeSchema14State(initial, 1000);
  mockLocal.set(`${mode}:1`, structuredClone(initial));
  await login();
  const acknowledged = (await backupBindings())[0];
  for (let index = 1; index <= 3; index++) {
    const next = structuredClone(mockLocal.get(`${mode}:1`)!);
    // This is the actual canonicalization run by persistActiveSave, not a
    // hand-constructed root timestamp change that bypasses the wallet clock.
    synchronizeSchema14State(next, 2000 + index);
    next.updatedAt += index;
    mockLocal.set(`${mode}:1`, next);
    await markBackupDirty(next.id, mode, 1, 'owner-a');
    await syncAccountCareers(false);
  }
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect((await backupBindings())[0]).toMatchObject({ revision: acknowledged.revision,
    checksum: acknowledged.checksum, confirmedAt: acknowledged.confirmedAt, pending: false });
  const changed = structuredClone(mockLocal.get(`${mode}:1`)!);
  changed.wallet.coins -= 1;
  synchronizeSchema14State(changed, 3000);
  mockLocal.set(`${mode}:1`, changed);
  await markBackupDirty(changed.id, mode, 1, 'owner-a');
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(2);
  expect(mockRemote.get(changed.id)!.save.premiumWallet).toMatchObject({ accountCoins: 10999, gems: 75, updatedAt: 3000 });
  expect(mockRemote.get(changed.id)!.save.premiumInventory?.squadRecoveryTokens).toBe(1);
  expect(mockRemote.get(changed.id)!.save.flags['purchaseToken:clock-regression']).toBe(true);
});
it.each([
  { wallet: { coins: 1699, gems: 31 } }, { wallet: { coins: 1700, gems: 30 } },
  { premiumInventory: { recoveryTokens: 1 } }, { entitlements: { removeAdsUntil: 25 } },
  { flags: { 'iap:tx:unique-order': true, 'iap:tx:second-order': true } },
  { players: { player: { form: 60 } } }, { fixtures: { fixture: { completed: true } } },
  { seasons: { season: { completed: true } } },
])('does not skip meaningful changes even when updatedAt is unchanged: %p', async (change) => {
  const initial = await linkedCareer();
  const changed = { ...initial, ...change } as unknown as SaveGame;
  await dirty(changed);
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockRemote.get(initial.id)!.save).toEqual(changed);
});
it.each(['changed', 'deleted', 'missing', 'slot'])(
  'does not hide a remote %s behind a local no-op hash', async (state) => {
    const initial = await linkedCareer();
    await dirty({ ...initial, updatedAt: 300 });
    const row = mockRemote.get(initial.id)!.row;
    if (state === 'changed') row.revision += 1;
    if (state === 'deleted') row.deleted = true;
    if (state === 'missing') mockRemote.delete(initial.id);
    if (state === 'slot') row.slot = 2;
    mockUpload.mockRejectedValueOnce(new Error(state === 'deleted' ? 'DELETED' : 'CONFLICT'));
    await expect(syncAccountCareers(false)).rejects.toThrow(state === 'deleted' ? 'DELETED' : 'CONFLICT');
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect((await backupBindings())[0].pending).toBe(true);
    expect(useAccountBackup.getState().phase).toBe('error');
  },
);
it('does not confirm unchanged progress while offline or when metadata listing fails', async () => {
  const initial = await linkedCareer();
  await dirty({ ...initial, updatedAt: 300 });
  mockOnline = false;
  await expect(syncAccountCareers(false)).rejects.toThrow('offline');
  expect((await backupBindings())[0].pending).toBe(true);
  mockOnline = true;
  mockList.mockRejectedValueOnce(new Error('metadata unavailable'));
  await expect(syncAccountCareers(false)).rejects.toThrow('metadata unavailable');
  expect(mockUpload).not.toHaveBeenCalled();
  expect(useAccountBackup.getState().phase).toBe('error');
});
it('falls back to a full upload if native hashing fails, and clears the older hash', async () => {
  const initial = await linkedCareer();
  await dirty({ ...initial, updatedAt: 300 });
  jest.requireMock('expo-crypto').digestStringAsync.mockRejectedValueOnce(new Error('native failure'));
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect((await backupBindings())[0].contentHash).toBeUndefined();
});
it('upgrades legacy journal metadata lazily without a server/save format change', async () => {
  const initial = await linkedCareer();
  const journal = mockRows.get('account-career-backups:v1') as { entries: BackupBinding[] };
  delete journal.entries[0].contentHash; delete journal.entries[0].localChecksum;
  await dirty({ ...initial, updatedAt: 300 });
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect((await backupBindings())[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  await dirty({ ...initial, updatedAt: 400 });
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
});
it('keeps a newer write pending when it arrives during no-op metadata verification', async () => {
  const initial = await linkedCareer();
  await dirty({ ...initial, updatedAt: 300 });
  mockList.mockImplementationOnce(async () => {
    await dirty({ ...initial, updatedAt: 400, wallet: { ...initial.wallet, coins: 2000, gems: 31 } });
    return [...mockRemote.values()].map((entry) => entry.row);
  });
  await syncAccountCareers(false);
  expect(mockUpload).not.toHaveBeenCalled();
  expect((await backupBindings())[0].pending).toBe(true);
  expect(useAccountBackup.getState().phase).toBe('pending');
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockRemote.get(initial.id)!.save.wallet.coins).toBe(2000);
});
it('cancels a superseded autosave timer after an explicit successful backup', async () => {
  const initial = await linkedCareer();
  await dirty({ ...initial, wallet: { ...initial.wallet, coins: 2000, gems: 31 } });
  await syncAccountCareers(false);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(2001);
  expect(mockOpen).toHaveBeenCalledTimes(1);
});
it('a queued job cannot migrate into a new account before starting', async () => {
  await linkedCareer();
  const old = syncAccountCareers(true);
  mockAuth.setState({ user: { provider: 'google', remoteId: 'owner-b' } });
  await expect(old).rejects.toThrow('account changed');
  await syncAccountCareers(true);
  expect(mockUpload).not.toHaveBeenCalled();
  expect((await backupBindings())[0].ownerId).toBe('owner-a');
});
it('does not trust a hash carried through an older client’s acknowledgement', async () => {
  const initial = await linkedCareer();
  const journal = mockRows.get('account-career-backups:v1') as { entries: BackupBinding[] };
  // Simulate an older app that retains unknown fields while acknowledging a
  // DIFFERENT payload. Its old fingerprint must not authorize a no-op now.
  journal.entries[0].revision += 1;
  journal.entries[0].checksum = 'older-client-payload';
  const row = mockRemote.get(initial.id)!.row;
  row.revision = journal.entries[0].revision;
  row.checksum = journal.entries[0].checksum;
  await dirty({ ...initial, updatedAt: 500 });
  await syncAccountCareers(false);
  expect(mockUpload).toHaveBeenCalledTimes(1);
});
it('avoids ten large full-save transfers for bookkeeping-only writes', async () => {
  const snapshot = save('career', 'large-snapshot');
  snapshot.players = { syntheticPlayer: { name: 'Synthetic test only',
    retainedHistory: 'cricket-🏏-'.repeat(150_000) } } as unknown as SaveGame['players'];
  mockLocal.set('career:1', snapshot);
  await login();
  const initialBytes = Buffer.byteLength(mockUpload.mock.calls[0][2].json, 'utf8');
  expect(initialBytes).toBeGreaterThan(1_000_000);
  mockUpload.mockClear();
  for (let n = 1; n <= 10; n++) {
    await dirty({ ...snapshot, updatedAt: snapshot.updatedAt + n });
    await syncAccountCareers(false);
  }
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRemote.get(snapshot.id)!.save).toEqual(snapshot);
  expect((await backupBindings())[0].pending).toBe(false);
});
