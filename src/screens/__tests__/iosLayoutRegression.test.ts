import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { createManagerSave } from '../../game/createGame';
import { PlayerProfileScreen } from '../PlayerProfileScreen';
import { ManagerLeadershipScreen } from '../ManagerLeadershipScreen';
import { WageBreakdownScreen } from '../WageBreakdownScreen';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
let mockSave: SaveGame;
const mockRenew = jest.fn();
const mockAppoint = jest.fn();
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  FadeInDown: { duration: () => undefined },
}));
jest.mock('../../components', () => ({
  AppText: 'Text',
  Button: 'Button',
  Card: 'Card',
  CountryFlag: 'CountryFlag',
  PlayerAvatar: 'PlayerAvatar',
  ProgressBar: 'ProgressBar',
  Screen: 'Screen',
  ScreenHeader: 'ScreenHeader',
  SponsorBrandRow: 'SponsorBrandRow',
  Icon: 'Icon',
  SegmentedControl: 'SegmentedControl',
}));
jest.mock('../../components/AppText', () => ({ AppText: 'Text' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../state/careerStore', () => ({
  useCareer: (selector: (state: unknown) => unknown) =>
    selector({ save: mockSave, renewDeal: mockRenew, appointManagerLeader: mockAppoint }),
}));
jest.mock('../../theme', () => ({
  fonts: {},
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: {},
  useTheme: () => ({ colors: { accent: '#cca' } }),
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({ accent: '#cca' }),
}));

describe('iOS audit layout regressions', () => {
  let tree: ReactTestRenderer;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave = createManagerSave({
      teamId: 'manager_india_t3_1',
      country: 'india',
      difficulty: 'NORMAL',
      seed: 351,
    });
  });
  afterEach(() => act(() => tree?.unmount()));

  it('bounds the ledger and leaves safe-area ownership to Screen, without auto-anchoring its first row', () => {
    act(() => {
      tree = create(createElement(WageBreakdownScreen, { navigation } as any));
    });
    const list = tree.root.findByType('FlashList' as any);
    expect(list.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(list.props.automaticallyAdjustContentInsets).toBe(false);
    expect(list.props.maintainVisibleContentPosition).toEqual({ disabled: true });
    expect(list.parent?.props.style).toMatchObject({ flex: 1, minHeight: 0 });
    expect(list.props.data).toHaveLength(mockSave.teams[mockSave.userTeamId!].playerIds.length);
    expect(mockRenew).not.toHaveBeenCalled();
  });

  it('gives Selected and Swap role intrinsic width without changing appointments', () => {
    act(() => {
      tree = create(createElement(ManagerLeadershipScreen, { navigation } as any));
    });
    const buttons = tree.root.findAllByType('Button' as any);
    const selected = buttons.find((node) => node.props.label === 'Selected')!;
    expect(selected).toBeDefined();
    expect(selected.props.disabled).toBe(true);
    expect(selected.props.style).toMatchObject({ minWidth: 108, flexShrink: 0 });
    expect(selected.props.style.width).toBeUndefined();
    expect(buttons.some((node) => node.props.label === 'Swap role')).toBe(true);
    expect(mockAppoint).not.toHaveBeenCalled();
  });

  it('renders full attribute labels with wrapping instead of ellipsis', () => {
    const playerId = mockSave.teams[mockSave.userTeamId!].playerIds[0];
    act(() => {
      tree = create(
        createElement(PlayerProfileScreen, {
          navigation,
          route: { params: { playerId } },
        } as any),
      );
    });
    const label = tree.root
      .findAllByType('Text' as any)
      .find((node) => node.props.children === 'Temperament')!;
    expect(label).toBeDefined();
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.style).toMatchObject({ flexBasis: 110, flexShrink: 1 });
  });

  it('does not line-limit the player role, pathway or readiness details', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'CareerHubScreen.tsx'), 'utf8');
    for (const style of ['mastheadRole', 'mastheadPath', 'mastheadReadiness']) {
      expect(source).toContain(`<Text style={styles.${style}}>`);
      expect(source).not.toMatch(new RegExp(`<Text style=\\{styles\\.${style}\\} numberOfLines`));
    }
  });
});
jest.mock('../../components/CareerGuide', () => require('../../test/coachGuideMock'));
