# Play Console Product Checklist

Status: **NO-GO** until the Play Console and RevenueCat exports are compared
against the active catalog in `src/services/purchases.ts`.

For every active product:

1. Product ID exactly matches the source catalog.
2. Product type matches its restore policy: durable entitlement or consumable.
3. Localized title and description promise only the implemented grant.
4. The app displays provider-supplied localized pricing in release builds.
5. Player-only and Manager-only products remain in their correct mode.
6. Budget copy does not imply that an account coin balance is club money.
7. Conditioning copy states that injuries are not healed.
8. VIP copy states permanent ads-off, 60-energy cap and +20% match coins.

The complete active catalog is documented in Section 13 of
`docs/APP_COMPLETE_REFERENCE.md`. Retired hidden products must not be recreated
in Play Console or RevenueCat.
