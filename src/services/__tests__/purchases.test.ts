jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
const {
  getProducts,
  purchase,
  GRANTS,
  groupProductIdsByCategory,
  isProductAvailable,
  isRestorableProduct,
  isSaveSponsorCheckoutReady,
  isSaveSponsorProduct,
  MAX_TRAINING_ACCELERATOR_CHARGES,
  MODE_STORE_PRODUCT_IDS,
  PRICE_UNAVAILABLE,
  providerTransactionIdentifier,
  restorableProductIdsFromCustomerInfo,
  STARTER_PACK_OFFER_HOURS,
  storeProductCategory,
} = jest.requireActual<typeof import('../purchases')>('../purchases');

describe('purchase catalog', () => {
  it('matches the approved coin, Player Legend and facility-token offers', async () => {
    const products = await getProducts();

    expect(products.find((product) => product.id === 'coins_medium')).toMatchObject({
      description: '10,000 coins',
      priceString: '₹299',
    });
    expect(products.find((product) => product.id === 'coins_large')).toMatchObject({
      description: '20,000 coins',
      priceString: '₹499',
    });
    expect(products.find((product) => product.id === 'bundle_legend')).toMatchObject({
      description: '40,000 coins · 1,200 gems · No ads · 60 Focus capacity · Cosmetics',
      priceString: '₹899',
    });
    expect(products.find((product) => product.id === 'facility_upgrade_token')).toMatchObject({
      priceString: '₹99',
    });
    expect(products.find((product) => product.id === 'energy_refill')).toBeUndefined();
    expect(GRANTS.coins_medium).toEqual({ coins: 10_000 });
    expect(GRANTS.coins_large).toEqual({ coins: 20_000 });
    expect(GRANTS.bundle_legend).toEqual({
      coins: 40_000,
      gems: 1_200,
      entitlement: { removeAds: true },
    });
    expect(GRANTS.energy_refill).toBeUndefined();
  });

  it('keeps the starter pack on the 24-hour launch window', async () => {
    expect(STARTER_PACK_OFFER_HOURS).toBe(24);
    const starterPack = (await getProducts()).find(
      (product: { id: string }) => product.id === 'starter_pack',
    );
    expect(starterPack?.offerHours).toBe(24);
  });

  it('accepts only the provider store transaction identifier for fulfillment', () => {
    expect(
      providerTransactionIdentifier({ transaction: { transactionIdentifier: '  google-tx-42  ' } }),
    ).toBe('google-tx-42');
    expect(
      providerTransactionIdentifier({
        productIdentifier: 'coins_medium',
        customerInfo: { originalAppUserId: 'shared-user-id' },
      }),
    ).toBeNull();
    expect(
      providerTransactionIdentifier({ transaction: { transactionIdentifier: '   ' } }),
    ).toBeNull();
  });

  it('marks missing Google Play pricing unavailable and caps accelerator stock', () => {
    expect(isProductAvailable({ priceString: PRICE_UNAVAILABLE })).toBe(false);
    expect(isProductAvailable({ priceString: '₹199' })).toBe(true);
    expect(MAX_TRAINING_ACCELERATOR_CHARGES).toBe(6);
  });

  it('separates subscriptions from one-time products for RevenueCat queries', () => {
    expect(
      groupProductIdsByCategory([
        'coins_medium',
        'season_pass',
        'manager_legend_pack',
        'remove_ads',
      ]),
    ).toEqual({
      subscriptionIds: ['season_pass'],
      oneTimeIds: ['coins_medium', 'manager_legend_pack', 'remove_ads'],
    });
  });

  it('postpones sponsor sales while preserving their save-bound classification', async () => {
    expect(MODE_STORE_PRODUCT_IDS.career).not.toContain('player_save_sponsor');
    expect(MODE_STORE_PRODUCT_IDS.career).not.toContain('manager_save_sponsor');
    expect(MODE_STORE_PRODUCT_IDS.manager).not.toContain('manager_save_sponsor');
    expect(MODE_STORE_PRODUCT_IDS.manager).not.toContain('player_save_sponsor');
    expect(isSaveSponsorProduct('player_save_sponsor')).toBe(true);
    expect(isSaveSponsorProduct('manager_save_sponsor')).toBe(true);
    expect(isSaveSponsorProduct('remove_ads')).toBe(false);
    expect(isSaveSponsorCheckoutReady()).toBe(true);

    const products = await getProducts();
    for (const id of ['player_save_sponsor', 'manager_save_sponsor']) {
      expect(products.find((product) => product.id === id)).toBeUndefined();
      expect(storeProductCategory(id)).toBe('NON_SUBSCRIPTION');
    }
  });

  it('lists 14 products with Focus recovery included in Mental Coaching', async () => {
    const products = await getProducts();
    expect(products.map((product) => product.id).sort()).toEqual([
      'player_vip', 'manager_vip', 'bundle_legend', 'manager_legend_pack',
      'starter_pack', 'coins_medium', 'coins_large', 'gems_medium', 'gems_large',
      'form_recovery', 'transfer_budget_sm', 'scout_full_reveal',
      'facility_upgrade_token', 'recovery_pack',
    ].sort());
    expect(await purchase('energy_refill')).toMatchObject({ ok: false });
    for (const [id, priceString] of [
      ['form_recovery', '₹99'], ['transfer_budget_sm', '₹99'],
      ['scout_full_reveal', '₹49'], ['facility_upgrade_token', '₹99'],
      ['recovery_pack', '₹99'],
    ]) {
      expect(products.find((product) => product.id === id)).toMatchObject({ priceString, kind: 'consumable' });
    }
    for (const id of ['training_accelerator', 'contract_boost', 'player_save_sponsor', 'manager_save_sponsor']) {
      expect(await purchase(id)).toMatchObject({ ok: false, productId: id });
      expect(GRANTS[id]).toBeDefined();
    }
  });

  it('restores only durable entitlements and never consumed or save-bound products', () => {
    expect(isRestorableProduct('remove_ads')).toBe(true);
    expect(isRestorableProduct('bundle_legend')).toBe(true);
    expect(isRestorableProduct('manager_legend_pack')).toBe(true);
    expect(isRestorableProduct('season_pass')).toBe(true);
    for (const productId of [
      'coins_medium',
      'gems_large',
      'starter_pack',
      'facility_upgrade_token',
      'player_save_sponsor',
      'manager_save_sponsor',
    ]) {
      expect(isRestorableProduct(productId)).toBe(false);
    }

    expect(
      restorableProductIdsFromCustomerInfo({
        entitlements: {
          active: {
            remove_ads: { isActive: true },
            season_pass: { isActive: true },
            coins_medium: { isActive: true },
            player_save_sponsor: { isActive: true },
            manager_save_sponsor: { isActive: true },
            bundle_legend: { isActive: false },
          },
        },
      }),
    ).toEqual(['remove_ads', 'season_pass']);
  });
});
