# Season Pass Value Audit — 2026-08-29

## Current product

- Reference price: INR 299 per month. The store-localized price remains the
  production authority.
- Duration: 30 days, auto-renewing until cancelled.
- Progression: 20 tiers and 11,020 cumulative XP. XP and claim ledgers remain
  separate in every save.
- Entitlement: one active store subscription unlocks Premium access in every
  Player and Manager save on that store account.
- Full free track: 4,750 Wallet Coins.
- Full premium track: 8,160 additional Wallet Coins.
- Featured premium scenario: 1,250–2,400 additional Wallet Coins depending on
  the monthly cycle.
- Paid coin value when the track/scenario is completed: 9,410–10,560 Wallet
  Coins, excluding the free track.
- Other premium value: temporary ad removal, monthly mode-specific collection,
  monthly collectible, story chain, featured scenario, active naming editor,
  one additional save slot and mode benefits.

## Mode-specific fulfilment

Future claims no longer put unusable cosmetics into the wrong mode.

Player Career:

- Tier items: Stadium Noir kit, Championship frame, Floodlight celebration and
  Stadium Noir ground presentation.
- Monthly claim: that cycle's Player kit, celebration and collectible.
- Active benefits: 10% more growth from valid paid training and 5% more positive
  selection-reputation gain.

Manager Career:

- Tier items: Stadium Noir ground and Executive office presentation.
- Monthly claim: that cycle's Manager office and collectible.
- Active benefits: 5% staff-signing discount and four percentage points of
  superstar-transfer interest.

Existing saves keep any items already claimed under the previous shared list;
the correction is non-destructive.

## UI correction

- Player and Manager Home both show a compact, explicitly mode-labelled pass
  ticket with the current monthly chapter, tier, progress and ready claims.
- The main screen shows only the nearby three tiers by default.
- Price, 30-day duration and auto-renewal remain on the purchase surface.
- Exact mode benefits are moved behind an `i` control.
- The monthly card opens Premium Clubhouse. Previously this implemented screen
  had no reachable navigation action, hiding the monthly collection/scenario.

## Price comparison

| Product                      | Reference price |                           Wallet Coin value | Other value                                                         |
| ---------------------------- | --------------: | ------------------------------------------: | ------------------------------------------------------------------- |
| Bag of Coins                 |         INR 299 |                          10,000 immediately | None                                                                |
| Season Pass at current price |         INR 299 |                         9,410–10,560 earned | Cosmetics, stories, scenario, temporary ad removal and mode benefit |
| Proposed Season Pass         |         INR 199 | Same earned value if rewards stay unchanged | Same non-coin value                                                 |

## Recommendation

INR 199 is the stronger launch price if the objective is conversion and
retention. Its approximately 33% discount against the instant INR 299 coin pack
is defensible because Season Pass value is earned over roughly four active weeks
rather than granted immediately. The pass contains no Gems and does not buy
wins, selection or trophies.

Keep INR 299 if the priority is maximizing revenue per subscriber rather than
pass adoption. Do not change the runtime fallback or store product until the
owner approves one price and the matching Google Play/App Store subscription is
configured.

The entitlement scope is approved: provider subscription access is account-wide
while XP, tier state and reward claims stay separate in every save.

## Verification

- Season Pass, editor, Store, entitlement and Home focused suites: 153 tests
  passed.
- TypeScript: passed.
- ESLint on changed implementation and tests: passed.
- No full suite, APK build or emulator install was run.
