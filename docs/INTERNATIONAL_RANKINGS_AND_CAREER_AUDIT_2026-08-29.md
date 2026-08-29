# International Rankings And 24-Career Audit — 29 August 2026

## Scope

- Player Career: four Batters, four Bowlers and four All-Rounders, age 16 to fixed retirement at 35.
- Manager Career: twelve Managers, age 35 to retirement at 60.
- Difficulty: Normal.
- Match mode: Instant Sim.
- IAP and rewarded ads: excluded.
- Player spending: earned Wallet Coins used for training.
- Manager spending: Club Balance used for retention and infrastructure upgrades.

Raw artifact:
`test-artifacts/full-career-audit-12-player-12-manager-international-rankings-2026-08-29.json`

## Ranking implementation verified

- National Managers have separate Test, ODI and T20I team rankings with position, team, matches, points and rating.
- Capped Player Careers have separate Test, ODI and T20I Batting, Bowling and All-Rounder rankings.
- The controlled country/player is highlighted; a user outside the top ten is pinned below it.
- Only the matching international format moves when a canonical fixture result is completed.
- Replaying an already-completed fixture cannot increment rankings again.
- Retired players are removed and players without a completed match in the selected format do not qualify.
- The All-Rounder index is batting rating multiplied by bowling rating divided by 1,000.

## Player averages

| Role | Final OVR | Career matches | Runs | Bat avg | SR | Wickets | Bowl avg | Econ | Tests | ODIs | T20Is | World titles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 89.0 | 454.0 | 21,807 | 57.54 | 103.36 | 0 | — | — | 20.5 | 67.8 | 13.5 | 8 |
| Bowler | 90.5 | 460.8 | 4,902 | 14.59 | 70.28 | 812 | 25.70 | 4.18 | 26.8 | 81.5 | 21.5 | 8 |
| All-Rounder | 90.3 | 458.0 | 16,797 | 53.31 | 103.36 | 689 | 28.51 | 4.47 | 27.3 | 66.8 | 22.8 | 9 |

All twelve Player careers retired at 35 with zero warnings and zero errors.

### Player runs

| Role | Seed | OVR | Matches | Runs | Wickets | Tests | ODIs | T20Is | World titles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 81001 | 92 | 487 | 24,331 | 0 | 28 | 79 | 19 | 3 |
| Batter | 91004 | 90 | 480 | 23,566 | 0 | 20 | 69 | 10 | 1 |
| Batter | 101007 | 89 | 464 | 21,854 | 0 | 21 | 73 | 16 | 4 |
| Batter | 111010 | 85 | 385 | 17,475 | 0 | 13 | 50 | 9 | 0 |
| Bowler | 82002 | 91 | 454 | 5,122 | 762 | 25 | 100 | 26 | 3 |
| Bowler | 92005 | 91 | 485 | 5,382 | 824 | 29 | 89 | 19 | 0 |
| Bowler | 102008 | 90 | 448 | 4,640 | 751 | 27 | 67 | 26 | 3 |
| Bowler | 112011 | 90 | 456 | 4,462 | 912 | 26 | 70 | 15 | 2 |
| All-Rounder | 83003 | 90 | 480 | 17,661 | 647 | 25 | 84 | 20 | 2 |
| All-Rounder | 93006 | 93 | 477 | 18,542 | 888 | 34 | 69 | 30 | 4 |
| All-Rounder | 103009 | 88 | 437 | 15,417 | 533 | 26 | 60 | 15 | 1 |
| All-Rounder | 113012 | 90 | 438 | 15,568 | 686 | 24 | 54 | 26 | 2 |

### Player balance observation

The annual international calendar remains 10 Tests, 25 ODIs and 15 T20Is, but
selection, later debut and form drops mean the protagonist does not play every
scheduled match. Across this sample, career averages were only 20.5–27.3 Tests,
66.8–81.5 ODIs and 13.5–22.8 T20Is depending on role. These totals remain well
below the earlier target of roughly 100–200 Tests, 300–350 ODIs and 160–200
T20Is. This is a separate selection/availability balance decision; it was not
silently changed as part of the rankings implementation.

## Manager summary

- All twelve careers completed 25 seasons and retired at age 60.
- Ten of twelve Managers reached National level: 83.3%, above the approved 70% target.
- National appointment age among successful careers: average 49.2, range 42–55.
- Final reputation: average 87.3, range 86–88.
- Career win rate: average 54.2%, range 45.2–60.9%.
- Average occupancy: 76.9%, range 73.0–79.1%.
- Final Wallet Coins: average 171,927, range 137,721–201,172.
- Final Club Balance: average 724,314, range 217,314–1,861,313.
- Titles across the sample: 35 league, 21 cup, 20 continental and 39 world titles.
- No completed season ended in Club Balance debt.
- Zero errors. One warning: seed 101014 completed 2026 undefeated over at least ten matches.

### Manager runs

| Seed | Final level | Rep | Win rate | National age | World titles | Occupancy | Wallet | Club Balance |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 71005 | National | 88 | 60.9% | 46 | 6 | 79.1% | 192,795 | 1,002,254 |
| 81008 | National | 87 | 53.7% | 52 | 3 | 76.1% | 168,035 | 217,314 |
| 91011 | National | 88 | 51.3% | 55 | 3 | 77.6% | 157,794 | 307,785 |
| 101014 | National | 87 | 56.1% | 46 | 3 | 75.9% | 188,152 | 1,013,146 |
| 111017 | National | 87 | 57.4% | 50 | 4 | 75.7% | 177,651 | 318,346 |
| 121020 | Elite | 87 | 45.2% | — | 0 | 78.6% | 137,721 | 1,861,313 |
| 131023 | Elite | 86 | 50.2% | — | 0 | 78.2% | 142,668 | 1,324,055 |
| 141026 | National | 87 | 57.7% | 48 | 4 | 76.5% | 183,364 | 795,837 |
| 151029 | National | 88 | 52.2% | 50 | 3 | 78.2% | 173,285 | 493,511 |
| 161032 | National | 86 | 58.1% | 42 | 6 | 73.0% | 201,172 | 520,215 |
| 171035 | National | 88 | 55.9% | 49 | 5 | 77.6% | 179,097 | 597,712 |
| 181038 | National | 88 | 51.3% | 54 | 2 | 76.1% | 161,395 | 240,276 |

## Verification

- `npm run check`: passed.
- 185 test suites passed.
- 1,031 tests passed.
- Full-career audit: passed in 1,155.944 seconds.
- 12 Player careers and 12 Manager careers completed canonical retirement.
