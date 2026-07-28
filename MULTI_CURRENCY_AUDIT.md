# Multi-Currency Audit

Status: **NO-GO**. This audit identifies current locations; it does not claim the full Money migration is complete.

| Location | Current value | Category | Correct currency source | Migration required | Status |
|----------|---------------|----------|-------------------------|--------------------|--------|
| `src/game/money.ts` | `Money { amountMinor, currencyCode }` plus registry/ops | CLUB_MONEY / CONTRACT_MONEY foundation | ISO 4217 configured currency | No, new utility | IMPLEMENTED UTILITY, NOT WIRED |
| `src/services/purchases.ts` catalog `priceString` | Hardcoded INR dev fallback | GOOGLE_PLAY_PRICE | Google Play/RevenueCat ProductDetails | Yes: production must not show stale fallback | PARTIAL: production now shows "Connect to view price" when metadata unavailable |
| `src/game/finance.ts::formatClubCurrency` | INR formatting for club money | CLUB_MONEY | Club/competition base currency | Yes | BLOCKED |
| `Team.budget` | Plain number | CLUB_MONEY | Team base currency | Yes | BLOCKED |
| `SaveGame.finances.transferBudget` | Plain number | CLUB_MONEY | Club finance currency | Yes | BLOCKED |
| `Player.contract.wage` | Plain number | CLUB_MONEY | Employer/competition salary currency | Yes | BLOCKED |
| `wallet.coins` | Plain number | ACCOUNT_COINS | Account wallet | No fiat migration; naming cleanup needed | OK AS ACCOUNT SOFT CURRENCY |
| `wallet.gems` | Plain number | ACCOUNT_GEMS | Account wallet | No fiat migration | OK AS PREMIUM CURRENCY |
| `energy_refill` grant | `wallet.energy` number | TRAINING_FOCUS | Account/career resource cap | Naming migration needed | PARTIAL |
| Transfer budget IAP grants | Numeric 500,000 / 2,000,000 | CLUB_MONEY | Competition economy premium grant config | Yes | BLOCKED |
| Instant Buyout gem fee | Not implemented | ACCOUNT_GEMS | Premium wallet gems | Yes before feature | BLOCKED |
