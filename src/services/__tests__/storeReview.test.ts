import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import {
  claimPlayRatingPrompt,
  hasRatingExperience,
  hasSeenPlayRatingPrompt,
  openPlayStoreReview,
  PLAY_RATING_MIN_MATCHES,
  PLAY_RATING_PROMPT_KEY,
  PLAY_REVIEW_URL,
} from '../storeReview';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: jest.fn() } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (Platform as any).OS = 'android';
  (Linking.openURL as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('installation-local, neutral Play rating invitation', () => {
  it('uses the owner-approved five completed matches, not wins or a star prediction', () => {
    expect(PLAY_RATING_MIN_MATCHES).toBe(5);
    expect(hasRatingExperience(4)).toBe(false);
    expect(hasRatingExperience(5)).toBe(true);
    expect(hasRatingExperience(50)).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity, -1])('fails closed for invalid match count %s', (count) => {
    expect(hasRatingExperience(count)).toBe(false);
  });
  it('claims once and persists before granting permission to show', async () => {
    expect(await hasSeenPlayRatingPrompt()).toBe(false);
    expect(await claimPlayRatingPrompt(() => true)).toBe(true);
    expect(await AsyncStorage.getItem(PLAY_RATING_PROMPT_KEY)).toBe('shown');
    expect(await claimPlayRatingPrompt(() => true)).toBe(false);
    expect(await hasSeenPlayRatingPrompt()).toBe(true);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it.each(['1750000000000', 'malformed'])(
    'respects legacy native-review history %s',
    async (legacy) => {
      await AsyncStorage.setItem('sr:lastPrompt', legacy);
      expect(await claimPlayRatingPrompt(() => true)).toBe(false);
      expect(await AsyncStorage.getItem(PLAY_RATING_PROMPT_KEY)).toBeNull();
    },
  );
  it('does not erase existing settings or career saves when recording prompt history', async () => {
    await AsyncStorage.setItem('cricket:settings', 'existing settings');
    await AsyncStorage.setItem('career:1', 'existing save');
    await claimPlayRatingPrompt(() => true);
    expect(await AsyncStorage.getItem('cricket:settings')).toBe('existing settings');
    expect(await AsyncStorage.getItem('career:1')).toBe('existing save');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
  it('suppresses the popup on read failure instead of assuming fresh storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await claimPlayRatingPrompt(() => true)).toBe(false);
    expect(await AsyncStorage.getItem(PLAY_RATING_PROMPT_KEY)).toBeNull();
  });
  it('does not show when recording history fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    expect(await claimPlayRatingPrompt(() => true)).toBe(false);
  });
  it('rejects duplicate concurrent claims across retained hubs', async () => {
    let release!: (value: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = claimPlayRatingPrompt(() => true);
    expect(await claimPlayRatingPrompt(() => true)).toBe(false);
    release(null);
    expect(await first).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
  it('rechecks focus/eligibility after storage awaits', async () => {
    let current = true;
    const claim = claimPlayRatingPrompt(() => current);
    current = false;
    expect(await claim).toBe(false);
    expect(await AsyncStorage.getItem(PLAY_RATING_PROMPT_KEY)).toBeNull();
  });
  it('does not offer Google Play on another platform', async () => {
    (Platform as any).OS = 'web';
    expect(await claimPlayRatingPrompt(() => true)).toBe(false);
    expect(await openPlayStoreReview()).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it('opens only the correct Play listing after a user action', async () => {
    expect(await openPlayStoreReview()).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(
      'market://details?id=com.coverdrive.cricket&showAllReviews=true',
    );
  });
  it('falls back to HTTPS when the native Play handler is unavailable', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no handler'));
    expect(await openPlayStoreReview()).toBe(true);
    expect(Linking.openURL).toHaveBeenLastCalledWith(PLAY_REVIEW_URL);
  });
  it('returns a handled failure when both store links fail', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('offline'));
    expect(await openPlayStoreReview()).toBe(false);
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });
});
