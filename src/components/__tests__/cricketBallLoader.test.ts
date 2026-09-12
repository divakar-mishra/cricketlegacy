import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CricketBallLoader } from '../CricketBallLoader';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockTiming = jest.fn();
let mockReducedMotion = false;
jest.mock('react-native', () => ({
  View: 'View', StyleSheet: { create: (value: unknown) => value },
  Easing: { linear: 'linear' },
  Animated: {
    View: 'AnimatedView',
    Value: class { setValue() {} interpolate(value: unknown) { return value; } },
    timing: (...args: unknown[]) => mockTiming(...args),
    loop: () => ({ start: mockStart, stop: mockStop }),
  },
}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs',
  Path: 'Path', RadialGradient: 'RadialGradient', Stop: 'Stop',
}));
jest.mock('../../theme', () => ({ useColors: () => ({
  danger: '#E5484D', dangerDark: '#B93A3E', white: '#FFFFFF',
}) }));

describe('cricket ball saving indicator', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    mockReducedMotion = false;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

  it('spins natively, announces its purpose without visible text, and stops on unmount', () => {
    act(() => { tree = create(createElement(CricketBallLoader)); });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockTiming).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      useNativeDriver: true, isInteraction: false,
    }));
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityLabel)
      .toBe('Saving match result');
    expect(tree.root.findAll((node) => typeof node.props.children === 'string')).toHaveLength(0);
    act(() => tree.unmount());
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('keeps a static ball when reduced motion is requested', () => {
    mockReducedMotion = true;
    act(() => { tree = create(createElement(CricketBallLoader)); });
    expect(mockStart).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityState)
      .toEqual({ busy: true });
  });
});
