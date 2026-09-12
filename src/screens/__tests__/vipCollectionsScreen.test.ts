import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { VipCollectionsScreen } from '../VipCollectionsScreen';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import { grantModeVip, settleVipSeason, chooseVipCollection } from '../../game/vip';
import { MONTHLY_PASS_CONTENT } from '../../data/seasonPassContent';
let mockSave = makeCareerSave();
const mockChoose = jest.fn(() => ({ ok: true })),
  mockClaim = jest.fn(async () => ({ ok: true, items: [] }));
const mockBuy = jest.fn(async () => ({ ok: true }));
jest.mock('react-native', () => ({ View: 'View' }));
jest.mock('../../components', () => ({
  Button: 'Button',
  Card: 'Card',
  Screen: 'Screen',
  ScreenHeader: 'ScreenHeader',
  RewardModal: 'RewardModal',
}));
jest.mock('../../components/AppText', () => ({ AppText: 'Text' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: jest.fn() } }));
jest.mock('../../components/RewardShowcase', () => ({ RewardShowcase: 'RewardShowcase' }));
jest.mock('../../theme', () => ({
  spacing: { sm: 8, md: 16, lg: 24 },
  useColors: () => ({ text: '#fff', textMuted: '#aaa' }),
}));
jest.mock('../../services', () => ({
  purchases: {
    getProducts: async () =>
      ['player_vip', 'manager_vip'].map((id) => ({ id, priceString: '₹499' })),
    isProductAvailable: () => true,
  },
}));
jest.mock('../../state/careerStore', () => ({
  useCareer: (select: (state: unknown) => unknown) =>
    select({
      save: mockSave,
      chooseVipCollection: mockChoose,
      claimVipCollection: mockClaim,
      purchaseProduct: mockBuy,
      restorePurchases: jest.fn(),
      claimPass: jest.fn(),
    }),
}));

describe('VIP collection presentation and actions', () => {
  let tree: ReactTestRenderer, warning: jest.SpyInstance;
  const props = { navigation: { goBack: jest.fn(), navigate: jest.fn() } } as unknown as Parameters<
    typeof VipCollectionsScreen
  >[0];
  beforeEach(() => {
    mockSave = makeCareerSave();
    mockBuy.mockClear();
    mockChoose.mockClear();
    warning = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => tree?.unmount());
    warning.mockRestore();
  });
  const buttons = () => tree.root.findAll((node) => String(node.type) === 'Button');
  it.each(['career', 'manager'] as const)(
    'previews twelve mode-appropriate sets and buys only %s VIP',
    async (mode) => {
      mockSave = mode === 'career' ? makeCareerSave() : makeManagerSave();
      await act(async () => {
        tree = create(createElement(VipCollectionsScreen, props));
      });
      const art = tree.root.findAll((node) => String(node.type) === 'RewardShowcase');
      expect(art).toHaveLength(12);
      expect(art[0].props.itemIds).toContain(
        mode === 'career'
          ? MONTHLY_PASS_CONTENT[0].kit.id
          : MONTHLY_PASS_CONTENT[0].office.inventoryId,
      );
      expect(art[0].props.itemIds).not.toContain(
        mode === 'career'
          ? MONTHLY_PASS_CONTENT[0].office.inventoryId
          : MONTHLY_PASS_CONTENT[0].kit.id,
      );
      expect(
        buttons()
          .filter((node) => node.props.label === 'Choose collection')
          .every((node) => node.props.disabled),
      ).toBe(true);
      await act(async () => {
        await buttons()
          .find((node) => node.props.label === 'Buy · ₹499 once')!
          .props.onPress();
      });
      expect(mockBuy).toHaveBeenCalledWith(mode === 'career' ? 'player_vip' : 'manager_vip');
    },
  );
  it('shows a claim only after a season credit is earned', async () => {
    grantModeVip(mockSave, 'player_vip');
    chooseVipCollection(mockSave, MONTHLY_PASS_CONTENT[0].id);
    await act(async () => {
      tree = create(createElement(VipCollectionsScreen, props));
    });
    expect(
      buttons().find((node) => node.props.label === 'Complete this season')!.props.disabled,
    ).toBe(true);
    settleVipSeason(mockSave, 'finished');
    await act(async () => {
      tree.update(createElement(VipCollectionsScreen, props));
    });
    expect(buttons().find((node) => node.props.label === 'Claim collection')!.props.disabled).toBe(
      false,
    );
    await act(async () => {
      await buttons()
        .find((node) => node.props.label === 'Claim collection')!
        .props.onPress();
    });
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
  it.each(['career', 'manager'] as const)('links owned %s cosmetics to their in-game destination', async mode => {
    mockSave = mode === 'career' ? makeCareerSave() : makeManagerSave();
    grantModeVip(mockSave, mode === 'career' ? 'player_vip' : 'manager_vip');
    await act(async () => { tree = create(createElement(VipCollectionsScreen, props)); });
    expect(JSON.stringify(tree.toJSON())).toContain('Retirement unlocks remaining cosmetics only — no Coins, Gems or cash rewards.');
    const label = mode === 'career' ? 'View my player' : 'View Club Office';
    act(() => buttons().find(node => node.props.label === label)!.props.onPress());
    if (mode === 'career') expect(props.navigation.navigate).toHaveBeenCalledWith('PlayerProfile', { playerId: mockSave.userPlayerId });
    else expect(props.navigation.navigate).toHaveBeenCalledWith('ClubOffice');
  });
});
