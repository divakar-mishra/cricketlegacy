import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave, createManagerSave } from '../../game/createGame';
import { achievementsForMode, totalGamerscore } from '../../game/achievements';
import { RecordsScreen } from '../RecordsScreen';
import { PlayerLifeScreen } from '../PlayerLifeScreen';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();

let mockSave: SaveGame | null;
const mockLoad = jest.fn();
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  TextInput: 'TextInput',
  Share: { share: jest.fn() },
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-reanimated', () => {
  const transition = { duration: (_: number) => transition, delay: (_: number) => transition };
  return { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: transition };
});
jest.mock('../../components', () => ({
  Button: 'Button',
  BannerAdSlot: 'BannerAdSlot',
  Card: 'Card',
  Icon: 'Icon',
  LeagueTable: 'LeagueTable',
  NewspaperModal: 'NewspaperModal',
  ProgressBar: 'ProgressBar',
  Screen: 'Screen',
  ScreenHeader: 'ScreenHeader',
  SegmentedControl: 'SegmentedControl',
  SponsorLogo: 'SponsorLogo',
  SponsorMark: 'SponsorMark',
}));
jest.mock('../../components/AppText', () => ({ AppText: 'Text' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../components/VenueIllustration', () => ({ VenueIllustration: 'VenueIllustration' }));
jest.mock('../../components/PlayerLifeAssetCard', () => ({
  PlayerLifeAssetCard: 'PlayerLifeAssetCard',
  PLAYER_LIFE_ART: {},
}));
jest.mock('../../state/careerStore', () => ({
  useCareer: (selector: (state: unknown) => unknown) => selector({ save: mockSave }),
}));
jest.mock('../../state/hofStore', () => ({
  useHallOfFame: (selector: (state: unknown) => unknown) =>
    selector({ board: { players: [], managers: [] }, load: mockLoad }),
}));
jest.mock('../../theme', () => ({
  fonts: {},
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: {},
  useTheme: () => ({ colors: {} }),
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({}),
}));

function career(): SaveGame {
  return createCareerSave({
    player: buildUserPlayer({
      name: 'Navigation QA',
      age: 16,
      nationality: 'india',
      role: 'ALLROUNDER',
      battingStyle: 'RHB',
      bowlingStyle: 'PACE',
      batting: { technique: 40, timing: 40, power: 40, footwork: 40, temperament: 40, running: 40 },
      bowling: { paceOrSpin: 40, accuracy: 40, movement: 40, variations: 40, stamina: 40 },
      fielding: { catching: 40, throwing: 40, agility: 40, keeping: 40 },
      meta: { fitness: 80, confidence: 60, aggression: 50, discipline: 70 },
    }),
    teamId: 'bengaluru-royals',
    difficulty: 'NORMAL',
    seed: 51510,
  });
}

describe('real screen navigation destinations', () => {
  let tree: ReactTestRenderer;
  let currentScreen: typeof RecordsScreen | typeof PlayerLifeScreen;
  let route: { name: string; key: string; params?: { initialTab?: string } };
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() };
  const update = () => tree.update(createElement(currentScreen as any, { navigation, route }));
  const render = (screen: typeof currentScreen, name: string, initialTab?: string) => {
    currentScreen = screen;
    route = { name, key: name, params: initialTab ? { initialTab } : undefined };
    act(() => {
      tree = create(createElement(screen as any, { navigation, route }));
    });
  };
  const recordSections = () =>
    tree.root
      .findAllByType('SegmentedControl' as any)
      .find((node) => node.props.accessibilityLabel === 'Records sections')!;
  const buttons = (label: string) =>
    tree.root.findAllByType('Button' as any).filter((node) => node.props.label === label);
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave = career();
    navigation.setParams.mockImplementation((params) => {
      route = { ...route, params };
      update();
    });
  });
  afterEach(() => act(() => tree?.unmount()));

  it.each(['achievements', 'hof'] as const)(
    'opens %s immediately rather than Records first',
    (tab) => {
      render(RecordsScreen, 'Records', tab);
      expect(recordSections().props.value).toBe(tab);
      expect(tree.root.findByType('Screen' as any).props.careerNavigation).toBe(true);
    },
  );
  it('defaults an ordinary Records link to Records', () => {
    render(RecordsScreen, 'Records');
    expect(recordSections().props.value).toBe('records');
  });
  it('honors a changed deep link on the same Records component after manual tab selection', () => {
    render(RecordsScreen, 'Records', 'achievements');
    act(() => recordSections().props.onChange('hof'));
    expect(recordSections().props.value).toBe('hof');
    act(() => {
      route = { ...route, params: { initialTab: 'achievements' } };
      update();
    });
    expect(recordSections().props.value).toBe('achievements');
    expect(tree.root.findByType('Screen' as any).props.scrollResetKey).toBe(
      `${mockSave!.id}:achievements`,
    );
  });
  it('does not retain a special Records tab when opened without tab parameters again', () => {
    render(RecordsScreen, 'Records', 'hof');
    act(() => {
      route = { ...route, params: undefined };
      update();
    });
    expect(recordSections().props.value).toBe('records');
  });
  it('puts Portfolio under Finances, not the Career overview', () => {
    render(PlayerLifeScreen, 'PlayerLife');
    expect(buttons('Portfolio · Locked')).toHaveLength(0);
    act(() =>
      tree.root
        .findAllByType('Pressable' as any)
        .find((node) => node.props.accessibilityLabel === 'Finances')!
        .props.onPress(),
    );
    expect(navigation.setParams).toHaveBeenCalledWith({ initialTab: 'finance' });
    expect(buttons('Portfolio · Locked')).toHaveLength(1);
    expect(buttons('Portfolio · Locked')[0].props.disabled).toBe(true);
  });
  it('keeps an unlocked senior Portfolio a direct, non-spending destination', () => {
    mockSave!.players[mockSave!.userPlayerId!].age = 18;
    mockSave!.careerPathLevel = 'DOMESTIC';
    render(PlayerLifeScreen, 'PlayerLife', 'finance');
    expect(buttons('Stock Portfolio')[0].props.disabled).toBe(false);
    act(() => buttons('Stock Portfolio')[0].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('InvestmentScreen');
  });
  it('keeps Portfolio locked for an adult still in youth cricket', () => {
    mockSave!.players[mockSave!.userPlayerId!].age = 18;
    mockSave!.careerPathLevel = 'U19';
    render(PlayerLifeScreen, 'PlayerLife', 'finance');
    expect(buttons('Portfolio · Locked')[0].props.disabled).toBe(true);
  });
  it('updates an already mounted Player Life screen for a new media deep link', () => {
    render(PlayerLifeScreen, 'PlayerLife', 'media');
    act(() =>
      tree.root
        .findAllByType('Pressable' as any)
        .find((node) => node.props.accessibilityLabel === 'Finances')!
        .props.onPress(),
    );
    expect(buttons('Portfolio · Locked')).toHaveLength(1);
    act(() => {
      route = { ...route, params: { initialTab: 'media' } };
      update();
    });
    expect(buttons('Portfolio · Locked')).toHaveLength(0);
    expect(
      tree.root
        .findAllByType('Pressable' as any)
        .find((node) => node.props.accessibilityLabel === 'Kit & media')!.props.accessibilityState
        .selected,
    ).toBe(true);
  });
  it('opens Hall of Fame directly from Player Life Legacy', () => {
    render(PlayerLifeScreen, 'PlayerLife', 'legacy');
    act(() => buttons('Hall of Fame')[0].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('Records', { initialTab: 'hof' });
  });
  it.each([RecordsScreen, PlayerLifeScreen])(
    'shows an empty state without a save instead of throwing',
    (screen) => {
      mockSave = null;
      render(screen, screen === RecordsScreen ? 'Records' : 'PlayerLife');
      expect(tree.root.findByType('Screen' as any).props.careerNavigation).not.toBe(true);
    },
  );

  describe.each(['career', 'manager'] as const)('%s achievement summary copy', (mode) => {
    beforeEach(() => {
      if (mode === 'manager') {
        mockSave = createManagerSave({
          teamId: 'manager_india_t3_1',
          country: 'india',
          difficulty: 'NORMAL',
          seed: 351,
        });
      }
    });

    const summaryCases = [
      { label: 'No achievements yet', count: (_total: number) => 0 },
      { label: 'Building your collection', count: (_total: number) => 1 },
      { label: 'Building your collection', count: (total: number) => Math.ceil(total * 0.3) - 1 },
      { label: '🥈 Rising achiever', count: (total: number) => Math.ceil(total * 0.3) },
      { label: '🥈 Rising achiever', count: (total: number) => Math.ceil(total * 0.6) - 1 },
      { label: '🥇 Elite collector', count: (total: number) => Math.ceil(total * 0.6) },
      { label: '🥇 Elite collector', count: (total: number) => Math.ceil(total * 0.9) - 1 },
      { label: '🏆 Legendary completionist', count: (total: number) => Math.ceil(total * 0.9) },
      { label: '🏆 Legendary completionist', count: (total: number) => total },
    ];

    it.each(summaryCases)('shows $label without changing the save or rewards (%#)', ({ label, count }) => {
      const catalog = achievementsForMode(mockSave!);
      mockSave!.achievements = catalog.slice(0, count(catalog.length)).map((entry) => entry.id);
      const before = JSON.stringify(mockSave);
      const gamerscore = totalGamerscore(mockSave!);
      render(RecordsScreen, 'Records', 'achievements');
      const messages = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
      expect(messages).toContain(label);
      if (label !== 'No achievements yet') expect(messages).not.toContain('No achievements yet');
      expect(JSON.stringify(mockSave)).toBe(before);
      expect(totalGamerscore(mockSave!)).toBe(gamerscore);
    });

    it('treats missing legacy achievement state as empty without mutating it', () => {
      delete mockSave!.achievements;
      const before = JSON.stringify(mockSave);
      render(RecordsScreen, 'Records', 'achievements');
      expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).toContain('No achievements yet');
      expect(JSON.stringify(mockSave)).toBe(before);
    });

    it('ignores unknown IDs and counts duplicate earned IDs only once', () => {
      const first = achievementsForMode(mockSave!)[0].id;
      mockSave!.achievements = [first, first, 'unknown_legacy_achievement'];
      const before = JSON.stringify(mockSave);
      render(RecordsScreen, 'Records', 'achievements');
      const messages = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
      expect(messages).toContain('Building your collection');
      expect(messages).not.toContain('No achievements yet');
      expect(recordSections().props.options).toContainEqual({ value: 'achievements', label: 'Achievements (1)' });
      expect(JSON.stringify(mockSave)).toBe(before);
    });
  });
});
jest.mock('../../components/CareerGuide', () => require('../../test/coachGuideMock'));
