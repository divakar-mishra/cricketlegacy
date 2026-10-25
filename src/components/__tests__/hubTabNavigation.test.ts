import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HubTabBar } from '../HubTabBar';
import { careerTabs } from '../../navigation/careerNavigation';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('../../audio', () => ({ haptics: { selection: jest.fn() } }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../GlassSurface', () => ({ GlassSurface: 'GlassSurface' }));
jest.mock('../../theme', () => ({
  radius: { lg: 16 },
  spacing: { sm: 8, xs: 4 },
  fontWeight: {},
  useTheme: () => ({ colors: {} }),
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({}),
}));

describe('real hub tab interactions', () => {
  let tree: ReactTestRenderer;
  const render = (mode: 'career' | 'manager', national = false) => {
    const tabs = careerTabs(
      mode,
      mode === 'career' ? 'CareerHub' : 'ManagerHub',
      'home',
      national,
    ).map((tab) => ({ ...tab, onPress: jest.fn() }));
    act(() => {
      tree = create(createElement(HubTabBar, { tabs }));
    });
    return tabs;
  };
  afterEach(() => act(() => tree?.unmount()));
  it.each([
    ['career', false, 4],
    ['manager', false, 6],
    ['manager', true, 5],
  ] as const)(
    'renders every %s tab as a labelled selectable control (national=%s)',
    (mode, national, count) => {
      const tabs = render(mode, national);
      const controls = tree.root.findAllByType('Pressable' as any);
      expect(controls).toHaveLength(count);
      controls.forEach((control, index) => {
        expect(control.props.accessibilityRole).toBe('tab');
        expect(control.props.accessibilityLabel).toBe(tabs[index].label);
        expect(control.props.accessibilityState.selected).toBe(index === 0);
        expect(control.props.style).toMatchObject({ flex: 1, minWidth: 0, minHeight: 48 });
        act(() => control.props.onPress());
        expect(tabs[index].onPress).toHaveBeenCalledTimes(1);
      });
    },
  );
  it('preserves one-tap Academy access while adding Team rather than moving Academy deeper', () => {
    const tabs = render('manager');
    expect(tabs.map((tab) => tab.key)).toEqual([
      'home',
      'team',
      'club',
      'store',
      'academy',
      'records',
    ]);
  });
  it('supports a swipe to the next destination and ignores accidental small movements', () => {
    const tabs = render('manager');
    const touch = tree.root.findAllByType('View' as any).find((node) => node.props.onTouchStart)!;
    act(() => {
      touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
      touch.props.onTouchEnd({ nativeEvent: { pageX: 80, pageY: 600 } });
    });
    expect(tabs[1].onPress).not.toHaveBeenCalled();
    act(() => {
      touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
      touch.props.onTouchEnd({ nativeEvent: { pageX: 40, pageY: 600 } });
    });
    expect(tabs[1].onPress).toHaveBeenCalledTimes(1);
  });
  it.each(['touch-end-first', 'press-first'] as const)(
    'activates only one destination for a swipe (%s)',
    (order) => {
      const tabs = render('manager');
      const touch = tree.root.findAllByType('View' as any).find((node) => node.props.onTouchStart)!;
      const home = tree.root.findAllByType('Pressable' as any)[0];
      const end = { nativeEvent: { pageX: 40, pageY: 600 } };
      act(() => {
        touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
        if (order === 'touch-end-first') {
          touch.props.onTouchEnd(end);
          home.props.onPress(end);
        } else {
          home.props.onPress(end);
          touch.props.onTouchEnd(end);
        }
      });
      expect(tabs[1].onPress).toHaveBeenCalledTimes(1);
      expect(tabs[0].onPress).not.toHaveBeenCalled();
    },
  );
  it.each([
    [50, 300],
    [50, -220],
    [50, 50],
    [0, 100],
  ])('ignores vertical/diagonal drags dx=%s dy=%s', (dx, dy) => {
    const tabs = render('manager');
    const touch = tree.root.findAllByType('View' as any).find((node) => node.props.onTouchStart)!;
    const end = { nativeEvent: { pageX: 100 - dx, pageY: 600 + dy } };
    act(() => {
      touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
      touch.props.onTouchEnd(end);
      tree.root.findAllByType('Pressable' as any)[0].props.onPress(end);
    });
    tabs.forEach((tab) => expect(tab.onPress).not.toHaveBeenCalled());
  });
  it('ignores cancelled gestures, then allows the next tap and accessibility activation', () => {
    const tabs = render('manager');
    const touch = tree.root.findAllByType('View' as any).find((node) => node.props.onTouchStart)!;
    const home = tree.root.findAllByType('Pressable' as any)[0];
    act(() => {
      touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
      touch.props.onTouchCancel();
      touch.props.onTouchEnd({ nativeEvent: { pageX: 40, pageY: 600 } });
      home.props.onPress({ nativeEvent: { pageX: 40, pageY: 600 } });
    });
    tabs.forEach((tab) => expect(tab.onPress).not.toHaveBeenCalled());
    act(() => {
      touch.props.onTouchStart({ nativeEvent: { pageX: 100, pageY: 600 } });
      home.props.onPress({ nativeEvent: { pageX: 100, pageY: 600 } });
      touch.props.onTouchEnd({ nativeEvent: { pageX: 100, pageY: 600 } });
      home.props.onPress({ nativeEvent: { pageX: 0, pageY: 0 } });
      home.props.onPress({ nativeEvent: {} });
    });
    expect(tabs[0].onPress).toHaveBeenCalledTimes(3);
  });
});
jest.mock('../CareerGuide', () => require('../../test/coachGuideMock'));
