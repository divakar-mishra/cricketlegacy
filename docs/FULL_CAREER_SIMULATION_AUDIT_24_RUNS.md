# Full Career Simulation Audit — 24 Runs

Date: 29 August 2026

> Follow-up: the three balancing priorities identified here were corrected and
> re-audited in `BALANCE_CORRECTION_AUDIT_2026-08-29.md`. This document and its
> artifact remain the preserved before-state evidence.
>
> Lifecycle note: this preserved audit forced Player retirement at 33. The live
> policy now uses optional retirement from 33, a performance/fitness/selection
> review from 35-38, and a maximum age of 40. Its cap totals are therefore not a
> current career-length target.

This is the post-correction retirement audit requested after the All-Rounder and
Manager balance changes. It supersedes the 18-run historical baseline for
current balance conclusions.

## Scope and verification

- Player Career: four Batters, four Bowlers and four All-Rounders, age 16 to
  retirement at 33; 17 seasons per save.
- Manager Career: twelve Managers, age 35 to retirement at 60; 25 seasons per
  save.
- Difficulty: Normal.
- Match presentation: canonical Instant Sim settlement.
- Purchases/rewards: no IAP and no rewarded ads.
- Starting resources: 750 Wallet Coins and zero gems in both modes; Manager
  clubs started with 750,000 Club Balance.
- Player behaviour: spend only earned Wallet Coins on affordable training.
- Manager behaviour: renew expiring players, make up to two clear free-agent
  improvements and buy at most one affordable facility level per off-season
  while retaining a 400,000 safety reserve before settlement.

Verification completed before the retirement run:

- TypeScript: passed.
- ESLint: passed.
- Jest: 179/179 suites, 1,010/1,010 tests and 2/2 snapshots passed.
- Retirement audit: passed in 1,012.28 seconds.
- Completed careers: 12/12 Player and 12/12 Manager.
- Correct retirement age/season count: 24/24.
- Audit integrity errors: zero.
- Recorded team match results checked: 12,045 (5,949 Player; 6,096 Manager).
- Competition-table snapshots checked: 1,264 (619 Player; 645 Manager).

The complete 8.9 MB machine-readable result, including every season, match,
innings, table snapshot, training purchase, wallet movement and title, is:

`test-artifacts/full-career-audit-4x-player-12x-manager-2026-08-29.json`

## Player results

Batting average is runs divided by recorded dismissals. `W-L-D/NR` is the
controlled team's full career record, not only matches in which the player was
selected.

| Role | Seed | OVR | Matches | Runs | Bat avg | HS | 100s/50s | Wickets | Bowl avg | Best | W-L-D/NR | Training sessions | Training cost | End wallet | International matches | World titles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 81001 | 26→88 | 441 | 21,749 | 60.9 | 260 | 45/126 | 0 | — | — | 262-233-36 | 115 | 108,119 | 2,412 | 40 | 2 |
| Batter | 91004 | 26→86 | 405 | 18,617 | 54.6 | 243 | 45/93 | 0 | — | — | 231-238-25 | 109 | 93,493 | 1,123 | 29 | 4 |
| Batter | 101007 | 26→86 | 416 | 18,938 | 53.8 | 211 | 44/113 | 0 | — | — | 246-247-30 | 112 | 100,320 | 2,218 | 40 | 5 |
| Batter | 111010 | 26→81 | 315 | 13,848 | 50.9 | 242 | 27/82 | 0 | — | — | 199-210-32 | 98 | 76,769 | 2,264 | 21 | 4 |
| Bowler | 82002 | 27→88 | 361 | 3,573 | 13.9 | 79 | 0/4 | 540 | 27.37 | 8/144 | 213-258-32 | 89 | 72,343 | 2,142 | 40 | 3 |
| Bowler | 92005 | 27→88 | 384 | 4,004 | 14.5 | 81 | 0/7 | 629 | 25.29 | 8/67 | 204-257-25 | 91 | 73,505 | 532 | 18 | 0 |
| Bowler | 102008 | 27→86 | 338 | 3,393 | 13.9 | 106 | 1/6 | 467 | 29.88 | 8/131 | 191-253-47 | 88 | 64,243 | 1,661 | 26 | 4 |
| Bowler | 112011 | 27→90 | 394 | 3,444 | 12.3 | 68 | 0/5 | 693 | 25.92 | 7/53 | 221-243-26 | 96 | 82,168 | 1,527 | 25 | 1 |
| All-Rounder | 83003 | 26→81 | 348 | 11,686 | 46.9 | 173 | 15/69 | 545 | 24.92 | 8/116 | 184-247-40 | 108 | 82,283 | 106 | 0 | 0 |
| All-Rounder | 93006 | 26→85 | 387 | 11,585 | 41.1 | 170 | 11/62 | 544 | 27.20 | 7/39 | 251-226-28 | 113 | 101,445 | 898 | 42 | 6 |
| All-Rounder | 103009 | 26→84 | 378 | 11,498 | 40.6 | 150 | 12/66 | 504 | 27.61 | 6/18 | 231-237-26 | 109 | 93,607 | 354 | 31 | 3 |
| All-Rounder | 113012 | 26→83 | 403 | 13,029 | 45.2 | 141 | 14/81 | 529 | 26.71 | 7/136 | 226-261-33 | 115 | 96,945 | 423 | 26 | 1 |

