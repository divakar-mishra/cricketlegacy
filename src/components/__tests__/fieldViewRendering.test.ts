import { createElement } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FieldView } from '../FieldView';

let mockQuality = 'high';
let mockReducedMotion = false;
const mockMotionStart = jest.fn();

jest.mock('react-native', () => {
  const motion = () => ({ start: mockMotionStart, stop: jest.fn() });
  return {
    View: 'View',
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Animated: {
      View: 'AnimatedView',
      Value: class {
        stopAnimation() {}
        setValue() {}
        interpolate(config: { outputRange: unknown[] }) {
          return config.outputRange.at(-1);
        }
      },
      parallel: motion,
      sequence: motion,
      delay: motion,
      timing: motion,
    },
  };
});
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../../state/settingsStore', () => ({
  useSettings: (select: (state: { graphics: string }) => unknown) =>
    select({ graphics: mockQuality }),
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../../theme', () => ({
  useColors: () => ({
    text: '#EEE8D8',
    textMuted: '#A8B5B3',
    border: '#334448',
    bgElevated: '#182733',
    primaryLight: '#67C89F',
    accent: '#CBA85F',
    accentLight: '#F1D698',
    accentDark: '#876522',
    danger: '#DF5555',
    info: '#55AAD0',
    white: '#FFFFFF',
  }),
}));
jest.mock('react-native-svg', () => ({
  ClipPath: 'clipPath',
  __esModule: true,
  default: 'svg',
  Circle: 'circle',
  Defs: 'defs',
  Ellipse: 'ellipse',
  G: 'g',
  Line: 'line',
  LinearGradient: 'linearGradient',
  Path: 'path',
  RadialGradient: 'radialGradient',
  Rect: 'rect',
  Stop: 'stop',
  Text: 'text',
}));

let consoleSpy: jest.SpyInstance;
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  consoleSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated.')) return;
    originalError(...args);
  });
});
afterAll(() => {
  consoleSpy.mockRestore();
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});
beforeEach(() => {
  mockQuality = 'high';
  mockReducedMotion = false;
  mockMotionStart.mockClear();
});

describe('live match renderer', () => {
  it.each(['striker', 'nonStriker', 'bowler'] as const)('equips only the controlled %s', (position) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(createElement(FieldView, {
        animate: false,
        userKitId: 'kit_blue',
        userBatterPosition: position === 'bowler' ? null : position,
        userIsBowler: position === 'bowler',
      }));
    });
    const patterns = tree.root.findAll((node) => node.type === 'g' && node.props.testID === 'kit-pattern-chevron');
    expect(patterns).toHaveLength(1);
    act(() => tree.update(createElement(FieldView, { animate: false, userKitId: 'kit_blue' })));
    expect(tree.root.findAll((node) => node.type === 'g' && node.props.testID === 'kit-pattern-chevron')).toHaveLength(0);
    act(() => tree.unmount());
  });
  it.each([220, 280, 360, 420])('renders all roles and own-player state at %ipx', (size) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        createElement(FieldView, { size, animate: false, userBatterPosition: 'striker' }),
      );
    });
    const spriteCount = (role: string) =>
      tree.root.findAll(
        (node) => String(node.type) === 'AnimatedView' && node.props.testID === `live-player-${role}`,
      ).length;
    expect(spriteCount('fielder')).toBe(9);
    expect(spriteCount('batter')).toBe(2);
    expect(spriteCount('bowler')).toBe(1);
    expect(spriteCount('keeper')).toBe(1);
    expect(tree.root.findAll(node => node.type === 'g' && node.props.testID === 'match-jersey-tailoring')).toHaveLength(13);
    expect(tree.root.findAll(node => node.type === 'path' && node.props.testID === 'bat-blade')).toHaveLength(2);
    expect(tree.root.findAll(node => node.type === 'path' && node.props.testID === 'keeper-gloves')).toHaveLength(1);
    expect(tree.root.findAll(node => node.type === 'path' && node.props.testID === 'fielder-cap-brim')).toHaveLength(9);
    expect(
      tree.root.find((node) => node.props.accessibilityRole === 'image').props.accessibilityLabel,
    ).toContain('Your player is on strike');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/NaN|Infinity/);
    expect(mockMotionStart).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it.each([1, 2, 3, 4, 5])(
    'shows the actual level %i ground with a complete playing XI',
    (level) => {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          createElement(FieldView, {
            size: 340,
            animate: false,
            groundAppearance: { capacityLevel: level, experienceLevel: level },
            lastShot: { key: 1, tone: 'four', runs: 4, reach: 0.9, angleDeg: 90 },
          }),
        );
      });
      expect(
        tree.root.findAll(
          (node) => node.type === 'g' && String(node.props.testID).startsWith('live-stand-'),
        ),
      ).toHaveLength([4, 8, 12, 12, 12][level - 1]);
      expect(
        tree.root.findAll(
          (node) => node.type === 'g' && String(node.props.testID).startsWith('live-sightscreen-'),
        ),
      ).toHaveLength(2);
      expect(JSON.stringify(tree.toJSON())).toContain('Boundary');
      act(() => tree.unmount());
    },
  );

  it.each(['reduced', 'low', 'fast'])(
    'keeps %s motion static without hiding the result',
    (mode) => {
      mockReducedMotion = mode === 'reduced';
      mockQuality = mode === 'low' ? 'low' : 'high';
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          createElement(FieldView, {
            animate: mode !== 'fast',
            stadiumTheme: 'stadium_noir',
            userBatterPosition: 'nonStriker',
            lastShot: { key: 2, tone: 'six', runs: 6, reach: 0.99, angleDeg: 0 },
          }),
        );
      });
      expect(mockMotionStart).not.toHaveBeenCalled();
      expect(JSON.stringify(tree.toJSON())).toContain('Over the rope');
      expect(
        tree.root.find((node) => node.props.accessibilityRole === 'image').props.accessibilityLabel,
      ).toContain('Your player is the non-striker');
      act(() => tree.unmount());
    },
  );
});
