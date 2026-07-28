import fs from 'fs';
import path from 'path';

describe('MatchScreen rewarded ad result UI', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

  it('disables result-screen ad rewards when no provider is ready', () => {
    expect(source).toContain('const rewardedAdsAvailable = ads.isAdsReady() || ads.isReady');
    expect(source).toContain('Rewarded ads unavailable');
    expect(source).toContain('disabled');
  });

  it('grants doubled coins only after a completed rewarded ad callback', () => {
    expect(source).toContain('const { completed } = await ads.showRewarded();');
    expect(source).toContain('if (completed) {');
    expect(source).toContain('grantAdReward(');
    expect(source).toContain('`match-double:${result.fixtureId}`');
    expect(source).toContain('adRewardPendingRef');
    expect(source).toContain('Reward not granted. Watch the full ad to claim the bonus.');
  });
});
