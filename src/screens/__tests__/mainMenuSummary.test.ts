import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MainMenuScreen } from '../MainMenuScreen';
import type { ResolvedSummary } from '../../storage/saveGames';

const mockSummary = jest.fn();
const mockLoad = jest.fn();
const mockActive = jest.fn();
const mockAlert = jest.fn();
let mockRefresh = 0;
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => {
  const { useEffect } = jest.requireActual('react'); useEffect(callback, [callback]);
} }));
jest.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', BackHandler: {}, Platform: { OS: 'ios' },
  StyleSheet: { create: (v: unknown) => v } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation };
  return { __esModule: true, default: { View: 'AnimatedView' }, FadeIn: animation, FadeInDown: animation, FadeInRight: animation };
});
jest.mock('../../components', () => ({ Screen: 'Screen', Emblem: 'Emblem', AppText: 'Text' }));
jest.mock('../../components/HeroBackground', () => ({ HeroBackground: 'Hero' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../services', () => ({ purchases: { MOCK_MODE: true } }));
jest.mock('../../state/careerStore', () => ({ useCareer: (selector: (s: unknown) => unknown) => selector({ setActive: mockActive }) }));
jest.mock('../../state/settingsStore', () => ({ useSettings: (selector: (s: unknown) => unknown) => selector({ playedMatchesAllModes: 0 }) }));
jest.mock('../../services/accountRecovery', () => ({ useAccountBackup: (selector: (s: unknown) => unknown) => selector({ refresh: mockRefresh }) }));
jest.mock('../../storage/saveGames', () => ({ getLastPlayedSummary: (...args: unknown[]) => mockSummary(...args), loadSave: (...args: unknown[]) => mockLoad(...args) }));
jest.mock('../../i18n', () => ({ useT: () => (key: string) => key }));
jest.mock('../../theme', () => ({ fonts: {}, fontSize: {}, fontWeight: {}, radius: {}, shadow: {}, spacing: {},
  useTheme: () => ({ colors: {}, gradients: {} }), useThemedStyles: (factory: (c: unknown) => unknown) => factory({}) }));

const summary = { mode: 'career', slot: 1, summary: { id: 'continue-id', mode: 'career', title: 'Player',
  subtitle: 'Player · Season 2026', hasMatchHistory: false } } as ResolvedSummary;
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
describe('Continue summary and selected full verification', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  const navigation = { navigate: jest.fn() };
  const render = () => act(async () => { tree = create(createElement(MainMenuScreen, { navigation } as any)); });
  const resume = () => tree.root.findAllByType('Pressable' as any)[0].props.onPress();
  beforeEach(() => {
    jest.clearAllMocks(); mockRefresh = 0; mockSummary.mockResolvedValue(summary);
    warning = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });
  it('does not load a world for the Continue card or backup refresh; verifies on tap once', async () => {
    await render();
    expect(mockLoad).not.toHaveBeenCalled();
    mockRefresh++;
    await act(async () => tree.update(createElement(MainMenuScreen, { navigation } as any)));
    expect(mockSummary).toHaveBeenCalledTimes(2);
    expect(mockLoad).not.toHaveBeenCalled();
    const pending = deferred<unknown>();
    mockLoad.mockReturnValue(pending.promise);
    act(() => { resume(); resume(); });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    const save = { id: 'continue-id', mode: 'career' };
    await act(async () => pending.resolve(save));
    expect(mockActive).toHaveBeenCalledWith(save, 'career', 1);
    expect(navigation.navigate).toHaveBeenCalledWith('CareerHub');
  });
  it('rejects a stale Continue identity and never activates a projection', async () => {
    await render();
    mockLoad.mockResolvedValue({ id: 'replacement', mode: 'career' });
    await act(async () => resume());
    expect(mockActive).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Career not opened', expect.stringContaining('career changed'));
  });
  it('stops pending selected verification after leaving the menu', async () => {
    await render();
    const pending = deferred<unknown>();
    mockLoad.mockReturnValue(pending.promise);
    act(() => resume());
    const options = mockLoad.mock.calls[0][2];
    act(() => tree.unmount());
    expect(options.isCurrent()).toBe(false);
    await act(async () => pending.resolve({ id: 'continue-id', mode: 'career' }));
    expect(mockActive).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
