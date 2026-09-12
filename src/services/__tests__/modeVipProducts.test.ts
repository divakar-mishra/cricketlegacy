jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
(global as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
const api = jest.requireActual<typeof import('../purchases')>('../purchases');

describe('mode VIP products', () => {
  it('prices Manager Legacy at ₹899 once, keeping standalone VIP at ₹449', async () => {
    const products = await api.getProducts();
    expect(products.find(p => p.id === 'manager_legend_pack')).toMatchObject({
      priceString: '₹899', kind: 'entitlement',
    });
    expect(products.find(p => p.id === 'manager_vip')?.priceString).toBe('₹449');
  });
  it('preserves the approved one-time Legend value', async () => {
    const products = await api.getProducts();
    expect(products.find(p => p.id === 'bundle_legend')).toMatchObject({
      priceString: '₹899', badge: 'One-time bundle', kind: 'entitlement',
    });
    expect(api.GRANTS.bundle_legend).toMatchObject({ coins: 40_000, gems: 1_200 });
    expect(api.GRANTS.gems_large).toMatchObject({ gems: 1_200 });
    expect(products.find(p => p.id === 'gems_large')?.priceString).toBe('₹999');
    expect(products.find(p => p.id === 'coins_large')?.priceString).toBe('₹499');
  });
  it('offers two ₹449 non-subscriptions and retires shared checkout', async () => {
    const products = await api.getProducts();
    for (const id of ['player_vip', 'manager_vip']) {
      expect(products.find((item) => item.id === id)).toMatchObject({
        priceString: '₹449',
        kind: 'entitlement',
      });
      expect(api.storeProductCategory(id)).toBe('NON_SUBSCRIPTION');
      expect(api.isRestorableProduct(id)).toBe(true);
      expect(api.GRANTS[id].coins).toBeUndefined();
    }
    for (const id of ['remove_ads', 'season_pass']) {
      expect(products.some((item) => item.id === id)).toBe(false);
      expect(await api.purchase(id)).toMatchObject({ ok: false, error: 'retired_product' });
      expect(api.isRestorableProduct(id)).toBe(true);
    }
  });
  it('restores exactly the active mode entitlement IDs, not a shared VIP substitute', () => {
    expect(
      api.restorableProductIdsFromCustomerInfo({
        entitlements: {
          active: {
            player_vip: { isActive: true },
            manager_vip: { isActive: false },
            coins_large: { isActive: true },
          },
        },
      }),
    ).toEqual(['player_vip']);
  });
});