### Player role averages

| Role | Final OVR | Matches | Runs | Wickets | Team win rate | Sessions | Training coins | End wallet | International matches | World titles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 85.25 | 394.25 | 18,288 | 0 | 47.05% | 108.50 | 94,675 | 2,004 | 32.50 | 15 |
| Bowler | 88.00 | 369.25 | 3,604 | 582.25 | 42.08% | 91.00 | 73,065 | 1,466 | 27.25 | 8 |
| All-Rounder | 83.25 | 379.00 | 11,950 | 530.50 | 44.78% | 111.25 | 93,570 | 445 | 24.75 | 10 |

Peak OVR was only zero or one point above retirement OVR in these runs. The
retirement results therefore are not hiding a materially higher mid-career
peak.

### Player world titles

- 81001: ODI World Cup 2037; World Test Championship 2041.
- 91004: Champions Trophy 2036 and 2040; T20 World Cup 2038; U19 World Cup.
- 101007: Champions Trophy 2036 and 2040; U19 World Cup; World Test
  Championship 2037 and 2039.
- 111010: Champions Trophy 2040; T20 World Cup 2042; U19 World Cup; World Test
  Championship 2041.
- 82002: T20 World Cup 2038 and 2042; World Test Championship 2041.
- 92005: none.
- 102008: ODI World Cup 2037; World Test Championship 2037, 2039 and 2041.
- 112011: T20 World Cup 2038.
- 83003: none.
- 93006: Champions Trophy 2040; ODI World Cup 2037; T20 World Cup 2042; U19
  World Cup; World Test Championship 2037 and 2041.
- 103009: Champions Trophy 2040; ODI World Cup 2037; U19 World Cup.
- 113012: World Test Championship 2037.

### Competition totals across each four-save role sample

| Role | Competition | Matches | Runs | Wickets | 100s | 50s |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Batter | Grade A | 22 | 547 | 0 | 0 | 5 |
| Batter | Under-19 | 34 | 1,153 | 0 | 1 | 10 |
| Batter | U19 World Cup | 6 | 506 | 0 | 3 | 2 |
| Batter | Domestic T20 | 792 | 23,453 | 0 | 14 | 165 |
| Batter | List A | 373 | 19,189 | 0 | 65 | 78 |
| Batter | First-Class | 220 | 20,683 | 0 | 57 | 114 |
| Batter | T20I | 58 | 2,115 | 0 | 3 | 16 |
| Batter | ODI | 47 | 2,777 | 0 | 9 | 13 |
| Batter | Test | 25 | 2,729 | 0 | 9 | 11 |
| Bowler | Grade A | 21 | 194 | 31 | 0 | 1 |
| Bowler | Under-19 | 51 | 719 | 46 | 1 | 2 |
| Bowler | U19 World Cup | 4 | 45 | 2 | 0 | 0 |
| Bowler | Domestic T20 | 734 | 4,352 | 925 | 0 | 0 |
| Bowler | List A | 341 | 3,435 | 412 | 0 | 10 |
| Bowler | First-Class | 217 | 4,799 | 748 | 0 | 6 |
| Bowler | T20I | 49 | 210 | 64 | 0 | 0 |
| Bowler | ODI | 37 | 351 | 29 | 0 | 2 |
| Bowler | Test | 23 | 309 | 72 | 0 | 1 |
| All-Rounder | Grade A | 20 | 430 | 23 | 0 | 1 |
| All-Rounder | Under-19 | 30 | 866 | 36 | 2 | 3 |
| All-Rounder | U19 World Cup | 6 | 43 | 4 | 0 | 0 |
| All-Rounder | Domestic T20 | 772 | 14,936 | 913 | 1 | 74 |
| All-Rounder | List A | 359 | 12,060 | 410 | 17 | 77 |
| All-Rounder | First-Class | 230 | 16,268 | 575 | 26 | 102 |
| All-Rounder | T20I | 18 | 286 | 41 | 0 | 2 |
| All-Rounder | ODI | 63 | 2,124 | 88 | 5 | 15 |
| All-Rounder | Test | 18 | 785 | 32 | 1 | 4 |

