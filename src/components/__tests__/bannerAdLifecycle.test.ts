import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BannerAdSlot } from '../BannerAdSlot';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

let mockFocused = true;
let mockState = 'active';
let mockAdsReady = true;
let mockAdsRemoved = false;
let mockUnit: string | undefined = 'test-banner-unit';
const mockAppListeners = new Set<(state: string) => void>();
const mockAdsListeners = new Set<() => void>();
const mockMount = jest.fn();
const mockDestroy = jest.fn();

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native', () => ({
  View: 'View', StyleSheet: { create: (style: unknown) => style, hairlineWidth: 1 },
  AppState: {
    get currentState() { return mockState; },
    addEventListener: (_: string, listener: (state: string) => void) => {
      mockAppListeners.add(listener);
      return { remove: () => mockAppListeners.delete(listener) };
    },
  },
}));
jest.mock('../../theme', () => ({ useTheme: () => ({ colors: { border: '#333' } }) }));
jest.mock('../../game/economy', () => ({ areAdsRemoved: () => mockAdsRemoved }));
jest.mock('../../services/ads', () => ({
  isAdsReady: () => mockAdsReady,
  getBannerAdUnitId: () => mockUnit,
  getAdRequestOptions: () => ({}),
  subscribeAdsState: (listener: () => void) => {
    mockAdsListeners.add(listener);
    return () => mockAdsListeners.delete(listener);
  },
}));
jest.mock('react-native-google-mobile-ads', () => ({
  BannerAdSize: { BANNER: 'BANNER' },
  BannerAd: function MockBanner(props: object) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => { mockMount(); return () => mockDestroy(); }, []);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react').createElement('NativeBanner', props);
  },
}));

configureReactRenderEnvironment();

describe('banner WebView lifecycle on hidden screens/background transitions', () => {
  let tree: ReactTestRenderer | undefined;
  const render = () => act(() => {
    const element = createElement(BannerAdSlot, { entitlements: undefined });
    if (tree) tree.update(element); else tree = create(element);
  });
  const visible = () => tree!.root.findAllByType('NativeBanner' as any).length;
  const transition = (state: string) => act(() => {
    mockState = state;
    mockAppListeners.forEach(listener => listener(state));
  });

  beforeEach(() => {
    mockFocused = true; mockState = 'active'; mockAdsReady = true;
    mockAdsRemoved = false; mockUnit = 'test-banner-unit';
    mockMount.mockClear(); mockDestroy.mockClear();
  });
  afterEach(() => {
    act(() => tree?.unmount()); tree = undefined;
    expect(mockAppListeners.size).toBe(0);
    expect(mockAdsListeners.size).toBe(0);
  });

  it('preserves the foreground focused banner and existing ad request options', () => {
    render(); expect(visible()).toBe(1);
    expect(tree!.root.findByType('NativeBanner' as any).props).toMatchObject({
      unitId: 'test-banner-unit', size: 'BANNER', requestOptions: {},
    });
  });

  it.each(['inactive', 'background', 'unknown', null])('does not create a WebView when starting %s', state => {
    mockState = state as string; render(); expect(visible()).toBe(0);
    expect(mockMount).not.toHaveBeenCalled();
  });

  it('destroys a backgrounded banner and recreates it only after returning active', () => {
    render(); transition('inactive'); expect(visible()).toBe(0);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    transition('background'); expect(mockMount).toHaveBeenCalledTimes(1);
    transition('active'); expect(visible()).toBe(1);
    expect(mockMount).toHaveBeenCalledTimes(2);
  });

  it('never mounts banners for screens underneath the current route', () => {
    mockFocused = false; render(); expect(visible()).toBe(0);
    mockFocused = true; render(); expect(visible()).toBe(1);
    mockFocused = false; render(); expect(visible()).toBe(0);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    transition('background'); transition('active'); expect(visible()).toBe(0);
  });

  it('does not duplicate an existing banner for repeated active events', () => {
    render(); for (let i = 0; i < 50; i++) transition('active');
    expect(visible()).toBe(1); expect(mockMount).toHaveBeenCalledTimes(1);
  });

  it('cleans up after repeated focus/background cycles without leaking subscriptions', () => {
    render();
    for (let i = 0; i < 25; i++) {
      mockFocused = false; render(); transition('background');
      mockFocused = true; render(); expect(visible()).toBe(0);
      transition('active'); expect(visible()).toBe(1);
    }
    expect(mockAppListeners.size).toBe(1);
    expect(mockAdsListeners.size).toBe(1);
    expect(mockMount.mock.calls.length - mockDestroy.mock.calls.length).toBe(1);
  });

  it('respects removed-ads ownership across background/resume', () => {
    mockAdsRemoved = true; render(); transition('background'); transition('active');
    expect(visible()).toBe(0); expect(mockMount).not.toHaveBeenCalled();
  });

  it('respects readiness revocation while hidden and restores only when eligible', () => {
    render(); transition('background'); mockAdsReady = false;
    act(() => mockAdsListeners.forEach(listener => listener()));
    transition('active'); expect(visible()).toBe(0);
    mockAdsReady = true;
    act(() => mockAdsListeners.forEach(listener => listener()));
    expect(visible()).toBe(1);
  });

  it('does not bypass missing units or a failed-load state on resume', () => {
    mockUnit = undefined; render(); expect(visible()).toBe(0);
    mockUnit = 'test-banner-unit'; render();
    act(() => tree!.root.findByType('NativeBanner' as any).props.onAdFailedToLoad());
    transition('background'); transition('active'); expect(visible()).toBe(0);
  });
});
