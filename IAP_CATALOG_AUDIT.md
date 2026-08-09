# IAP Catalog Audit

The authoritative runtime catalog is `src/services/purchases.ts`; the
human-readable product table is Section 13 of
`docs/APP_COMPLETE_REFERENCE.md`.

## Current Audit Rules

- Only products present in the runtime catalog may be configured in RevenueCat
  or surfaced by the Store.
- Product grants must exist in `GRANTS` or in the explicitly handled
  mode-specific fulfillment branch.
- Player and Manager products must pass both UI filtering and state-level mode
  guards.
- Durable entitlements may restore; coins, gems, energy and action tokens may
  not be re-granted by restore.
- Fulfillment requires a purchased, verified transaction and an unused
  purchase token.
- Release builds show `Connect to view price` when provider metadata is
  unavailable instead of presenting a fallback as a live charge.
- Store copy must match the actual grant and must not promise named commentary,
  early access, guaranteed wins, selection, trophies or Hall of Fame status.

## Release Evidence Still Required

1. Export active Android products from Play Console.
2. Export RevenueCat offerings and entitlement mappings.
3. Compare IDs, product types, prices and restore behavior.
4. Complete successful, pending, cancelled, refunded and restored sandbox
   purchase flows on a physical Android device.
