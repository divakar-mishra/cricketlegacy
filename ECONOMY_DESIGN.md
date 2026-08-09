# Economy Design

Status: **NO-GO** for a fully localized multi-currency release.

## Current Model

- Account coins, gems and save-compatible `energy` live in `wallet`.
- Manager club balance and transfer budget remain operational numeric values on
  the team and manager-finance state.
- `StoredMoney` and `CanonicalClubFinance` live in `src/domain/types.ts`.
  Schema 14 initializes their persisted compatibility mirror with an ISO 4217
  currency code.
- Current gameplay still spends the numeric manager-finance fields, so the
  canonical money mirror is not yet the sole source of truth.

## Rules

- Account coins and gems never display fiat symbols.
- Store prices come from RevenueCat/Google Play metadata in release builds.
- Club finance currency follows the club or competition, not the app-store
  country.
- Historical contracts and finance transactions must retain their original
  currency.
- Cross-currency transfers require a versioned in-game exchange-rate table.

## Remaining Blockers

- Replace operational numeric club finance, wages and contracts with
  `StoredMoney` end to end.
- Select currency from the active club/country instead of the current
  compatibility default.
- Migrate historical finance and contract records without inventing precision.
- Keep auction, transfer, wage and facility calculations in one currency-aware
  service.

The complete current economy and all live prices are documented in
`docs/APP_COMPLETE_REFERENCE.md`.
