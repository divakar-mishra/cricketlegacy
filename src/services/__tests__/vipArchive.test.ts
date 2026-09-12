const mockData = new Map<string, string>();
let mockAccount = 'account-a';
const mockRpc = jest.fn(async () => ({ data: [], error: null }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockData.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockData.set(key, value);
  }),
}));
jest.mock('../supabaseClient', () => ({
  currentSupabaseSession: async () => ({ userId: mockAccount, isAnonymous: false }),
  getSupabaseClient: () => ({
    rpc: () => ({ abortSignal: () => mockRpc() }),
  }),
}));
import { syncVipArchive } from '../vipArchive';
import { grantModeVip, grantCollection, hasModeVip } from '../../game/vip';
import { MONTHLY_PASS_CONTENT } from '../../data/seasonPassContent';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';

describe('account and mode scoped cosmetic archive', () => {
  afterEach(async () => {
    // Let resolved background archive writes settle before clearing mock storage.
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  beforeEach(() => {
    mockData.clear();
    mockAccount = 'account-a';
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: [], error: null });
  });
  it('carries Player VIP and earned collections into another Player save, not Manager', async () => {
    const first = makeCareerSave();
    grantModeVip(first, 'player_vip');
    grantCollection(first, MONTHLY_PASS_CONTENT[0].id);
    await syncVipArchive(first);
    const next = makeCareerSave(),
      manager = makeManagerSave();
    const wallet = { ...next.wallet };
    await syncVipArchive(next);
    await syncVipArchive(manager);
    expect(hasModeVip(next)).toBe(true);
    expect(next.vipCollections?.owned).toContain(MONTHLY_PASS_CONTENT[0].id);
    expect(next.wallet).toEqual(wallet);
    expect(hasModeVip(manager)).toBe(false);
    expect(manager.vipCollections?.owned).toEqual([]);
  });
  it('carries Manager VIP only into Manager saves', async () => {
    const save = makeManagerSave();
    grantModeVip(save, 'manager_vip');
    await syncVipArchive(save);
    const manager = makeManagerSave(),
      player = makeCareerSave();
    await syncVipArchive(manager);
    await syncVipArchive(player);
    expect(hasModeVip(manager)).toBe(true);
    expect(hasModeVip(player)).toBe(false);
  });
  it('does not share ownership between accounts', async () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    await syncVipArchive(save);
    mockAccount = 'account-b';
    const next = makeCareerSave();
    await syncVipArchive(next);
    expect(hasModeVip(next)).toBe(false);
    await syncVipArchive(save);
    expect(hasModeVip(save)).toBe(false);
  });
  it('serializes concurrent collection merges without losing either claim', async () => {
    const a = makeCareerSave(),
      b = makeCareerSave();
    grantModeVip(a, 'player_vip');
    grantModeVip(b, 'player_vip');
    grantCollection(a, MONTHLY_PASS_CONTENT[0].id);
    grantCollection(b, MONTHLY_PASS_CONTENT[1].id);
    await Promise.all([syncVipArchive(a), syncVipArchive(b)]);
    const next = makeCareerSave();
    await syncVipArchive(next);
    expect(next.vipCollections?.owned).toHaveLength(2);
  });
  it('accepts remote cosmetics only behind mode VIP, not remote purchase authority', async () => {
    mockRpc.mockResolvedValue({ data: [MONTHLY_PASS_CONTENT[2].id] as never[], error: null });
    const save = makeManagerSave();
    grantModeVip(save, 'manager_vip', mockAccount);
    await syncVipArchive(
      save,
      { accountId: mockAccount, owned: true, source: 'manager_vip' },
      true,
    );
    expect(save.inventory?.[MONTHLY_PASS_CONTENT[2].office.inventoryId]).toBe(1);
    expect(save.inventory?.[MONTHLY_PASS_CONTENT[2].kit.id]).toBeUndefined();
  });
  it('revokes cached new VIP on a verified inactive verdict, not an offline failure', async () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip', mockAccount);
    await syncVipArchive(save);
    await syncVipArchive(save);
    expect(hasModeVip(save)).toBe(true);
    await syncVipArchive(save, { accountId: mockAccount, owned: false });
    expect(hasModeVip(save)).toBe(false);
    const next = makeCareerSave();
    await syncVipArchive(next);
    expect(hasModeVip(next)).toBe(false);
  });
  it('does not block local saves behind a slow ownership refresh or resurrect a revoked VIP', async () => {
    let finish!: (value: { data: never[]; error: null }) => void;
    mockRpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip', mockAccount);
    await syncVipArchive(save, { accountId: mockAccount, owned: true, source: 'player_vip' });
    // These complete while the server request is still unresolved.
    await syncVipArchive(save);
    await syncVipArchive(save, { accountId: mockAccount, owned: false });
    expect(hasModeVip(save)).toBe(false);
    finish({ data: [MONTHLY_PASS_CONTENT[0].id] as never[], error: null });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const next = makeCareerSave();
    await syncVipArchive(next);
    expect(hasModeVip(next)).toBe(false);
    expect(next.vipCollections?.owned).toEqual([]);
  });
  it('does not write unchanged local archives again', async () => {
    const save = makeCareerSave();
    await syncVipArchive(save);
    const secure = jest.requireMock('expo-secure-store');
    secure.setItemAsync.mockClear();
    await syncVipArchive(save);
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });
});
