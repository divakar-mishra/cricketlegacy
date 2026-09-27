const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockSetRequestConfiguration = jest.fn().mockResolvedValue(undefined);
const mockGather = jest.fn();
const mockGetInfo = jest.fn();
const mockPrivacy = jest.fn();
const mockUpdate = jest.fn();
// Jest's CommonJS runtime needs require here to reset module-level SDK state.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadAds = (): typeof import('../ads') => require('../ads');
jest.mock('react-native-google-mobile-ads', () => ({
  default: () => ({ initialize: mockInitialize, setRequestConfiguration: mockSetRequestConfiguration }),
  MaxAdContentRating: { G: 'G' },
  AdsConsent: {
    gatherConsent: mockGather,
    getConsentInfo: mockGetInfo,
    requestInfoUpdate: mockUpdate,
    showPrivacyOptionsForm: mockPrivacy,
  },
}));

describe('ad consent boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGather.mockResolvedValue({ canRequestAds: true });
    mockGetInfo.mockResolvedValue({ canRequestAds: true });
  });
  it('never initializes before an eligible age is known', async () => {
    const ads = loadAds();
    await ads.configureAds({}, 'none');
    expect(mockGather).not.toHaveBeenCalled();
    expect(mockSetRequestConfiguration).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it.each(['denied', 'error'])('keeps gameplay ad-free on %s', async (mode) => {
    if (mode === 'error') mockGather.mockRejectedValue(new Error('offline'));
    else mockGather.mockResolvedValue({ canRequestAds: false });
    const ads = loadAds();
    await ads.configureAds({}, 'adult');
    expect(mockInitialize).not.toHaveBeenCalled();
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
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
  it('configures eligible teen ads with child-directed G-rated treatment before UMP', async () => {
    const ads = loadAds();
    await ads.configureAds({ rewarded: 'ca-app-pub-example/rewarded' }, 'teen');
    expect(mockSetRequestConfiguration).toHaveBeenCalledWith({
      tagForChildDirectedTreatment: true,
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
