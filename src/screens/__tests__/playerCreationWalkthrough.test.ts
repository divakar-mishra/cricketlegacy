import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PlayerCreationScreen } from '../PlayerCreationScreen';
import { Stepper } from '../../components/Stepper';
import { guideAction } from '../../game/coachGuide';
import { useSettings } from '../../state/settingsStore';
import { AttributesGuidePopup } from '../../components/AttributesGuidePopup';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
const mockWrite = jest.fn();
const mockMeasure = jest.fn();
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('react-native', () => ({
  View: 'View', Modal: 'Modal', ScrollView: 'ScrollView', TextInput: 'TextInput', Pressable: 'Pressable', Switch: 'Switch',
  AccessibilityInfo: { announceForAccessibility: jest.fn() },
  Keyboard: { dismiss: jest.fn(), addListener: () => ({ remove: jest.fn() }) },
  BackHandler: { addEventListener: () => ({ remove: jest.fn() }) },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 360, height: 800, fontScale: 1 }),
}));
jest.mock('../../components/AppText', () => ({ AppText: 'Text' }));
jest.mock('../../components/Button', () => ({ Button: 'Button' }));
jest.mock('../../components/ProgressBar', () => ({ ProgressBar: 'ProgressBar' }));
jest.mock('../../components', () => ({
  ...Object.fromEntries(['PortraitPicker', 'Card', 'CountrySelect', 'ScreenHeader', 'SelectableCard',
    'SegmentedControl'].map(name => [name, name])),
  AppText: 'Text', Button: 'Button', ProgressBar: 'ProgressBar',
  Stepper: jest.requireActual('../../components/Stepper').Stepper,
  Screen: ({ guide, children, footer }: any) => require('react').createElement(
    require('../../components/CareerGuide').CareerGuide, guide,
    require('react').createElement('ScreenBody', {}, children, footer)),
}));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { prompt: 3 }, useModalQueue: (wants: boolean) => wants,
}));
jest.mock('../../state/settingsStore', () => ({
  useSettings: jest.requireActual('zustand').create((set: any) => ({
    hasHydrated: true, hasOnboarded: true, dismissedTips: [],
    dismissTip: (key: string) => set((s: any) => ({ dismissedTips: [...s.dismissedTips, key] })),
  })),
}));
jest.mock('../../state/careerStore', () => ({ useCareer: (select: any) => select({ setActive: jest.fn() }) }));
jest.mock('../../storage/saveGames', () => ({
  findCreationSlot: async () => 2, writeSave: (...args: unknown[]) => mockWrite(...args), setLastPlayed: jest.fn(),
}));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../services', () => ({ analytics: { setUserProperty: jest.fn(), logEvent: jest.fn(), EVT: {} } }));
jest.mock('../../theme', () => ({
  fontSize: {}, fontWeight: {}, radius: {}, spacing: {},
  useTheme: () => ({ colors: {} }), useThemedStyles: (make: any) => make({}),
}));

