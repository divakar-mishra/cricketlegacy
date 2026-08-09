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

describe('Android purchase screen copy', () => {
  it('uses Google Play wording and does not expose App Store or restore copy', () => {
    expect(purchaseScreen).not.toContain('App Store');
    expect(purchaseScreen).not.toContain('Restore Purchases');
    expect(purchaseScreen).toContain('Purchases secured by Google Play');
    expect(purchaseScreen).toContain('Google Play pricing is unavailable');
    expect(purchaseScreen).toContain('disabled={!available || owned');
  });

  it('disables free-energy rewarded ads when no provider is ready', () => {
    expect(purchaseScreen).toContain(
      "const rewardedEnergyAvailable = ads.isAdsReady() || ads.isReady('rewarded');",
    );
    expect(purchaseScreen).toContain(
      "label={rewardedEnergyAvailable ? 'Watch ad' : 'Rewarded ads unavailable'}",
    );
    expect(purchaseScreen).toContain(
      'disabled={!rewardedEnergyAvailable || (busy != null && busy !==',
    );
  });

  it('keeps player and manager Legend IAP privileges separate', () => {
    expect(purchaseScreen).toContain("'manager_legend_pack'");
    expect(purchaseScreen).toContain("'bundle_legend'");
    expect(purchaseScreen).toContain('MANAGER LEGACY EDITION');
    expect(purchaseScreen).toContain('PLAYER LEGEND EDITION');
    expect(purchaseScreen).toContain('Applies only to this');
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
    expect(purchases).toContain("'training_accelerator', 'contract_boost', 'form_recovery'");
    expect(purchases).toContain("'scout_full_reveal'");
    expect(purchases).toContain("'facility_upgrade_token'");
    expect(purchases).toContain("'recovery_pack'");
    expect(purchases).toContain("'transfer_budget_sm'");
    expect(purchases).toContain("export const SHARED_STORE_PRODUCT_IDS = ['remove_ads']");
    expect(purchaseScreen).toContain('Player Career Tools');
    expect(purchaseScreen).toContain('Manager Career Tools');
    expect(purchaseScreen).toContain('Account Upgrade');
    expect(purchaseScreen).not.toContain('Daily Deals');
  });

  it('explains immediate product value and gives tools distinct visual identities', () => {
    expect(purchaseScreen).toContain('3 sessions at 3x gains');
    expect(purchaseScreen).toContain('nextContractOffer.wage * 1.25');
    expect(purchaseScreen).toContain('exact OVR, condition and valuation');
    expect(purchaseScreen).not.toContain('exact OVR, potential');
    expect(purchaseScreen).toContain('saves at least');
    expect(purchaseScreen).toContain('+20 condition, +20 fitness and +15 morale');
    expect(purchaseScreen).not.toContain("Commentary callouts with your player's name");
    expect(purchaseScreen).not.toContain('Early access to seasonal events');
    expect(purchaseScreen).toContain('Dual Mode Value');
    expect(purchaseScreen).toContain('PRODUCT_ICON_NAME');
    expect(purchaseScreen).toContain("contract_boost: 'document-text'");
    expect(purchaseScreen).toContain("facility_upgrade_token: 'business'");
    expect(purchaseScreen).toContain("recovery_pack: 'fitness'");
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
