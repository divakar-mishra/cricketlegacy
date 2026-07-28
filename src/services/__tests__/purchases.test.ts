jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
const {
  getStarterPack,
  groupProductIdsByCategory,
  isProductAvailable,
  MAX_TRAINING_ACCELERATOR_CHARGES,
  PRICE_UNAVAILABLE,
  providerTransactionIdentifier,
  STARTER_PACK_OFFER_HOURS,
} = jest.requireActual<typeof import('../purchases')>('../purchases');

describe('purchase catalog', () => {
  it('keeps the starter pack on the 24-hour launch window', () => {
    expect(STARTER_PACK_OFFER_HOURS).toBe(24);
    expect(getStarterPack().offerHours).toBe(24);
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
});
