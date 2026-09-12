# Mode VIP and permanent collections — approved 8 September 2026

This replaces the proposed shared VIP / monthly Season Pass for new purchases.

## Products and scope

| Product ID | Launch reference price | Access |
| --- | --- | --- |
| `player_vip` | ₹449 once | Player saves only |
| `manager_vip` | ₹449 once | Manager saves only |

Both are restorable non-consumables. Production display/checkout prices come from store metadata, not these reference prices. Buying one does not grant the other. Player Legend includes Player VIP. Following the September 9 approval, Manager Legacy includes Manager VIP at the approved ₹899 reference price, including on verified restore of existing ownership. Bundle currency/toolkit consumables are never replayed on restore.

Each preserves the existing VIP benefits: ad removal, 60 Focus capacity and +20% Wallet Coin match rewards. The matching mode also gets the extra save slot, naming editor, existing pass story/challenge content and existing mode-appropriate pass gameplay benefits. There is no new paid XP track. Free XP rewards remain; the existing free calendar cycle and daily/weekly quests are unchanged.

## Collections

Manager Legacy also delivers $1,000,000 fictional Club Balance once to the
purchased Manager save. This is not Wallet Coins and is never granted by
restore, archive sync or retirement. The existing toolkit remains two scout
tokens, one facility token and one conditioning token.

Purchase/collection screens explicitly distinguish cosmetics-only retirement
unlocks from currency rewards. Reward previews identify where equipped items
appear; collections link to the Player profile or Club Office. Explicitly chosen
office themes override the default Legend boardroom appearance.

- The existing twelve themed sets are available to preview and select in any order.
- Each canonical completed in-game season earns one collection claim while mode VIP is owned. Nothing uses real-world months to unlock these sets.
- Claims are earned per save, with a durable settled-season ledger. Switching selections does not lose the season claim. An unused claim is kept for later selection.
- Player gets that set's kit, celebration and collectible; Manager gets its office theme and collectible. No cross-mode grants.
- Owned sets stay available for story/challenge selection and quick equipment.
- Existing inventory and legacy premium claims are preserved, including older tier artwork. No consumables are restored from the collection archive.
- Earned set ownership is shared with future saves of the same mode and account; XP, season claims, currency and scenario rewards remain save-local.
- Player retirement grants all remaining set cosmetics, idempotently, including for late VIP buyers. Existing retirement eligibility is unchanged: this does not add a new early-retirement button.
- Manager retirement also grants remaining Manager collection cosmetics, including for late VIP buyers/restores. This uses the existing age-60 retirement boundary; dismissal or changing clubs is not retirement. No Player kits, currency or consumables are granted.

## Legacy ownership

- Existing permanent `remove_ads` owners keep their previously purchased access. Their original shared product remains restorable as a legacy exception; new products are strictly mode-specific.
- Existing Player Legend ownership restores its permanent cosmetics and Player VIP, never its one-time coins/gems again.
- Existing active `season_pass` subscriptions remain readable/restorable through their verified expiry. Their old reward screen remains available under “Existing subscription rewards”. They are not silently made permanent or cancelled.
- Neither `season_pass` nor `remove_ads` is exposed or accepted for new app checkout.
- Schema 44 adds mode-tagged VIP/collection state without changing balances, encryption keys or save envelopes.

## Account archive and release work

Offline collection ownership is merged in an account-and-mode-keyed SecureStore archive. Permanent entitlement refresh uses RevenueCat, not client-written cloud flags. A verified inactive new VIP removes cached access; an unavailable network does not erase it.

The optional cloud `merge_vip_collections` RPC synchronizes cosmetic collection IDs only. It cannot grant VIP, coins, Gems or claim credits. This is offline-game cosmetic progress, not a server-authoritative anti-cheat ledger. RLS/definer RPC binds records to `auth.uid()` and mode; deleting the auth user cascades the archive.

Before real purchases/cross-device verification:

1. Create `player_vip` and `manager_vip` as one-time non-consumables in each supported store. Set the ₹449 India reference price and the desired country prices.
2. Map each to its own identically named RevenueCat entitlement and offering. Keep legacy entitlement mappings for restores.
   Preserve `bundle_legend` and `manager_legend_pack` ownership entitlements as well: the client resolves each to its matching mode VIP, so a Legacy refund cannot be mistaken for permanent independently purchased VIP.
3. Retire new sales of the old shared products in store/RevenueCat configuration. Existing subscriptions need an explicit operational sunset; a code change does not cancel billing.
4. Deploy `supabase/migrations/202609080002_vip_collections.sql` through the normal reviewed release process.
5. Test real sandbox checkout, account switching, restore, refunds, offline loads and a second device. Local QA does not verify store configuration or deployment.

No production console settings, SQL deployment, APK build/install or live purchases are performed by this implementation.
