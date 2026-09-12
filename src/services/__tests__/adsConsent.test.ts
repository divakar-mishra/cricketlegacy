const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGather = jest.fn();
const mockGetInfo = jest.fn();
const mockPrivacy = jest.fn();
const mockUpdate = jest.fn();
// Jest's CommonJS runtime needs require here to reset module-level SDK state.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadAds = (): typeof import('../ads') => require('../ads');
jest.mock('react-native-google-mobile-ads', () => ({
  default: () => ({ initialize: mockInitialize }),
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
  it('never initializes before adult eligibility', async () => {
    const ads = loadAds();
    await ads.configureAds({}, false);
    expect(mockGather).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });
  it.each(['denied', 'error'])('keeps gameplay ad-free on %s', async (mode) => {
    if (mode === 'error') mockGather.mockRejectedValue(new Error('offline'));
    else mockGather.mockResolvedValue({ canRequestAds: false });
    const ads = loadAds();
    await ads.configureAds({}, true);
    expect(mockInitialize).not.toHaveBeenCalled();
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
  });
  it('initializes once after successful consent, including concurrent callers', async () => {
    const ads = loadAds();
    await Promise.all([ads.configureAds({}, true), ads.configureAds({}, true)]);
    expect(mockGather).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(ads.isAdsReady()).toBe(true);
  });
  it('stops requests after privacy choices withdraw permission', async () => {
    const ads = loadAds();
    await ads.configureAds({}, true);
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
    await ads.configureAds({}, true);
    mockGetInfo.mockRejectedValue(new Error('unavailable'));
    await expect(ads.showRewarded()).resolves.toEqual({ completed: false });
  });
});
