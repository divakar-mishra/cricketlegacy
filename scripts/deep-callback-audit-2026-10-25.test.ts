// Diagnostic only. Evaluate the actual result-button callback extracted from
// trusted local source, with device I/O and the ad completion under test control.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  InteractionManager: { runAfterInteractions: (cb: () => void) => { cb(); return { cancel: jest.fn() }; } },
}));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }));
jest.mock('../src/services/vipArchive', () => ({ syncVipArchive: async () => {} }));
jest.mock('../src/config/qa', () => ({ QA_TOOLS_ENABLED: false }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
const { useCareer } = jest.requireActual<typeof import('../src/state/careerStore')>('../src/state/careerStore');
const { makeCareerSave, makeManagerSave } = jest.requireActual<typeof import('../src/game/__tests__/_depthHelpers')>('../src/game/__tests__/_depthHelpers');
const { purchases } = jest.requireActual<typeof import('../src/services')>('../src/services');

function actualRewardCallback(args: Record<string, unknown>): () => Promise<void> {
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/MatchScreen.tsx'), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const found: string[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXAttribute' && node.name?.name === 'onPress') {
      const fn = node.value?.expression;
      if (fn?.type === 'ArrowFunctionExpression') {
        const code = source.slice(fn.start, fn.end);
        if (code.includes('match-double:${result.fixtureId}')) found.push(code);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast.program);
  expect(found).toHaveLength(1);
  return new Function(...Object.keys(args), `return (${found[0]});`)(...Object.values(args));
}

beforeEach(() => {
  jest.spyOn(purchases, 'getPermanentVipSnapshot').mockResolvedValue(null);
  jest.spyOn(purchases, 'getEntitlementSnapshot').mockResolvedValue({ status: 'UNAVAILABLE' });
  useCareer.setState({ save: null, ref: null, persist: jest.fn(async () => {}), persistCritical: jest.fn(async () => {}) });
});
afterEach(() => { useCareer.setState({ save: null, ref: null }); jest.restoreAllMocks(); });

describe('diagnostic: delayed result-screen rewarded callback', () => {
  it('does not credit another career after the result screen is left during ad loading', async () => {
    const player = makeCareerSave(99101);
    player.id = 'audit-result-origin';
    useCareer.getState().setActive(player, 'career', 1);
    let complete!: (result: { completed: boolean }) => void;
    const callback = actualRewardCallback({
      ads: { showRewarded: () => new Promise(resolve => { complete = resolve; }) },
      grantAdReward: useCareer.getState().grantAdReward,
      save: player,
      result: { fixtureId: 'audit-finished-fixture' }, coinsAwarded: 100,
      adRewardPendingRef: { current: false }, adClaimed: false,
      setAdError: jest.fn(), setAdBusy: jest.fn(), setAdClaimed: jest.fn(),
    });
    const waiting = callback();
    const manager = makeManagerSave(99102);
    manager.id = 'audit-result-unrelated-manager';
    useCareer.getState().setActive(manager, 'manager', 2);
    const before = useCareer.getState().save!.wallet.coins;
    complete({ completed: true });
    await waiting;
    expect(useCareer.getState().save!.id).toBe(manager.id);
    expect(useCareer.getState().save!.wallet.coins).toBe(before);
  });
});
