const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockSetRequestConfiguration = jest.fn().mockResolvedValue(undefined);
const mockGather = jest.fn();
const mockGetInfo = jest.fn();
const mockPrivacy = jest.fn();
const mockUpdate = jest.fn();
const mockRewardedCreate = jest.fn();
const mockInterstitialCreate = jest.fn();
const mockUnityConsent = jest.fn().mockResolvedValue(undefined);
const mockResetConsent = jest.fn().mockResolvedValue(undefined);
const mockQa = { enabled: false };
// Jest's CommonJS runtime needs require here to reset module-level SDK state.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadAds = (): typeof import('../ads') => require('../ads');
async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Expected ad boundary was not reached');
}
jest.mock('react-native-google-mobile-ads', () => ({
  default: () => ({ initialize: mockInitialize, setRequestConfiguration: mockSetRequestConfiguration }),
  MaxAdContentRating: { G: 'G' },
  RewardedAd: { createForAdRequest: mockRewardedCreate },
  InterstitialAd: { createForAdRequest: mockInterstitialCreate },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
  AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
  AdsConsent: {
    gatherConsent: mockGather,
    getConsentInfo: mockGetInfo,
    requestInfoUpdate: mockUpdate,
    showPrivacyOptionsForm: mockPrivacy,
    reset: mockResetConsent,
  },
}));
jest.mock('../connectivity', () => ({ isOnline: jest.fn().mockResolvedValue(true) }));
jest.mock('../unityConsent', () => ({ synchronizeUnityConsent: mockUnityConsent }));
jest.mock('../../config/qa', () => ({ get QA_TOOLS_ENABLED() { return mockQa.enabled; } }));