## Manager results

`National at` is the Manager age when the National appointment was earned.
World titles are split as ODI World Cup / T20 World Cup / Champions Trophy /
World Test Championship.

| Seed | Final level | Reputation | National at | W-L-D/NR | Win % | League/Cup/Continental | World titles by type | End wallet | End Club Balance | Facilities T/M/A | Avg occupancy | Warnings |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 71005 | National | 88 | 59 | 288-262-21 | 50.4% | 6/5/3 | 0/1/0/0 | 141,106 | -284,000 | 4/3/3 | 78.4% | 1 |
| 81008 | National | 87 | 50 | 302-171-10 | 62.5% | 1/1/2 | 2/3/2/3 | 135,150 | 172,901 | 4/4/4 | 77.6% | 1 |
| 91011 | Elite | 88 | — | 288-280-8 | 50.0% | 6/3/1 | 0/0/0/0 | 141,532 | -275,000 | 4/4/3 | 77.0% | 0 |
| 101014 | National | 88 | 44 | 295-92-10 | 74.3% | 3/2/2 | 4/4/4/8 | 128,741 | 760,046 | 4/4/4 | 78.3% | 1 |
| 111017 | National | 86 | 45 | 268-148-17 | 61.9% | 2/0/0 | 4/4/4/6 | 127,703 | 57,435 | 4/4/3 | 74.6% | 1 |
| 121020 | National | 87 | 45 | 291-124-12 | 68.1% | 2/0/1 | 4/4/4/7 | 129,847 | 10,759 | 3/3/3 | 75.9% | 1 |
| 131023 | Elite | 87 | — | 261-289-4 | 47.1% | 5/1/2 | 0/0/0/0 | 137,368 | -275,000 | 4/4/3 | 77.1% | 0 |
| 141026 | National | 88 | 56 | 315-220-18 | 57.0% | 6/1/2 | 1/1/1/1 | 142,006 | -281,000 | 4/4/4 | 77.1% | 1 |
| 151029 | National | 88 | 53 | 299-204-15 | 57.7% | 4/2/1 | 2/2/1/3 | 137,907 | -136,920 | 5/4/4 | 75.7% | 1 |
| 161032 | National | 88 | 60 | 321-263-18 | 53.3% | 6/3/5 | 0/0/0/0 | 146,038 | -185,544 | 5/4/4 | 76.5% | 0 |
| 171035 | National | 86 | 43 | 265-115-17 | 66.8% | 1/0/1 | 4/5/3/4 | 125,090 | -161,432 | 3/3/2 | 73.6% | 1 |
| 181038 | Elite | 87 | — | 278-289-18 | 47.5% | 4/3/2 | 0/0/0/0 | 141,264 | -287,000 | 5/5/5 | 78.0% | 0 |

### Manager aggregate

- First-season Club→State promotions: 12/12. This is permitted by the approved
  design.
- National appointments: 9/12, or 75%; approved target was at least roughly
  70% without hardcoding the result.
- National appointment age: 43–60, average 50.6.
- Final levels: nine National and three Elite.
- Reputation: 86–88, average 87.33.
- Career win rate: average 58.05%.
- Domestic-only Manager record: 2,555 wins, 2,446 losses and 145 draws/no
  results; 49.6% wins among decisions.
- National-only Manager record: 916 wins, 11 losses and 23 draws/no results;
  96.4% wins among decisions.
