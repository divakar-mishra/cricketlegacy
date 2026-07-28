import {
  DEFAULT_INTERSTITIAL_GAP_MS,
  INTERSTITIAL_MAX_PER_WINDOW,
  INTERSTITIAL_WINDOW_MS,
  isAdsReady,
  isReady,
  MOCK_MODE,
  showRewarded,
} from '../ads';
import fs from 'fs';
import path from 'path';

describe('rewarded ads', () => {
  it('does not complete rewarded ads from an unconfigured local simulation', async () => {
    expect(MOCK_MODE).toBe(false);
    expect(isAdsReady()).toBe(false);
    expect(isReady('rewarded')).toBe(false);
    await expect(showRewarded()).resolves.toEqual({ completed: false });
  });

  it('does not let the local mock branch mint an earned reward', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'ads.ts'), 'utf8');
    const mockBranch = source.match(
      /if \(MOCK_MODE\) \{[\s\S]*?return \{ completed: (true|false) \};[\s\S]*?\}/,
    );
    expect(mockBranch?.[1]).toBe('false');
  });

  it('caps interstitials at two per rolling gameplay hour', () => {
    expect(INTERSTITIAL_MAX_PER_WINDOW).toBe(2);
    expect(INTERSTITIAL_WINDOW_MS).toBe(60 * 60_000);
    expect(DEFAULT_INTERSTITIAL_GAP_MS).toBe(30 * 60_000);
  });
});
