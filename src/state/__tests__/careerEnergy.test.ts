jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: () => void) => {
      cb();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android' },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
}));
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: async () => {} }));
jest.mock('../../config/qa', () => ({ QA_TOOLS_ENABLED: false }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');
const { makeCareerSave, makeManagerSave } = jest.requireActual<
  typeof import('../../game/__tests__/_depthHelpers')
>('../../game/__tests__/_depthHelpers');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');
const { synchronizeSchema14State } =
  jest.requireActual<typeof import('../../storage/schema14')>('../../storage/schema14');
const base = Date.UTC(2026, 9, 23);
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(base);
  jest.spyOn(purchases, 'getPermanentVipSnapshot').mockResolvedValue(null);
  jest.spyOn(purchases, 'getEntitlementSnapshot').mockResolvedValue({ status: 'UNAVAILABLE' });
  useCareer.setState({
    save: null,
    ref: null,
    persist: jest.fn(async () => {}),
    persistCritical: jest.fn(async () => {}),
  });
});
afterEach(() => jest.restoreAllMocks());

describe('production Player energy store regressions', () => {
  it.each([false, true])(
    'uses the right cap on load, ordinary refresh, lightweight clock and gem refill (VIP %s)',
    (vip) => {
      const save = makeCareerSave();
      save.entitlements.removeAds = vip;
      save.wallet = { ...save.wallet, energy: 0, gems: 10, energyUpdatedAt: base - 180 * 60_000 };
      useCareer.getState().setActive(save, 'career', 1);
      const cap = vip ? 60 : 36;
      expect(useCareer.getState().save?.wallet.energy).toBe(cap);
      const active = useCareer.getState().save!;
      active.wallet = { ...active.wallet, energy: 0, energyUpdatedAt: base - 180 * 60_000 };
      useCareer.getState().refreshEnergy();
      expect(useCareer.getState().save?.wallet.energy).toBe(cap);
      useCareer.getState().save!.wallet = {
        ...useCareer.getState().save!.wallet,
        energy: 0,
        energyUpdatedAt: base,
      };
      expect(useCareer.getState().synchronizeEnergyClock(base + 180 * 60_000)).toBe(true);
      expect(useCareer.getState().save?.wallet.energy).toBe(cap);
      const current = useCareer.getState().save!;
      current.wallet = { ...current.wallet, energy: 5, energyUpdatedAt: base };
      expect(useCareer.getState().refillEnergy()).toEqual({ ok: true });
      expect(useCareer.getState().save?.wallet).toMatchObject({ energy: cap, gems: 0 });
      synchronizeSchema14State(useCareer.getState().save!);
      expect(useCareer.getState().save?.playerCareerResources?.trainingFocusCap).toBe(cap);
    },
  );
  it('only reconciles energy: no careers, fixtures, quests or persistence work on each countdown second', () => {
    const save = makeCareerSave();
    save.wallet = { ...save.wallet, energy: 0, energyUpdatedAt: base };
    useCareer.getState().setActive(save, 'career', 1);
    const original = useCareer.getState().save!;
    const fixtures = JSON.stringify(original.fixtures);
    for (let seconds = 1; seconds < 180; seconds++)
      expect(useCareer.getState().synchronizeEnergyClock(base + seconds * 1000)).toBe(false);
    expect(useCareer.getState().save).toBe(original);
    expect(useCareer.getState().persist).not.toHaveBeenCalled();
    expect(useCareer.getState().synchronizeEnergyClock(base + 180_000)).toBe(true);
    expect(useCareer.getState().save?.wallet.energy).toBe(1);
    expect(JSON.stringify(useCareer.getState().save?.fixtures)).toBe(fixtures);
    expect(useCareer.getState().persist).toHaveBeenCalledTimes(1);
  });
  it.each([
    [false, 5, 13, 8],
    [true, 50, 58, 8],
    [true, 58, 60, 2],
    [true, 75, 75, 0],
  ] as const)(
    'reward never reduces energy and is idempotent: VIP%s at%d ->%d',
    (vip, energy, expected, added) => {
      const save = makeCareerSave();
      save.entitlements.removeAds = vip;
      save.wallet = { ...save.wallet, energy, energyUpdatedAt: base - 30_000 };
      useCareer.getState().setActive(save, 'career', 1);
      const result = useCareer.getState().grantAdEnergy(8, 'completed-ad', save.id);
      expect(result).toEqual({ ok: true, energyAdded: added });
      expect(useCareer.getState().save?.wallet.energy).toBe(expected);
      expect(useCareer.getState().grantAdEnergy(8, 'completed-ad', save.id).ok).toBe(false);
      if (expected < (vip ? 60 : 36))
        expect(useCareer.getState().save?.wallet.energyUpdatedAt).toBe(base - 30_000);
    },
  );
  it('rejects another save, Manager mode and malformed rewards without consuming a transaction', () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    expect(useCareer.getState().grantAdEnergy(8, 'late', 'different-save').ok).toBe(false);
    for (const amount of [NaN, Infinity, -8, 0])
      expect(useCareer.getState().grantAdEnergy(amount, 'bad').ok).toBe(false);
    expect(useCareer.getState().save?.flags['rewardTx:late']).toBeUndefined();
    useCareer.getState().setActive(makeManagerSave(), 'manager', 1);
    expect(useCareer.getState().grantAdEnergy(8, 'manager').ok).toBe(false);
    expect(useCareer.getState().refillEnergy().ok).toBe(false);
  });
});
