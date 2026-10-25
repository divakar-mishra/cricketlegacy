import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { GameMode, SaveGame } from '../../domain/types';
import type { SummarySlot } from '../../storage/saveGames';
import { summarizeSave } from '../../storage/saveSummary';
import { SavedGamesScreen } from '../SavedGamesScreen';

const mockList = jest.fn();
const mockSetActive = jest.fn();
const mockAlert = jest.fn();
const mockLoad = jest.fn();
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
jest.mock('../../storage/saveGames', () => ({ BASE_MAX_SLOTS: 5, listSlotSummaries: (...args: unknown[]) => mockList(...args), loadSave: (...args: unknown[]) => mockLoad(...args), deleteSave: jest.fn() }));
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
const rows = (save: SaveGame): SummarySlot[] => [{ slot: 1, summary: summarizeSave(save, save.id) }, { slot: 2, summary: null }];

describe('Saved Games mode switching during encrypted/cloud recovery loads', () => {
  let tree: ReactTestRenderer;
  let warning: jest.SpyInstance;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const buttons = (label: string) => tree.root.findAllByType('Button' as any).filter(node => node.props.label === label);
  const select = (mode: GameMode) => act(() => tree.root.findByType('SegmentedControl' as any).props.onChange(mode));
  const render = () => act(async () => { tree = create(createElement(SavedGamesScreen, { navigation } as any)); });
  beforeEach(() => { jest.clearAllMocks(); mockLoad.mockImplementation(async (mode: GameMode) => mode === 'career' ? player : manager); warning = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { act(() => tree?.unmount()); warning.mockRestore(); });

  it('hides previous-mode actions while the selected mode is still loading', async () => {
    const pendingManager = deferred<SummarySlot[]>();
    mockList.mockImplementation((mode: GameMode) => mode === 'career' ? Promise.resolve(rows(player)) : pendingManager.promise);
    await render();
    expect(buttons('Play')).toHaveLength(1);
    select('manager');
    expect(buttons('Play')).toHaveLength(0);
    expect(buttons('Delete')).toHaveLength(0);
    await act(async () => pendingManager.resolve(rows(manager)));
    expect(buttons('Play')).toHaveLength(1);
    await act(async () => buttons('Play')[0].props.onPress());
    expect(mockSetActive).toHaveBeenCalledWith(manager, 'manager', 1);
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerHub');
  });

  it('rejects previously captured Play/Delete/New callbacks after a tab switch', async () => {
    const pendingManager = deferred<SummarySlot[]>();
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
    const pendingPlayer = deferred<SummarySlot[]>();
    const pendingManager = deferred<SummarySlot[]>();
    mockList.mockImplementation((mode: GameMode) => mode === 'career' ? pendingPlayer.promise : pendingManager.promise);
    await render();
    select('manager');
    await act(async () => pendingManager.resolve(rows(manager)));
    await act(async () => pendingPlayer.resolve(rows(player)));
    await act(async () => buttons('Play')[0].props.onPress());
    expect(mockSetActive).toHaveBeenCalledWith(manager, 'manager', 1);
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerHub');
  });

  it('verifies only the selected career, blocks duplicate taps and rejects replacement identities', async () => {
    mockList.mockResolvedValue(rows(player));
    const pending = deferred<SaveGame>();
    mockLoad.mockReturnValue(pending.promise);
    await render();
    const play = buttons('Play')[0].props.onPress;
    act(() => { play(); play(); });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockSetActive).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ ...player, id: 'replacement-career' }));
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Career not opened', expect.stringContaining('slot changed'));
  });

  it('aborts abandoned list/Play work when leaving and ignores its late completion', async () => {
    mockList.mockResolvedValue(rows(player));
    await render();
    const signal = mockList.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    const pending = deferred<SaveGame>();
    mockLoad.mockReturnValue(pending.promise);
    act(() => buttons('Play')[0].props.onPress());
    act(() => tree.unmount());
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(player));
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
  it('does not resurrect an abandoned Play after switching away and back to the same mode', async () => {
    mockList.mockImplementation(async (mode: GameMode) => rows(mode === 'career' ? player : manager));
    await render();
    const pending = deferred<SaveGame>();
    mockLoad.mockReturnValue(pending.promise);
    act(() => buttons('Play')[0].props.onPress());
    const options = mockLoad.mock.calls[0][2];
    await act(async () => select('manager'));
    await act(async () => select('career'));
    expect(options.isCurrent()).toBe(false);
    await act(async () => pending.resolve(player));
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
