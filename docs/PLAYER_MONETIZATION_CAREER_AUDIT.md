# Player Monetization Career Audit

## Approved follow-up

- Player Career has a one-way Gem Exchange at `1 gem = 40 Wallet Coins`.
- Available exchanges are `25 → 1,000`, `100 → 4,000`, and `300 → 12,000`.
- The exchange is not available in Manager Career.
- After this measurement, Bag of Coins changed to `10,000 coins / INR 299` and
  Sack of Coins changed to `20,000 coins / INR 499`.
- Player Legend changed to `40,000 coins and 1,200 gems / INR 999`.
- The Manager facility token changed to `INR 199`, and the inactive real-money
  Energy Refill product was removed from the catalog.
- The retirement tables below remain the 28 August pre-change snapshot. The
  reusable runner now uses the approved catalog, but it has not been rerun for
  this update.

Date: 28 August 2026

Status: historical current-balance measurement. No runtime price, grant,
training or ad behavior was changed by the audit run itself; the approved
catalog changes listed above were applied afterward.

## Method

The audit completed 18 deterministic Player careers: Batter, Bowler and All-Rounder across six purchase profiles. Every career began at age 16, retired at age 33, used Normal difficulty and resolved the canonical fixture, selection, reward and season-rollover paths.

Every simulated player behaved as a training-only optimiser:

- buy every affordable paid training session;
- spend nothing on Player Life, equipment, personal coaches, investments or the personal Cricket Academy;
- claim no rewarded ads;
- use no paid gems;
- use the same role seed in every purchase tier.

The fixed comparison profiles were:

| Tier | Current reference spend | Audit basket |
| --- | ---: | --- |
| Free | INR 0 | No purchase |
| Starter | INR 99 | One Starter Pack: 3,000 coins, 50 gems and seven ad-free days; the timed ad benefit is not simulated |
| Accelerator | INR 149 | One Training Accelerator: three accelerated sessions |
| Coin buyer | INR 599 | One Sack of Coins: 15,000 coins |
| Legend | INR 999 | Player Legend Edition: 20,000 coins, 600 gems and permanent VIP benefits |
| Whale comparison | INR 4,987 | Starter, Legend, five Sacks of Coins and six Accelerators |

The whale basket is an audit profile, not a proposed store product or approved price.

## Retirement results

| Tier | Batter OVR | Bowler OVR | All-Rounder OVR |
| --- | ---: | ---: | ---: |
| Free | 90 | 88 | 92 |
| Starter | 90 | 87 | 91 |
| Accelerator | 90 | 87 | 89 |
| Coin buyer | 94 | 90 | 94 |
| Legend | 94 | 93 | 94 |
| Whale comparison | 94 | 93 | 95 |

Starter and Accelerator differences contain normal full-career feedback and randomness: a small early attribute change can alter selection, fixtures played, rewards earned and later sessions afforded. Neither product produced a reliable retirement advantage in this run.

## Age at key OVR

`-` means that the role did not reach the target in that career.

| Tier | Role | 80 OVR | 90 OVR | 95 OVR |
| --- | --- | ---: | ---: | ---: |
| Free | Batter | 28 | 33 | - |
| Free | Bowler | 29 | - | - |
| Free | All-Rounder | 27 | 31 | - |
| Starter | Batter | 29 | 31 | - |
| Starter | Bowler | 29 | - | - |
| Starter | All-Rounder | 27 | 31 | - |
| Accelerator | Batter | 29 | 32 | - |
| Accelerator | Bowler | 29 | - | - |
| Accelerator | All-Rounder | 27 | - | - |
| Coin buyer | Batter | 27 | 30 | 31 |
| Coin buyer | Bowler | 28 | 31 | - |
| Coin buyer | All-Rounder | 26 | 29 | 32 |
| Legend | Batter | 26 | 28 | 29 |
| Legend | Bowler | 26 | 29 | - |
| Legend | All-Rounder | 24 | 27 | 30 |
| Whale comparison | Batter | 20 | 22 | 23 |
| Whale comparison | Bowler | 21 | 24 | 24 |
| Whale comparison | All-Rounder | 20 | 22 | 23 |

