# International Selection and Ranking-Peak Correction — 2026-08-29

## Implemented

- Player Career saves now persist independent career-best rank and career-best
  rating milestones for each qualifying Test/ODI/T20I ×
  Batting/Bowling/All-Rounder combination.
- Each rank milestone stores rank, rating, save-season ID, displayed year and
  player age. Each rating milestone separately stores rating, rank,
  save-season ID, displayed year and player age.
- The International Calendar shows the selected ranking category's two career
  peaks beneath its format/category controls.
- Schema 43 starts an empty prospective ledger for existing Player saves. It
  deliberately does not invent historic positions from aggregate career stats.
- Standard senior selection remains merit-led but is reachable during the
  intended age-22-to-25 window. Assignment condition recovery prevents calendar
  density from silently ruling out a fit player.
- A new assignment blocks only genuinely collapsed form below 30. A selected
  player is not released from the rest of a tour until at least three tour
  appearances have been completed with form still below 30.

## Six-career distribution audit

The audit ran two complete age-16-to-35 careers for each role using the normal
engaged-career training strategy.

| Role        |  Seed | Test | ODI | T20I | Total caps |
| ----------- | ----: | ---: | --: | ---: | ---------: |
| Batter      | 81001 |  113 | 286 |  175 |        574 |
| Batter      | 91004 |  114 | 299 |  180 |        593 |
| Bowler      | 82002 |   81 | 262 |  158 |        501 |
| Bowler      | 92005 |   92 | 292 |  188 |        572 |
| All-Rounder | 83003 |  100 | 250 |  150 |        500 |
| All-Rounder | 93006 |  128 | 318 |  193 |        639 |

| Role        | Average Test | Average ODI | Average T20I |
| ----------- | -----------: | ----------: | -----------: |
| Batter      |        113.5 |       292.5 |        177.5 |
| Bowler      |         86.5 |       277.0 |        173.0 |
| All-Rounder |        114.0 |       284.0 |        171.5 |
| All six     |        104.7 |       284.5 |        174.0 |

The earlier 12-career audit averaged roughly 20–27 Tests, 67–82 ODIs and
13–23 T20Is depending on role. This correction removes that severe under-supply.
T20I and overall Test volume now sit in the approved bands; ODI volume lands
near the 300-match lower target while still respecting the approved ceiling of
25 ODIs per fully selected season, debut variation and tournament elimination.

Raw artifact:
`test-artifacts/international-selection-balance-6-player-2026-08-29.json`

## Verification

- Five focused Jest suites: 32 tests passed.
- TypeScript compilation: passed.
- ESLint on changed implementation/test files: passed.
- Six complete Player Career simulations: passed.

No APK was built for this correction.
