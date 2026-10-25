// Diagnostic audit only, intentionally outside the normal src test match.
// Reproduced on the pre-audit candidate; retained to verify the partial-failure fix.
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PlayerCreationScreen } from '../src/screens/PlayerCreationScreen';
import { TeamSelectScreen } from '../src/screens/TeamSelectScreen';
import { configureReactRenderEnvironment } from '../src/test/reactRenderEnvironment';

configureReactRenderEnvironment();
const mockSetActive = jest.fn();
const mockWrite = jest.fn();
const mockLastPlayed = jest.fn();
const mockCreationSlot = jest.fn();
jest.mock('../src/components/CareerGuide', () => require('../src/test/coachGuideMock'));
jest.mock('../src/components/CreationOverview', () => ({ CreationOverview: 'CreationOverview' }));
jest.mock('../src/components/AttributesGuidePopup', () => ({ AttributesGuidePopup: 'AttributesGuidePopup' }));
jest.mock('react-native', () => ({ View: 'View', Switch: 'Switch', TextInput: 'TextInput', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('../src/components', () => ({
  ...Object.fromEntries(['PortraitPicker', 'Button', 'Card', 'CountrySelect', 'ProgressBar', 'ScreenHeader',
    'SelectableCard', 'SegmentedControl', 'Stepper', 'AppText'].map(name => [name, name])),
  Screen: ({ children, footer, ...props }: any) => require('react').createElement('Screen', props, children, footer),
}));
jest.mock('../src/components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../src/services', () => ({ analytics: {
  setUserProperty: jest.fn(), logEvent: jest.fn(), EVT: { CAREER_START: 'career_start' },
} }));
jest.mock('../src/state/careerStore', () => ({ useCareer: (select: (s: unknown) => unknown) => select({ setActive: mockSetActive }) }));
jest.mock('../src/storage/saveGames', () => ({
  findCreationSlot: (...args: unknown[]) => mockCreationSlot(...args),
  writeSave: (...args: unknown[]) => mockWrite(...args),
  setLastPlayed: (...args: unknown[]) => mockLastPlayed(...args),
}));
jest.mock('../src/theme', () => ({ fontSize: {}, fontWeight: {}, radius: {}, spacing: {},
  useTheme: () => ({ colors: {} }), useThemedStyles: (make: (c: object) => object) => make({}),
}));

describe('diagnostic: successful career save followed by pointer failure', () => {
  let tree: ReactTestRenderer;
  const navigation = { reset: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  const button = (label: string) => tree.root.findAllByType('Button' as any).find(n => n.props.label === label)!;
  const prepare = (mode: 'career' | 'manager') => {
    act(() => { tree = create(mode === 'career'
      ? createElement(PlayerCreationScreen, { navigation, route: { params: {} } } as any)
      : createElement(TeamSelectScreen, { navigation, route: { params: {} } } as any)); });
    act(() => tree.root.findByType('CountrySelect' as any).props.onChange('india'));
    if (mode === 'career') {
      act(() => tree.root.findByType('TextInput' as any).props.onChangeText('Audit Player'));
      act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseSex('female'));
      act(() => tree.root.findByType('PortraitPicker' as any).props.onChooseTone());
      act(() => tree.root.findByType('PortraitPicker' as any).props.onChoosePortrait());
      act(() => tree.root.findAllByType('SelectableCard' as any).find(n => n.props.title === 'Batter')!.props.onPress());
      act(() => button('Next').props.onPress());
      act(() => button('Next').props.onPress());
    }
    act(() => tree.root.findAllByType('SelectableCard' as any)[0].props.onPress());
    if (mode === 'career') act(() => button('Next').props.onPress());
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrite.mockResolvedValue(undefined);
    mockCreationSlot.mockResolvedValueOnce(1).mockResolvedValue(2);
    mockLastPlayed.mockRejectedValueOnce(new Error('disk full writing sg:lastPlayed')).mockResolvedValue(undefined);
  });
  afterEach(() => act(() => tree?.unmount()));

  it.each(['career', 'manager'] as const)('%s activates the durably created career even if optional pointer metadata fails', async mode => {
    prepare(mode);
    await act(async () => button(mode === 'career' ? 'Start Career' : 'Start Managing').props.onPress());
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockSetActive).toHaveBeenCalledTimes(1);
  });

  it.each(['career', 'manager'] as const)('%s does not create an extra career in another slot after that partial success', async mode => {
    prepare(mode);
    const label = mode === 'career' ? 'Start Career' : 'Start Managing';
    await act(async () => button(label).props.onPress());
    // If still on the form, this is the Retry encouraged by Career not created.
    if (!mockSetActive.mock.calls.length) await act(async () => button(label).props.onPress());
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
