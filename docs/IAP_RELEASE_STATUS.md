# IAP follow-up — 9 September 2026

This is a local implementation/status record, not evidence of live store readiness.

## Implemented

- September 11 final coaching revision: `form_recovery` is ₹99, raising form
  and confidence to at least 99 and topping up Focus to 36 (60 with VIP) in
  the purchased Player save. Values already above the targets never decrease.
  Checkout is rejected only when all three benefits are already satisfied.
  The unlaunched `energy_refill` was merged into this product and is no longer
  sold; the launch catalogue remains 14 products. Focus popups open coaching.
- Action-triggered dismissible offers now link to a highlighted store item
  for Player Focus, training coins, Manager transfer fee shortages and squad
  conditioning. Facility budget failure links to the facility token instead
  of club cash. Offers do not automatically buy or retry gameplay actions.
  Transfer suggestions exclude gaps above $1M, used seasonal boosts, national
  duty and wage-ceiling blockers. Waiting/earning/rest alternatives remain.

- September 11 launch catalogue: 14 products (the existing nine plus the five
  utilities below). Training Accelerator, Contract Negotiation Boost and both
  premium save sponsors are hidden and blocked from new client checkout.
  Existing ownership, inventory use and reward fulfilment remain intact.

| Utility product ID | India price | Benefit in purchased save |
| --- | --- | --- |
| `form_recovery` | ₹99 | Form and confidence at least 99; full Focus (36 / VIP 60) |
| `transfer_budget_sm` | ₹99 | $1,000,000 fictional club funds; once per season, no national duty |
| `scout_full_reveal` | ₹49 | One full scout token |
| `facility_upgrade_token` | ₹99 | One facility-level token; normal upkeep applies |
| `recovery_pack` | ₹99 | One squad-conditioning token |

These five use consumable purchase handling. Live Google Play prices and
descriptions still require manual setup; local reference prices do not change
store charges. Sponsor integration work below is postponed, not a launch SKU.

- September 9 India-only price revision: both standalone VIPs are ₹449;
  Player Legend and Manager Legacy are ₹899. Benefits and international
  prices remain unchanged. Local reference prices are updated; the owner
  must edit India only in Google Play, without regenerating other regions.

- Approved Manager Legacy investment: $1,000,000 fictional Club Balance once
  on purchase, synchronized with transfer budget. No restore/retirement grant.
  Other benefits remain unchanged; a second facility token and new stadium
  styling remain proposals, not advertised shipped benefits.

- Manager Legacy (`manager_legend_pack`, approved ₹899 reference price) includes
  Manager VIP on purchase, verified restore, and permanent ownership refresh.
  Restore does not deliver scout/facility/conditioning tokens again. VIP can be
  restored during national duty without applying domestic board backing there.
- Manager VIP grants remaining Manager collection cosmetics at the existing
  retirement boundary (age 60), on loading a retired career, and on late VIP
  purchase/restore. It grants neither Player cosmetics nor currency.

## Approved bundle value

Player Legend retains 1,200 Gems at ₹899, plus 40,000 Coins, VIP and cosmetics.
The owner approved retaining the one-time bundle advantage rather than reducing
Gems to 600. The shop labels it as a one-time bundle, not a subscription.
Chest of Gems retains 1,200 Gems and the existing first-pack bonus.
Retirement unlocks collection cosmetics only, not Coins, Gems or cash rewards.

## Production access / release evidence still required

No RevenueCat or Supabase admin tool connection or installed Supabase CLI was
available in this session. No store products, secrets, SQL or production
checkout settings have been changed or independently verified remotely.

1. In the existing Google Play application, configure `player_vip` and
   `manager_vip` as non-consumable one-time products (₹449 India). Country
   overrides require the owner's approved prices, not guessed conversions.
2. Confirm both products are available through RevenueCat with their matching
   entitlement IDs. Preserve `bundle_legend`, `manager_legend_pack`, and legacy
   ownership mappings. The app derives mode VIP from the matching bundle;
   revocation must remain distinguishable from independently purchased VIP.
3. Review applied Supabase migration history before deploying
   `202609080002_vip_collections.sql`. Do not blindly push every pending
   migration: this worktree also includes unrelated integrity/backend changes.
   Test two accounts and both modes for isolation and account deletion cascade.
4. Complete sponsor client checkout/reconciliation, launch/status revocation,
   automatic backups and exact-save recovery UI as specified in
   `PREMIUM_SAVE_SPONSOR_CHECKOUT.md`. These remain unfinished; the presence of
   backend source is not sufficient to enable purchases.
5. Deploy/review sponsor migrations and functions, configure server-only keys,
   allowlisted RevenueCat product/app IDs and authenticated webhooks; obtain
   KYC/payment-profile readiness confirmation. Begin with SANDBOX only.
6. Use a Play-installed test build to exercise purchase, cancellation, pending
   payment, refund, restore, sign-out/account switch, offline use, two devices,
   duplicate fulfilment, exact-save recovery and intentional save deletion.

Keep both sponsor production gates closed until the complete client/server
path and sandbox evidence above pass. Never place admin or provider secrets
in chat, Expo public configuration or the APK.
