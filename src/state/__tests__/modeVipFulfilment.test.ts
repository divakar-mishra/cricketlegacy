jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: () => void) => {
      cb();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('../../storage/saveEncryption', () => ({
  openSave: async () => null,
  sealSave: async () => ({}),
  markSaveSealed: async () => {},
}));
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));
(global as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');
const { makeCareerSave, makeManagerSave } = jest.requireActual<
  typeof import('../../game/__tests__/_depthHelpers')
>('../../game/__tests__/_depthHelpers');

describe('mode VIP purchase fulfilment', () => {
  beforeEach(() => {
    useCareer.setState({
      persist: jest.fn(async () => {}),
      persistCritical: jest.fn(async () => {}),
    });
  });
  afterEach(() => jest.restoreAllMocks());
  it('does not autosave a career again for an unchanged inactive legacy pass', async () => {
    jest.spyOn(purchases, 'getEntitlementSnapshot').mockResolvedValue({ status: 'INACTIVE' });
    jest.spyOn(purchases, 'getPermanentVipSnapshot').mockResolvedValue(null);
    useCareer.getState().setActive(makeCareerSave(), 'career', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(useCareer.getState().persist).not.toHaveBeenCalled();
  });
  it.each(['career', 'manager'] as const)(
    'rejects the other mode before opening checkout in %s',
    async (mode) => {
      const save = mode === 'career' ? makeCareerSave() : makeManagerSave();
      useCareer.getState().setActive(save, mode, 1);
      const checkout = jest.spyOn(purchases, 'purchase');
      expect(
        await useCareer
          .getState()
          .purchaseProduct(mode === 'career' ? 'manager_vip' : 'player_vip'),
      ).toEqual({ ok: false, error: 'wrong_vip_mode' });
      expect(checkout).not.toHaveBeenCalled();
    },
  );
  it.each(['career', 'manager'] as const)(
    'purchases %s VIP once without granting currency',
    async (mode) => {
      const save = mode === 'career' ? makeCareerSave() : makeManagerSave();
      useCareer.getState().setActive(save, mode, 1);
      const before = { ...useCareer.getState().save!.wallet };
      const product = mode === 'career' ? 'player_vip' : 'manager_vip';
      expect(await useCareer.getState().purchaseProduct(product)).toEqual({ ok: true });
      expect(useCareer.getState().save!.entitlements.modeVip).toMatchObject({ mode, owned: true });
      expect(useCareer.getState().save!.wallet).toEqual(before);
      expect(await useCareer.getState().purchaseProduct(product)).toMatchObject({
        ok: false,
        error: 'already_owned',
      });
    },
  );
  it('restores only the applicable VIP without restoring currency', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    const before = { ...useCareer.getState().save!.wallet };
    jest.spyOn(purchases, 'restore').mockResolvedValue({
      status: 'RESTORED',
      purchases: [
        { ok: true, productId: 'manager_vip', verificationState: 'VERIFIED' },
        { ok: true, productId: 'player_vip', verificationState: 'VERIFIED' },
      ],
    });
    expect(await useCareer.getState().restorePurchases()).toMatchObject({
      status: 'RESTORED',
      productIds: ['player_vip'],
    });
    expect(useCareer.getState().save!.wallet).toEqual(before);
  });
  it('blocks new subscription and shared VIP checkout', async () => {
    useCareer.getState().setActive(makeCareerSave(), 'career', 1);
    expect(await useCareer.getState().purchaseProduct('season_pass')).toMatchObject({
      ok: false,
      error: 'retired_product',
    });
    expect(await useCareer.getState().purchaseProduct('remove_ads')).toMatchObject({
      ok: false,
      error: 'retired_product',
    });
  });
  it('includes Manager VIP in Legacy and restores no toolkit tokens', async () => {
    useCareer.getState().setActive(makeManagerSave(), 'manager', 1);
    const initial = useCareer.getState().save!;
    const budget = initial.teams[initial.userTeamId!].budget;
    const initialWallet = { ...initial.wallet };
    expect(await useCareer.getState().purchaseProduct('manager_legend_pack')).toEqual({ ok: true });
    const purchased = useCareer.getState().save!;
    expect(purchased.teams[purchased.userTeamId!].budget).toBe(budget + 1_000_000);
    expect(purchased.finances?.transferBudget).toBe(budget + 1_000_000);
    expect(purchased.wallet).toEqual(initialWallet);
    expect(await useCareer.getState().purchaseProduct('manager_legend_pack')).toMatchObject({ ok: false, error: 'already_owned' });
    expect(useCareer.getState().save!.teams[purchased.userTeamId!].budget).toBe(budget + 1_000_000);
    expect(useCareer.getState().save!.entitlements.modeVip).toMatchObject({
      mode: 'manager', owned: true, source: 'manager_legend_pack',
    });
    expect(await useCareer.getState().purchaseProduct('manager_vip')).toMatchObject({
      ok: false, error: 'already_owned',
    });
    useCareer.getState().setActive(makeManagerSave(), 'manager', 2);
    const wallet = { ...useCareer.getState().save!.wallet };
    const restoreSave = useCareer.getState().save!;
    const restoreBudget = restoreSave.teams[restoreSave.userTeamId!].budget;
    jest.spyOn(purchases, 'restore').mockResolvedValue({
      status: 'RESTORED',
      purchases: [{ ok: true, productId: 'manager_legend_pack', verificationState: 'VERIFIED' }],
    });
    await useCareer.getState().restorePurchases();
    await useCareer.getState().restorePurchases();
    expect(useCareer.getState().save!.teams[restoreSave.userTeamId!].budget).toBe(restoreBudget);
    expect(useCareer.getState().save!.entitlements.modeVip?.owned).toBe(true);
    expect(useCareer.getState().save!.wallet).toEqual(wallet);
    expect(useCareer.getState().save!.inventory?.scout_full_reveal_token ?? 0).toBe(0);
    expect(useCareer.getState().save!.inventory?.facility_upgrade_token ?? 0).toBe(0);
    expect(useCareer.getState().save!.inventory?.squad_recovery_token ?? 0).toBe(0);
  });
  it('fulfils retirement cosmetics through the actual retirement action', async () => {
    const save = makeCareerSave();
    save.players[save.userPlayerId!].age = 33;
    useCareer.getState().setActive(save, 'career', 1);
    await useCareer.getState().purchaseProduct('player_vip');
    const before = { ...useCareer.getState().save!.wallet };
    expect(useCareer.getState().retire()).not.toBeNull();
    expect(useCareer.getState().save!.vipCollections?.owned).toHaveLength(12);
    expect(useCareer.getState().save!.wallet).toEqual(before);
  });
});
