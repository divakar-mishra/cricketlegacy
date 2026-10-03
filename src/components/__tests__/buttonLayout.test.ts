import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Button } from '../Button';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' },
  useAnimatedStyle: () => ({}), useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../audio', () => ({ moment: jest.fn() }));
jest.mock('../../theme', () => ({
  fonts: { bold: 'Inter' }, fontSize: { sm: 13, md: 15, lg: 17 },
  fontWeight: { bold: '700', medium: '500' }, radius: { md: 12 },
  shadow: { soft: {} }, spacing: { lg: 20, xs: 4 },
  useTheme: () => ({
    isDark: true, colors: { white: '#fff', text: '#eee', textMuted: '#999', black: '#000' },
    gradients: { brand: ['#080', '#040'], gold: ['#ff0', '#aa0'] },
  }),
}));

const flatten = (style: any): Record<string, any> => Array.isArray(style)
  ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style ?? {};

describe('buttons used beside copy and inside narrow action rows', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  beforeEach(() => { warning = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });

  it.each(['₹449.00', 'Restore Purchases', 'Complete this season to claim your collection'])(
    'keeps %s intrinsic without percentage-width descendants or hidden labels', label => {
      act(() => { tree = create(createElement(Button, { label, fullWidth: false, subtitle: 'One-time purchase' })); });
      const root = tree.root.findByType('AnimatedView' as any);
      expect(flatten(root.props.style).width).toBeUndefined();
      // This is the shared cause of the narrow text column in the VIP card.
      for (const node of tree.root.findAll(n => typeof n.type === 'string')) {
        expect(flatten(node.props.style).width).not.toBe('100%');
      }
      const labels = tree.root.findAllByType('Text' as any);
      expect(labels.map(n => n.props.children)).toEqual([label, 'One-time purchase']);
      expect(labels.every(n => n.props.numberOfLines == null)).toBe(true);
      expect(labels.every(n => !n.props.adjustsFontSizeToFit)).toBe(true);
    },
  );

  it('fills a stacked card without allowing its button height to collapse', () => {
    act(() => { tree = create(createElement(Button, { label: 'Buy', fullWidth: true })); });
    expect(flatten(tree.root.findByType('AnimatedView' as any).props.style)).toMatchObject({
      width: '100%', flexShrink: 0,
    });
  });

  it('preserves explicit equal-width action layouts and disabled purchase semantics', () => {
    act(() => { tree = create(createElement(Button, {
      label: 'Unavailable', fullWidth: false, disabled: true, style: { flex: 1 },
    })); });
    expect(flatten(tree.root.findByType('AnimatedView' as any).props.style).flex).toBe(1);
    expect(tree.root.findByType('Pressable' as any).props).toMatchObject({
      disabled: true, accessibilityLabel: 'Unavailable', accessibilityState: { disabled: true },
    });
  });
});
