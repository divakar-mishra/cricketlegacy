const mockRpc = jest.fn();
let mockAccount: string | null = 'owner-a';
let mockEnabled = true;
jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockEnabled ? { rpc: mockRpc } : null,
  currentRecoverableSupabaseUserId: async () => mockAccount,
}));
jest.mock('../../storage/migrate', () => ({ runMigrations: (raw: unknown) => raw }));
import { SaveGame, SAVE_SCHEMA_VERSION } from '../../domain/types';
import { checksumOf } from '../../storage/integrity';
import {
  decodeCareerBackup, fetchAccountCareer, listAccountCareers, RemoteCareer, removeAccountCareer, uploadAccountCareer,
} from '../accountCareerCloud';
const save = { schemaVersion: SAVE_SCHEMA_VERSION, id: 'player-a', mode: 'career', createdAt: 100, updatedAt: 200,
  wallet: { coins: 321, gems: 17 }, userPlayerId: 'p', players: { p: { name: 'Player' } },
  teams: {}, seasons: {}, fixtures: {}, leagues: {}, entitlements: { removeAdsUntil: 50 },
  flags: { 'iap:tx:paid-once': true },
} as unknown as SaveGame;
const json = JSON.stringify(save);
const row: RemoteCareer = { save_id: save.id, mode: 'career', slot: 1, revision: 5,
  deleted: false, checksum: checksumOf(json), updated_at: new Date(1000).toISOString() };
const binding = { saveId: save.id, mode: 'career' as const, slot: 1, ownerId: 'owner-a',
  revision: 5, generation: 1, pending: true, deleted: false };
beforeEach(() => { mockRpc.mockReset(); mockAccount = 'owner-a'; mockEnabled = true; });
it('restores remaining wallet, expired ad-free time and grant markers verbatim', () => {
  expect(decodeCareerBackup(json, row)).toEqual(save);
  expect(decodeCareerBackup(json, row).entitlements.removeAdsUntil).toBe(50);
});
it.each([
  { ...row, checksum: 'wrong' }, { ...row, save_id: 'another-save' }, { ...row, mode: 'manager' as const },
])('rejects corruption or mismatched mode/identity', (meta) => {
  expect(() => decodeCareerBackup(json, meta)).toThrow();
});
it('rejects future schema backups rather than erasing them', () => {
  const newer = JSON.stringify({ ...save, schemaVersion: SAVE_SCHEMA_VERSION + 1 });
  expect(() => decodeCareerBackup(newer, { ...row, checksum: checksumOf(newer) })).toThrow('newer app');
});
it('fails closed when the backend is disabled; no local fallback can report successful backup', async () => {
  mockEnabled = false;
  await expect(listAccountCareers('owner-a')).rejects.toThrow('Sign in again');
  expect(mockRpc).not.toHaveBeenCalled();
});
it('rejects a signed-in identity mismatch before issuing any server request', async () => {
  mockAccount = 'owner-b';
  await expect(uploadAccountCareer(binding, save)).rejects.toThrow('Sign in again');
  expect(mockRpc).not.toHaveBeenCalled();
});
it('pins a download to account, save and listed revision', async () => {
  mockRpc.mockResolvedValue({ data: json, error: null });
  expect(await fetchAccountCareer('owner-a', row)).toEqual(save);
  expect(mockRpc).toHaveBeenCalledWith('read_account_career_backup', {
    p_owner_id: 'owner-a', p_save_id: 'player-a', p_revision: 5,
  });
});
it('sends the original snapshot and expected revision for a conditional upload', async () => {
  mockRpc.mockResolvedValue({ data: { status: 'SAVED', revision: 6 }, error: null });
  expect(await uploadAccountCareer(binding, save)).toEqual({ revision: 6, checksum: checksumOf(json) });
  expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_owner_id: 'owner-a', p_expected_revision: 5,
    p_save_json: json, p_delete: false });
});
it.each(['CONFLICT', 'DELETED'])('does not report an upload successful for %s', async (status) => {
  mockRpc.mockResolvedValue({ data: { status, revision: 6 }, error: null });
  await expect(uploadAccountCareer(binding, save)).rejects.toThrow();
});
it('does not accept a failed deletion', async () => {
  mockRpc.mockResolvedValue({ data: { status: 'CONFLICT' }, error: null });
  await expect(removeAccountCareer(binding)).rejects.toThrow('not confirmed');
});
it('does not turn a listing failure into an empty cloud account', async () => {
  mockRpc.mockResolvedValue({ data: null, error: new Error('missing migration') });
  await expect(listAccountCareers('owner-a')).rejects.toThrow('unavailable');
});
