# Cricket Legacy — approved launch IAP catalogue

Updated 11 September 2026. Fourteen products; no new subscriptions. These are
approved India reference prices, not proof of live Play Console configuration.
Production prices are fetched from the store. All dollar amounts below are
fictional club funds, not real money paid to the user.

## Permanent products

| Exact product ID | Name | India price | Benefits |
| --- | --- | --- | --- |
| `player_vip` | Player VIP | ₹449 | Permanent Player-mode VIP: no ads, 60 Focus capacity, +20% Wallet Coin match rewards, extra Player save slot and 12 earnable cosmetic collections. |
| `manager_vip` | Manager VIP | ₹449 | Permanent Manager-mode VIP: no ads, +20% Wallet Coin match rewards, extra Manager save slot and 12 earnable office collections. |
| `bundle_legend` | Player Legend Edition | ₹899 | Player VIP, 40,000 Wallet Coins, 1,200 Gems, all standard kit designs and Legend Gold frame. Currency delivered once to the purchased Player save. |
| `manager_legend_pack` | Manager Legacy Edition | ₹899 | Manager VIP, $1,000,000 Club Balance, board confidence at least 82, club reputation +3, two full-scout tokens, one facility token, one conditioning token and Legend boardroom. Cash/toolkit delivered once to the purchased Manager save. |

VIP applies across saves of its own mode, never the other mode. It also keeps
the existing naming editor and mode-appropriate premium story/challenge access.
Choose one collection per completed in-game season. Retirement unlocks remaining
collection cosmetics only, not cash, Coins, Gems or tokens. Already-earned
cosmetics remain available in future careers of that mode.

Bundle restoration never repeats currency or toolkit grants. Manager Legacy
backing is not job protection; it does not prevent future dismissal. New Manager
Legacy checkout is unavailable on national duty.

## Consumables and starter offer

| Exact product ID | Name | India price | Benefits / limits |
| --- | --- | --- | --- |
| `starter_pack` | Starter Pack | ₹99 | 3,000 Wallet Coins, 50 Gems and seven ad-free days. One per account; 24-hour offer unlocked after first match, unavailable after another purchase in that save. |
| `coins_medium` | Bag of Coins | ₹299 | 10,000 Wallet Coins in the purchased save. Not Manager club funds. |
| `coins_large` | Sack of Coins | ₹499 | 20,000 Wallet Coins in the purchased save. Not Manager club funds. |
| `gems_medium` | Bag of Gems | ₹299 | 300 Gems in the purchased save. |
| `gems_large` | Chest of Gems | ₹999 | 1,200 Gems in the purchased save. |
| `form_recovery` | Mental Coaching Session | ₹99 | Player form and confidence raised to at least 99; full Focus to 36, or 60 with VIP. Higher values preserved. Available if any benefit is needed. |
| `transfer_budget_sm` | Transfer Budget Boost | ₹99 | $1,000,000 fictional club funds in the purchased Manager save, once per in-game season. Unavailable during national duty. Does not raise the wage ceiling. |
| `scout_full_reveal` | Full Scout Intelligence | ₹49 | One token revealing OVR, form, fitness, injury status and value for one Manager transfer target. |
| `facility_upgrade_token` | Instant Facility Upgrade | ₹99 | One token upgrades Training Ground, Medical Centre or Youth Academy by one level. Normal upkeep applies; Club Balance upgrades remain available. |
| `recovery_pack` | Squad Conditioning Pack | ₹99 | One token adds 20 condition, 20 fitness and 15 morale to eligible non-injured Manager squad players, capped at normal maxima. Existing recovery cooldown applies. |

The first eligible gem-pack purchase per save doubles its Gems: 600 or 2,400.
Starter and Legend Gems are excluded. Consumables are not regranted by Restore
Purchases or by changing saves. The standalone `energy_refill` is not sold;
its effect is included in `form_recovery`.

## Console / RevenueCat mapping

Use the exact product IDs above in the existing Play app. Keep the existing
one-time **Buy** purchase option (`buy`); do not create subscriptions. Review
regional prices separately instead of overwriting previously approved overrides.

| Products | RevenueCat type | RevenueCat entitlement |
| --- | --- | --- |
| `player_vip` | Non-consumable | `player_vip` |
| `manager_vip` | Non-consumable | `manager_vip` |
| `bundle_legend` | Non-consumable | `bundle_legend` |
| `manager_legend_pack` | Non-consumable | `manager_legend_pack` |
| All ten remaining products | Consumable | None |

The app derives matching-mode VIP from the Legend/Legacy ownership entitlement.
Do not replace these with a shared cross-mode VIP entitlement. Starter remains
consumable at the provider, with its one-per-account guard enforced by the app.

## Copy-ready descriptions for the five utility products

Each description is under 200 characters.

| Product ID | Description |
| --- | --- |
| `form_recovery` | Raises form and confidence to at least 99 and refills Focus to 36, or 60 with VIP, in the purchased Player save. Higher values are preserved. |
| `transfer_budget_sm` | Adds $1,000,000 fictional club funds to the purchased Manager save. Once per in-game season. Unavailable during national-team duty. |
| `scout_full_reveal` | One token reveals overall rating, form, fitness, injury status and value for one transfer target in the purchased Manager save. |
| `facility_upgrade_token` | One token upgrades Training Ground, Medical Centre or Youth Academy by one level in the purchased Manager save. Normal upkeep still applies. |
| `recovery_pack` | One token adds 20 condition, 20 fitness and 15 morale to eligible non-injured players in the purchased Manager save. Existing recovery cooldown applies. |

Training Accelerator, Contract Boost and both paid save sponsors are postponed.
The old shared VIP/Season Pass products remain legacy restore paths only.
Local builds and tests do not verify KYC, store setup, production checkout,
refunds or deployment of the optional cloud collection archive.
