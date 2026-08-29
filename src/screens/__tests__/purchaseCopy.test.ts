import fs from 'fs';
import path from 'path';

const purchaseScreen = fs.readFileSync(path.join(__dirname, '..', 'PurchaseScreen.tsx'), 'utf8');
const careerStore = fs.readFileSync(
  path.join(__dirname, '..', '..', 'state', 'careerStore.ts'),
  'utf8',
);
const purchases = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'purchases.ts'),
  'utf8',
);
const premiumClubhouse = fs.readFileSync(
  path.join(__dirname, '..', 'PremiumClubhouseScreen.tsx'),
  'utf8',
);
const seasonPass = fs.readFileSync(path.join(__dirname, '..', 'SeasonPassScreen.tsx'), 'utf8');
const contextualOffer = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ContextualOffer.tsx'),
  'utf8',
);
const starterPackModal = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'StarterPackModal.tsx'),
  'utf8',
);
const walletBar = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'WalletBar.tsx'),
  'utf8',
);

describe('purchase screen copy', () => {
  it('uses the active platform store and exposes a guarded restore action', () => {
    expect(purchaseScreen).toContain("Platform.OS === 'ios' ? 'App Store' : 'Google Play'");
    expect(purchaseScreen).toContain('Purchases handled by {storeName}');
    expect(purchaseScreen).toContain('Restore Purchases');
    expect(purchaseScreen).toContain('Checkout coming soon');
    expect(purchaseScreen).not.toContain('checkout is not connected yet');
    expect(purchaseScreen).not.toContain('Google Play pricing is unavailable');
    expect(purchaseScreen).toContain('disabled={!available || owned');
    expect(purchaseScreen).toContain('disabled={!save || busy != null}');
    expect(purchaseScreen).toContain('Restores permanent upgrades and active passes.');
    expect(purchaseScreen).toContain('Open a career to restore purchases.');
  });

  it('stacks store actions before Pixel-class cards can crush their copy', () => {
    expect(purchaseScreen).toContain('const compact = useIsCompact(560);');
    expect(purchaseScreen).toContain('fullWidth={compact}');
    expect(purchaseScreen).toContain('itemButtonCompact');
    expect(purchaseScreen).toContain("unavailableLabel = storeSetupPending ? 'Coming soon'");
  });

  it('disables free-energy rewarded ads when no provider is ready', () => {
    expect(purchaseScreen).toContain(
      "const rewardedEnergyAvailable = ads.isAdsReady() || ads.isReady('rewarded');",
    );
    expect(purchaseScreen).toContain(
      "label={rewardedEnergyAvailable ? 'Watch ad' : 'Ad unavailable'}",
    );
    expect(purchaseScreen).toContain('!rewardedEnergyAvailable ||');
    expect(purchaseScreen).toContain('style={styles.energyAlertActions}');
    expect(purchaseScreen).toContain('style={styles.energyAlertAction}');
    expect(purchaseScreen).toContain('label={`Refill · ${ENERGY_REFILL_GEMS} gems`}');
    expect(purchaseScreen).toContain('const result = refillEnergy()');
    expect(purchaseScreen).not.toContain("products.find((p) => p.id === 'energy_refill')");
  });

  it('keeps Player energy controls out of the Manager Store', () => {
    expect(purchaseScreen).toContain(
      "<WalletBar wallet={save.wallet} showEnergy={save.mode !== 'manager'} />",
    );
    expect(purchaseScreen).toContain("save?.mode !== 'manager' && energyLow");
    expect(walletBar).toContain('showEnergy = true');
    expect(walletBar).toContain('{showEnergy ? (');
    expect(purchaseScreen).toContain('Manager Career Tools');
    expect(purchaseScreen).toContain('modeProducts.map((product, index) =>');
  });

  it('offers the approved one-way gem exchange only in Player Career', () => {
    expect(purchaseScreen).toContain("save?.mode === 'career'");
    expect(purchaseScreen).toContain('Gem Exchange');
    expect(purchaseScreen).toContain('PLAYER_GEM_CONVERSION_PRESETS.map');
    expect(purchaseScreen).toContain('1 gem = {PLAYER_GEM_TO_COIN_RATE} coins');
    expect(purchaseScreen).toContain('This cannot be reversed.');
    expect(purchaseScreen).toContain('convertPlayerGems(gems)');
  });

  it('keeps player and manager Legend IAP privileges separate', () => {
    expect(purchaseScreen).toContain("'manager_legend_pack'");
    expect(purchaseScreen).toContain("'bundle_legend'");
    expect(purchaseScreen).toContain('MANAGER LEGACY EDITION');
    expect(purchaseScreen).toContain('PLAYER LEGEND EDITION');
    expect(purchaseScreen).not.toContain('Player and Manager stories');
    expect(purchaseScreen).not.toContain('Manager board backing and reputation lift');
    expect(careerStore).toContain('function applyManagerLegendBacking');
    expect(careerStore).toContain("productId === 'manager_legend_pack'");
    expect(careerStore).toContain('manager_save_required');
    expect(careerStore).toContain('player_career_required');
    expect(careerStore).toContain('manager_legend_backing');
    const bundleBranch = careerStore.slice(
      careerStore.indexOf("if (productId === 'bundle_legend')"),
      careerStore.indexOf("if (productId === 'transfer_budget_sm'"),
    );
    expect(bundleBranch).not.toContain('applyManagerLegendBacking(save)');
    expect(careerStore).toContain("'bundle_legend',");
  });

  it('shows stable, useful tool sections for the active career mode', () => {
    expect(purchases).toContain('export const MODE_STORE_PRODUCT_IDS');
    expect(purchases).toContain("'training_accelerator'");
    expect(purchases).toContain("'contract_boost'");
    expect(purchases).toContain("'form_recovery'");
    expect(purchases).toContain("'scout_full_reveal'");
    expect(purchases).toContain("'facility_upgrade_token'");
    expect(purchases).toContain("'recovery_pack'");
    expect(purchases).toContain("'transfer_budget_sm'");
    expect(purchases).toContain("export const SHARED_STORE_PRODUCT_IDS = ['remove_ads']");
    expect(purchaseScreen).toContain('Player Career Tools');
    expect(purchaseScreen).toContain('Manager Career Tools');
    expect(purchaseScreen).toContain('Account Upgrade');
    expect(purchaseScreen).not.toContain('Daily Deals');
    expect(purchaseScreen).toContain('{modeProducts.length > 0 && (');
    expect(purchaseScreen).toContain('{sharedProducts.length > 0 && (');
  });

  it('keeps product cards compact and previews the catalogue before checkout is connected', () => {
    expect(purchaseScreen).toContain('style={styles.itemDesc} numberOfLines={1}');
    expect(purchaseScreen).toContain('style={styles.itemValue} numberOfLines={1}');
    expect(purchaseScreen).toContain('{coinProducts.length > 0 && (');
    expect(purchaseScreen).toContain("{(gemProducts.length > 0 || save?.mode === 'career') && (");
    expect(purchaseScreen).toContain('checkout will activate after product setup is finished.');
  });

  it('gates the exact-save sponsor checkout and shows the irreversible binding warning', () => {
    expect(purchases).toContain("id: 'player_save_sponsor'");
    expect(purchases).toContain("id: 'manager_save_sponsor'");
    expect(purchases).toContain("priceString: '₹499'");
    expect(purchases).toContain('return MOCK_MODE;');
    expect(purchaseScreen).toContain('premiumSponsorStoreUnlocked(save)');
    expect(purchaseScreen).toContain(
      'Secure save binding is not ready. Checkout remains disabled.',
    );
    expect(purchaseScreen).toContain('Bind sponsor to this save?');
    expect(purchaseScreen).toContain('It cannot move to another save or mode');
    expect(purchaseScreen).toContain(
      'Choosing Delete Save permanently destroys its server backup and sponsor binding',
    );
    expect(purchaseScreen).toContain('Current rate:');
    expect(purchases).toContain('Legacy Crown — Player Sponsor');
    expect(purchases).toContain('Legacy Crown — Manager Sponsor');
    expect(purchaseScreen).toContain('Legacy Crown permanent sponsor');
  });

  it('explains immediate product value and gives tools distinct visual identities', () => {
    expect(purchases).toContain('1.5× gains · Next 3 sessions');
    expect(purchaseScreen).toContain('${acceleratorCharges}/6 charges stored');
    expect(purchaseScreen).toContain('nextContractOffer.wage * 1.25');
    expect(purchases).toContain('Reveal OVR, form, fitness, injury and value');
    expect(purchaseScreen).not.toContain('exact OVR, potential');
    expect(purchaseScreen).toContain('saves at least');
    expect(purchases).toContain('+20 condition, +20 fitness and +15 morale');
    expect(purchaseScreen).not.toContain("Commentary callouts with your player's name");
    expect(purchaseScreen).not.toContain('Early access to seasonal events');
    expect(purchaseScreen).toContain("save?.mode === 'manager' ? 'Manager' : 'Player'");
    expect(purchaseScreen).toContain('PRODUCT_ICON_NAME');
    expect(purchaseScreen).toContain("contract_boost: 'document-text'");
    expect(purchaseScreen).toContain("facility_upgrade_token: 'business'");
    expect(purchaseScreen).toContain("recovery_pack: 'fitness'");
  });

  it('keeps purchase effects and limits in compact, non-duplicated copy', () => {
    expect(purchases).toContain('coins_medium: { coins: 10_000 }');
    expect(purchases).toContain('coins_large: { coins: 20_000 }');
    expect(purchases).toContain(
      'bundle_legend: { coins: 40_000, gems: 1_200, entitlement: { removeAds: true } }',
    );
    expect(purchases).not.toContain("id: 'energy_refill'");
    expect(purchaseScreen).toContain('40,000 Wallet Coins and 1,200 Gems');
    expect(purchases).toContain('No ads · 60 energy · +20% match coins');
    expect(purchases).toContain('+₹500,000 transfer budget · Once per season');
    expect(purchases).toContain('+25% next renewal wage and signing bonus');
    expect(purchases).toContain('No injury healing.');
    expect(purchases).toContain('1.5× gains · Next 3 sessions');
    expect(purchases).toContain('Permanent backing · Boardroom · Toolkit');
    expect(purchaseScreen).toContain('club reputation +3');
    expect(purchaseScreen).toContain('hideUnavailableReason={false}');
    expect(purchaseScreen).not.toContain('Google Play setup pending.');
    expect(purchaseScreen).not.toContain(
      'Google Play purchases coming soon. Checkout will be enabled after the Google Play store setup is complete.',
    );
    expect(premiumClubhouse).not.toContain('Pass bonuses:');
    expect(premiumClubhouse).not.toContain('Eligibility, budgets and squad rules still apply.');
    expect(seasonPass).toContain('Premium rewards for tiers earned in this save');
    expect(seasonPass).toContain('Auto-renews until canceled.');
    expect(contextualOffer).toContain("'Permanent ad removal'");
    expect(contextualOffer).toContain("'60-energy cap'");
    expect(contextualOffer).toContain("'+20% match coins'");
    expect(contextualOffer).toContain("ctaLabel: 'View VIP'");
    expect(contextualOffer).not.toContain('₹299');
    expect(starterPackModal).toContain('ONE PER ACCOUNT');
    expect(starterPackModal).toContain('Ad-free for 7 days');
  });

  it('describes the Season Pass as account-wide access with per-save progression', () => {
    expect(purchaseScreen).toContain('Thirty days of Premium access across every save');
    expect(purchaseScreen).toContain(
      'Every Player and Manager save keeps separate XP and reward claims',
    );
    expect(purchaseScreen).toContain('League and club naming editor while Premium is active');
  });

  it('hides or disables purchases that would provide no benefit', () => {
    expect(purchaseScreen).toContain("product.id !== 'form_recovery' || needsFormRecovery");
    expect(purchaseScreen).toContain('Your next-contract boost is already stored.');
    expect(purchaseScreen).toContain(
      'Every remaining facility upgrade already has a stored token.',
    );
    expect(purchaseScreen).toContain('This season’s transfer-budget boost is already used.');
    expect(careerStore).toContain("error: 'no_recovery_needed'");
    expect(careerStore).toContain("error: 'facilities_maxed'");
    expect(careerStore).toContain("error: 'contract_boost_already_stored'");
  });
});
