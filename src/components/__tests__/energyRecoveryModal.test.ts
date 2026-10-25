import { createElement, Fragment } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
let mockSave: SaveGame;
let mockReady = true;
let mockPending = false;
let mockQueue = true;
const mockListeners = new Set<(state: string) => void>();
const mockAd = jest.fn();
jest.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, cb: (state: string) => void) => {
      mockListeners.add(cb);
      return { remove: () => mockListeners.delete(cb) };
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
}));
jest.mock('../../state/careerStore', () => ({
  useCareer: Object.assign((select: (s: unknown) => unknown) => select({ save: mockSave }), {
    getState: () => ({ save: mockSave, synchronizeEnergyClock: () => false }),
  }),
}));
jest.mock('../../hooks/useEnergyClock', () => ({ useEnergyClock: jest.fn() }));
jest.mock('../../hooks/useAdsReady', () => ({ useAdsReady: () => mockReady }));
jest.mock('../../services/rewardedEnergy', () => ({
  requestRewardedEnergy: (id: string) => mockAd(id),
  useRewardedEnergyPending: () => mockPending,
}));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { critical: 1 },
  useModalQueue: (requested: boolean) => requested && mockQueue,
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../CountUp', () => ({ CountUp: 'CountUp' }));
jest.mock('../Icon', () => ({ Icon: 'Icon' }));
jest.mock('../../theme', () => ({
  useColors: () => ({}),
  useThemedStyles: () => ({}),
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: { lg: 16 },
}));
import { EnergyRecoveryModal } from '../EnergyRecoveryModal';
import { WalletBar } from '../WalletBar';
import { useEnergyRecovery } from '../../state/energyRecoveryStore';
configureReactRenderEnvironment();

describe('actual energy popup interaction and lifecycle', () => {
  let tree: ReactTestRenderer | undefined;
  const render = async (enabled = true) => {
    await act(async () => {
      const node = createElement(EnergyRecoveryModal, { enabled });
      if (tree) tree.update(node);
      else tree = create(node);
    });
  };
  const text = () => JSON.stringify(tree!.toJSON());
  const adButton = () =>
    tree!.root
      .findAllByType('Button' as never)
      .find((b) => /Watch ad|Ad unavailable|Energy full/.test(b.props.label))!;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.UTC(2026, 9, 23));
    mockReady = true;
    mockPending = false;
    mockQueue = true;
    mockAd.mockReset();
    mockAd.mockResolvedValue({ ok: true, energyAdded: 8 });
    mockSave = {
      id: 'player',
      mode: 'career',
      wallet: { coins: 0, gems: 0, energy: 12, energyUpdatedAt: Date.now() },
      entitlements: { removeAds: false },
    } as SaveGame;
    useEnergyRecovery.setState({ saveId: null });
  });
  afterEach(async () => {
    await act(async () => {
      tree?.unmount();
    });
    tree = undefined;
    mockListeners.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('opens on request, shows both accurate countdowns, updates while visible and closes', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    await render();
    expect(tree!.toJSON()).toBeNull();
    await act(async () => useEnergyRecovery.getState().open());
    expect(text()).toContain('3m 0s');
    expect(text()).toContain('1h 12m 0s');
    expect(adButton().props.label).toBe('Watch ad · +8 energy');
    await act(async () => jest.advanceTimersByTime(1000));
    expect(text()).toContain('2m 59s');
    expect(text()).toContain('1h 11m 59s');
    await act(async () =>
      tree!.root
        .findAllByType('Button' as never)
        .find((b) => b.props.label === 'Close')!
        .props.onPress(),
    );
    expect(tree!.toJSON()).toBeNull();
    expect(clear).toHaveBeenCalledWith(intervals.mock.results[0].value);
  });
  it('shows the VIP cap and actual remaining reward instead of promising8at58', async () => {
    mockSave.entitlements.removeAds = true;
    mockSave.wallet.energy = 58;
    useEnergyRecovery.setState({ saveId: 'player' });
    await render();
    expect(text()).toContain('60');
    expect(adButton().props.label).toBe('Watch ad · +2 energy');
  });
  it.each(['full', 'unavailable', 'pending'])(
    'disables ad action when%s without hiding free recovery',
    async (state) => {
      if (state === 'full') mockSave.wallet.energy = 36;
      if (state === 'unavailable') mockReady = false;
      if (state === 'pending') mockPending = true;
      useEnergyRecovery.setState({ saveId: 'player' });
      await render();
      expect(adButton().props.disabled).toBe(true);
      expect(text()).toContain('Waiting is free.');
      expect(mockAd).not.toHaveBeenCalled();
    },
  );
  it('waits for completed ad delivery and shows honest success/failure feedback', async () => {
    useEnergyRecovery.setState({ saveId: 'player' });
    await render();
    await act(async () => adButton().props.onPress());
    expect(mockAd).toHaveBeenCalledWith('player');
    expect(text()).toContain('8 energy added.');
    mockAd.mockResolvedValue({ ok: false, reason: 'No fill. Free recovery continues.' });
    await act(async () => adButton().props.onPress());
    expect(text()).toContain('No fill. Free recovery continues.');
  });
  it('cleans up countdown ticks in background, refreshes on return and respects the modal queue', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    useEnergyRecovery.setState({ saveId: 'player' });
    await render();
    await act(async () => mockListeners.forEach((cb) => cb('background')));
    expect(tree!.toJSON()).toBeNull();
    expect(clear).toHaveBeenCalledWith(intervals.mock.results[0].value);
    await act(async () => jest.advanceTimersByTime(60_000));
    await act(async () => mockListeners.forEach((cb) => cb('active')));
    expect(text()).toContain('2m 0s');
    mockQueue = false;
    await render();
    expect(tree!.toJSON()).toBeNull();
  });
  it('closes rather than carrying an energy dialog to another career or ineligible audience', async () => {
    useEnergyRecovery.setState({ saveId: 'player' });
    await render();
    mockSave = { ...mockSave, id: 'other' };
    await render();
    expect(useEnergyRecovery.getState().saveId).toBeNull();
    useEnergyRecovery.setState({ saveId: 'other' });
    await render(false);
    expect(tree!.toJSON()).toBeNull();
    expect(useEnergyRecovery.getState().saveId).toBeNull();
  });
  it('the real WalletBar energy tap opens this dialog with the same VIP denominator', async () => {
    mockSave.entitlements.removeAds = true;
    await act(async () => {
      tree = create(
        createElement(
          Fragment,
          null,
          createElement(WalletBar, { wallet: mockSave.wallet }),
          createElement(EnergyRecoveryModal, { enabled: true }),
        ),
      );
    });
    const meter = tree!.root
      .findAllByType('Pressable' as never)
      .find((p) => p.props.accessibilityLabel?.startsWith('Energy '))!;
    expect(meter.props.accessibilityLabel).toContain('of 60');
    await act(async () => meter.props.onPress());
    expect(useEnergyRecovery.getState().saveId).toBe('player');
    expect(text()).toContain('Match energy');
  });
});
