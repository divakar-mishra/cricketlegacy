import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PlayerCreationScreen } from '../PlayerCreationScreen';
import { TeamSelectScreen } from '../TeamSelectScreen';
import { GlassAlert } from '../../components/GlassAlertModal';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
const mockSetActive = jest.fn();
const mockWrite = jest.fn();
const mockLastPlayed = jest.fn();
const mockCreationSlot = jest.fn();
jest.mock('../../components/CareerGuide', () => require('../../test/coachGuideMock'));
jest.mock('../../components/CreationOverview', () => ({ CreationOverview: 'CreationOverview' }));
jest.mock('../../components/AttributesGuidePopup', () => ({ AttributesGuidePopup: 'AttributesGuidePopup' }));
jest.mock('react-native', () => ({
  View: 'View',
  Switch: 'Switch',
  TextInput: 'TextInput',
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('../../components', () => ({
  ...Object.fromEntries(
    [
      'PortraitPicker',
      'Button',
      'Card',
      'CountrySelect',
      'ProgressBar',
      'ScreenHeader',
      'SelectableCard',
      'SegmentedControl',
      'Stepper',
      'AppText',
    ].map((name) => [name, name]),
  ),
  Screen: ({ children, footer, ...props }: any) =>
    require('react').createElement('Screen', props, children, footer),
}));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../services', () => ({
  analytics: {
    setUserProperty: jest.fn(),
    logEvent: jest.fn(),
    EVT: { CAREER_START: 'career_start' },
  },
}));
jest.mock('../../state/careerStore', () => ({
  useCareer: (select: (s: unknown) => unknown) => select({ setActive: mockSetActive }),
}));
jest.mock('../../storage/saveGames', () => ({
  findCreationSlot: (...args: unknown[]) => mockCreationSlot(...args),
  writeSave: (...args: unknown[]) => mockWrite(...args),
  setLastPlayed: (...args: unknown[]) => mockLastPlayed(...args),
}));
jest.mock('../../theme', () => ({
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: {},
  useTheme: () => ({ colors: {} }),
  useThemedStyles: (make: (c: object) => object) => make({}),
}));

