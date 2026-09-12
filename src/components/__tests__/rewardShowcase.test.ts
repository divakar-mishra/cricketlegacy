import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { RewardShowcase } from '../RewardShowcase';
let mockSave: SaveGame;
const mockEquip = jest.fn(() => ({ ok: true }));
jest.mock('react-native', () => ({ View: 'View', Modal: 'Modal', StyleSheet: { create: (v: unknown) => v, hairlineWidth: 1 } }));
jest.mock('../CelebrationOverlay', () => ({ CelebrationOverlay: 'CelebrationOverlay' }));
jest.mock('../RewardArtwork', () => ({ RewardArtwork: 'RewardArtwork' }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../../state/careerStore', () => ({ useCareer: (select: (state: unknown) => unknown) => select({ save: mockSave, equipOwnedReward: mockEquip }) }));
jest.mock('../../theme', () => ({ useColors: () => ({ text: '#FFFFFF', textMuted: '#AABBCC', border: '#334455' }) }));
describe('visual reward equip controls', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  beforeEach(() => {
    warning = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockEquip.mockClear();
    mockSave = { id: 'save-a', mode: 'career', inventory: {}, cosmetics: { kit: 'kit_white' } } as SaveGame;
  });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });
  it('previews locked rewards without exposing an equip action', () => {
    act(() => { tree = create(createElement(RewardShowcase, { itemIds: ['pass_kit_noir'], saveId: 'save-a' })); });
    expect(tree.root.findAll(n => String(n.type) === 'RewardArtwork')).toHaveLength(1);
    expect(tree.root.findAll(n => String(n.type) === 'Button')).toHaveLength(0);
  });
  it('equips a claimed item only on explicit tap and shows Equipped from live save state', () => {
    mockSave.inventory = { pass_kit_noir: 1 };
    act(() => { tree = create(createElement(RewardShowcase, { itemIds: ['pass_kit_noir', 'pass_kit_noir'], saveId: 'save-a' })); });
    expect(mockEquip).not.toHaveBeenCalled();
    const button = () => tree.root.findAll(n => String(n.type) === 'Button')[0];
    act(() => button().props.onPress());
    expect(mockEquip).toHaveBeenCalledWith('pass_kit_noir', 'save-a');
    mockSave.cosmetics!.kit = 'pass_kit_noir';
    act(() => tree.update(createElement(RewardShowcase, { itemIds: ['pass_kit_noir'], saveId: 'save-a' })));
    expect(button().props.label).toBe('Equipped');
    expect(button().props.disabled).toBe(true);
  });
  it('hides stale-save actions and never creates art/actions for unrecognised items', () => {
    act(() => { tree = create(createElement(RewardShowcase, { itemIds: ['pass_kit_noir'], saveId: 'save-b' })); });
    expect(tree.toJSON()).toBeNull();
    act(() => tree.update(createElement(RewardShowcase, { itemIds: ['unknown-token'], saveId: 'save-a' })));
    expect(tree.root.findAll(n => String(n.type) === 'Button')).toHaveLength(0);
    expect(tree.root.findAll(n => String(n.type) === 'RewardArtwork')).toHaveLength(0);
  });
  it('previews the real equipped effect without claiming or equipping the locked celebration', () => {
    act(() => { tree = create(createElement(RewardShowcase, { itemIds: ['pass_celebration_lights'], saveId: 'save-a' })); });
    const button = (label: string) => tree.root.findAll(n => String(n.type) === 'Button' && n.props.label === label)[0];
    expect(button('Equip')).toBeUndefined();
    act(() => button('Preview').props.onPress());
    const effect = () => tree.root.findAll(n => String(n.type) === 'CelebrationOverlay')[0];
    expect(effect().props).toMatchObject({ cosmeticId: 'pass_celebration_lights', kind: 'six', trigger: 1 });
    act(() => button('Replay').props.onPress());
    expect(effect().props.trigger).toBe(2);
    act(() => button('Done').props.onPress());
    expect(effect()).toBeUndefined();
    expect(mockEquip).not.toHaveBeenCalled();
  });
});
