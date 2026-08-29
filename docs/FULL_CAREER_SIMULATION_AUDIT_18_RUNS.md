# Full Career Simulation Audit — 18 Runs

Generated on 29 August 2026 from the deterministic full-career audit runner.

> Historical baseline: the All-Rounder, Manager reputation/progression,
> Manager-wallet, attendance, Manager ODI and debt corrections approved after
> this run are now implemented in source. The figures below remain the evidence
> that motivated those changes; they are not post-correction results. A fresh
> 18-career audit is required before the new targets can be marked verified.

## Scope and result

- Difficulty: Normal
- Match mode: Instant Sim
- IAP and rewarded ads: disabled
- Player careers: age 16 to retirement at 33, three Batters, three Bowlers and three All-Rounders
- Manager careers: age 35 to retirement at 60, nine runs
- Player spending: earned Wallet Coins were reinvested in training
- Manager spending: Club Balance was used for retention/facility upgrades
- Final audit result: **PASS**
- Player retirements: **9/9**
- Manager retirements: **9/9**
- Integrity errors: **0**

The complete machine-readable report, including every season, fixture, innings, competition table, competition-specific player stat line, wallet movement, training purchase and title, is in `test-artifacts/full-career-audit-3x-player-9x-manager.json`.

## Test gate

| Check | Result |
| --- | ---: |
| TypeScript | Pass |
| ESLint | Pass |
| Jest suites | 179/179 passed |
| Jest tests | 1,000/1,000 passed |
| Snapshots | 2/2 passed |
| Full-career audit test | Pass |

## Player careers

All player careers completed 17 seasons and retired at age 33.

| Seed | Role | OVR | Matches | Runs | Bat Avg | HS | 50s | 100s | Wickets | Bowl Avg | Best | Caps |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 81001 | Batter | 90 | 443 | 21,770 | 61.2 | 260 | 126 | 46 | 0 | — | — | 42 |
| 91004 | Batter | 86 | 405 | 18,617 | 54.6 | 243 | 93 | 45 | 0 | — | — | 29 |
| 101007 | Batter | 86 | 416 | 18,938 | 53.8 | 211 | 113 | 44 | 0 | — | — | 40 |
| 82002 | Bowler | 88 | 361 | 3,573 | 13.9 | 79 | 4 | 0 | 540 | 27.37 | 8/144 | 40 |
| 92005 | Bowler | 88 | 384 | 4,004 | 14.5 | 81 | 7 | 0 | 629 | 25.29 | 8/67 | 18 |
| 102008 | Bowler | 86 | 338 | 3,393 | 13.9 | 106 | 6 | 1 | 467 | 29.88 | 8/131 | 26 |
| 83003 | All-Rounder | 92 | 380 | 13,723 | 53.6 | 175 | 70 | 26 | 653 | 24.56 | 8/65 | 22 |
| 93006 | All-Rounder | 92 | 377 | 13,800 | 53.9 | 206 | 83 | 26 | 633 | 26.14 | 8/46 | 21 |
| 103009 | All-Rounder | 92 | 389 | 13,907 | 50.8 | 229 | 80 | 25 | 535 | 28.63 | 7/85 | 26 |

### Player progression and economy

| Seed | Role | Team W-L-D/NR | Win % | Training sessions | Training spend | End coins | End gems | League/Cup/Continental titles |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 81001 | Batter | 266-232-35 | 49.9% | 116 | 111,269 | 1,532 | 204 | 5 / 3 / 2 |
| 91004 | Batter | 231-238-25 | 46.8% | 109 | 93,493 | 1,123 | 174 | 1 / 5 / 1 |
| 101007 | Batter | 246-247-30 | 47.0% | 112 | 100,320 | 2,218 | 162 | 2 / 1 / 1 |
| 82002 | Bowler | 213-258-32 | 42.3% | 89 | 72,343 | 2,142 | 121 | 0 / 2 / 0 |
| 92005 | Bowler | 204-257-25 | 42.0% | 91 | 73,505 | 532 | 162 | 2 / 4 / 4 |
| 102008 | Bowler | 191-253-47 | 38.9% | 88 | 64,243 | 1,661 | 91 | 0 / 0 / 0 |
| 83003 | All-Rounder | 232-217-41 | 47.3% | 102 | 98,293 | 1,537 | 245 | 1 / 7 / 2 |
| 93006 | All-Rounder | 225-227-35 | 46.2% | 100 | 95,180 | 2,570 | 221 | 1 / 3 / 0 |
| 103009 | All-Rounder | 236-220-36 | 48.0% | 101 | 95,555 | 749 | 245 | 1 / 3 / 2 |