describe('full guided Player creation replaces quick-start', () => {
  let tree: ReactTestRenderer;
  const navigation = { reset: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  const render = (params = {}) =>
    act(() => {
      tree = create(createElement(PlayerCreationScreen, { navigation, route: { params } } as any));
    });
  const button = (label: string) =>
    tree.root.findAllByType('Button' as any).find((n) => n.props.label === label)!;
  const chooseAppearanceAndRole = () => {
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseSex('female'));
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseTone());
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChoosePortrait());
    act(() => tree.root.findAllByType('SelectableCard' as any).find(n => n.props.title === 'All-Rounder')!.props.onPress());
  };
  const prepare = (params = {}) => {
    render(params);
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Cricketer'));
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    chooseAppearanceAndRole();
    act(() => button('Next').props.onPress());
    act(() => button('Next').props.onPress());
    act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
    act(() => button('Next').props.onPress());
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrite.mockResolvedValue(undefined);
    mockLastPlayed.mockResolvedValue(undefined);
    mockCreationSlot.mockResolvedValue(2);
  });
  afterEach(() => act(() => tree?.unmount()));
  it('shows full appearance/role setup and requires name and chosen country', () => {
    render();
    expect(tree.root.findAllByType('PortraitPicker' as any)).toHaveLength(1);
    expect(button('Next').props.disabled).toBe(true);
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('Me'));
    expect(button('Next').props.disabled).toBe(true);
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    expect(button('Next').props.disabled).toBe(true);
    chooseAppearanceAndRole();
    expect(button('Next').props.disabled).toBe(false);
    expect(
      tree.root.findAllByType('Button' as any).some((n) => n.props.label === 'Start Career'),
    ).toBe(false);
  });
  it('uses one static popup and plain attributes without interactive targets or automatic points', () => {
    render();
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    chooseAppearanceAndRole();
    act(() => button('Next').props.onPress());
    const rows = tree.root.findAllByType('Stepper' as any);
    expect(tree.root.findAllByType('SelectableCard' as any).length).toBeGreaterThan(0);
    expect(tree.root.findByType('SegmentedControl' as any).props.accessibilityLabel).toBe('Difficulty');
    expect(tree.root.findAllByType('GuideTarget' as any).map(node => node.props.id)).toEqual(['creation-next']);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(n => n.props.guideIncreaseId === undefined)).toBe(true);
    expect(tree.root.findByType('Screen' as any).props.guide).toMatchObject({
      chapter: 'player.attributes', layout: 'plain', enabled: false, progress: 'session',
    });
    const popup = () => tree.root.findByType('AttributesGuidePopup' as any);
    expect(popup().props.visible).toBe(true);
    act(() => popup().props.onClose());
    expect(popup().props.visible).toBe(false);
    act(() => button('Show screen guide').props.onPress());
    expect(popup().props.visible).toBe(true);
    expect(tree.root.findAllByType('CreationOverview' as any)).toHaveLength(0);
    expect(rows.every((n) => n.props.canDec === false && n.props.canInc === true)).toBe(true);
    act(() => rows[0].props.onInc());
    expect(tree.root.findAllByType('Stepper' as any)[0].props.canDec).toBe(true);
    expect(
      tree.root
        .findAllByType('Stepper' as any)
        .slice(1)
        .every((n) => !n.props.canDec),
    ).toBe(true);
  });
  it('creates once, persists before activation, and lands at Home, never Match', async () => {
    prepare();
    expect(tree.root.findByType('Screen' as any).props.guide.chapter).toBe('player.review');
    let finish!: () => void;
    mockWrite.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let pending: unknown;
    act(() => {
      pending = button('Start Career').props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(button('Back').props.disabled).toBe(true);
    const resetCount = navigation.reset.mock.calls.length;
    act(() => button('Back').props.onPress());
    expect(navigation.reset).toHaveBeenCalledTimes(resetCount);
    expect(tree.root.findByType('Screen' as any).props.guide.chapter).toBe('player.review');
    await act(async () => {
      finish();
      await pending;
    });
    expect(mockWrite.mock.calls[0][1]).toBe(2);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'MainMenu' }, { name: 'CareerHub' }],
    });
    expect(mockSetActive).toHaveBeenCalledTimes(1);
    expect(mockCreationSlot).toHaveBeenCalledWith('career', undefined);
  });
  it('cannot bypass an empty/short name or missing choices by invoking Next directly', () => {
    render();
    act(() => button('Next').props.onPress());
    expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(1);
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    chooseAppearanceAndRole();
    for (const name of ['', ' ', 'A']) {
      act(() => tree.root.findByType('TextInput' as any).props.onChangeText(name));
      act(() => button('Next').props.onPress());
      expect(button('Next').props.disabled).toBe(true);
      expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(1);
    }
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('groups the three identity stops and requires every choice within each group', () => {
    render();
    expect(tree.root.findByType('Screen' as any).props.guide).toMatchObject({
      chapter: 'player.identity', layout: 'docked', progress: 'session', enabled: true,
    });
    expect(tree.root.findAllByType('CreationOverview' as any)).toHaveLength(0);
    const target = (id: string) => tree.root.findAllByType('GuideTarget' as any).find(n => n.props.id === id)!;
    expect(target('name').props.ready).toBe(false);
    expect(target('styles').findAllByType('SelectableCard' as any)).toHaveLength(4);
    expect(target('styles').findAllByType('SegmentedControl' as any)).toHaveLength(3);
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    expect(target('name').props.ready).toBe(true);
    expect(target('identity-basics').props.ready).toBe(false);
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    expect(target('identity-basics').props.ready).toBe(true);
    expect(target('appearance').props.ready).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseSex('female'));
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseTone());
    expect(target('appearance').props.ready).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChoosePortrait());
    expect(target('appearance').props.ready).toBe(true);
    expect(target('role-and-styles').props.ready).toBe(false);
    expect(target('role-and-styles').findAllByType('SelectableCard' as any)).toHaveLength(8);
    act(() => tree.root.findAllByType('SelectableCard' as any).find(n => n.props.title === 'Batter')!.props.onPress());
    expect(target('role-and-styles').props.ready).toBe(true);
    act(() => tree.root.findByType('CountrySelect' as any).props.onOpenChange(true));
    expect(tree.root.findByType('Screen' as any).props.guide.enabled).toBe(false);
    act(() => tree.root.findByType('CountrySelect' as any).props.onOpenChange(false));
    expect(tree.root.findByType('Screen' as any).props.guide.enabled).toBe(true);
  });
  it('requires new skin tone and portrait choices after switching gender', () => {
    render();
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    chooseAppearanceAndRole();
    expect(button('Next').props.disabled).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseSex('female'));
    // Test picker mock has not committed its female config yet; simulate the real callback.
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChange({ sex: 'female', portraitId: 'portrait_female_025' }));
    expect(button('Next').props.disabled).toBe(true);
    expect(tree.root.findByType('PortraitPicker' as any).props.creationChoices.tone).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseTone());
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChoosePortrait());
    expect(button('Next').props.disabled).toBe(false);
  });
  it('Manager creation also requires an explicit country and club', () => {
    act(() => { tree = create(createElement(TeamSelectScreen, { navigation, route: { params: {} } } as any)); });
    expect(tree.root.findByType('Screen' as any).props.guide).toBeUndefined();
    expect(tree.root.findByType('CreationOverview' as any).props.chapter).toBe('manager.creation');
    expect(button('Start Managing').props.disabled).toBe(true);
    expect(tree.root.findAllByType('SelectableCard' as any)).toHaveLength(0);
    act(() => { void button('Start Managing').props.onPress(); });
    expect(mockWrite).not.toHaveBeenCalled();
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    expect(button('Start Managing').props.disabled).toBe(true);
    act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
    expect(button('Start Managing').props.disabled).toBe(false);
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('england'));
    expect(button('Start Managing').props.disabled).toBe(true);
  });
  it('creates Manager once and waits for durable storage before opening Home', async () => {
    act(() => { tree = create(createElement(TeamSelectScreen, { navigation, route: { params: {} } } as any)); });
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
    let finish!: () => void;
    mockWrite.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const start = button('Start Managing').props.onPress;
    let pending!: Promise<void>;
    await act(async () => {
      pending = start();
      await start();
      await Promise.resolve();
    });
    expect(mockCreationSlot).toHaveBeenCalledTimes(1);
    expect(mockCreationSlot).toHaveBeenCalledWith('manager', undefined);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(button('Start Managing').props.loading).toBe(true);
    await act(async () => { finish(); await pending; });
    expect(mockSetActive).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'MainMenu' }, { name: 'ManagerHub' }] });
  });
  it('keeps Manager choices and releases the busy guard after a failed first save', async () => {
    act(() => { tree = create(createElement(TeamSelectScreen, { navigation, route: { params: {} } } as any)); });
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
    mockWrite.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => button('Start Managing').props.onPress());
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(button('Start Managing').props.disabled).toBe(false);
    expect(GlassAlert.alert).toHaveBeenCalledWith('Career not created', expect.any(String));
    await act(async () => button('Start Managing').props.onPress());
    expect(mockSetActive).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });
  it.each(['career', 'manager'] as const)(
    '%s opens the confirmed first save even when last-played metadata cannot be written',
    async mode => {
      if (mode === 'career') prepare();
      else {
        act(() => { tree = create(createElement(TeamSelectScreen, { navigation, route: { params: {} } } as any)); });
        act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
        act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
      }
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockLastPlayed.mockRejectedValueOnce(new Error('disk full writing resume pointer'));
      try {
        await act(async () => button(mode === 'career' ? 'Start Career' : 'Start Managing').props.onPress());
        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(mockSetActive).toHaveBeenCalledWith(mockWrite.mock.calls[0][2], mode, 2);
        expect(navigation.reset).toHaveBeenCalledWith({
          index: 1, routes: [{ name: 'MainMenu' }, { name: mode === 'career' ? 'CareerHub' : 'ManagerHub' }],
        });
        expect(GlassAlert.alert).not.toHaveBeenCalled();
      } finally {
        warning.mockRestore();
      }
    },
  );
  it('changing skin tone requires choosing a matching portrait again', () => {
    render();
    act(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    chooseAppearanceAndRole();
    expect(button('Next').props.disabled).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseTone());
    expect(button('Next').props.disabled).toBe(true);
    expect(tree.root.findByType('PortraitPicker' as any).props.creationChoices.portrait).toBe(false);
    act(() => tree.root.findByType('PortraitPicker' as any).props.onChoosePortrait());
    expect(button('Next').props.disabled).toBe(false);
  });
  it('rejects same-frame duplicate creation and preserves the retry after a failed write', async () => {
    prepare();
    mockWrite.mockRejectedValueOnce(new Error('disk'));
    const start = button('Start Career').props.onPress;
    await act(async () => {
      await Promise.all([start(), start()]);
    });
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(GlassAlert.alert).toHaveBeenCalledWith('Career not created', expect.any(String));
    await act(async () => button('Start Career').props.onPress());
    expect(mockSetActive).toHaveBeenCalledTimes(1);
  });
  it.each(['occupied', 'unavailable', 'missing'])(
    'does not overwrite an explicitly %s slot',
    async (state) => {
      // Real occupancy/error detection is exercised in encryptedSaves.test.ts.
      mockCreationSlot.mockResolvedValue(null);
      prepare({ slot: state === 'missing' ? 5 : 1 });
      await act(async () => button('Start Career').props.onPress());
      expect(mockWrite).not.toHaveBeenCalled();
      expect(mockSetActive).not.toHaveBeenCalled();
      expect(mockCreationSlot).toHaveBeenCalledWith('career', state === 'missing' ? 5 : 1);
    },
  );
});
