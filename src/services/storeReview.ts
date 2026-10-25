import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

// Installation-local engagement state, never part of a career/cloud save.
export const PLAY_RATING_PROMPT_KEY = 'sr:play-prompt:v1';
export const PLAY_RATING_MIN_MATCHES = 5;
const LEGACY_PROMPT_KEY = 'sr:lastPrompt';
export const PLAY_REVIEW_URL =
  'https://play.google.com/store/apps/details?id=com.coverdrive.cricket&showAllReviews=true';
const PLAY_REVIEW_DEEP_LINK = 'market://details?id=com.coverdrive.cricket&showAllReviews=true';
let claiming = false;
const APPLE_PROMPT_KEY = 'sr:apple-prompt:v1';
let appleClaiming = false;

/** Use Apple's system review API, without a custom rating pre-prompt or store ID.
 * A completed request never proves Apple displayed a dialog or a review was sent.
 */
export async function requestAppleStoreReview(isCurrent: () => boolean): Promise<boolean> {
  if (Platform.OS !== 'ios' || appleClaiming || !isCurrent()) return false;
  appleClaiming = true;
  try {
    if (await AsyncStorage.getItem(APPLE_PROMPT_KEY) !== null || !isCurrent()) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const review = require('expo-store-review') as typeof import('expo-store-review');
    if (!(await review.isAvailableAsync()) || !isCurrent()) return false;
    await AsyncStorage.setItem(APPLE_PROMPT_KEY, 'requested');
    if (!isCurrent()) return false;
    await review.requestReview();
    return true;
  } catch {
    return false;
  } finally {
    appleClaiming = false;
  }
}

export function hasRatingExperience(completedMatches: number): boolean {
  return Number.isFinite(completedMatches) && completedMatches >= PLAY_RATING_MIN_MATCHES;
}

/** Existing native-review history is respected; unreadable storage never nags. */
export async function hasSeenPlayRatingPrompt(): Promise<boolean> {
  try {
    const [current, legacy] = await Promise.all([
      AsyncStorage.getItem(PLAY_RATING_PROMPT_KEY),
      AsyncStorage.getItem(LEGACY_PROMPT_KEY),
    ]);
    return current !== null || legacy !== null;
  } catch {
    return true;
  }
}

/** Persist before displaying, so closing/relaunching cannot repeat the ask. */
export async function claimPlayRatingPrompt(isCurrent: () => boolean): Promise<boolean> {
  if (claiming || Platform.OS !== 'android') return false;
  claiming = true;
  try {
    if ((await hasSeenPlayRatingPrompt()) || !isCurrent()) return false;
    await AsyncStorage.setItem(PLAY_RATING_PROMPT_KEY, 'shown');
    return isCurrent();
  } catch {
    return false;
  } finally {
    claiming = false;
  }
}

/** A user-tapped rating CTA opens Play, not its quota-limited in-app API.
 * Success means only that the URL opened, never that a review was submitted.
 */
export async function openPlayStoreReview(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await Linking.openURL(PLAY_REVIEW_DEEP_LINK);
    return true;
  } catch {
    try {
      await Linking.openURL(PLAY_REVIEW_URL);
      return true;
    } catch {
      return false;
    }
  }
}