// Real Player form + production guide content + real pointer engine + real +/−.
// Native geometry/modal state are controlled here, not certified on a device.
describe('short interactive Player creation walkthrough', () => {
  let tree: ReactTestRenderer;
  let oldRaf: typeof requestAnimationFrame;
  let oldCancel: typeof cancelAnimationFrame;
  const settle = () => act(() => jest.runAllTimers());
  const perform = (action: () => void) => { act(action); settle(); };
  const text = () => JSON.stringify(tree.toJSON());
  const guideButton = (label: string) => tree.root.findByProps({ testID: 'guide-actions' })
    .findAllByType('Button' as any).find(node => node.props.label === label)!;
  const formButton = (label: string) => tree.root.findByType('ScreenBody' as any)
    .findAllByType('Button' as any).find(node => node.props.label === label)!;
  const portrait = () => tree.root.findByType('PortraitPicker' as any);
  const selectCard = (title?: string) => tree.root.findAllByType('SelectableCard' as any)
    .find(node => !title || node.props.title === title)!.props.onPress();
  const render = () => {
    act(() => { tree = create(createElement(PlayerCreationScreen, {
      navigation: { goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() }, route: { params: {} },
    } as any), {
      createNodeMock: node => node.type === 'View' ? {
        measureInWindow: (callback: (...v: number[]) => void) => {
          mockMeasure();
          const id = (node.props as { testID?: string }).testID;
          if (id === 'guide-root') callback(0, 0, 360, 800);
          else if (id === 'guide-target-attribute-plus') callback(270, 280, 40, 40);
          else callback(20, 100, 320, 400);
        },
      } : null,
    }); });
    settle();
  };
  const finishIdentity = () => {
    perform(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    perform(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    perform(() => guideButton('Next').props.onPress());
    perform(() => portrait().props.onChooseSex('female'));
    perform(() => portrait().props.onChooseTone());
    perform(() => portrait().props.onChoosePortrait());
    perform(() => guideButton('Next').props.onPress());
    perform(() => selectCard('All-Rounder'));
    perform(() => guideButton('Finish').props.onPress());
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useSettings.setState({ hasHydrated: true, hasOnboarded: true, dismissedTips: [] });
    oldRaf = global.requestAnimationFrame;
    oldCancel = global.cancelAnimationFrame;
    global.requestAnimationFrame = callback => setTimeout(() => callback(0), 0) as unknown as number;
    global.cancelAnimationFrame = id => clearTimeout(id);
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    global.requestAnimationFrame = oldRaf;
    global.cancelAnimationFrame = oldCancel;
  });
  it('uses exactly three required identity stops without losing name/country or appearance choices', () => {
    render();
    expect(text()).toContain('Name and cricket country');
    expect(guideButton('Next').props.disabled).toBe(true);
    perform(() => tree.root.findByType('TextInput' as any).props.onChangeText('A'));
    perform(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    expect(guideButton('Next').props.disabled).toBe(true);
    perform(() => tree.root.findByType('TextInput' as any).props.onChangeText('My Player'));
    perform(() => guideButton('Next').props.onPress());
    expect(text()).toContain('Make the player yours');
    perform(() => portrait().props.onChooseSex('female'));
    perform(() => portrait().props.onChooseTone());
    expect(guideButton('Next').props.disabled).toBe(true);
    perform(() => portrait().props.onChoosePortrait());
    perform(() => guideButton('Next').props.onPress());
    expect(text()).toContain('Choose how you play');
    expect(guideButton('Finish').props.disabled).toBe(true);
    perform(() => selectCard('All-Rounder'));
    perform(() => guideButton('Finish').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    expect(formButton('Next').props.disabled).toBe(false);
    expect(tree.root.findAllByType(Stepper)).toHaveLength(0); // No automatic page advance.
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('uses a single static attributes popup, no target measurements, and resumes the Club/Review pointers', () => {
    render(); finishIdentity();
    perform(() => formButton('Next').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'attributes-guide-popup' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'guide-highlight' })).toHaveLength(0);
    expect(tree.root.findAllByType(Stepper).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Stepper).every(node => !node.props.canDec)).toBe(true);
    const popupButton = tree.root.findByProps({ testID: 'attributes-guide-popup' }).findByType('Button' as any);
    expect(popupButton.props.label).toBe('Got it');
    perform(() => popupButton.props.onPress());
    mockMeasure.mockClear();
    expect(tree.root.findAllByProps({ testID: 'attributes-guide-popup' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'guide-target-attribute-plus' })).toHaveLength(0);
    const plus = tree.root.findAllByType('Pressable' as any)
      .find(node => /^Increase /.test(node.props.accessibilityLabel ?? ''))!;
    expect(plus.props.accessibilityLabel).toMatch(/^Increase /);
    perform(() => plus.props.onPress());
    expect(tree.root.findAllByType(Stepper)[0].props.canDec).toBe(true);
    expect(tree.root.findAllByType(Stepper).slice(1).every(node => !node.props.canDec)).toBe(true);
    perform(() => guideAction('attribute-increased'));
    expect(mockMeasure).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    perform(() => formButton('Next').props.onPress());
    expect(text()).toContain('Choose your future club');
    expect(guideButton('Finish').props.disabled).toBe(true);
    perform(() => selectCard());
    perform(() => guideButton('Finish').props.onPress());
    perform(() => formButton('Next').props.onPress());
    expect(text()).toContain('Ready to start?');
    perform(() => guideButton('Finish').props.onPress());
    expect(formButton('Start Career').props.disabled).toBe(false);
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('reopens only the static popup and retains per-form completion when going back', () => {
    render(); finishIdentity();
    perform(() => formButton('Next').props.onPress());
    const close = () => tree.root.findByType(AttributesGuidePopup).props.onClose();
    perform(close);
    expect(tree.root.findAllByType(Stepper).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Stepper).every(node => !node.props.canDec)).toBe(true);
    perform(() => formButton('Show screen guide').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'attributes-guide-popup' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    perform(close);
    expect(formButton('Next').props.disabled).toBe(false);
    perform(() => formButton('Next').props.onPress());
    expect(text()).toContain('Choose your future club');
    perform(() => formButton('Back').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'attributes-guide-popup' })).toHaveLength(0);
    expect(tree.root.findAllByType(Stepper).every(node => !node.props.canDec)).toBe(true);
    perform(() => formButton('Back').props.onPress());
    expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
  });
  it('ignores old completion keys, yields to the country picker, and replays without bypassing form validation', () => {
    useSettings.setState({ dismissedTips: ['coach-v1:skip:player', 'coach-v1:player.identity:name'] });
    render();
    expect(text()).toContain('Name and cricket country');
    perform(() => tree.root.findByType('CountrySelect' as any).props.onOpenChange(true));
    expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
    perform(() => tree.root.findByType('CountrySelect' as any).props.onOpenChange(false));
    expect(text()).toContain('Name and cricket country');
    perform(() => guideButton('Skip guide').props.onPress());
    expect(formButton('Next').props.disabled).toBe(true);
    perform(() => formButton('Next').props.onPress());
    expect(tree.root.findAllByType('TextInput' as any)).toHaveLength(1);
    perform(() => formButton('Show screen guide').props.onPress());
    expect(text()).toContain('Name and cricket country');
    expect(guideButton('Next').props.disabled).toBe(true);
  });
});