### Player role averages

| Role | Avg final OVR | Avg matches | Avg runs | Avg wickets | Avg win % | Avg training spend | World titles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 87.3 | 421.3 | 19,775 | 0 | 47.9% | 101,694 | 12 |
| Bowler | 87.3 | 361.0 | 3,657 | 545 | 41.1% | 70,030 | 7 |
| All-Rounder | 92.0 | 382.0 | 13,810 | 607 | 47.2% | 96,343 | 7 |

### World titles by player seed

- 81001: ODI World Cup 2037; T20 World Cup 2042; World Test Championship 2041
- 91004: Champions Trophy 2036 and 2040; T20 World Cup 2038; U19 World Cup
- 101007: Champions Trophy 2036 and 2040; U19 World Cup; World Test Championship 2037 and 2039
- 82002: T20 World Cup 2038 and 2042; World Test Championship 2041
- 92005: none
- 102008: ODI World Cup 2037; World Test Championship 2037, 2039 and 2041
- 83003: T20 World Cup 2034 and 2042; World Test Championship 2043
- 93006: ODI World Cup 2037; U19 World Cup
- 103009: ODI World Cup 2037; U19 World Cup

## Manager careers

All Manager careers completed 25 seasons and retired at age 60.

| Seed | Final level | W-L-D/NR | Win % | League/Cup/Continental | Promotion events | End Wallet | End Club Balance | Facilities T/M/A | Avg occupancy |
| ---: | --- | --- | ---: | --- | ---: | ---: | ---: | --- | ---: |
| 71005 | Elite | 297-300-15 | 48.5% | 7 / 1 / 4 | 7 | 287,030 | 64,907 | 4 / 3 / 3 | 99.6% |
| 81008 | Elite | 317-316-28 | 48.0% | 5 / 4 / 1 | 4 | 295,044 | 679,794 | 5 / 5 / 4 | 98.9% |
| 91011 | Elite | 323-257-19 | 53.9% | 6 / 4 / 3 | 7 | 292,638 | -640,711 | 5 / 5 / 5 | 99.4% |
| 101014 | Elite | 340-293-35 | 50.9% | 3 / 6 / 6 | 6 | 301,582 | 5,651,662 | 5 / 5 / 5 | 99.4% |
| 111017 | Elite | 339-340-34 | 47.5% | 7 / 1 / 1 | 9 | 303,422 | 4,135,088 | 5 / 5 / 5 | 99.4% |
| 121020 | Elite | 294-280-14 | 50.0% | 6 / 1 / 3 | 8 | 284,720 | 1,471,055 | 4 / 4 / 3 | 99.6% |
| 131023 | State | 280-273-6 | 50.1% | 2 / 3 / 4 | 7 | 279,166 | -530,722 | 5 / 5 / 4 | 99.7% |
| 141026 | Elite | 278-351-28 | 42.3% | 5 / 2 / 2 | 8 | 286,362 | 535,026 | 4 / 4 / 4 | 99.3% |
| 151029 | Elite | 291-315-21 | 46.4% | 4 / 3 / 2 | 8 | 287,606 | -29,680 | 5 / 5 / 5 | 99.6% |

### Manager aggregate

