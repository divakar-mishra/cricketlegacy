import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CareerGuide, GuideScrollView, GuideTarget, replayCareerGuide } from '../CareerGuide';
import { CAREER_GUIDES, type GuideChapter } from '../../content/careerGuides';
import { guideAction, guideStepKey } from '../../game/coachGuide';
import { useSettings } from '../../state/settingsStore';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

// Exercise generic engine edge cases with longer synthetic chapters, independently
// of the owner's shortened production walkthrough. Actual Player flow has its own tests.
jest.mock('../../content/careerGuides', () => ({
  ...jest.requireActual('../../content/careerGuides'),
  CAREER_GUIDES: {
    ...jest.requireActual('../../content/careerGuides').CAREER_GUIDES,
    ...jest.requireActual('../../test/pointerGuideFixtures').POINTER_GUIDE_FIXTURES,
  },
}));

configureReactRenderEnvironment();
let mockFocused = true;
let mockQueue = true;
const mockAnnounce = jest.fn();
const mockActive = jest.fn();
const mockKeyboardDismiss = jest.fn();
const mockKeyboardListeners = new Map<string, Set<(event?: any) => void>>();
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
}));
jest.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  AccessibilityInfo: { announceForAccessibility: (...args: unknown[]) => mockAnnounce(...args) },
  Keyboard: {
    dismiss: () => mockKeyboardDismiss(),
    addListener: (name: string, callback: (event: any) => void) => {
      const callbacks = mockKeyboardListeners.get(name) ?? new Set();
      callbacks.add(callback);
      mockKeyboardListeners.set(name, callbacks);
      return { remove: () => callbacks.delete(callback) };
    },
  },
  BackHandler: { addEventListener: () => ({ remove: jest.fn() }) },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 360, height: 800, fontScale: 1 }),
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { prompt: 3 },
  useModalQueue: (wants: boolean) => wants && mockQueue,
}));
jest.mock('../../state/settingsStore', () => {
  const { create: makeStore } = jest.requireActual('zustand');
  return {
    useSettings: makeStore((set: any) => ({
      hasHydrated: true,
      hasOnboarded: true,
      dismissedTips: [],
      dismissTip: (key: string) =>
        set((s: any) => ({ dismissedTips: [...new Set([...s.dismissedTips, key])] })),
    })),
  };
});
jest.mock('../../theme', () => ({
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: {},
  useTheme: () => ({ colors: {} }),
}));

