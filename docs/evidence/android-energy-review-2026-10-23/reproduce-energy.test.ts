/** Point-in-time DIAGNOSTIC, not an approved balance contract or a fix.
 * Excluded from normal Jest testMatch. Run explicitly as documented in the audit.
 * Native storage is mocked; no installed game, save, network or account is used. */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../../src/services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));
jest.mock('../../../src/storage/saveEncryption', () => ({
  openSave: async () => null, verifySaveIdentity: async () => null,
  sealSave: async () => ({ __env: 2, algorithm: 'AES-256-GCM', data: 'test-only' }),
  markSaveSealed: async () => undefined, deleteSaveKey: async () => undefined,
}));
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: (cb: () => void) => { cb(); return { cancel: jest.fn() }; } },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;

import { ECONOMY } from '../../../src/data/gameConfig';
import { matchEnergyCost, refillEnergyWithGems, regenEnergy } from '../../../src/game/economy';
import { simulateFirstWeekNoSpendLoop } from '../../../src/game/__tests__/_economyHarness';
const { makeCareerSave } = jest.requireActual<typeof import('../../../src/game/__tests__/_depthHelpers')>(
  '../../../src/game/__tests__/_depthHelpers'
);
const { useCareer } = jest.requireActual<typeof import('../../../src/state/careerStore')>(
  '../../../src/state/careerStore'
);

const base = Date.UTC(2026, 9, 23, 0, 0, 0);
beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(base); });
afterEach(() => { jest.restoreAllMocks(); });

it('reports current match costs, full-meter budgets and zero-to-match waits', () => {
  const rows = (['YOUTH', 'DOMESTIC', 'INTERNATIONAL'] as const).flatMap(level =>
    (['T20', 'ODI', 'TEST'] as const).map(format => {
      const cost = matchEnergyCost(format, level);
      return { level, format, cost, fullMeterMatches: Math.floor(ECONOMY.energyMax / cost),
        emptyToMatchMinutes: cost * ECONOMY.energyRegenMinutes };
    }));
  console.info('ENERGY_COST_DIAGNOSTIC', JSON.stringify(rows));
  expect(rows.find(row => row.level === 'INTERNATIONAL' && row.format === 'TEST'))
    .toEqual({ level: 'INTERNATIONAL', format: 'TEST', cost: 10, fullMeterMatches: 3, emptyToMatchMinutes: 50 });
});

it('compares fast and slower match sessions with the existing no-spend harness', () => {
  const rows = [1, 8].flatMap(duration => (['YOUTH', 'DOMESTIC', 'INTERNATIONAL'] as const)
    .flatMap(level => (['T20', 'TEST'] as const).map(format => {
      const result = simulateFirstWeekNoSpendLoop({ days: 1, dailySessionMinutes: 45,
        matchDurationMinutes: duration, fixtureCosts: [matchEnergyCost(format, level)] });
      return { duration, level, format, matches: result.totalMatchesPlayed, energyBlocks: result.energyBlocks };
    })));
  console.info('ENERGY_SESSION_DIAGNOSTIC', JSON.stringify(rows));
  expect(rows.find(row => row.duration === 1 && row.level === 'INTERNATIONAL' && row.format === 'TEST')?.matches).toBe(4);
});

it('reproduces normal VIP refresh stopping at36 despite five hours elapsed', () => {
  const save = makeCareerSave();
  save.entitlements.removeAds = true;
  save.wallet = { ...save.wallet, energy: 0, energyUpdatedAt: base };
  useCareer.getState().setActive(save, 'career', 1);
  jest.spyOn(Date, 'now').mockReturnValue(base + 300 * 60_000);
  useCareer.getState().refreshEnergy();
  expect(useCareer.getState().save?.entitlements.removeAds).toBe(true);
  expect(useCareer.getState().save?.wallet.energy).toBe(36);
  expect(regenEnergy({ ...save.wallet, energy: 0, energyUpdatedAt: base }, Date.now(), ECONOMY.vipEnergyMax).energy).toBe(60);
});

it('reproduces a gem refill for a VIP reaching36 rather than60', () => {
  const save = makeCareerSave();
  save.entitlements.removeAds = true;
  save.wallet = { ...save.wallet, gems: 10, energy: 5, energyUpdatedAt: base };
  useCareer.getState().setActive(save, 'career', 1);
  expect(useCareer.getState().refillEnergy()).toEqual({ ok: true });
  expect(useCareer.getState().save?.wallet.energy).toBe(36);
  expect(useCareer.getState().save?.wallet.gems).toBe(0);
  expect(refillEnergyWithGems({ coins: 0, gems: 10, energy: 5, energyUpdatedAt: base })?.energy).toBe(36);
});

it('reproduces the ad-reward handler reducing existing VIP overflow if called at50', () => {
  const save = makeCareerSave();
  save.entitlements.removeAds = true;
  save.wallet = { ...save.wallet, energy: 50, energyUpdatedAt: base };
  useCareer.getState().setActive(save, 'career', 1);
  expect(useCareer.getState().grantAdEnergy(4, 'diagnostic-energy-at50')).toEqual({ ok: true });
  expect(useCareer.getState().save?.wallet.energy).toBe(36);
  // Store ad UI is normally hidden above8; this is a handler/race edge, not
  // evidence that users can ordinarily press the ad button at50.
});
