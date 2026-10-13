import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { GameMode, SaveGame } from '../../domain/types';
import type { SlotView } from '../../storage/saveGames';
import { SavedGamesScreen } from '../SavedGamesScreen';

const mockList = jest.fn();
const mockSetActive = jest.fn();
const mockAlert = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(callback, [callback]);
  },
}));
jest.mock('react-native', () => ({
  Pressable: 'Pressable', View: 'View', StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('../../components', () => ({
  AppText: 'Text', Button: 'Button', Card: 'Card', Screen: 'Screen',
  ScreenHeader: 'ScreenHeader', SegmentedControl: 'SegmentedControl',
}));
jest.mock('../../components/AccountBackupCard', () => ({ AccountBackupCard: 'AccountBackupCard' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../services', () => ({ premiumSponsorSave: {} }));
jest.mock('../../services/purchaseRecovery', () => ({ assertNoPendingPurchaseForSlot: jest.fn() }));
jest.mock('../../services/accountRecovery', () => ({ useAccountBackup: (selector: (value: unknown) => unknown) => selector({ refresh: 0 }) }));
jest.mock('../../state/careerStore', () => ({ useCareer: (selector: (value: unknown) => unknown) => selector({ setActive: mockSetActive }) }));
jest.mock('../../storage/saveGames', () => ({ BASE_MAX_SLOTS: 5, listSlots: (...args: unknown[]) => mockList(...args), deleteSave: jest.fn() }));
jest.mock('../../game/saveMeta', () => ({ saveTitle: (save: SaveGame) => save.id, saveSubtitle: (save: SaveGame) => save.mode }));
jest.mock('../../game/seasonPass', () => ({ isSeasonPassActive: () => false }));
jest.mock('../../theme', () => ({
  spacing: {}, fontSize: {}, fontWeight: {}, useThemedStyles: (factory: (colors: unknown) => unknown) => factory({}),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const player = { id: 'backed-up-player', mode: 'career', updatedAt: 100 } as SaveGame;
const manager = { id: 'backed-up-manager', mode: 'manager', updatedAt: 100 } as SaveGame;
const rows = (save: SaveGame): SlotView[] => [{ slot: 1, save }, { slot: 2, save: null }];

describe('Saved Games mode switching during encrypted/cloud recovery loads', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const buttons = (label: string) => tree.root.findAllByType('Button' as any).filter(node => node.props.label === label);
  const select = (mode: GameMode) => act(() => tree.root.findByType('SegmentedControl' as any).props.onChange(mode));
  const render = () => act(async () => { tree = create(createElement(SavedGamesScreen, { navigation } as any)); });
  beforeEach(() => { jest.clearAllMocks(); warning = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });

  it('hides previous-mode actions while the selected mode is still loading', async () => {
    const pendingManager = deferred<SlotView[]>();
    mockList.mockImplementation((mode: GameMode) => mode === 'career' ? Promise.resolve(rows(player)) : pendingManager.promise);
    await render();
    expect(buttons('Play')).toHaveLength(1);
    select('manager');
    expect(buttons('Play')).toHaveLength(0);
    expect(buttons('Delete')).toHaveLength(0);
    await act(async () => pendingManager.resolve(rows(manager)));
    expect(buttons('Play')).toHaveLength(1);
    act(() => buttons('Play')[0].props.onPress());
    expect(mockSetActive).toHaveBeenCalledWith(manager, 'manager', 1);
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerHub');
  });

  it('rejects previously captured Play/Delete/New callbacks after a tab switch', async () => {
    const pendingManager = deferred<SlotView[]>();
    mockList.mockImplementation((mode: GameMode) => mode === 'career' ? Promise.resolve(rows(player)) : pendingManager.promise);
    await render();
    const play = buttons('Play')[0].props.onPress;
    const remove = buttons('Delete')[0].props.onPress;
    const newCareer = tree.root.findByType('Pressable' as any).props.onPress;
    select('manager');
    act(() => { play(); remove(); newCareer(); });
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('ignores a slow Player listing that finishes after the Manager listing', async () => {
    const pendingPlayer = deferred<SlotView[]>();
    const pendingManager = deferred<SlotView[]>();
    mockList.mockImplementation((mode: GameMode) => mode === 'career' ? pendingPlayer.promise : pendingManager.promise);
    await render();
    select('manager');
    await act(async () => pendingManager.resolve(rows(manager)));
    await act(async () => pendingPlayer.resolve(rows(player)));
    act(() => buttons('Play')[0].props.onPress());
    expect(mockSetActive).toHaveBeenCalledWith(manager, 'manager', 1);
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerHub');
  });
});
