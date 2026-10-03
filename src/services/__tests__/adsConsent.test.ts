const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockSetRequestConfiguration = jest.fn().mockResolvedValue(undefined);
const mockGather = jest.fn();
const mockGetInfo = jest.fn();
const mockPrivacy = jest.fn();
const mockUpdate = jest.fn();
const mockRewardedCreate = jest.fn();
// Jest's CommonJS runtime needs require here to reset module-level SDK state.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadAds = (): typeof import('../ads') => require('../ads');
jest.mock('react-native-google-mobile-ads', () => ({
  default: () => ({ initialize: mockInitialize, setRequestConfiguration: mockSetRequestConfiguration }),
  MaxAdContentRating: { G: 'G' },
  RewardedAd: { createForAdRequest: mockRewardedCreate },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  AdsConsent: {
    gatherConsent: mockGather,
    getConsentInfo: mockGetInfo,
    requestInfoUpdate: mockUpdate,
    showPrivacyOptionsForm: mockPrivacy,
  },
}));
jest.mock('../connectivity', () => ({ isOnline: jest.fn().mockResolvedValue(true) }));

describe('ad consent boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
  it('never initializes before an eligible age is known', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'none');
    expect(mockGather).not.toHaveBeenCalled();
    expect(mockSetRequestConfiguration).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it('keeps gameplay ad-free when UMP does not permit requests', async () => {
    mockGather.mockResolvedValue({ canRequestAds: false });
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockInitialize).not.toHaveBeenCalled();
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
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(ads.isAdsReady()).toBe(true);
    mockUpdate.mockResolvedValue({ privacyOptionsRequirementStatus: 'NOT_REQUIRED', canRequestAds: true });
    await expect(ads.showAdPrivacyChoices()).resolves.toBe('not_required');
    expect(mockUpdate).toHaveBeenCalledWith({ tagForUnderAgeOfConsent: true });
  });
});
