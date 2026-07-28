# Premium Transaction Design

Status: **NO-GO** for release. The client now has a canonical ledger shape and local duplicate guards, but production still needs authoritative store verification and server-side wallet/entitlement persistence.

## Current Source

- Billing facade: `src/services/purchases.ts`
- Ledger shape/helpers: `src/services/purchaseLedger.ts`
- Grant processor: `src/state/careerStore.ts::purchaseProduct`
- Premium gem actions: `applySquadRecovery`, `useFullScoutReveal`

## Ledger Fields

The client ledger entry contains `purchaseToken`, `storeTransactionId`, `productId`, `userId`, `purchaseState`, `verificationState`, `grantState`, `grantVersion`, `grantedContents`, `consumedAt`, `acknowledgedAt`, `restoredAt`, `refundedAt`, `revokedAt`, `promotionId`, `promotionApplied`, `createdAt`, and `updatedAt`.

## Invariants Implemented Client-Side

- A purchase must be `PURCHASED` before grant.
- A purchase must be `VERIFIED` or `LOCAL_MOCK` before grant.
- Reprocessing the same purchase token returns without regranting.
- First gem-pack bonus is guarded by `promo:first_gem_pack_bonus`.
- Recovery and scout gem/token actions use separate `premiumTx:*` transaction ids.
- Rewarded ads keep existing `rewardTx:*` guards.

## Production Blockers

- No authoritative Google Play receipt verification endpoint exists in this repo.
- No RevenueCat webhook or backend entitlement reconciliation is wired.
- Local save flags are not enough for multi-device or reinstall-safe purchase authority.
- Refund/revocation handling is documented but not executable without backend events.
- Mixed-bundle restore must restore permanent entitlements without regranting consumables.

## Required Backend Contract

Create an endpoint or webhook-backed service that accepts a store token, verifies it with Google Play/RevenueCat, records the ledger server-side, returns grant decisions, and emits revocation/refund updates. The client should then call this processor before mutating coins, gems, inventory, club funds, or entitlements.

