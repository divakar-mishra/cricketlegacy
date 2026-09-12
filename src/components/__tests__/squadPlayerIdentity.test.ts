import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SquadPlayerIdentity } from '../SquadPlayerIdentity';
import type { SaveGame, Player } from '../../domain/types';
jest.mock('react-native', () => ({ View: 'View', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('../PlayerAvatar', () => ({ PlayerAvatar: 'PlayerAvatar' }));
jest.mock('../PlayerStatusBadges', () => ({ PlayerStatusBadges: 'Status' }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../../theme', () => ({ useColors: () => ({}) }));
describe('compact squad identities', () => {
  let tree: ReactTestRenderer, warning: jest.SpyInstance;
  beforeEach(() => { warning = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });
  const player = { id: 'me', name: 'A very long cricket player name', role: 'WK_BATTER', meta: { fitness: 80 }, morale: 70 } as Player;
  const save = { mode: 'career', userPlayerId: 'me', cosmetics: { kit: 'pass_kit_noir', avatarConfig: { portraitId: 'portrait_female_001' } } } as SaveGame;
  it('uses the controlled player identity, compact portrait, role and captain badge', () => {
    act(() => { tree = create(createElement(SquadPlayerIdentity, { player, save, captain: true, viceCaptain: false })); });
    const avatar = tree.root.findAll(n => String(n.type) === 'PlayerAvatar')[0];
    expect(avatar.props).toMatchObject({ size: 'sm', kitId: 'pass_kit_noir', config: save.cosmetics?.avatarConfig });
    expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Captain')).toHaveLength(1);
    expect(tree.root.findAll(n => String(n.type) === 'Text' && n.props.children === 'WK')).toHaveLength(1);
    expect(tree.root.findAll(n => n.props.numberOfLines === 1)).toHaveLength(1);
  });
  it('does not dress teammates in the user kit; marks the vice-captain separately', () => {
    act(() => { tree = create(createElement(SquadPlayerIdentity, { player: { ...player, id: 'other' }, save, captain: false, viceCaptain: true })); });
    expect(tree.root.findAll(n => String(n.type) === 'PlayerAvatar')[0].props.kitId).toBeUndefined();
    expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Vice-captain')).toHaveLength(1);
  });
});