describe('measured interactive coach', () => {
  let tree: ReactTestRenderer;
  let oldRaf: typeof requestAnimationFrame;
  let oldCancel: typeof cancelAnimationFrame;
  // Children are supplied in createElement's third argument, outside the props object.
  const element = () =>
    createElement(
      CareerGuide,
      { chapter: 'player.attributes', onActiveChange: mockActive } as unknown as ComponentProps<typeof CareerGuide>,
      CAREER_GUIDES['player.attributes'].map(({ target: id }) =>
        createElement(
          GuideTarget,
          { id, key: id } as unknown as ComponentProps<typeof GuideTarget>,
          createElement('ActualControl', { onPress: () => guideAction('attribute-increased') }),
        ),
      ),
    );
  const render = (atPlus = true) => {
    act(() => {
      tree = create(element(), {
        createNodeMock: (node) =>
          node.type === 'View'
            ? {
                measureInWindow: (cb: (...args: number[]) => void) =>
                  (node.props as { testID?: string }).testID === 'guide-root'
                    ? cb(0, 0, 360, 800)
                    : cb(24, 250, 220, 44),
              }
            : null,
      });
    });
    // Action tests begin after the user has read the top-to-bottom setup intro.
    // A separate test below asserts the complete entry sequence from the top.
    if (atPlus) for (const step of CAREER_GUIDES['player.attributes'].slice(0, 3)) {
      settle();
      if (text().includes(step.title)) act(() => button('Next').props.onPress());
    }
    mockKeyboardDismiss.mockClear();
  };
  const settle = () => act(() => jest.runAllTimers());
  const text = () => JSON.stringify(tree.toJSON());
  const button = (label: string) =>
    tree.root.findAllByType('Button' as any).find((n) => n.props.label === label)!;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockKeyboardListeners.clear();
    mockFocused = true;
    mockQueue = true;
    useSettings.setState({ hasHydrated: true, hasOnboarded: true, dismissedTips: [] });
    oldRaf = global.requestAnimationFrame;
    oldCancel = global.cancelAnimationFrame;
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number;
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    global.requestAnimationFrame = oldRaf;
    global.cancelAnimationFrame = oldCancel;
  });
  it('enters attributes at the top and explains pathway, difficulty and budget before revealing +', () => {
    render(false);
    settle();
    expect(text()).toContain('Choose your starting pathway');
    act(() => guideAction('attribute-increased'));
    expect(text()).toContain('Choose your starting pathway');
    for (const title of ['Choose your challenge', 'Your starting points and rating', 'Build the skills you want']) {
      act(() => button('Next').props.onPress());
      settle();
      expect(text()).toContain(title);
    }
    act(() => guideAction('attribute-increased'));
    settle();
    expect(text()).toContain('Shape the rest of your skills');
  });
  it('highlights the actual + and waits for an action, not elapsed time', () => {
    render();
    settle();
    expect(tree.root.findAllByProps({ testID: 'guide-highlight' })).toHaveLength(1);
    expect(text()).toContain('Build the skills you want');
    act(() => jest.advanceTimersByTime(60_000));
    expect(text()).toContain('Build the skills you want');
    act(() => guideAction('some-other-action'));
    expect(text()).toContain('Build the skills you want');
    act(() => tree.root.findByProps({ testID: 'guide-target-attribute-plus' }).findByType('ActualControl' as any).props.onPress());
    settle();
    expect(text()).toContain('Shape the rest of your skills');
    expect(useSettings.getState().dismissedTips).toContain(
      guideStepKey('player.attributes', 'attribute-plus'),
    );
    expect(mockAnnounce).toHaveBeenCalled();
  });
  it('supports Back without demanding another spend, and resumes after remount', () => {
    render();
    settle();
    act(() => guideAction('attribute-increased'));
    settle();
    act(() => button('Back').props.onPress());
    settle();
    expect(button('Next')).toBeDefined();
    act(() => button('Next').props.onPress());
    settle();
    act(() => tree.unmount());
    render();
    settle();
    expect(text()).toContain('Shape the rest of your skills');
  });
  it('skips only this career mode and supports replay of the completed screen', () => {
    render();
    settle();
    act(() => button('Skip guide').props.onPress());
    settle();
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    expect(useSettings.getState().dismissedTips).toContain('coach-v1:skip:player');
    expect(useSettings.getState().dismissedTips).not.toContain('coach-v1:skip:manager');
    act(() => replayCareerGuide('player.attributes'));
    settle();
    expect(text()).toContain('Choose your starting pathway');
  });
  it.each([
    'background route',
    'higher priority modal',
    'settings not hydrated',
    'welcome incomplete',
  ])('does not coach or consume actions during %s', (reason) => {
    mockFocused = reason !== 'background route';
    mockQueue = reason !== 'higher priority modal';
    useSettings.setState({
      hasHydrated: reason !== 'settings not hydrated',
      hasOnboarded: reason !== 'welcome incomplete',
    });
    render();
    settle();
    act(() => guideAction('attribute-increased'));
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    expect(useSettings.getState().dismissedTips).toEqual([]);
  });
  it('does not block the screen when an optional anchor is absent', () => {
    act(() => {
      tree = create(
        createElement(
          CareerGuide,
          { chapter: 'player.attributes' } as unknown as ComponentProps<typeof CareerGuide>,
          createElement('ScreenContent'),
        ),
      );
    });
    settle();
    expect(tree.root.findAllByType('ScreenContent' as any)).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
  });
  it('releases the live-match pause callback when leaving the screen', () => {
    render();
    settle();
    expect(mockActive).toHaveBeenLastCalledWith(true);
    act(() => tree.unmount());
    expect(mockActive).toHaveBeenLastCalledWith(false);
  });
  it('dismisses the keyboard on guide advancement', () => {
    render();
    settle();
    act(() => guideAction('attribute-increased'));
    settle();
    expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
  });
  it('moves/shrinks the card into the visible area above the keyboard', () => {
    render();
    settle();
    act(() =>
      mockKeyboardListeners
        .get('keyboardDidShow')
        ?.forEach((callback) => callback({ endCoordinates: { screenY: 400 } })),
    );
    settle();
    const card = tree.root.findByProps({ testID: 'guide-card' });
    const layout = card.props.style[1];
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(400);
    expect(layout.top).toBeGreaterThanOrEqual(24);
    act(() => mockKeyboardListeners.get('keyboardDidHide')?.forEach((callback) => callback()));
    settle();
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(1);
  });
  it('does not let guide Next bypass a required missing name, even through a direct handler call', () => {
    const identity = (ready: boolean) => createElement(CareerGuide,
      { chapter: 'player.identity', layout: 'docked' } as unknown as ComponentProps<typeof CareerGuide>,
      ['name', 'country', 'gender', 'portrait', 'role', 'creation-next'].map(id =>
        createElement(GuideTarget, { id, key: id, ready } as unknown as ComponentProps<typeof GuideTarget>, createElement('ActualControl'))),
    );
    act(() => {
      tree = create(identity(false), { createNodeMock: node => node.type === 'View' ? {
        measureInWindow: (cb: (...args: number[]) => void) => (node.props as { testID?: string }).testID === 'guide-root' ? cb(0, 0, 360, 800) : cb(24, 100, 280, 48),
      } : null });
    });
    settle();
    expect(button('Next').props.disabled).toBe(true);
    act(() => button('Next').props.onPress());
    expect(text()).toContain('Make this your player');
    expect(useSettings.getState().dismissedTips).toEqual([]);
    act(() => tree.update(identity(true)));
    settle();
    expect(button('Next').props.disabled).toBe(false);
    act(() => button('Next').props.onPress());
    settle();
    expect(text()).toContain('Choose your cricket country');
    // Clearing a required value again must disable Next even if earlier guide
    // progress was recorded. Skipping the whole guide never bypasses form guards.
    act(() => tree.update(identity(false)));
    settle();
    expect(button('Next').props.disabled).toBe(true);
  });
  it('reserves a separate creation-coach area instead of covering avatar options', () => {
    act(() => {
      tree = create(createElement(CareerGuide,
        { chapter: 'player.identity', layout: 'docked' } as unknown as ComponentProps<typeof CareerGuide>,
        createElement(GuideTarget, { id: 'name', ready: false } as unknown as ComponentProps<typeof GuideTarget>, createElement('ActualControl')),
      ), { createNodeMock: node => node.type === 'View' ? {
        measureInWindow: (cb: (...args: number[]) => void) => (node.props as { testID?: string }).testID === 'guide-root' ? cb(0, 0, 360, 800) : cb(24, 100, 280, 48),
      } : null });
    });
    settle();
    const body = tree.root.findByProps({ testID: 'guide-screen-body' });
    const card = tree.root.findByProps({ testID: 'guide-card' });
    expect(body.props.style.height).toBe(card.props.style[1].top);
    expect(card.props.style[1].top + card.props.style[1].maxHeight).toBeLessThanOrEqual(776);
    expect(body.findAllByType('ActualControl' as any)).toHaveLength(1);
  });
  const sessionElement = (chapter: GuideChapter = 'player.identity', ready = true) => createElement(CareerGuide,
    { chapter, layout: 'docked', progress: 'session' } as unknown as ComponentProps<typeof CareerGuide>,
    CAREER_GUIDES[chapter].map(step => createElement(GuideTarget,
      { id: step.target, key: step.target, ready } as unknown as ComponentProps<typeof GuideTarget>, createElement('ActualControl'))),
  );
  const sessionOptions = { createNodeMock: (node: any) => node.type === 'View' ? {
    measureInWindow: (cb: (...args: number[]) => void) => node.props.testID === 'guide-root'
      ? cb(0, 0, 360, 800) : cb(24, 100, 280, 48),
  } : null };
  it('starts a new blank creation at name despite old completed/skip settings, then covers country, gender and colour in order', () => {
    const previous = [
      ...CAREER_GUIDES['player.identity'].map(step => guideStepKey('player.identity', step.target)),
      'coach-v1:skip:player', 'unrelated-tip',
    ];
    useSettings.setState({ dismissedTips: previous });
    act(() => { tree = create(sessionElement('player.identity', false), sessionOptions); });
    settle();
    expect(text()).toContain('Make this your player');
    expect(button('Next').props.disabled).toBe(true);
    act(() => button('Next').props.onPress());
    expect(text()).toContain('Make this your player');
    act(() => tree.update(sessionElement()));
    settle();
    for (const title of ['Choose your cricket country', 'Choose your player’s gender', 'Choose your skin tone', 'Choose your look', 'Choose your role']) {
      act(() => button('Next').props.onPress());
      settle();
      expect(text()).toContain(title);
    }
    expect(useSettings.getState().dismissedTips).toEqual(previous);
    act(() => tree.unmount());
    act(() => { tree = create(sessionElement(), sessionOptions); });
    settle();
    expect(text()).toContain('Make this your player');
  });
  it('keeps creation progress when going back from attributes but a fresh Manager form never inherits it', () => {
    act(() => { tree = create(sessionElement(), sessionOptions); });
    settle();
    act(() => button('Next').props.onPress());
    settle();
    act(() => tree.update(sessionElement('player.attributes')));
    settle();
    expect(text()).toContain('Choose your starting pathway');
    act(() => tree.update(sessionElement()));
    settle();
    expect(text()).toContain('Choose your cricket country');
    act(() => button('Skip guide').props.onPress());
    settle();
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    expect(useSettings.getState().dismissedTips).toEqual([]);
    act(() => replayCareerGuide('player.identity'));
    settle();
    expect(text()).toContain('Make this your player');
    act(() => tree.unmount());
    useSettings.setState({ dismissedTips: ['coach-v1:skip:manager', guideStepKey('manager.creation', 'difficulty')] });
    act(() => { tree = create(sessionElement('manager.creation'), sessionOptions); });
    settle();
    expect(text()).toContain('Choose your challenge');
  });
  it('keeps Back/Next/Skip outside scrolling coach text and blocks touching dimmed creation fields', () => {
    act(() => { tree = create(sessionElement(), sessionOptions); });
    settle();
    const copy = tree.root.findByProps({ testID: 'guide-copy' });
    expect(copy.findAllByType('Button' as any)).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'guide-actions' }).findAllByType('Button' as any)).toHaveLength(3);
    const dim = tree.root.findByProps({ testID: 'guide-dim-top' });
    expect(dim.props.pointerEvents).toBe('auto');
    expect(dim.props.onStartShouldSetResponder()).toBe(true);
  });
  it('restores the full creation coach height after the keyboard closes', () => {
    act(() => { tree = create(sessionElement(), sessionOptions); });
    settle();
    const card = () => tree.root.findByProps({ testID: 'guide-card' });
    const before = card().props.style[1].height;
    act(() => mockKeyboardListeners.get('keyboardDidShow')?.forEach(callback => callback({ endCoordinates: { screenY: 400 } })));
    settle();
    const small = card().props.style[1].height;
    expect(small).toBeLessThan(before);
    act(() => card().props.onLayout({ nativeEvent: { layout: { height: small } } }));
    act(() => mockKeyboardListeners.get('keyboardDidHide')?.forEach(callback => callback()));
    settle();
    expect(card().props.style[1].height).toBe(before);
    expect(tree.root.findByProps({ testID: 'guide-actions' }).findAllByType('Button' as any)).toHaveLength(3);
  });
  it.each([48, 800])('locks scrolling to the current %ipx field, with no scrolling past portrait options', height => {
    let nativeOffset = 0;
    const scrollTo = jest.fn(({ y }: { y: number }) => { nativeOffset = y; });
    act(() => {
      tree = create(createElement(CareerGuide,
        { chapter: 'player.identity', layout: 'docked', progress: 'session' } as unknown as ComponentProps<typeof CareerGuide>,
        createElement(GuideScrollView, { testID: 'form-scroll' }, createElement(GuideTarget,
          { id: 'name', ready: false } as unknown as ComponentProps<typeof GuideTarget>, createElement('ActualControl')))), {
        createNodeMock: (node: any) => node.type === 'ScrollView' ? (() => {
          if (node.props.innerViewRef) node.props.innerViewRef.current = {};
          return { scrollTo };
        })() : node.type === 'View' ? {
          measureLayout: (_ancestor: unknown, cb: (...args: number[]) => void) => cb(24, 650, 280, height),
          measureInWindow: (cb: (...args: number[]) => void) => node.props.testID === 'guide-root'
            ? cb(0, 0, 360, 800) : cb(24, 650 - nativeOffset, 280, height),
        } : null,
      });
    });
    settle();
    const scroller = () => tree.root.findAllByType('ScrollView' as any).find(n => n.props.testID === 'form-scroll')!;
    act(() => scroller().props.onLayout({ nativeEvent: { layout: { width: 360, height: 500 } } }));
    act(() => scroller().props.onContentSizeChange(360, 1800));
    settle();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 638, animated: false });
    act(() => scroller().props.onScroll({ nativeEvent: { contentOffset: { y: 638 } } }));
    expect(scroller().props.scrollEnabled).toBe(height > 500);
    expect(scroller().props.bounces).toBe(false);
    act(() => scroller().props.onScroll({ nativeEvent: { contentOffset: { y: 1300 } } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: height > 500 ? 962 : 638, animated: false });
    act(() => scroller().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 638, animated: false });
    settle();
    act(() => button('Skip guide').props.onPress());
    settle();
    expect(scroller().props.scrollEnabled).toBe(true);
  });

  function nativeScrollScene({ delayed = false, height = 1000 } = {}) {
    let nativeOffset = 0;
    const queued: Array<() => void> = [];
    const content = {};
    const scrollTo = jest.fn(); // Deliberately do NOT acknowledge commands here.
    const windows = jest.fn();
    const layouts = jest.fn();
    act(() => {
      tree = create(createElement(CareerGuide,
        { chapter: 'player.identity', layout: 'docked', progress: 'session' } as unknown as ComponentProps<typeof CareerGuide>,
        createElement(GuideScrollView, { testID: 'native-form-scroll' }, ['name', 'country'].map(id => createElement(GuideTarget,
          { id, key: id, ready: true } as unknown as ComponentProps<typeof GuideTarget>, createElement('ActualControl'))))), {
        createNodeMock: (node: any) => {
          if (node.type === 'ScrollView') {
            if (node.props.innerViewRef) node.props.innerViewRef.current = content;
            return { scrollTo };
          }
          if (node.type !== 'View') return null;
          const root = node.props.testID === 'guide-root';
          const y = node.props.testID === 'guide-target-country' ? 650 : 200;
          return {
            measureInWindow: (cb: (...args: number[]) => void) => {
              windows();
              if (root) cb(0, 0, 360, 800);
              else cb(24, y - nativeOffset, 280, height);
            },
            measureLayout: (ancestor: unknown, cb: (...args: number[]) => void) => {
              expect(ancestor).toBe(content);
              layouts();
              const complete = () => cb(24, y, 280, height);
              if (delayed) queued.push(complete);
              else complete();
            },
          };
        },
      });
    });
    const scroller = () => tree.root.findAllByType('ScrollView' as any).find(node => node.props.testID === 'native-form-scroll')!;
    const layout = () => act(() => {
      scroller().props.onLayout({ nativeEvent: { layout: { width: 360, height: 500 } } });
      scroller().props.onContentSizeChange(360, 2400);
    });
    const nativeScroll = (y: number) => act(() => {
      nativeOffset = y;
      scroller().props.onScroll({ nativeEvent: { contentOffset: { y } } });
    });
    const targetLayout = (id = 'name') => act(() => tree.root.findByProps({ testID: `guide-target-${id}` }).props.onLayout());
    const completeNext = () => act(() => queued.shift()?.());
    layout();
    settle();
    return { scrollTo, windows, layouts, layout, nativeScroll, targetLayout, completeNext };
  }

  it('does not remeasure native views or re-scroll on every normal drag frame', () => {
    const native = nativeScrollScene();
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 188, animated: false });
    native.nativeScroll(188); // First native acknowledgement arrives separately.
    settle();
    const windows = native.windows.mock.calls.length;
    const layouts = native.layouts.mock.calls.length;
    for (let y = 200; y <= 580; y += 10) {
      native.nativeScroll(y);
      act(() => jest.advanceTimersByTime(16));
    }
    expect(native.windows).toHaveBeenCalledTimes(windows);
    expect(native.layouts).toHaveBeenCalledTimes(layouts);
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) native.layout();
    settle();
    expect(native.layouts).toHaveBeenCalledTimes(layouts);
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
  });
  it('coalesces reveal requests and never adds optimistic offsets to delayed native measurements', () => {
    const native = nativeScrollScene({ delayed: true });
    expect(native.layouts).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) native.targetLayout();
    settle();
    expect(native.layouts).toHaveBeenCalledTimes(2); // One batch, not twenty.
    native.completeNext(); // Superseded native result must not scroll.
    expect(native.scrollTo).not.toHaveBeenCalled();
    native.completeNext();
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 188, animated: false });
    native.targetLayout();
    settle();
    native.completeNext(); // Native offset is STILL zero; do not issue 376, etc.
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
    native.nativeScroll(188);
    native.targetLayout();
    settle();
    native.completeNext();
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
  });
  it('sends only one correction while the same out-of-range native scroll is still pending', () => {
    const native = nativeScrollScene();
    native.nativeScroll(188);
    native.scrollTo.mockClear();
    for (let i = 0; i < 30; i++) native.nativeScroll(1000);
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 712, animated: false });
    native.nativeScroll(712);
    native.nativeScroll(712);
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
  });
  it('ignores delayed results from a previous guide step and after leaving the screen', () => {
    const native = nativeScrollScene({ delayed: true, height: 48 });
    act(() => button('Next').props.onPress());
    settle();
    native.completeNext(); // Old name geometry, now on country.
    expect(native.scrollTo).not.toHaveBeenCalled();
    native.completeNext();
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 638, animated: false });
    native.nativeScroll(638);
    native.targetLayout('country');
    settle();
    act(() => tree.unmount());
    native.completeNext();
    expect(native.scrollTo).toHaveBeenCalledTimes(1);
  });
});