The whale Batter and Bowler reached 95 during their prime before later attribute decline, so their retirement OVR is lower than their recorded age-at-95 peak.

## Training and wallet evidence

| Tier | Role | Sessions | Accelerated | Training coins spent | Ending wallet |
| --- | --- | ---: | ---: | ---: | ---: |
| Free | Batter | 116 | 0 | 111,269 | 1,532 |
| Free | Bowler | 89 | 0 | 72,343 | 2,142 |
| Free | All-Rounder | 102 | 0 | 98,293 | 1,537 |
| Coin buyer | Batter | 126 | 0 | 131,444 | 2,572 |
| Coin buyer | Bowler | 103 | 0 | 91,243 | 2,530 |
| Coin buyer | All-Rounder | 116 | 0 | 122,518 | 109 |
| Legend | Batter | 135 | 0 | 159,719 | 4,196 |
| Legend | Bowler | 114 | 0 | 123,681 | 2,152 |
| Legend | All-Rounder | 121 | 0 | 142,656 | 3,114 |
| Whale comparison | Batter | 146 | 18 | 243,681 | 4,968 |
| Whale comparison | Bowler | 131 | 18 | 204,269 | 2,133 |
| Whale comparison | All-Rounder | 136 | 18 | 216,756 | 21,899 |

The free optimiser ends almost empty because it converts nearly every earned coin into training. That creates an opportunity cost, but only if the alternatives are attractive enough to justify slower development.

## Findings

1. The then-current 15,000-coin pack was materially useful. It moved the three roles from 88-92 retirement OVR to 90-94 and generally brought 80 OVR forward by one season.
2. Player Legend is a materially faster route. It brought 80 OVR forward by two to three seasons and 90 OVR forward by roughly four to five seasons where directly comparable.
3. One Training Accelerator is not a persuasive standalone progression purchase in the current career simulation.
4. The audit found that the runtime accelerator substituted a `1.50x` multiplier for the normal archetype, Pass and personal-coach multiplier rather than multiplying the normal result. This was corrected after the measurement: Accelerator now adds 50% to the normal combined session result. The purchase must be re-audited before changing its price or charge count.
5. Gems did not affect progression in this training-only audit. They remain cosmetic, recovery and energy currency; the purchased gem balances were not spent by the optimiser.
6. A free user can rationally ignore most optional systems and still reach 88-92 by retirement. The concern is real.

## Why the off-field systems are currently easy to ignore

- Personal Cricket Academy tiers cost 15,000, 50,000 and 150,000 coins while paying 800, 2,500 and 7,000 periodically. Simple purchase-price recovery takes approximately 19-21 periods, longer than this 17-season career if a period is one season.
- Equipment costs 5,000-9,000 coins for two permanent attribute points. A training-focused player usually receives stronger development value from paid sessions.
- Properties recover their price in roughly 23-27 seasons. Businesses take roughly 14-17 seasons before considering unlock timing.
- Personal coaches have strong training synergy, but they compete directly with the session coins needed to use their benefit and are not represented in the training-only optimiser.

The solution should not be to hide progression or make a free career impossible. Optional systems need timely, cricket-relevant value that competes credibly with another training session.

## Current ad-revenue position

- The post-match screen offers a rewarded ad that doubles the completed match's coin reward. A training-only free player has a reason to watch because their ending wallet is nearly zero.
- The Store offers a rewarded ad for four energy.
- Career Home may show frequency-capped interstitials after three appearances, at most two per rolling hour and at least 30 minutes apart.
- The rewarded Android unit has a release fallback configured. The interstitial unit is currently empty, so production interstitial revenue remains unavailable until a real unit is configured.

The next balance decision should compare training-only Free against a deliberately balanced Free path using personal coaches/equipment/Academy, then compare rewarded-ad participation levels. IAP grants and prices should be changed only after those opportunity-cost and ad-value curves are visible.

## Artifacts

- Reusable command: `npm run audit:monetization-careers`
- Machine-readable report: `test-artifacts/player-monetization-career-audit.json`
- Audit runner: `scripts/five-season-career-audit.test.ts`
