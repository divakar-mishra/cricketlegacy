/**
 * Store review prompt — wraps expo-store-review.
 *
 * Shows the native rating dialog at high-value moments (first big win,
 * milestone match, etc). Guards:
 *  - Only prompts if `isAvailableAsync()` returns true.
 *  - Rate-limits: at most once per 7 days (tracked in AsyncStorage).
 *  - Only after enough "positive sentiment" matches (3+ wins before first ask).
 */

const _lastPromptKey = 'sr:lastPrompt';

async function getStorage() {
  try {
    const m = await import('@react-native-async-storage/async-storage');
    return m.default;
  } catch {
    return null;
  }
}

const MIN_DAYS_BETWEEN = 7;
const MIN_WINS_BEFORE_FIRST = 3;

/** Call after a win. Internally guards frequency. */
export async function maybeRequestReview(totalWins: number): Promise<void> {
  // In-app review is meaningful only for store-distributed builds. Dev clients can
  // report the native API as available and then fail after a completed match.
  if (__DEV__) return;
  if (totalWins < MIN_WINS_BEFORE_FIRST) return;
  try {
    const StoreReview = await import('expo-store-review').catch(() => null);
    if (!StoreReview) return;
    const available = await StoreReview.isAvailableAsync().catch(() => false);
    if (!available) return;

    const storage = await getStorage();
    if (storage) {
      const raw = await storage.getItem(_lastPromptKey).catch(() => null);
      if (raw) {
        const last = parseInt(raw, 10);
        const daysSince = (Date.now() - last) / 86_400_000;
        if (daysSince < MIN_DAYS_BETWEEN) return;
      }
      await storage.setItem(_lastPromptKey, String(Date.now())).catch(() => {});
    }

    await StoreReview.requestReview().catch(() => {});
  } catch {
    // Never block gameplay on this.
  }
}
