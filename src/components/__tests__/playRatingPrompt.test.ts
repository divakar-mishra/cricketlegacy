import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PlayRatingPrompt } from '../PlayRatingPrompt';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

let mockFocused = true;
let mockAppState = 'active';
let mockSeen = false;
let mockQueueAvailable = true;
let mockContractVisible = false;
let mockQaTools = false;
const mockSettings = { hasHydrated: true, hasOnboarded: true, playedMatchesAllModes: 5 };
const mockListeners = new Set<(state: string) => void>();
const mockHasSeen = jest.fn(async () => mockSeen);
const mockClaim = jest.fn(async (isCurrent: () => boolean) => {
  if (mockSeen || !isCurrent()) return false;
  mockSeen = true;
  return true;
});
const mockOpen = jest.fn(async () => true);

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../../config/qa', () => ({
  get QA_TOOLS_ENABLED() {
    return mockQaTools;
  },
}));
jest.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  Platform: { OS: 'android' },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 320, height: 480 }),
  AppState: {
    get currentState() {
      return mockAppState;
    },
    addEventListener: (_: string, callback: (state: string) => void) => {
      mockListeners.add(callback);
      return { remove: () => mockListeners.delete(callback) };
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { prompt: 3 },
  useModalQueue: (wants: boolean) => wants && mockQueueAvailable,
}));
jest.mock('../../services/storeReview', () => ({
  hasSeenPlayRatingPrompt: () => mockHasSeen(),
  claimPlayRatingPrompt: (guard: () => boolean) => mockClaim(guard),
  openPlayStoreReview: () => mockOpen(),
  hasRatingExperience: (count: number) => Number.isFinite(count) && count >= 5,
}));
jest.mock('../../state/settingsStore', () => ({
  useSettings: (selector: any) => selector(mockSettings),
}));
jest.mock('../../state/contractPresentationStore', () => ({
  useContractPresentation: (selector: any) => selector({ signed: mockContractVisible ? {} : null }),
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../GlassSurface', () => ({ GlassSurface: 'GlassSurface' }));
jest.mock('../../theme', () => ({
  useColors: () => ({ text: '#fff', textMuted: '#ddd', overlay: '#000b', surface: '#151920' }),
  fontSize: { xl: 24, sm: 14 },
  fontWeight: { bold: '700' },
  radius: { lg: 16 },
  spacing: { lg: 20, md: 12 },
}));

configureReactRenderEnvironment();
describe('real rating popup controls and lifecycle', () => {
  let tree: ReactTestRenderer | undefined;
  const render = async (eligible = true, qaPreview = false, onDismiss?: () => void) => {
    await act(async () => {
      const element = createElement(PlayRatingPrompt, { eligible, qaPreview, onDismiss });
      if (tree) tree.update(element);
      else tree = create(element);
    });
  };
  const visible = () => tree!.root.findAllByType('Modal' as any).length === 1;
  const button = (label: string) =>
    tree!.root.findAllByType('Button' as any).find((node) => node.props.label === label)!;
  beforeEach(() => {
    mockFocused = true;
    mockAppState = 'active';
    mockSeen = false;
    mockQueueAvailable = true;
    mockContractVisible = false;
    mockQaTools = false;
    Object.assign(mockSettings, {
      hasHydrated: true,
      hasOnboarded: true,
      playedMatchesAllModes: 5,
    });
    jest.clearAllMocks();
    mockOpen.mockReset().mockResolvedValue(true);
  });
  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    expect(mockListeners.size).toBe(0);
  });
  it('shows a neutral, optional invitation after five completed matches', async () => {
    await render();
    expect(visible()).toBe(true);
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(button('Rate on Google Play')).toBeDefined();
    expect(button('Not now')).toBeDefined();
    expect(tree!.root.findByType('GlassSurface' as any).props.blur).toBe(false);
    expect(tree!.root.findByType('GlassSurface' as any).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#151920' })]),
    );
    expect(tree!.root.findByType('ScrollView' as any).props.accessibilityViewIsModal).toBe(true);
  });
  it('cannot bypass production eligibility through the QA preview prop', async () => {
    mockSettings.playedMatchesAllModes = 0;
    await render(true, true);
    expect(visible()).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
  });
  it('previews the exact popup without reading/writing real prompt history or matches', async () => {
    mockQaTools = true;
    mockSeen = true;
    mockSettings.playedMatchesAllModes = 0;
    const onDismiss = jest.fn();
    await render(true, true, onDismiss);
    expect(visible()).toBe(true);
    expect(mockHasSeen).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSettings.playedMatchesAllModes).toBe(0);
    const close = button('Not now').props.onPress;
    act(() => {
      close();
      close();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSeen).toBe(true);
    expect(visible()).toBe(false);
  });
  it('enabling QA tools alone does not change the real five-match/history policy', async () => {
    mockQaTools = true;
    mockSettings.playedMatchesAllModes = 4;
    await render();
    expect(visible()).toBe(false);
    mockSettings.playedMatchesAllModes = 5;
    mockSeen = true;
    await render();
    expect(visible()).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
  });
  it.each([
    'not hydrated',
    'onboarding',
    'four matches',
    'invalid count',
    'unfocused',
    'background',
    'contract',
    'hub overlay',
  ])('defers without consuming prompt history while %s', async (reason) => {
    if (reason === 'not hydrated') mockSettings.hasHydrated = false;
    if (reason === 'onboarding') mockSettings.hasOnboarded = false;
    if (reason === 'four matches') mockSettings.playedMatchesAllModes = 4;
    if (reason === 'invalid count') mockSettings.playedMatchesAllModes = NaN;
    if (reason === 'unfocused') mockFocused = false;
    if (reason === 'background') mockAppState = 'background';
    if (reason === 'contract') mockContractVisible = true;
    await render(reason !== 'hub overlay');
    expect(visible()).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
  });
  it('waits for competing queued dialogs to finish', async () => {
    mockQueueAvailable = false;
    await render();
    expect(visible()).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
    mockQueueAvailable = true;
    await render();
    expect(visible()).toBe(true);
  });
  it('does not show again on another mount or a different retained hub', async () => {
    await render();
    act(() => button('Not now').props.onPress());
    expect(visible()).toBe(false);
    act(() => tree!.unmount());
    tree = undefined;
    await render();
    expect(visible()).toBe(false);
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
  it.each(['back', 'outside', 'not now'])(
    'supports %s dismissal without opening Play',
    async (action) => {
      await render();
      act(() => {
        if (action === 'back') tree!.root.findByType('Modal' as any).props.onRequestClose();
        else if (action === 'outside') tree!.root.findByType('Pressable' as any).props.onPress();
        else button('Not now').props.onPress();
      });
      expect(visible()).toBe(false);
      expect(mockOpen).not.toHaveBeenCalled();
    },
  );
  it('opens the store on an explicit tap, prevents duplicate launches and closes', async () => {
    await render();
    const rate = button('Rate on Google Play');
    await act(async () => {
      await Promise.all([rate.props.onPress(), rate.props.onPress()]);
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(visible()).toBe(false);
  });
  it('keeps a dismissible error when neither store link opens', async () => {
    mockOpen.mockResolvedValue(false);
    await render();
    await act(async () => {
      await button('Rate on Google Play').props.onPress();
    });
    expect(visible()).toBe(true);
    expect(
      tree!.root
        .findAllByType('Text' as any)
        .some((node) => node.props.accessibilityRole === 'alert'),
    ).toBe(true);
    act(() => button('Not now').props.onPress());
    expect(visible()).toBe(false);
  });
  it('hides on blur/background and does not duplicate the claimed invitation', async () => {
    await render();
    mockFocused = false;
    await render();
    expect(visible()).toBe(false);
    mockFocused = true;
    await render();
    expect(visible()).toBe(true);
    act(() => {
      mockAppState = 'background';
      mockListeners.forEach((listener) => listener(mockAppState));
    });
    expect(visible()).toBe(false);
    act(() => {
      mockAppState = 'active';
      mockListeners.forEach((listener) => listener(mockAppState));
    });
    expect(visible()).toBe(true);
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
});
