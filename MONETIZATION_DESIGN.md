# Monetization Design

Status: **NO-GO** until billing verification, product metadata, multi-currency finances, and running-app sandbox flows pass.

## Resource Separation

- Account coins: account-level soft currency for player/career boosts and ordinary rewards.
- Gems: premium account currency for paid actions such as scout intelligence and recovery.
- Training Energy/Focus: optional development/preparation capacity; scheduled matches should not depend on it.
- Club balance and transfer budget: manager-career club finance, never account coins.
- Wage budget: manager-career salary capacity, never gems or account coins.
- Player condition: fitness/form/confidence/injury; fitness recovery does not heal injuries.
- Manager reputation: career progression/status, not spendable currency.

## Product Principles

- Gems never buy an auction player by themselves.
- Instant Buyout, when implemented, must use gems only as a facilitation fee and still require club acquisition price, wage capacity, eligibility, and squad rules.
- `recovery_pack` grants a token; it does not auto-apply.
- Full Fitness Recovery is a gem action, not a real-money product.
- `scout_full_reveal` grants one token/report for one player.
- Mixed bundles split consumable grants from permanent entitlements in the ledger.

## Current NO-GO Items

- Real-money prices still require live ProductDetails/RevenueCat metadata in production.
- Store UI organization is not complete.
- `legend_status` still touches `legendGranted`, which is not purely cosmetic.
- Contract boost, facility token, and training accelerator spend paths need deeper audits.
- Multi-currency finance model is not implemented.

