import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Screen } from '../Screen';
jest.mock('../CareerGuide', () => require('../../test/coachGuideMock'));

const mockDimensions = { width: 320, height: 640, scale: 1, fontScale: 1 };
const mockInsets = { top: 24, left: 0, right: 0, bottom: 24 };
jest.mock('react-native', () => ({
  ScrollView: 'ScrollView', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  useWindowDimensions: () => mockDimensions,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => mockInsets,
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../GlassSurface', () => ({ GlassBlurProvider: 'GlassBlurProvider' }));
jest.mock('../CareerNavigation', () => ({ CareerNavigation: 'CareerNavigation' }));
jest.mock('../../theme', () => ({
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  useTheme: () => ({
    colors: { bg: '#121110', bgElevated: '#1C1A17', border: '#39342C' },
    gradients: { night: ['#121110', '#1C1A17'] },
  }),
}));

const flatten = (style: any): Record<string, any> => Array.isArray(style)
  ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style ?? {};
const screenElement = (props: Omit<ComponentProps<typeof Screen>, 'children'> = {}) =>
  createElement(Screen, props as ComponentProps<typeof Screen>, 'body');

describe('shared screen edge spacing', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  beforeEach(() => {
    warning = jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.assign(mockDimensions, { width: 320, height: 640 });
    Object.assign(mockInsets, { top: 24, left: 0, right: 0, bottom: 24 });
  });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });

  it.each([320, 360, 390, 430, 600, 1024])(
    'keeps at least 5dp outside the existing 12dp scene bleed at width %i', width => {
      mockDimensions.width = width;
      act(() => { tree = create(screenElement({ scroll: true })); });
      const body = flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle);
      expect(body.paddingHorizontal - 12).toBeGreaterThanOrEqual(5);
      expect(body.paddingHorizontal).toBeLessThanOrEqual(24);
      expect(body).toMatchObject({ maxWidth: 980, width: '100%' });
    },
  );

  it('protects the body on both sides and at the bottom when there is no footer', () => {
    act(() => { tree = create(screenElement()); });
    expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(
      expect.arrayContaining(['top', 'left', 'right', 'bottom']),
    );
  });

  it.each([false, true])('protects landscape actions without double-counting the bottom inset (scroll=%s)', scroll => {
    Object.assign(mockDimensions, { width: 844, height: 390 });
    Object.assign(mockInsets, { left: 44, right: 24, bottom: 34 });
    const action = createElement('Action' as any, { testID: 'footer-action' }, 'Continue season');
    act(() => { tree = create(screenElement({ scroll, footer: action })); });
    const safeArea = tree.root.findByType('SafeAreaView' as any);
    expect(safeArea.props.edges).toEqual(['top', 'left', 'right']);
    const button = tree.root.findByProps({ testID: 'footer-action' });
    const footerContent = flatten(button.parent!.props.style);
    const footer = flatten(button.parent!.parent!.props.style);
    expect(footerContent).toMatchObject({ paddingHorizontal: 24, maxWidth: 980, width: '100%' });
    expect(footer).toMatchObject({ paddingLeft: 44, paddingRight: 24, paddingBottom: 46, flexShrink: 0 });
    // No top inset on the footer; no absolutely positioned overlay on the body.
    expect(footer.paddingTop).toBe(12);
    expect(footer.position).not.toBe('absolute');
    expect(footerContent.position).not.toBe('absolute');
  });

  it('keeps body and footer constrained to the same tablet content width', () => {
    mockDimensions.width = 1366;
    const action = createElement('Action' as any, { testID: 'footer-action' });
    act(() => { tree = create(screenElement({ scroll: true, footer: action })); });
    const body = flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle);
    const footerContent = flatten(tree.root.findByProps({ testID: 'footer-action' }).parent!.props.style);
    expect(footerContent.maxWidth).toBe(body.maxWidth);
    expect(footerContent.paddingHorizontal).toBe(body.paddingHorizontal);
    expect(footerContent.alignSelf).toBe(body.alignSelf);
  });

  it('updates side protection and gutters after rotation', () => {
    act(() => { tree = create(screenElement({ scroll: true })); });
    expect(flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle).paddingHorizontal).toBe(20);
    Object.assign(mockDimensions, { width: 844, height: 390 });
    Object.assign(mockInsets, { left: 44, right: 24 });
    act(() => { tree.update(screenElement({ scroll: true })); });
    expect(flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle).paddingHorizontal).toBe(24);
    expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(
      expect.arrayContaining(['left', 'right']),
    );
  });

  it('preserves the intentionally unpadded splash background', () => {
    act(() => { tree = create(screenElement({ scroll: true, padded: false })); });
    expect(flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle)).toMatchObject({
      paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0,
    });
  });

  it('recomputes gutters and footer safe areas across repeated narrow/wide window changes', () => {
    // A generic window-resize contract, NOT an iPhone Duo native-fold test.
    const action = createElement('Action' as any, { testID: 'resize-action' });
    const props = { scroll: true, footer: action };
    act(() => { tree = create(screenElement(props)); });
    for (const [width, height, left, right] of [
      [375, 667, 0, 0], [820, 700, 40, 20], [440, 956, 0, 0], [375, 667, 0, 0],
    ]) {
      Object.assign(mockDimensions, { width, height });
      Object.assign(mockInsets, { left, right });
      act(() => { tree.update(screenElement(props)); });
      const body = flatten(tree.root.findByType('ScrollView' as any).props.contentContainerStyle);
      const button = tree.root.findByProps({ testID: 'resize-action' });
      const footerContent = flatten(button.parent!.props.style);
      const footer = flatten(button.parent!.parent!.props.style);
      expect(body.paddingHorizontal).toBe(width < 480 ? 20 : 24);
      expect(footerContent.paddingHorizontal).toBe(body.paddingHorizontal);
      expect(footer).toMatchObject({ paddingLeft: left, paddingRight: right, flexShrink: 0 });
      expect(body.width).toBe('100%');
      expect(body.maxWidth).toBe(980);
    }
  });
});
