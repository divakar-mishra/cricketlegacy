import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { OtherGamesPrompt } from '../OtherGamesPrompt';
import { OTHER_GAMES_GAP_MS, OTHER_GAMES_HISTORY_KEY, OTHER_GAMES_PLAY_URL, OTHER_GAMES_START_AT } from '../../services/otherGamesPromotion';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

let mockFocused = true;
let mockAppState = 'active';
let mockQueueAvailable = true;
let mockContractVisible = false;
let mockSave: any = { entitlements: { removeAds: false } };
const mockSettings = { hasHydrated: true, hasOnboarded: true, playedMatchesAllModes: 5 };
const mockListeners = new Set<(state: string) => void>();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({
  Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
  Platform: { OS: 'android' }, Linking: { openURL: jest.fn() },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 320, height: 480 }),
  AppState: {
    get currentState() { return mockAppState; },
    addEventListener: (_: string, callback: (state: string) => void) => {
      mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) };
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { prompt: 3 }, useModalQueue: (wants: boolean) => wants && mockQueueAvailable,
}));
jest.mock('../../services/storeReview', () => ({ hasRatingExperience: (count: number) => Number.isFinite(count) && count >= 5 }));
jest.mock('../../state/careerStore', () => ({ useCareer: (select: any) => select({ save: mockSave }) }));
jest.mock('../../state/settingsStore', () => ({ useSettings: (select: any) => select(mockSettings) }));
jest.mock('../../state/contractPresentationStore', () => ({
  useContractPresentation: (select: any) => select({ signed: mockContractVisible ? {} : null }),
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../GlassSurface', () => ({ GlassSurface: 'GlassSurface' }));
jest.mock('../../theme', () => ({
  useColors: () => ({ text: '#fff', textMuted: '#ddd', overlay: '#000b', surface: '#151920', accent: '#e8b332' }),
  fontSize: { xl: 24, sm: 14, xs: 12 }, fontWeight: { bold: '700' }, radius: { lg: 16 }, spacing: { lg: 20, md: 12 },
}));

configureReactRenderEnvironment();
describe('real publisher popup plus durable campaign history', () => {
  let tree: ReactTestRenderer | undefined;
  const render = async (eligible = true) => {
    await act(async () => {
      const element = createElement(OtherGamesPrompt, { eligible });
      if (tree) tree.update(element); else tree = create(element);
    });
  };
  const visible = () => tree!.root.findAllByType('Modal' as any).length === 1;
  const button = (label: string) => tree!.root.findAllByType('Button' as any).find(node => node.props.label === label)!;
  const restart = async () => { act(() => tree?.unmount()); tree = undefined; await render(); };
  const history = async () => JSON.parse((await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY))!);
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }); jest.setSystemTime(OTHER_GAMES_START_AT);
    jest.clearAllMocks(); await AsyncStorage.clear();
    jest.mocked(Linking.openURL).mockReset().mockResolvedValue(undefined);
    (Platform as any).OS = 'android';
    mockFocused = true; mockAppState = 'active'; mockQueueAvailable = true; mockContractVisible = false;
    mockSave = { id: 'active-player', entitlements: { removeAds: false } };
    Object.assign(mockSettings, { hasHydrated: true, hasOnboarded: true, playedMatchesAllModes: 5 });
  });
  afterEach(() => {
    act(() => tree?.unmount()); tree = undefined;
    expect(mockListeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    jest.restoreAllMocks(); jest.useRealTimers();
  });

  it('shows clear optional copy, opaque themed card and exact Google Play CTA without auto-opening', async () => {
    await render();
    expect(visible()).toBe(true);
    expect((await history()).impressions).toBe(1);
    expect(button('View on Google Play')).toBeDefined();
    expect(button('Not now')).toBeDefined();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(tree!.root.findByType('GlassSurface' as any).props.blur).toBe(false);
    expect(tree!.root.findByType('GlassSurface' as any).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#151920' })]));
    expect(tree!.root.findByType('ScrollView' as any).props.accessibilityViewIsModal).toBe(true);
  });
  it('never claims beforeNov15and becomes eligible on the exact timer boundary', async () => {
    jest.setSystemTime(OTHER_GAMES_START_AT - 1000);
    await render(); expect(visible()).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(999); });
    expect(visible()).toBe(false);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(visible()).toBe(true);
    expect((await history()).impressions).toBe(1);
  });
  it('waits until foreground if the app sleeps across the launch date', async () => {
    jest.setSystemTime(OTHER_GAMES_START_AT - 60_000); mockAppState = 'background';
    await render(); expect(visible()).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    jest.setSystemTime(OTHER_GAMES_START_AT + 60_000);
    await act(async () => { mockAppState = 'active'; mockListeners.forEach(listener => listener(mockAppState)); });
    expect(visible()).toBe(true);
    expect((await history()).impressions).toBe(1);
  });
  it.each(['back', 'outside', 'not now'])('%s dismisses, never opens Play or repeats on the same day', async action => {
    await render();
    act(() => {
      if (action === 'back') tree!.root.findByType('Modal' as any).props.onRequestClose();
      else if (action === 'outside') tree!.root.findByType('Pressable' as any).props.onPress();
      else button('Not now').props.onPress();
    });
    expect(visible()).toBe(false); expect(Linking.openURL).not.toHaveBeenCalled();
    await restart(); expect(visible()).toBe(false);
    expect((await history()).impressions).toBe(1);
  });
  it('allows the second appearance48hours later and never a third across remounts/modes', async () => {
    await render(); act(() => button('Not now').props.onPress());
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS - 1);
    await restart(); expect(visible()).toBe(false);
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS);
    mockSave.id = 'a-different-manager-save';
    await restart(); expect(visible()).toBe(true);
    act(() => button('Not now').props.onPress());
    jest.setSystemTime(OTHER_GAMES_START_AT + 100 * OTHER_GAMES_GAP_MS);
    await restart(); expect(visible()).toBe(false);
    expect((await history()).impressions).toBe(2);
  });
  it.each(['not hydrated', 'onboarding', 'four matches', 'no save', 'unfocused', 'background', 'contract', 'hub overlay', 'ios', 'web',
    'VIP', 'timed ad removal', 'legacy premium'])('does not consume an appearance while %s', async reason => {
      if (reason === 'not hydrated') mockSettings.hasHydrated = false;
      if (reason === 'onboarding') mockSettings.hasOnboarded = false;
      if (reason === 'four matches') mockSettings.playedMatchesAllModes = 4;
      if (reason === 'no save') mockSave = null;
      if (reason === 'unfocused') mockFocused = false;
      if (reason === 'background') mockAppState = 'background';
      if (reason === 'contract') mockContractVisible = true;
      if (reason === 'ios' || reason === 'web') (Platform as any).OS = reason;
      if (reason === 'VIP') mockSave.entitlements.removeAds = true;
      if (reason === 'timed ad removal') mockSave.entitlements.removeAdsUntil = Date.now() + 10000;
      if (reason === 'legacy premium') mockSave.entitlements.seasonPass = { premium: true, expiresAt: Date.now() + 10000 };
      await render(reason !== 'hub overlay');
      expect(visible()).toBe(false); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  it('waits for the existing modal queue without reserving an unseen impression', async () => {
    mockQueueAvailable = false; await render();
    expect(visible()).toBe(false); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    mockQueueAvailable = true; await render(); expect(visible()).toBe(true);
    expect((await history()).impressions).toBe(1);
  });
  it('opens only after a tap, prevents rapid double launches and permanently stops prompts', async () => {
    await render(); const onPress = button('View on Google Play').props.onPress;
    await act(async () => { await Promise.all([onPress(), onPress()]); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(OTHER_GAMES_PLAY_URL);
    expect(visible()).toBe(false); expect((await history()).stopped).toBe(true);
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS);
    await restart(); expect(visible()).toBe(false);
  });
  it('keeps a link failure dismissible with an explicit retry but no future automatic ask', async () => {
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('offline'));
    await render(); await act(async () => button('View on Google Play').props.onPress());
    expect(visible()).toBe(true);
    expect(tree!.root.findAllByType('Text' as any).some(node => node.props.accessibilityRole === 'alert')).toBe(true);
    expect((await history()).stopped).toBe(true);
    await act(async () => button('View on Google Play').props.onPress()); expect(visible()).toBe(false);
  });
  it('fails closed when the impression cannot be persisted', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    await render(); expect(visible()).toBe(false);
    expect(await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY)).toBeNull();
  });
  it('does not launch a late store link if the user dismisses while the stop marker is writing', async () => {
    await render();
    const setItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let finish!: () => void;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce((key, raw) => new Promise(resolve => {
      finish = () => { void setItem(key, raw).then(() => resolve()); };
    }));
    let pending!: Promise<void>;
    await act(async () => { pending = button('View on Google Play').props.onPress(); });
    act(() => button('Not now').props.onPress());
    await act(async () => { finish(); await pending; });
    expect(visible()).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect((await history()).stopped).toBe(true);
  });
  it.each(['blur', 'background', 'new VIP'])('does not reopen a claimed card after %s then return', async reason => {
    await render(); expect(visible()).toBe(true);
    if (reason === 'blur') { mockFocused = false; await render(); }
    if (reason === 'background') await act(async () => {
      mockAppState = 'background'; mockListeners.forEach(listener => listener(mockAppState));
    });
    if (reason === 'new VIP') { mockSave.entitlements.removeAds = true; await render(); }
    expect(visible()).toBe(false);
    mockFocused = true; mockSave.entitlements.removeAds = false;
    await act(async () => { mockAppState = 'active'; mockListeners.forEach(listener => listener(mockAppState)); });
    await render(); expect(visible()).toBe(false);
    expect((await history()).impressions).toBe(1);
  });
});
