# Multi-Currency Audit

Status: **NO-GO**. The persisted currency-aware mirror exists, but gameplay
finance is not fully migrated to it.

| Location | Current value | Required source | Status |
| --- | --- | --- | --- |
| `src/domain/types.ts` | `StoredMoney` and `CanonicalClubFinance` | ISO 4217 currency configured for the club | Persisted foundation |
| `src/storage/schema14.ts` | Initializes canonical finance mirror | Legacy-save migration policy | Partial |
| `src/game/finance.ts` | Numeric operational club finance | Active club currency | Migration required |
| `Team.budget` | Numeric club balance | Active club currency | Migration required |
| `SaveGame.finances.transferBudget` | Numeric transfer budget | Active club currency | Migration required |
| `Player.contract.wage` | Numeric contract wage | Employer currency | Migration required |
| `wallet.coins` | Account soft currency | No fiat source | Correct category |
| `wallet.gems` | Account premium currency | No fiat source | Correct category |
| Store `priceString` | Local fallback in development; verified provider price in release | RevenueCat/Google Play | Provider verification required |
| Transfer Budget Boost | Numeric club-budget grant | Active club currency | Currency migration required |

The deleted standalone money prototype is not part of the architecture. New
currency work must extend the persisted domain model and finance service rather
than introduce a second representation.
