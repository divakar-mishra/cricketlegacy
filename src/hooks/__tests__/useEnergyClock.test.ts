import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
import { energyRecovery, energyCapacity } from '../../game/economy';
import type { SaveGame } from '../../domain/types';
const mockSync = jest.fn();
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, cb: (state: string) => void) => {
      mockListeners.add(cb);
      return { remove: () => mockListeners.delete(cb) };
    },
  },
}));
jest.mock('../../state/careerStore', () => {
  const { create: createStore } = jest.requireActual('zustand');
  return {
    useCareer: createStore(() => ({
      save: null,
      synchronizeEnergyClock: (now?: number) => mockSync(now),
    })),
  };
});
import { useEnergyClock } from '../useEnergyClock';
import { useCareer } from '../../state/careerStore';
function Clock({ enabled = true }: { enabled?: boolean }) {
  useEnergyClock(enabled);
  return null;
}
configureReactRenderEnvironment();

describe('single energy boundary timer', () => {
  let tree: ReactTestRenderer | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.UTC(2026, 9, 23));
    mockSync.mockReset();
    useCareer.setState({
      save: {
        id: 'clock',
        mode: 'career',
        wallet: { coins: 0, gems: 0, energy: 0, energyUpdatedAt: Date.now() },
        entitlements: { removeAds: false },
      } as SaveGame,
    });
    mockSync.mockImplementation((now = Date.now()) => {
      const save = useCareer.getState().save!;
      const next = energyRecovery(save.wallet, now, energyCapacity(save.entitlements)).wallet;
      if (next.energy === save.wallet.energy) return false;
      useCareer.setState({ save: { ...save, wallet: next } });
      return true;
    });
  });
  afterEach(async () => {
    await act(async () => tree?.unmount());
    tree = undefined;
    mockListeners.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('does not refresh every second; reconciles the exact boundary and schedules the next point', async () => {
    await act(async () => {
      tree = create(createElement(Clock));
    });
    const initialCalls = mockSync.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(179_999));
    expect(mockSync).toHaveBeenCalledTimes(initialCalls);
    await act(async () => jest.advanceTimersByTime(26));
    expect(useCareer.getState().save?.wallet.energy).toBe(1);
    await act(async () => jest.advanceTimersByTime(180_000));
    expect(useCareer.getState().save?.wallet.energy).toBe(2);
  });
  it('stops in background and reconciles elapsed offline time immediately on return', async () => {
    const clear = jest.spyOn(global, 'clearTimeout');
    await act(async () => {
      tree = create(createElement(Clock));
    });
    await act(async () => mockListeners.forEach((cb) => cb('background')));
    expect(clear).toHaveBeenCalled();
    const calls = mockSync.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(30 * 60_000));
    expect(mockSync).toHaveBeenCalledTimes(calls);
    await act(async () => mockListeners.forEach((cb) => cb('active')));
    expect(useCareer.getState().save?.wallet.energy).toBe(10);
  });
  it('re-arms after a clock correction rather than leaving an open app stuck forever', async () => {
    await act(async () => {
      tree = create(createElement(Clock));
    });
    await act(async () => jest.setSystemTime(Date.now() - 3 * 60_000));
    await act(async () => jest.advanceTimersByTime(180_025));
    expect(useCareer.getState().save?.wallet.energy).toBe(0);
    const calls = mockSync.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(180_025));
    expect(mockSync.mock.calls.length).toBeGreaterThan(calls);
    expect(useCareer.getState().save?.wallet.energy).toBe(1);
  });
  it.each(['full', 'manager', 'disabled'])('does not schedule energy work for%s', async (state) => {
    if (state === 'full') useCareer.getState().save!.wallet.energy = 36;
    if (state === 'manager') useCareer.getState().save!.mode = 'manager';
    await act(async () => {
      tree = create(createElement(Clock, { enabled: state !== 'disabled' }));
    });
    const calls = mockSync.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(10 * 60_000));
    expect(mockSync).toHaveBeenCalledTimes(calls);
  });
});