- Matches: 5,684
- Record: 2,759 wins, 2,725 losses, 200 draws/no-results
- Win rate: 48.5%
- Titles: 45 league, 25 cup and 26 continental; 96 total
- Final levels: eight Elite, one State, zero National
- Average end Wallet Coins: 290,841
- Average end Club Balance: 1,259,602
- Careers ending in debt: 3/9
- Average final stadium occupancy on the default Standard ticket preset: 99.4%
- Final reputation: 66 in every run
- First-season Club-to-State promotions: 9/9

## Score distribution

Low-score counts below refer only to completed all-out innings, avoiding false alarms from small successful run chases.

| Mode | Format | Innings | Mean | Range | All out <50 | All out <70 | All out <100 | >350 | >400 |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Player | T20 | 3,506 | 147.4 | 29–265 | 13 | 56 | 260 | 0 | 0 |
| Player | ODI | 1,968 | 277.5 | 57–504 | 0 | 2 | 8 | 240 | 34 |
| Player | Test | 2,212 | 243.8 | 3–522 | 1 | 10 | 49 | 281 | 90 |
| Manager | T20 | 6,736 | 148.7 | 18–260 | 16 | 94 | 355 | 0 | 0 |
| Manager | ODI | 3,302 | 327.0 | 91–473 | 0 | 0 | 1 | 1,134 | 183 |
| Manager | Test | 2,660 | 192.7 | 2–405 | 1 | 16 | 98 | 8 | 1 |

## Findings requiring balance review

1. **Manager Normal difficulty is now broadly neutral.** The combined Manager win rate is 48.5%, so the previous always-win Instant Sim behaviour is not reproduced.
2. **Entry-level Manager progression is too generous.** Every Manager was promoted from Club to State in season one; one seed went 16-0 and another later completed an undefeated 10+ match season.
3. **The National Manager pathway was never reached.** Across 225 simulated Manager seasons, no career ended at the National level, while eight reached Elite. This suggests a late-career progression bottleneck.
4. **Manager reputation lacks differentiation.** All nine careers ended at exactly 66 despite materially different records and trophy counts.
5. **Manager Wallet Coins remain excessive.** The non-club wallet ended at roughly 291k on average even though Manager expenditure is supposed to use Club Balance.
6. **Club debt needs an explicit design decision.** Three of nine careers retired with a negative Club Balance. The simulations did not deadlock, but the game currently permits long-term debt.
7. **Default attendance is effectively sold out.** Average occupancy was 99.4% in all nine careers. The runner kept the Standard ticket preset and did not upgrade stadium tracks, so this is a baseline demand warning rather than a full ticket-choice test.
8. **Manager ODI scoring is inflated.** The mean innings was 327; 34.3% of innings exceeded 350 and 5.5% exceeded 400. This is the clearest match-balance issue in the batch.
9. **Rare T20 collapses still occur.** Manager careers contained 16 sub-50 all-outs in 6,736 innings (0.24%). They are uncommon, but the previously reported 39-all-out type result remains possible.
10. **Free Player progression reaches the intended high range.** With no IAP or ads, final ratings ranged from 86 to 92. All-Rounders reached 92 in all three seeds, making them consistently stronger than specialists and worth reviewing before monetisation tuning.
11. **Bowler team results are weaker.** Bowler saves averaged a 41.1% win rate versus 47.9% for Batters and 47.2% for All-Rounders, despite comparable final OVR.

## Integrity checks covered

- Every simulated season advanced its year and age exactly once.
- Every player and manager reached the configured retirement age.
- No completed fixture was replayed or recorded twice.
- Team played/won/lost/drawn totals matched canonical completed-result ledgers.
- Player competition stats remained cumulative and internally consistent.
- No negative Player Wallet Coins or invalid training purchase was recorded.
- No career became trapped at a camp, selection meeting, training week or unresolved fixture.

## Audit-runner correction

The first batch exposed a runner-only false dead-end: resolving a national camp could replace the active calendar event while leaving the numeric cursor unchanged. The runner now includes the active event ID and completion state in its progress signature. No gameplay, economy or simulation rule was changed by this correction.
