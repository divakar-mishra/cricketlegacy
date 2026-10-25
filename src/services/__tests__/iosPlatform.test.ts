import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestAppleStoreReview } from '../storeReview';

const mockReview = jest.fn(async () => {});
const mockAvailable = jest.fn(async () => true);
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Linking: { openURL: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-store-review', () => ({ isAvailableAsync: () => mockAvailable(), requestReview: () => mockReview() }));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockAvailable.mockResolvedValue(true);
  (Platform as { OS: string }).OS = 'ios';
});
test('Apple system review is requested once across concurrent hubs and relaunches', async () => {
  expect(await Promise.all([requestAppleStoreReview(() => true), requestAppleStoreReview(() => true)])).toEqual([true, false]);
  expect(await requestAppleStoreReview(() => true)).toBe(false);
  expect(mockReview).toHaveBeenCalledTimes(1);
});
test('unsupported review does not consume history, stale navigation never requests it', async () => {
  mockAvailable.mockResolvedValueOnce(false);
  expect(await requestAppleStoreReview(() => true)).toBe(false);
  let current = true;
  mockAvailable.mockImplementationOnce(async () => { current = false; return true; });
  expect(await requestAppleStoreReview(() => current)).toBe(false);
  expect(mockReview).not.toHaveBeenCalled();
  expect(await requestAppleStoreReview(() => true)).toBe(true);
});
test('iOS never receives Android live ad-unit defaults or generic Android overrides', () => {
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT = 'android-live-unit';
  delete process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT;
  jest.isolateModules(() => {
    const { MONETIZATION } = require('../../config/monetization');
    expect(MONETIZATION.admob.rewarded).toBe('');
  });
  delete process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT;
});
test('iOS unconfigured ads stay uninitialized and use contextual request options', async () => {
  jest.resetModules();
  const ads = require('../ads') as typeof import('../ads');
  await ads.configureAds({}, 'adult');
  expect(ads.isAdsReady()).toBe(false);
  expect(ads.getAdRequestOptions()).toEqual({ requestNonPersonalizedAdsOnly: true });
});
