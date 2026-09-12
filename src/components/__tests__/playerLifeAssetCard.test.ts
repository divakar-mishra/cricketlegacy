import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PLAYER_BUSINESSES, PLAYER_PROPERTIES } from '../../game/playerLife';
import { PLAYER_LIFE_ART, PlayerLifeAssetCard } from '../PlayerLifeAssetCard';

jest.mock('react-native', () => ({ View: 'View', StyleSheet: { create: (v: unknown) => v } }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../Card', () => ({ Card: 'Card' }));
jest.mock('../VenueIllustration', () => ({ VenueIllustration: 'VenueIllustration' }));
jest.mock('../../theme', () => ({
  useColors: () => ({ text: '#fff', textMuted: '#aaa', success: '#0a8' }),
  fontSize: { lg: 20, sm: 14, xs: 12 }, fontWeight: { bold: '700' }, spacing: { md: 16, sm: 8 },
}));

describe('Player Life illustrated assets', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  const onBuy = jest.fn();
  const asset = PLAYER_PROPERTIES[0];
  beforeEach(() => {
    warning = jest.spyOn(console, 'error').mockImplementation(() => {});
    onBuy.mockClear();
  });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });
  const render = (owned = false, unlocked = true, walletCoins = asset.cost) => {
    act(() => { tree = create(createElement(PlayerLifeAssetCard, { asset, owned, unlocked, walletCoins, onBuy })); });
  };
  const buttons = () => tree.root.findAll(n => String(n.type) === 'Button');

  it('has a distinct offline illustration for the bank and every catalogue asset', () => {
    const ids = ['personal-bank', ...PLAYER_PROPERTIES.map(a => a.id), ...PLAYER_BUSINESSES.map(a => a.id)];
    expect(ids).toHaveLength(7);
    expect(ids.every(id => PLAYER_LIFE_ART[id]?.source != null)).toBe(true);
    expect(new Set(ids.map(id => PLAYER_LIFE_ART[id].id)).size).toBe(7);
  });
  it('shows actual catalogue artwork and price, buying only on explicit press', () => {
    render();
    expect(tree.root.findAll(n => String(n.type) === 'VenueIllustration')[0].props.art.id).toBe(asset.id);
    expect(buttons()[0].props.label).toBe(`Buy · ${asset.cost.toLocaleString()} coins`);
    expect(buttons()[0].props.disabled).toBe(false);
    expect(onBuy).not.toHaveBeenCalled();
    act(() => buttons()[0].props.onPress());
    expect(onBuy).toHaveBeenCalledTimes(1);
  });
  it('shows ownership without a repeat purchase control', () => {
    render(true);
    expect(buttons()).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Owned');
    expect(onBuy).not.toHaveBeenCalled();
  });
  it.each([[false, asset.cost], [true, asset.cost - 1]])('preserves eligibility and affordability: %s, %s', (unlocked, walletCoins) => {
    render(false, unlocked, walletCoins);
    expect(buttons()[0].props.disabled).toBe(true);
    expect(onBuy).not.toHaveBeenCalled();
  });
});
