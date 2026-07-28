# Economy Design

Status: **NO-GO** for multi-currency release.

## Current Model

The current save model stores account coins, gems, and energy in `wallet`. Manager club money is stored on `Team.budget` and `SaveGame.finances.transferBudget`, with display formatting in `src/game/finance.ts`.

## Required Model

The tested canonical type now exists in `src/game/money.ts`:

```ts
type Money = {
  amountMinor: string;
  currencyCode: string;
};
```

No club, transfer, wage, contract, auction, or financial-history amount should exist without an ISO 4217 `currencyCode`.

## Rules

- Account coins and gems must never display fiat symbols.
- Google Play prices must never be stored as club finance.
- Club finance currency follows the club/competition, not the user's app-store country.
- Historical contracts and finance history keep their original currency.
- Cross-currency transfers require a versioned game exchange-rate table.

## Current Blockers

- The Money utility exists and is unit-tested, but it is not yet wired into persisted save data.
- Existing `Team.budget`, `ClubFinances.transferBudget`, wages, staff wages, facility costs, and contract values are plain numbers.
- `formatClubCurrency` still assumes INR-style display.
- Legacy save migration for club/contract currencies is not implemented.
- Auction/transfer currency ownership is not modeled.
