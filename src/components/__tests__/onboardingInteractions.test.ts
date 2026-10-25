import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Onboarding } from '../Onboarding';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
const mockFinish = jest.fn();
const mockDismiss = jest.fn();
let mockDone = false;
let mockHydrated = true;
let mockQueued = true;
jest.mock('react-native', () => ({ View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' },
  FadeIn: { duration: () => undefined }, FadeInDown: { duration: () => ({ delay: () => undefined }) } }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../Icon', () => ({ Icon: 'Icon' }));
jest.mock('../../services', () => ({ analytics: { logEvent: jest.fn(), EVT: { ONBOARDING_COMPLETE: 'onboarding_complete' } } }));
jest.mock('../../context/ModalQueueContext', () => ({ MODAL_PRIORITY: { prompt: 1 }, useModalQueue: () => mockQueued }));
jest.mock('../../state/settingsStore', () => ({ useSettings: (select: (s: unknown) => unknown) => select({
  hasOnboarded: mockDone, hasHydrated: mockHydrated, setOnboarded: mockFinish, dismissTip: mockDismiss,
}) }));
jest.mock('../../theme', () => ({ fonts: {}, fontSize: {}, fontWeight: {}, radius: {}, shadow: {}, spacing: {},
  useColors: () => ({}), useThemedStyles: (make: (c: object) => object) => make({ text: 'white' }) }));

describe('optional first-launch game guide', () => {
  let tree: ReactTestRenderer;
  const render = () => act(() => { tree = create(createElement(Onboarding)); });
  const button = (label: string) => tree.root.findAllByType('Button' as any).find(n => n.props.label === label)!;
  beforeEach(() => { jest.clearAllMocks(); mockDone = false; mockHydrated = true; mockQueued = true; });
  afterEach(() => act(() => tree?.unmount()));
  it('starts contextual coaching without a timed slideshow', () => {
    render();
    expect(JSON.stringify(tree.toJSON())).not.toContain('1 of 5');
    act(() => button('Guide me').props.onPress());
    expect(mockFinish).toHaveBeenCalledWith(true);
    expect(mockDismiss).not.toHaveBeenCalled();
  });
  it('allows exploring without automatic guides in either career', () => {
    render(); act(() => button('Explore on my own').props.onPress());
    expect(mockFinish).toHaveBeenCalledWith(true);
    expect(mockDismiss.mock.calls.map(args => args[0])).toEqual([
      'coach-v1:skip:common', 'coach-v1:skip:player', 'coach-v1:skip:manager',
    ]);
  });
  it.each(['already completed', 'not hydrated', 'another modal owns the queue'])('does not show the welcome when %s', (state) => {
    mockDone = state === 'already completed';
    mockHydrated = state !== 'not hydrated';
    mockQueued = state !== 'another modal owns the queue';
    render(); expect(tree.toJSON()).toBeNull();
    expect(mockFinish).not.toHaveBeenCalled();
  });
});
