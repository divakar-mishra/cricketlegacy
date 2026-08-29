import fs from 'fs';
import path from 'path';

const seasonPassScreen = fs.readFileSync(
  path.join(__dirname, '..', 'SeasonPassScreen.tsx'),
  'utf8',
);
const purchaseScreen = fs.readFileSync(path.join(__dirname, '..', 'PurchaseScreen.tsx'), 'utf8');
const liveOpsCards = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'LiveOpsCards.tsx'),
  'utf8',
);

describe('season pass screen contract', () => {
  it('keeps Player energy out of the Manager pass wallet', () => {
    expect(seasonPassScreen).not.toContain('<WalletBar');
  });

  it('renders the required pass state instead of a placeholder page', () => {
    expect(seasonPassScreen).toContain('Season Pass');
    expect(seasonPassScreen).toContain(
      'Tier {level} of {PASS_TIERS.length} · resets in {fmtCountdown(countdown)}',
    );
    expect(seasonPassScreen).toContain('Next · Tier {level + 1}');
    expect(seasonPassScreen).toContain('<Text style={styles.section}>Rewards</Text>');
    expect(seasonPassScreen).toContain('subtitle={`${modeLabel} Career · separate save progress`}');
    expect(seasonPassScreen).toContain("navigation.navigate('PremiumClubhouse')");
    expect(seasonPassScreen).toContain('monthlyRewardLine');
    expect(seasonPassScreen).toContain('passTiersForMode(save.mode)');
    expect(seasonPassScreen).toContain('showPassInfo');
    expect(seasonPassScreen).toContain('Auto-renews until canceled.');
    expect(seasonPassScreen).toContain('One subscription unlocks Premium across every save');
    expect(seasonPassScreen).toContain('League and club naming editor');
    expect(seasonPassScreen).toContain(
      "label={showFullTrack ? 'Show nearby tiers' : 'View all 20 tiers'}",
    );
    expect(seasonPassScreen).toContain('visibleTiers.map((tier, idx) =>');
    expect(seasonPassScreen).toContain('compactTrackStart + 3');
    expect(seasonPassScreen).not.toContain('label="League Editor"');
    expect(seasonPassScreen).not.toContain('label="Clubhouse"');
    expect(seasonPassScreen).toContain('Free');
    expect(seasonPassScreen).toContain('Prem');
    expect(seasonPassScreen).toContain('Claim ${claimable.length} reward');
    expect(seasonPassScreen).toContain('claimedFree');
    expect(seasonPassScreen).toContain('claimedPremium');
    expect(seasonPassScreen).toContain('rewardLocked');
    expect(seasonPassScreen).not.toContain('Claimed: {claimedFreeCount} free');
    expect(seasonPassScreen).not.toContain('Subscription access:');
    expect(seasonPassScreen).not.toContain('Matches and completed quests earn XP.');
    expect(seasonPassScreen).toContain('{pass.xp} / {nextTier.xpRequired} XP');
    expect(seasonPassScreen).not.toContain('tierStatusRow');
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
    expect(seasonPassScreen).not.toContain('Gems: ${r.previousGems');
    expect(seasonPassScreen).not.toContain('r.gems ?');
  });

  it('opens the full reward track from the hub Season Pass card', () => {
    expect(liveOpsCards).toContain('export function SeasonPassHomeCard()');
    expect(liveOpsCards).toContain('View full track');
    expect(liveOpsCards).toContain("navigation.navigate('SeasonPass')");
    expect(liveOpsCards).toContain('Tier {level}/{PASS_TIER_COUNT} reached');
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
