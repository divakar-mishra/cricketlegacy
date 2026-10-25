import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import fs from 'node:fs';
import path from 'node:path';
import { HubEngagementPrompts } from '../HubEngagementPrompts';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

let mockFocused = true;
let mockAppState = 'active';
const mockRead = jest.fn();
const mockListeners = new Set<(state: string) => void>();
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: {
  get currentState() { return mockAppState; },
  addEventListener: (_: string, listener: (state: string) => void) => {
    mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
  },
} }));
jest.mock('../../services/storeReview', () => ({ hasSeenPlayRatingPrompt: () => mockRead() }));
jest.mock('../PlayRatingPrompt', () => ({ PlayRatingPrompt: 'Rating' }));
jest.mock('../OtherGamesPrompt', () => ({ OtherGamesPrompt: 'Promotion' }));

configureReactRenderEnvironment();
describe('Home-only engagement coordination', () => {
  let tree: ReactTestRenderer | undefined;
  const render = async (eligible = true) => {
    await act(async () => {
      const element = createElement(HubEngagementPrompts, { eligible });
      if (tree) tree.update(element); else tree = create(element);
    });
  };
  beforeEach(() => {
    jest.clearAllMocks(); mockFocused = true; mockAppState = 'active';
    (Platform as any).OS = 'android'; mockRead.mockReset().mockResolvedValue(false);
  });
  afterEach(() => { act(() => tree?.unmount()); tree = undefined; expect(mockListeners.size).toBe(0); });
  it('cannot follow a first rating ask with promotion in the same Home visit', async () => {
    await render();
    expect(tree!.root.findByType('Rating' as any).props.eligible).toBe(true);
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(false);
    // Rating history changes after its own claim, but the entry snapshot is fixed.
    mockRead.mockResolvedValue(true); await render();
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(false);
    expect(mockRead).toHaveBeenCalledTimes(1);
    mockFocused = false; await render(); mockFocused = true; await render();
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(true);
  });
  it('passes the same blocking hub eligibility to both asks', async () => {
    mockRead.mockResolvedValue(true); await render(false);
    expect(tree!.root.findByType('Rating' as any).props.eligible).toBe(false);
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(false);
  });
  it('waits for the rating snapshot rather than racing two claims at mount', async () => {
    let finish!: (seen: boolean) => void;
    mockRead.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await render();
    expect(tree!.root.findByType('Rating' as any).props.eligible).toBe(false);
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(false);
    await act(async () => finish(true));
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(true);
  });
  it('unmounts both asks in the background and refreshes once on foreground', async () => {
    await render();
    await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn(mockAppState)); });
    expect(tree!.root.findAllByType('Rating' as any)).toHaveLength(0);
    expect(tree!.root.findAllByType('Promotion' as any)).toHaveLength(0);
    mockRead.mockResolvedValue(true);
    await act(async () => { mockAppState = 'active'; mockListeners.forEach(fn => fn(mockAppState)); });
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(tree!.root.findByType('Promotion' as any).props.eligible).toBe(true);
  });
  it('preserves iOS native-rating eligibility without loading Google Play promotion/history', async () => {
    (Platform as any).OS = 'ios'; await render();
    expect(tree!.root.findByType('Rating' as any).props.eligible).toBe(true);
    expect(tree!.root.findAllByType('Promotion' as any)).toHaveLength(0);
    expect(mockRead).not.toHaveBeenCalled();
  });
  it('is wired into both Home hubs, not creation, matches or purchase screens', () => {
    for (const name of ['CareerHubScreen', 'ManagerHubScreen']) {
      const source = fs.readFileSync(path.join(__dirname, '../../screens', `${name}.tsx`), 'utf8');
      expect(source).toContain('<HubEngagementPrompts');
      expect(source).not.toContain('<PlayRatingPrompt');
    }
    for (const name of ['PlayerCreationScreen', 'TeamSelectScreen', 'MatchScreen', 'PurchaseScreen']) {
      expect(fs.readFileSync(path.join(__dirname, '../../screens', `${name}.tsx`), 'utf8')).not.toContain('OtherGamesPrompt');
    }
  });
});
