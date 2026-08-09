# Monetization Design

Status: **NO-GO** until live billing metadata, purchase restoration UI,
multi-currency club finance and sandbox purchase flows are verified.

## Resource Separation

- Account coins: soft currency for services, cosmetics and progression sinks.
- Gems: premium currency for connected gem actions.
- Training Focus: save-compatible `wallet.energy`; used by match/training flow.
- Club balance and transfer budget: Manager Career finance, never account
  coins or gems.
- Player condition, form, confidence and injuries: gameplay state, not money.
- Manager reputation: career status, not a spendable resource.

## Product Rules

- Player and Manager premium editions are mode-guarded.
- VIP and Season Pass are shared account-value products.
- Squad Conditioning grants a stored token and never heals injuries.
- Full Fitness Recovery is a gem action, not a real-money product.
- Full Scout Intelligence grants one exact-report token.
- Consumables are not replayed during entitlement restoration.
- Pending, cancelled, refunded, revoked or duplicate transactions are not
  fulfilled.
- Release UI must use verified localized store prices.

The authoritative product list, grants, prices and mode visibility are in
Section 13 of `docs/APP_COMPLETE_REFERENCE.md`.
