import fs from 'fs';
import path from 'path';

const seasonPassScreen = fs.readFileSync(
  path.join(__dirname, '..', 'SeasonPassScreen.tsx'),
  'utf8',
);
const purchaseScreen = fs.readFileSync(path.join(__dirname, '..', 'PurchaseScreen.tsx'), 'utf8');

describe('season pass screen contract', () => {
  it('renders the required pass state instead of a placeholder page', () => {
    expect(seasonPassScreen).toContain('Season Pass');
    expect(seasonPassScreen).toContain('Season resets in');
    expect(seasonPassScreen).toContain('Tier {level} / {PASS_TIERS.length}');
    expect(seasonPassScreen).toContain('Progress to Tier');
    expect(seasonPassScreen).toContain('Reward Track');
    expect(seasonPassScreen).toContain('Free');
    expect(seasonPassScreen).toContain('Prem');
    expect(seasonPassScreen).toContain('Claim ${claimable.length} reward');
    expect(seasonPassScreen).toContain('claimedFree');
    expect(seasonPassScreen).toContain('claimedPremium');
    expect(seasonPassScreen).toContain('rewardLocked');
    expect(seasonPassScreen).toContain('No active season. Start a career or manager game first.');
  });

  it('uses the canonical claim calculation and persistent store action', () => {
    expect(seasonPassScreen).toContain('claimablePassRewards(pass)');
    expect(seasonPassScreen).toContain('claimPass()');
    expect(seasonPassScreen).toContain('Season Pass reward claimed');
    expect(seasonPassScreen).toContain(
      'Coins: ${r.previousCoins.toLocaleString()} -> ${r.newCoins.toLocaleString()}',
    );
    expect(seasonPassScreen).toContain('<RewardModal data={rewardModal}');
    expect(seasonPassScreen).toContain('disabled={claimBusy}');
    expect(seasonPassScreen).toContain('passLevel(pass.xp)');
    expect(seasonPassScreen).toContain('xpForTier(level)');
  });

  it('opens the real Season Pass route from the Store card', () => {
    expect(purchaseScreen).toContain("p.id === 'season_pass'");
    expect(purchaseScreen).toContain("navigation.navigate('SeasonPass')");
    expect(purchaseScreen).toContain('Boolean(save && isSeasonPassActive(save)) ||');
    expect(purchaseScreen).toContain("import { isSeasonPassActive } from '../game/seasonPass'");
    expect(purchaseScreen).toContain('!purchases.isProductAvailable(passProduct)');
    expect(purchaseScreen).not.toContain('onBuy(passProduct)');
  });
});
