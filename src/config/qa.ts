/**
 * Internal playtesting controls. Production builds keep these disabled unless
 * the build environment explicitly opts in.
 */
export const QA_TOOLS_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_QA_TOOLS === 'true';

export const QA_WHALE_COINS = 10_000_000;
export const QA_WHALE_CLUB_BUDGET = 1_000_000_000;
