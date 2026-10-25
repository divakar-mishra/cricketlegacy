import type { SaveGame } from '../../domain/types';
let mockSave: SaveGame | null;
let mockReady = true;
const mockShow = jest.fn();
const mockGrant = jest.fn();
const mockSync = jest.fn();
jest.mock('../ads', () => ({ isAdsReady: () => mockReady, showRewarded: () => mockShow() }));
jest.mock('../../state/careerStore', () => ({
  useCareer: {
    getState: () => ({
      save: mockSave,
      synchronizeEnergyClock: mockSync,
      grantAdEnergy: mockGrant,
    }),
  },
}));
import { requestRewardedEnergy } from '../rewardedEnergy';

beforeEach(() => {
  jest.clearAllMocks();
  mockReady = true;
  mockSave = {
    id: 'player-one',
    mode: 'career',
    wallet: { coins: 0, gems: 0, energy: 5, energyUpdatedAt: Date.now() },
    entitlements: { removeAds: false },
  } as SaveGame;
  mockShow.mockResolvedValue({ completed: true });
  mockGrant.mockReturnValue({ ok: true, energyAdded: 8 });
});
it('requests an optional ad then delivers8once with the original save identity', async () => {
  expect(await requestRewardedEnergy('player-one')).toEqual({ ok: true, energyAdded: 8 });
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(mockGrant).toHaveBeenCalledWith(
    8,
    expect.stringContaining('energy:player-one:'),
    'player-one',
  );
});
it.each(['unavailable', 'incomplete', 'exception', 'full', 'manager', 'different-save'])(
  '%s never grants ad energy',
  async (scenario) => {
    if (scenario === 'unavailable') mockReady = false;
    if (scenario === 'incomplete') mockShow.mockResolvedValue({ completed: false });
    if (scenario === 'exception') mockShow.mockRejectedValue(new Error('No fill'));
    if (scenario === 'full') mockSave!.wallet.energy = 36;
    if (scenario === 'manager') mockSave!.mode = 'manager';
    if (scenario === 'different-save') mockSave!.id = 'other';
    expect((await requestRewardedEnergy('player-one')).ok).toBe(false);
    expect(mockGrant).not.toHaveBeenCalled();
  },
);
it('keeps optional ads available to VIP, without granting their reward before completion', async () => {
  mockSave!.entitlements.removeAds = true;
  let finish!: (result: { completed: boolean }) => void;
  mockShow.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const first = requestRewardedEnergy('player-one');
  expect(mockGrant).not.toHaveBeenCalled();
  expect((await requestRewardedEnergy('player-one')).ok).toBe(false);
  expect(mockShow).toHaveBeenCalledTimes(1);
  finish({ completed: true });
  await first;
  expect(mockGrant).toHaveBeenCalledTimes(1);
});
it('passes the original save binding to the final store guard after a save switch', async () => {
  mockShow.mockImplementation(async () => {
    mockSave!.id = 'other';
    return { completed: true };
  });
  mockGrant.mockImplementation((_energy: number, _tx: string, id: string) => ({
    ok: mockSave?.id === id,
  }));
  expect((await requestRewardedEnergy('player-one')).ok).toBe(false);
  expect(mockGrant.mock.calls[0][2]).toBe('player-one');
});
it('releases the global ad lock after failure so a later retry is possible', async () => {
  mockShow.mockRejectedValueOnce(new Error('load failed'));
  expect((await requestRewardedEnergy('player-one')).ok).toBe(false);
  expect((await requestRewardedEnergy('player-one')).ok).toBe(true);
  expect(mockGrant).toHaveBeenCalledTimes(1);
});