- Domestic titles: 46 league, 21 cup and 22 continental.
- International titles: 96 total.
- Ending personal wallet: 125,090–146,038; average 136,146. This is about 53%
  below the previous audit's roughly 291,000 average, but the runner did not
  spend Manager Wallet Coins on optional personal systems.
- Ending Club Balance: average -73,730; eight of twelve careers ended in debt.
  Debt remained bounded and never funded new purchases or deadlocked a save,
  but the frequency remains high.
- Default Standard-ticket occupancy: 73.6–78.4%, average 76.65%; this now sits
  inside the approved regular-match range.
- Eight careers emitted balance warnings. All warnings were undefeated-season
  warnings; no integrity warnings or errors were emitted.

## Team innings distribution

All-out thresholds count only innings with ten wickets recorded.

| Mode | Format | Innings | Mean | Range | All out <50 | All out <70 | >350 | >400 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Player | T20 | 4,620 | 146.7 | 15–265 | 23 | 92 | 0 | 0 |
| Player | ODI | 2,612 | 276.8 | 57–509 | 0 | 3 | 333 | 53 |
| Player | Test | 2,932 | 243.9 | 3–623 | 2 | 12 | 362 | 125 |
| Manager | T20 | 7,020 | 149.1 | 16–288 | 26 | 118 | 0 | 0 |
| Manager | ODI | 4,030 | 281.3 | 43–517 | 1 | 2 | 416 | 92 |
| Manager | Test | 2,284 | 192.7 | 1–511 | 9 | 43 | 121 | 54 |

The Manager ODI mean moved from the historical 327.0 to 281.3, directly on the
approved approximately-280 target. Manager ODI innings above 350 fell to 10.3%
and those above 400 to 2.3%. Very low totals remain possible but rare: 1.68% of
Manager T20 innings were all out below 70, and 0.05% of Manager ODI innings were
all out below 70.

## Conclusions against approved targets

### Passed

1. Every Player and Manager career reached retirement without a progression
   deadlock, repeat-result error or corrupt table.
2. Normal domestic Manager simulation is neutral: the aggregate decisive win
   rate is 49.6%, not the previous near-guaranteed winning behaviour.
3. National progression is no longer blocked: 75% reached National.
4. Free Manager reputation now finishes around 87–88 instead of always 66.
5. Regular Standard-ticket occupancy is in the approved 70–80% range.
6. Manager ODI scoring now averages approximately 280.
7. Manager Wallet income is materially lower than the historical baseline.
8. Club debt is bounded, blocks Club Balance spending and did not break career
   progression.

### Not yet passed

1. **All-Rounder progression is now too low.** The approved target was an
   average 87–88. The observed average is 83.25, with a range of 81–85. Training
   remains visible—111.25 sessions and 1,137.5 direct attribute points per save
   on average—but the dual-discipline/workload conversion is too restrictive.
2. **National Manager matches are much too easy.** Domestic results are neutral,
   but National seasons produced 916 wins and only 11 losses. Fifty-two of 85
   National seasons contained at least ten wins and no loss. The 96 world titles
   are a symptom of the same imbalance, not a healthy trophy distribution.
3. **The engaged-free Player ceiling is inconsistent.** Bowler average OVR is
   88, but Batter averages 85.25 and All-Rounder 83.25. One Batter and one
   All-Rounder ended at 81 despite spending virtually all affordable earned
   currency on training.
4. **Debt incidence needs another economy pass.** The safety cap works, but 8/12
   engaged Manager careers retiring in debt is high. This is not a deadlock, but
   it may punish normal squad retention too frequently.
5. **Manager Wallet usefulness still needs sink coverage.** The faucet was cut
   roughly in half, yet an unspent personal wallet still accumulates about
   136,000 coins. A separate audit should exercise the Cricket Academy,
   investments and other Manager Wallet sinks before changing the faucet again.

## Runtime defects found and corrected before the accepted run

The first expanded audit exposed two long-career roster defects rather than
papering them over:

1. Contract expiry could reduce a Manager club below a playable XI. When the
   final eleven are reached, expiring contracts now receive a one-year emergency
   extension at their existing wage.
2. Smaller national pools could age out until a team had only one valid player.
   National refresh now replenishes active under-40 players with a season-specific
   generated pool, and international eligibility no longer depends on having a
   domestic club contract.

Regression coverage was added for both cases. The full verification gate and
the exact 24-career audit then passed.
