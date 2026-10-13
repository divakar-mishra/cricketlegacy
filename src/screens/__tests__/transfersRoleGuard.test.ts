import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import { TransfersScreen } from '../TransfersScreen';

let mockSave: SaveGame | null = null;
const mockTransferAction = jest.fn();
jest.mock('../../state/careerStore', () => ({
  SCOUT_FULL_REVEAL_GEMS: 1,
  useCareer: (selector: (state: unknown) => unknown) => selector(new Proxy({}, {
    get: (_target, key) => key === 'save' ? mockSave : mockTransferAction,
  })),
}));
jest.mock('react-native', () => ({
  Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 320, height: 640 }),
}));
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' },
  FadeIn: { duration: () => ({}) }, FadeInDown: { duration: () => ({}) },
}));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../components/showShortageOffer', () => ({ showShortageOffer: jest.fn() }));
jest.mock('../../components', () => ({
  AppText: 'Text', Button: 'Button', Card: 'Card', Icon: 'Icon',
  MechanicInfoButton: 'MechanicInfoButton', PlayerStatusBadges: 'PlayerStatusBadges',
  Screen: 'Screen', ScreenHeader: 'ScreenHeader', SegmentedControl: 'SegmentedControl',
}));
jest.mock('../../theme', () => ({
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  fonts: {}, fontSize: {}, fontWeight: {}, radius: {}, shadow: {},
  useTheme: () => ({ colors: {} }),
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({}),
}));

describe('transfer screen role and stale-route recovery', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const renderScreen = () => act(() => {
    tree = create(createElement(TransfersScreen, { navigation } as any));
  });
  beforeEach(() => { warning = jest.spyOn(console, 'error').mockImplementation(() => {}); jest.clearAllMocks(); });
  afterEach(() => { act(() => tree?.unmount()); mockSave = null; warning.mockRestore(); });

  it('gives a Player stuck on the old Transfers route a working return to the career', () => {
    mockSave = makeCareerSave();
    mockSave.currentMonth = 8;
    renderScreen();
    expect(tree.root.findAllByType('FlashList' as any)).toHaveLength(0);
    const button = tree.root.findByType('Button' as any);
    expect(button.props.label).toBe('Return to Player Career');
    act(() => button.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('CareerHub');
    expect(mockTransferAction).not.toHaveBeenCalled();
  });

  it.each(['no-save', 'missing-team'] as const)('renders an honest %s state instead of crashing', kind => {
    mockSave = kind === 'no-save' ? null : makeManagerSave();
    if (mockSave) delete mockSave.teams[mockSave.userTeamId!];
    renderScreen();
    expect(tree.root.findAllByType('FlashList' as any)).toHaveLength(0);
    const button = tree.root.findByType('Button' as any);
    expect(button.props.label).toBe('Back');
    act(() => button.props.onPress());
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('keeps club operations paused on a National Manager stale route', () => {
    mockSave = makeManagerSave();
    mockSave.managerCareerLevel = 'NATIONAL';
    renderScreen();
    expect(tree.root.findAllByType('FlashList' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('Text' as any).map(node => node.props.children)).toContain('Club operations paused');
  });

  it.each(['FIRST_CLASS', 'OFF_SEASON'] as const)('keeps the %s club market visible with the correct signing state', phase => {
    mockSave = makeManagerSave();
    mockSave.managerCalendar!.phase = phase;
    mockSave.currentMonth = 8;
    mockSave.teams[mockSave.userTeamId!].budget = 10_000_000;
    renderScreen();
    const list = tree.root.findByType('FlashList' as any);
    expect(list.props.data.length).toBeGreaterThan(0);
    let row: ReactTestRenderer;
    act(() => { row = create(list.props.renderItem({ item: list.props.data[0], index: 0 })); });
    try {
      const signing = row!.root.findAllByType('Button' as any).find(node => ['Closed', 'Sign'].includes(node.props.label));
      expect(signing).toBeDefined();
      expect(signing!.props.label).toBe(phase === 'FIRST_CLASS' ? 'Closed' : 'Sign');
      expect(signing!.props.disabled).toBe(phase !== 'OFF_SEASON');
    } finally { act(() => row!.unmount()); }
  });
});
