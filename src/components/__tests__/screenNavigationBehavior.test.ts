import { createElement, useEffect, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Screen } from '../Screen';
import { GuideScrollView } from '../CareerGuide';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
jest.mock('../CareerGuide', () => require('../../test/coachGuideMock'));

configureReactRenderEnvironment();
const mockScrollTo = jest.fn();
jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    View: 'View',
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 360, height: 800 }),
    ScrollView: React.forwardRef(function MockScrollView(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return React.createElement('ScrollView', props);
    }),
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('../GlassSurface', () => ({ GlassBlurProvider: 'GlassBlurProvider' }));
jest.mock('../CareerNavigation', () => ({ CareerNavigation: 'CareerNavigation' }));
jest.mock('../../theme', () => ({
  spacing: { xs: 4, md: 12, lg: 16, xl: 24 },
  useTheme: () => ({ colors: {}, gradients: { night: ['black', 'black'] } }),
}));

describe('Screen navigation and scroll behavior', () => {
  let tree: ReactTestRenderer;
  const screenElement = (
    props: Omit<ComponentProps<typeof Screen>, 'children'>,
    content = 'Content',
  ) => createElement(Screen, props as ComponentProps<typeof Screen>, content);
  const render = (props: Omit<ComponentProps<typeof Screen>, 'children'>) =>
    act(() => {
      tree = create(screenElement(props));
    });
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => act(() => tree?.unmount()));
  it('resets a long scrolled page when switching tabs and when switching saves', () => {
    render({ scroll: true, scrollResetKey: 'save-1:home' });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    act(() =>
      tree.update(
        screenElement(
          {
            scroll: true,
            scrollResetKey: 'save-1:progress',
          },
          'Progress',
        ),
      ),
    );
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    act(() =>
      tree.update(
        screenElement(
          {
            scroll: true,
            scrollResetKey: 'save-2:progress',
          },
          'Progress',
        ),
      ),
    );
    expect(mockScrollTo).toHaveBeenCalledTimes(3);
  });
  it('does not reset scroll on ordinary content updates on the same tab', () => {
    render({ scroll: true, scrollResetKey: 'home' });
    act(() => tree.update(screenElement({ scroll: true, scrollResetKey: 'home' }, 'Updated')));
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });
  it('gives each guided form page a fresh native scroller instead of racing coach reveal with scroll-to-top', () => {
    const mounted = jest.fn();
    const unmounted = jest.fn();
    function Probe() {
      useEffect(() => { mounted(); return () => unmounted(); }, []);
      return createElement('Field');
    }
    const guided = (step: number) => createElement(Screen, {
      scroll: true, scrollResetKey: step,
      guide: { chapter: step === 0 ? 'player.identity' : 'player.attributes', progress: 'session', layout: 'docked' },
    } as ComponentProps<typeof Screen>, createElement(Probe));
    act(() => { tree = create(guided(0)); });
    expect(mounted).toHaveBeenCalledTimes(1);
    act(() => tree.update(guided(0)));
    expect(mounted).toHaveBeenCalledTimes(1);
    act(() => tree.update(guided(1)));
    expect(mounted).toHaveBeenCalledTimes(2);
    expect(unmounted).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });
  it('does not add career navigation to match, checkout or other non-opted-in screens', () => {
    render({});
    expect(tree.root.findAllByType('CareerNavigation' as any)).toHaveLength(0);
  });
  it('uses an ordinary native scroller on a plain page and restores guided scrolling on Club', () => {
    render({ scroll: true, scrollResetKey: 0,
      guide: { chapter: 'player.identity', layout: 'docked', progress: 'session' } });
    expect(tree.root.findAllByType(GuideScrollView)).toHaveLength(1);
    act(() => tree.update(screenElement({ scroll: true, scrollResetKey: 1,
      guide: { chapter: 'player.attributes', layout: 'plain', progress: 'session', enabled: false } })));
    expect(tree.root.findAllByType(GuideScrollView)).toHaveLength(0);
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    act(() => tree.update(screenElement({ scroll: true, scrollResetKey: 1,
      guide: { chapter: 'player.attributes', layout: 'plain', progress: 'session', enabled: false } }, 'Changed skills')));
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    act(() => tree.update(screenElement({ scroll: true, scrollResetKey: 2,
      guide: { chapter: 'player.club', layout: 'docked', progress: 'session' } })));
    expect(tree.root.findAllByType(GuideScrollView)).toHaveLength(1);
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });
  it('pins opted-in career navigation outside the scroll body', () => {
    render({ scroll: true, careerNavigation: true });
    expect(tree.root.findAllByType('CareerNavigation' as any)).toHaveLength(1);
    expect(
      tree.root.findByType('ScrollView' as any).findAllByType('CareerNavigation' as any),
    ).toHaveLength(0);
  });
  it('keeps a required Continue/Save action footer instead of showing navigation that bypasses it', () => {
    render({ careerNavigation: true, footer: createElement('RequiredAction') });
    expect(tree.root.findAllByType('RequiredAction' as any)).toHaveLength(1);
    expect(tree.root.findAllByType('CareerNavigation' as any)).toHaveLength(0);
  });
});