describe('ad consent boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockQa.enabled = false;
    mockResetConsent.mockReset().mockResolvedValue(undefined);
    mockUnityConsent.mockResolvedValue(undefined);
    mockGather.mockResolvedValue({ canRequestAds: true });
    mockGetInfo.mockResolvedValue({ canRequestAds: true });
    mockRewardedCreate.mockImplementation(() => {
      const listeners = new Map<string, () => void>();
      return {
        addAdEventListener: (event: string, callback: () => void) => {
          listeners.set(event, callback);
          return jest.fn();
        },
        load: () => listeners.get('error')?.(),
        show: jest.fn(),
      };
    });
  });
  afterEach(() => { jest.useRealTimers(); });
  it('never initializes before an eligible age is known', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'none');
    expect(mockGather).not.toHaveBeenCalled();
    expect(mockSetRequestConfiguration).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockUnityConsent).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it('keeps gameplay ad-free when UMP does not permit requests', async () => {
    mockGather.mockResolvedValue({ canRequestAds: false });
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockUnityConsent).toHaveBeenCalledWith('adult', false);
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
  });
  it('retries after consent becomes available and notifies ad-dependent screens', async () => {
    mockGather
      .mockResolvedValueOnce({ canRequestAds: false })
      .mockResolvedValueOnce({ canRequestAds: true });
    const ads = loadAds();
    const listener = jest.fn();
    const unsubscribe = ads.subscribeAdsState(listener);
    await ads.configureAds({}, 'adult');
    expect(ads.isAdsReady()).toBe(false);
    await ads.configureAds({}, 'adult');
    expect(ads.isAdsReady()).toBe(true);
    expect(mockGather).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
  it('uses only UMP previous-session permission after a transient form error', async () => {
    mockGather.mockRejectedValue(new Error('offline'));
    mockGetInfo.mockResolvedValueOnce({ canRequestAds: false });
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it('can initialize from UMP previous-session permission after a transient form error', async () => {
    mockGather.mockRejectedValue(new Error('offline'));
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockGetInfo).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });
  it('attempts an adult ad after a declined choice only when UMP permits requests, without awarding on no-fill', async () => {
    mockGather.mockResolvedValue({ canRequestAds: true, status: 'OBTAINED' });
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'ca-app-pub-example/rewarded' }, 'adult');
    expect(ads.getAdRequestOptions()).toEqual({});
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
    expect(mockRewardedCreate).toHaveBeenCalledWith('ca-app-pub-example/rewarded', {});
  });
  it('initializes once after successful consent, including concurrent callers', async () => {
    const ads = loadAds();
    await Promise.all([ads.configureAds({}, 'adult'), ads.configureAds({}, 'adult')]);
    expect(mockGather).toHaveBeenCalledTimes(1);
    expect(mockSetRequestConfiguration).toHaveBeenCalledWith({
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(ads.isAdsReady()).toBe(true);
    expect(ads.getAdRequestOptions()).toEqual({});
  });
  it('exposes only a configured banner unit after the adult/consent gate opens', async () => {
    const ads = loadAds();
    await ads.configureAds({ banner: 'ca-app-pub-example/banner-unit' }, 'adult');
    expect(ads.isAdsReady()).toBe(true);
    expect(ads.getBannerAdUnitId()).toBe('ca-app-pub-example/banner-unit');
  });
  it('stops requests after privacy choices withdraw permission', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    mockUpdate.mockResolvedValue({
      privacyOptionsRequirementStatus: 'REQUIRED',
      canRequestAds: true,
    });
    mockPrivacy.mockResolvedValue({ canRequestAds: false });
    await expect(ads.showAdPrivacyChoices()).resolves.toBe('shown');
    expect(ads.isAdsReady()).toBe(false);
    await expect(ads.showInterstitial()).resolves.toBe(false);
  });
  it('fails closed when current consent cannot be read', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    mockGetInfo.mockRejectedValue(new Error('unavailable'));
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
  });
  it('configures eligible teen ads with under-age-of-consent G-rated treatment before UMP', async () => {
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'ca-app-pub-example/rewarded' }, 'teen');
    expect(ads.getAdRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
    expect(mockSetRequestConfiguration).toHaveBeenCalledWith({
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: true,
      maxAdContentRating: 'G',
    });
    expect(mockGather).toHaveBeenCalledWith({ tagForUnderAgeOfConsent: true });
    expect(mockUnityConsent).toHaveBeenCalledWith('teen', true);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(ads.isAdsReady()).toBe(true);
    mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'NOT_REQUIRED', canRequestAds: true });
    await expect(ads.showAdPrivacyChoices()).resolves.toBe('not_required');
    expect(mockUpdate).toHaveBeenCalledWith({ tagForUnderAgeOfConsent: true });
  });

  it('applies Unity privacy after UMP and before SDK initialization', async () => {
    await loadAds().configureAds({}, 'adult');
    expect(mockGather.mock.invocationCallOrder[0]).toBeLessThan(mockUnityConsent.mock.invocationCallOrder[0]);
    expect(mockUnityConsent.mock.invocationCallOrder[0]).toBeLessThan(mockInitialize.mock.invocationCallOrder[0]);
  });
  it('does not initialize any mediated SDK if the native privacy bridge fails', async () => {
    mockUnityConsent.mockRejectedValue(new Error('native metadata unavailable'));
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it('clears Unity permission before the privacy form and reapplies after withdrawal', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: true });
    mockPrivacy.mockResolvedValue({ canRequestAds: false });
    await ads.showAdPrivacyChoices();
    expect(mockUnityConsent.mock.calls).toEqual([['adult', true], ['adult', false], ['adult', false]]);
    expect(mockUnityConsent.mock.invocationCallOrder[1]).toBeLessThan(mockPrivacy.mock.invocationCallOrder[0]);
  });
  it('does not reopen banners when privacy editing races initialization', async () => {
    let finishInitialization!: () => void;
    mockInitialize.mockImplementationOnce(() => new Promise<void>((resolve) => { finishInitialization = resolve; }));
    const ads = loadAds();
    const configuration = ads.configureAds({}, 'adult');
    await waitFor(() => Boolean(finishInitialization));
    mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: true });
    mockPrivacy.mockResolvedValue({ canRequestAds: false });
    const privacy = ads.showAdPrivacyChoices();
    finishInitialization();
    await configuration;
    expect(ads.isAdsReady()).toBe(false);
    await privacy;
    expect(ads.isAdsReady()).toBe(false);
  });
  it('reconfigures restrictive treatment when an initialized adult becomes a teen', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    await ads.configureAds({}, 'teen');
    expect(mockSetRequestConfiguration).toHaveBeenLastCalledWith({
      tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: true, maxAdContentRating: 'G',
    });
    expect(mockUnityConsent).toHaveBeenLastCalledWith('teen', true);
  });
  it('does not finish stale initialization after age eligibility is withdrawn', async () => {
    let finishConsent!: (value: unknown) => void;
    mockGather.mockImplementationOnce(() => new Promise((resolve) => { finishConsent = resolve; }));
    const ads = loadAds();
    const pending = ads.configureAds({}, 'adult');
    await waitFor(() => Boolean(finishConsent));
    await ads.configureAds({}, 'none');
    finishConsent({ canRequestAds: true });
    await pending;
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockUnityConsent).toHaveBeenLastCalledWith('none', false);
    expect(ads.isAdsReady()).toBe(false);
  });

  function installControlledAd(kind: 'rewarded' | 'interstitial') {
    const listeners = new Map<string, () => void>();
    const show = jest.fn().mockResolvedValue(undefined);
    const create = kind === 'rewarded' ? mockRewardedCreate : mockInterstitialCreate;
    create.mockImplementation(() => ({
      addAdEventListener: (event: string, callback: () => void) => {
        listeners.set(event, callback);
        return () => listeners.delete(event);
      },
      load: jest.fn(), show,
    }));
    return { listeners, show, emit: (event: string) => listeners.get(event)?.() };
  }
  it('allows only one hub interstitial request while the first one is loading', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('interstitial');
    const ads = loadAds();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storage = require('../../storage/storage') as typeof import('../../storage/storage');
    const read = jest.spyOn(storage, 'getJSON').mockResolvedValue([]);
    const write = jest.spyOn(storage, 'setJSON').mockResolvedValue(undefined);
    await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
    const first = ads.maybeShowInterstitial(true, 'career-hub-return');
    const second = ads.maybeShowInterstitial(true, 'career-hub-return');
    try {
      await waitFor(() => mockInterstitialCreate.mock.calls.length > 0);
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(mockInterstitialCreate).toHaveBeenCalledTimes(1);
    } finally {
      ad.emit('closed');
      jest.runAllTimers();
      await Promise.all([first, second]);
      read.mockRestore(); write.mockRestore();
    }
  });
  it('retains the in-memory frequency gap when persisting history fails', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('interstitial');
    const ads = loadAds();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storage = require('../../storage/storage') as typeof import('../../storage/storage');
    const read = jest.spyOn(storage, 'getJSON').mockResolvedValue([Date.now() - 20 * 60_000]);
    const write = jest.spyOn(storage, 'setJSON').mockRejectedValue(new Error('disk full'));
    await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
    const first = ads.maybeShowInterstitial(true, 'career-hub-return');
    await waitFor(() => ad.listeners.has('loaded'));
    ad.emit('loaded'); ad.emit('closed');
    expect(await first).toBe(true);
    const second = ads.maybeShowInterstitial(true, 'career-hub-return');
    try {
      for (let i = 0; i < 30; i++) await Promise.resolve();
      expect(mockInterstitialCreate).toHaveBeenCalledTimes(1);
    } finally {
      ad.emit('closed'); jest.runAllTimers(); await second;
      read.mockRestore(); write.mockRestore();
    }
  });
  it.each(['focused', 'sameSave', 'adsEnabled'] as const)(
    'discards a loading hub ad when %s eligibility changes', async key => {
      jest.useFakeTimers();
      const ad = installControlledAd('interstitial');
      const ads = loadAds();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const storage = require('../../storage/storage') as typeof import('../../storage/storage');
      const read = jest.spyOn(storage, 'getJSON').mockResolvedValue([]);
      await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
      const eligible = { focused: true, sameSave: true, adsEnabled: true };
      const pending = ads.maybeShowInterstitial(true, 'career-hub-return', undefined,
        () => eligible.focused && eligible.sameSave && eligible.adsEnabled);
      try {
        await waitFor(() => ad.listeners.has('loaded'));
        eligible[key] = false;
        ad.emit('loaded');
        expect(await pending).toBe(false);
        expect(ad.show).not.toHaveBeenCalled();
        expect(ad.listeners.size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      } finally { read.mockRestore(); }
    },
  );
  it('blocks persisted hourly caps and releases its loading lock after a failed ad', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('interstitial');
    const ads = loadAds();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storage = require('../../storage/storage') as typeof import('../../storage/storage');
    const now = Date.now();
    const read = jest.spyOn(storage, 'getJSON').mockResolvedValue([
      now - 59 * 60_000, now - 45 * 60_000, now - 30 * 60_000, now - 16 * 60_000,
    ]);
    await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
    try {
      expect(await ads.maybeShowInterstitial(true, 'career-hub-return')).toBe(false);
      expect(mockInterstitialCreate).not.toHaveBeenCalled();
      read.mockResolvedValue([]);
      const first = ads.maybeShowInterstitial(true, 'career-hub-return');
      await waitFor(() => ad.listeners.has('loaded'));
      ad.emit('error'); expect(await first).toBe(false);
      // No-fill/error must not permanently reserve the hub safe point.
      const retry = ads.maybeShowInterstitial(true, 'career-hub-return');
      await waitFor(() => ad.listeners.has('loaded'));
      ad.emit('closed'); expect(await retry).toBe(false);
      expect(mockInterstitialCreate).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    } finally { read.mockRestore(); }
  });
  it.each(['rewarded', 'interstitial'] as const)('does not present a delayed %s after age eligibility is withdrawn', async kind => {
    jest.useFakeTimers();
    const ad = installControlledAd(kind);
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded', interstitial: 'interstitial' }, 'adult');
    const pending = kind === 'rewarded' ? ads.showRewarded() : ads.showInterstitial();
    await waitFor(() => ad.listeners.has('loaded'));
    await ads.configureAds({}, 'none');
    ad.emit('loaded');
    await expect(pending).resolves.toEqual(kind === 'rewarded' ? { completed: false } : false);
    expect(ad.show).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['rewarded', 'interstitial'] as const)('handles an asynchronous native %s show rejection without a reward or stuck timer', async kind => {
    jest.useFakeTimers();
    const ad = installControlledAd(kind);
    ad.show.mockRejectedValue(new Error('Activity unavailable'));
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded', interstitial: 'interstitial' }, 'adult');
    const pending = kind === 'rewarded' ? ads.showRewarded() : ads.showInterstitial();
    await waitFor(() => ad.listeners.has('loaded'));
    ad.emit('loaded');
    await expect(pending).resolves.toEqual(kind === 'rewarded' ? { completed: false } : false);
    expect(jest.getTimerCount()).toBe(0);
    expect(ad.listeners.size).toBe(0);
  });
  it('does not grant a reward merely because a mediated ad closes', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('rewarded');
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded' }, 'adult');
    const pending = ads.showRewarded();
    await waitFor(() => ad.listeners.has('loaded'));
    ad.emit('loaded'); ad.emit('closed');
    await expect(pending).resolves.toEqual({ completed: false });
    expect(jest.getTimerCount()).toBe(0);
  });
  it('settles an earned reward once despite duplicate provider callbacks', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('rewarded');
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded' }, 'adult');
    const settled = jest.fn();
    const pending = ads.showRewarded().then(settled);
    await waitFor(() => ad.listeners.has('loaded'));
    const close = ad.listeners.get('closed')!;
    ad.emit('loaded'); ad.emit('earned_reward'); ad.emit('earned_reward'); close(); close();
    await pending;
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith({ completed: true });
    expect(ad.listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not load paid-removed interstitials or explicitly skipped rewarded ads', async () => {
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded', interstitial: 'interstitial' }, 'adult');
    await expect(ads.showInterstitial(false)).resolves.toBe(false);
    await expect(ads.showRewarded(false)).resolves.toEqual({ completed: false });
    expect(mockRewardedCreate).not.toHaveBeenCalled();
    expect(mockInterstitialCreate).not.toHaveBeenCalled();
  });
  it('discards an old ad after privacy choices change even when limited ad requests remain permitted', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('rewarded');
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded' }, 'adult');
    const pending = ads.showRewarded();
    await waitFor(() => ad.listeners.has('loaded'));
    mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: true });
    mockPrivacy.mockResolvedValue({ canRequestAds: true });
    await ads.showAdPrivacyChoices();
    expect(ads.isAdsReady()).toBe(true);
    ad.emit('loaded');
    await expect(pending).resolves.toEqual({ completed: false });
    expect(ad.show).not.toHaveBeenCalled();
  });
  it('discards a previous-audience ad even after the same adult audience is re-enabled', async () => {
    jest.useFakeTimers();
    const ad = installControlledAd('interstitial');
    const ads = loadAds();
    await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
    const pending = ads.showInterstitial();
    await waitFor(() => ad.listeners.has('loaded'));
    await ads.configureAds({}, 'none');
    await ads.configureAds({ interstitial: 'interstitial' }, 'adult');
    expect(ads.isAdsReady()).toBe(true);
    ad.emit('loaded');
    await expect(pending).resolves.toBe(false);
    expect(ad.show).not.toHaveBeenCalled();
  });
  it.each(['rewarded', 'interstitial'] as const)('presents %s only once despite duplicate loaded callbacks', async kind => {
    jest.useFakeTimers();
    const ad = installControlledAd(kind);
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'rewarded', interstitial: 'interstitial' }, 'adult');
    const pending = kind === 'rewarded' ? ads.showRewarded() : ads.showInterstitial();
    await waitFor(() => ad.listeners.has('loaded'));
    const loaded = ad.listeners.get('loaded')!;
    loaded(); loaded(); ad.emit('closed');
    await pending;
    loaded(); // Already queued callback after listener cleanup.
    expect(ad.show).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  describe('ephemeral QA privacy profiles', () => {
    beforeEach(() => { mockQa.enabled = true; });
    it('rejects production and unknown-age sessions before resetting UMP', async () => {
      const ads = loadAds();
      await expect(ads.configureQaAdSession('us-adult')).rejects.toThrow('eligible');
      await ads.configureAds({}, 'adult');
      mockQa.enabled = false;
      await expect(ads.configureQaAdSession('teen')).rejects.toThrow('eligible');
      expect(mockResetConsent).not.toHaveBeenCalled();
    });
    it('cannot use an override to upgrade an actual saved teen audience', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'teen');
      await expect(ads.configureQaAdSession('us-adult')).rejects.toThrow('existing adult test session');
      expect(mockResetConsent).not.toHaveBeenCalled();
    });
    it('uses regulated-US geography in both startup and the real privacy choices path', async () => {
      const ads = loadAds();
      await ads.configureAds({ banner: 'qa-banner' }, 'adult');
      await expect(ads.configureQaAdSession('us-adult')).resolves.toBe(true);
      expect(mockGather).toHaveBeenLastCalledWith({ tagForUnderAgeOfConsent: false, debugGeography: 3 });
      expect(mockUnityConsent.mock.calls.slice(1)).toEqual([['adult', false], ['adult', true]]);
      mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: true });
      mockPrivacy.mockResolvedValue({ canRequestAds: true });
      await expect(ads.showAdPrivacyChoices()).resolves.toBe('shown');
      expect(mockUpdate).toHaveBeenLastCalledWith({ tagForUnderAgeOfConsent: false, debugGeography: 3 });
      expect(ads.getBannerAdUnitId()).toBe('qa-banner');
    });
    it('uses the real restrictive teen pipeline and restores the normal in-memory profile', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'adult');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const storage = require('../../storage/storage') as typeof import('../../storage/storage');
      const write = jest.spyOn(storage, 'setJSON');
      await expect(ads.configureQaAdSession('teen')).resolves.toBe(true);
      expect(mockSetRequestConfiguration).toHaveBeenLastCalledWith({
        tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: true, maxAdContentRating: 'G',
      });
      expect(mockGather).toHaveBeenLastCalledWith({ tagForUnderAgeOfConsent: true, debugGeography: 4 });
      expect(mockUnityConsent).toHaveBeenLastCalledWith('teen', true);
      expect(ads.getAdRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
      await expect(ads.configureQaAdSession('normal')).resolves.toBe(true);
      expect(mockSetRequestConfiguration).toHaveBeenLastCalledWith({
        tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false,
      });
      expect(mockGather).toHaveBeenLastCalledWith({ tagForUnderAgeOfConsent: false });
      expect(mockUnityConsent).toHaveBeenLastCalledWith('adult', true);
      expect(ads.getAdRequestOptions()).toEqual({});
      expect(write).not.toHaveBeenCalled();
      write.mockRestore();
    });
    it('keeps requests and competing privacy/profile edits closed during the native reset', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'adult');
      let reset!: () => void;
      mockResetConsent.mockImplementationOnce(() => new Promise<void>((resolve) => { reset = resolve; }));
      const pending = ads.configureQaAdSession('us-adult');
      await waitFor(() => Boolean(reset));
      expect(ads.isAdsReady()).toBe(false);
      await expect(ads.showAdPrivacyChoices()).resolves.toBe('unavailable');
      await expect(ads.configureQaAdSession('teen')).rejects.toThrow('idle');
      await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
      reset();
      await expect(pending).resolves.toBe(true);
    });
    it('never resurrects withdrawn eligibility after a delayed native reset', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'adult');
      let reset!: () => void;
      mockResetConsent.mockImplementationOnce(() => new Promise<void>((resolve) => { reset = resolve; }));
      const pending = ads.configureQaAdSession('us-adult');
      await waitFor(() => Boolean(reset));
      await ads.configureAds({}, 'none');
      reset();
      await expect(pending).rejects.toThrow('audience changed');
      expect(mockGather).toHaveBeenCalledTimes(1);
      expect(ads.isAdsReady()).toBe(false);
    });
    it('fails closed on a native reset error without permanently locking the QA controls', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'adult');
      mockResetConsent.mockRejectedValueOnce(new Error('reset unavailable'));
      await expect(ads.configureQaAdSession('teen')).rejects.toThrow('reset unavailable');
      expect(ads.isAdsReady()).toBe(false);
      expect(mockUnityConsent).toHaveBeenLastCalledWith('adult', false);
      await expect(ads.configureQaAdSession('normal')).resolves.toBe(true);
    });
    it('rejects an unknown profile before reset', async () => {
      const ads = loadAds();
      await ads.configureAds({}, 'adult');
      await expect(ads.configureQaAdSession('invalid' as 'teen')).rejects.toThrow('Unknown QA profile');
      expect(mockResetConsent).not.toHaveBeenCalled();
    });
  });
});
