import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DEFAULT_AVATAR_CONFIGS } from '../../avatar';
import { PortraitPicker } from '../avatar/PortraitPicker';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
jest.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
  useWindowDimensions: () => ({ width: 360, height: 800 }),
}));
jest.mock('../CareerGuide', () => require('../../test/coachGuideMock'));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../avatar/PortraitAvatar', () => ({ PortraitAvatar: 'PortraitAvatar' }));
jest.mock('../../theme', () => ({
  fontSize: {}, fontWeight: {}, radius: {}, spacing: { sm: 8, md: 12, lg: 16 },
  useThemedStyles: (make: (colors: object) => object) => make({}),
}));

describe('explicit creation gender and portrait choices', () => {
  let tree: ReactTestRenderer;
  const onChange = jest.fn();
  const onChooseSex = jest.fn();
  const onChooseTone = jest.fn();
  const onChoosePortrait = jest.fn();
  const render = (sex = false, portrait = false, tone = sex) => act(() => {
    tree = create(createElement(PortraitPicker, {
      value: DEFAULT_AVATAR_CONFIGS.female, onChange, onChooseSex, onChooseTone, onChoosePortrait,
      creationChoices: { sex, tone, portrait },
    }));
  });
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => act(() => tree?.unmount()));
  it('does not count a default preview as an explicit gender or portrait choice', () => {
    render();
    const tabs = tree.root.findAllByType('Pressable' as any).filter(n => n.props.accessibilityRole === 'tab');
    expect(tabs.every(n => !n.props.accessibilityState.selected)).toBe(true);
    const portraits = tree.root.findAllByType('Pressable' as any).filter(n => n.props.accessibilityRole === 'button');
    expect(portraits.length).toBeGreaterThan(0);
    expect(portraits.every(n => n.props.disabled)).toBe(true);
    expect(onChooseSex).not.toHaveBeenCalled();
    expect(onChoosePortrait).not.toHaveBeenCalled();
    act(() => tabs.find(n => n.props.accessibilityLabel === 'female portraits')!.props.onPress());
    expect(onChooseSex).toHaveBeenCalledWith('female');
    expect(onChoosePortrait).not.toHaveBeenCalled();
  });
  it('highlights the real portrait grid and only records selection on an actual portrait action', () => {
    render(true);
    const target = tree.root.findAllByType('GuideTarget' as any).find(n => n.props.id === 'portrait')!;
    expect(target.props.focusHeight).toBeUndefined();
    expect(target.props.ready).toBe(false);
    const portraits = target.findAllByType('Pressable' as any);
    expect(portraits.every(n => !n.props.disabled)).toBe(true);
    act(() => portraits[0].props.onPress());
    expect(onChoosePortrait).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sex: 'female' }));
  });
  it('guides all eight skin tone swatches and waits for an explicit choice', () => {
    render(true, false, false);
    const tone = tree.root.findAllByType('GuideTarget' as any).find(n => n.props.id === 'skin-tone')!;
    expect(tone.props.ready).toBe(false);
    const swatches = tone.findAllByType('Pressable' as any);
    expect(swatches).toHaveLength(8);
    expect(swatches.every(n => !n.props.accessibilityState.selected)).toBe(true);
    expect(tree.root.findAllByType('Pressable' as any).filter(n => n.props.accessibilityRole === 'button').every(n => n.props.disabled)).toBe(true);
    act(() => swatches[7].props.onPress());
    expect(onChooseTone).toHaveBeenCalledTimes(1);
    expect(onChoosePortrait).not.toHaveBeenCalled();
  });
  it.each(['Randomize', 'Reset'])('%s explicitly chooses both tone and portrait when not guided', label => {
    render(true);
    act(() => tree.root.findAllByType('Button' as any).find(n => n.props.label === label)!.props.onPress());
    expect(onChooseTone).toHaveBeenCalledTimes(1);
    expect(onChoosePortrait).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
