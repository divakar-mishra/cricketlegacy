# National Manager Streak Correction Audit

Verified 29 August 2026 against the canonical full-career simulator.

## Outcome

The concentrated undefeated-season issue is corrected in the requested final
population. This is not implemented through forced defeats, an anti-streak
roll, or a hidden opposition boost.

| Measure | Challenged population | Corrected population |
| --- | ---: | ---: |
| Manager careers | 12 | 12 |
| Total Manager seasons | 300 | 300 |
| National seasons | 118 | 108 |
| National seasons with 10+ matches and no loss | 10 (8.5%) | 1 (0.9%) |
| National careers affected | 6/12 | 1/12 |
| All National seasons with no loss, including short schedules | 15 (12.7%) | 4 (3.7%) |
| All Manager seasons with 10+ matches and no loss | 11 | 2 |

The two remaining long undefeated seasons across all 300 Manager seasons are:

- seed `101014`, 2026 Club season: 16 wins, 0 losses;
- seed `101014`, 2038 National season: 9 wins, 0 losses, 2 draws.

One such National season in 108 is a genuine outlier. No result is injected to
guarantee a loss.

## Root causes and corrections

### 1. Late-career peer XIs were not truly equal

The National opponent floor stopped at 96 OVR while a mature controlled XI
could reach 99. Generated form and aggression also contributed to OVR without
being lifted to the requested peer target. The result was a persistent hidden
gap even when India and the opponent shared the same country-strength tier.

The floor now follows the controlled XI up to 99. Every rating included in the
overall calculation can reach the requested floor, while role balance and the
country-strength gap remain intact. A regression constructs a 99-OVR India
generation and requires Australia's best XI to finish within one OVR.

### 2. Live career matches ignored AI tactics

`simulateMatch` applied both TeamSide tactic sets. `LiveMatch`, used by the
canonical career settlement path for Watch, Key Moments and instant completion,
applied the user's selected plan but discarded the AI TeamSide tactics. A
default user `CONTAIN` plan therefore played against an unintended tactic-less
opponent.

`LiveMatch` now falls back to the batting and fielding TeamSide tactics whenever
that side is not user-controlled. A deterministic regression applies different
real tactics to the two teams and requires auto-sim and fully watched match
innings/results to be identical for the same seed.

### 3. Different saves shared international background branches

AI tournament group results, tiebreaks, knockout opponents and WTC background
series used competition/year keys without the save identity. Different careers
could consequently receive the same international world path.

Those deterministic keys now include `save.id`. Replaying one save remains
deterministic; different saves no longer inherit a globally identical
background branch.

## Final Manager population

All 12 Managers started at age 35 and completed 25 seasons to age 60 on Normal.
The audit used canonical match settlement, neutral user preparation, no IAP and
no ad rewards.

| Measure | Final result |
| --- | ---: |
| Careers retired normally | 12/12 |
| Audit errors | 0 |
| National appointments | 10/12 (83.3%) |
| National appointment age | 42–55; 49.2 average |
| Average full-career win rate | 51.2% |
| Final reputation | 86–88; 87.1 average |
| Average stadium occupancy | 76.9% |
| Occupancy range | 73.0–79.1% |
| Negative-balance seasons | 0 |
| Final Club Balance | 217,314–1,861,313; 724,314 average |
| Final Manager Wallet | 117,232–142,668; 129,632 average |
| World titles | 47 across 108 National seasons |

### National match distribution

| Format | Matches | Wins | Losses | Draw/NR | Decisive win rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| ODI | 581 | 420 | 152 | 9 | 73.4% |
| T20 | 322 | 226 | 93 | 3 | 70.8% |
| Test | 229 | 87 | 97 | 45 | 47.3% |
| **All** | **1,132** | **733** | **342** | **57** | **68.2%** |

Same-tier peer results are no longer in the mid-70s: Australia finished at
63.5% decisive wins for the controlled side across 519 matches, and England at
65.9% across 91. Lower-strength nations remain legitimate easier opponents.

### Score environment

| Format | Average innings | Range |
| --- | ---: | ---: |
| ODI | 262.5 | 57–437 |
| T20 | 167.8 | 30–261 |
| Test innings | 199.7 | 10–389 |

The ODI mean remains below the earlier approximate 280 target. It was already
approximately 265 before this streak correction, so it is not a regression from
the tactics fix; it remains a separate tuning candidate.

## Player regression population

Four Batters, four Bowlers and four All-Rounders completed age 16–33 careers.
All 12 retired normally, earned a senior cap and produced no audit errors or
warnings.

| Role | Final OVR | Matches | Runs | Wickets | Training sessions | Coins spent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Batter | 84.5 avg (81–88) | 392 avg | 17,204 avg | 0 | 104.8 avg | 86,398 avg |
| Bowler | 89.3 avg (88–91) | 374 avg | 3,976 avg | 623 avg | 92.3 avg | 77,265 avg |
| All-Rounder | 88.0 avg (87–90) | 390 avg | 12,753 avg | 532 avg | 107.0 avg | 95,846 avg |

The roles remain differentiated and the corrected All-Rounder average stays at
the approved 87–88 target. Batter progression averages below the previously
discussed 88–92 engaged-free range and should be reviewed separately if that
range remains mandatory; it was also low in the pre-fix population and was not
caused by this Manager correction.

## Verification

Before the final population:

- TypeScript passed;
- ESLint passed with `--quiet`;
- 179 Jest suites passed;
- 1,016 tests passed;
- 2 snapshots passed.

The final retirement simulation then passed for all 24 careers with no audit
errors. Source artifact:

`test-artifacts/full-career-balance-national-tactics-final-24.json`

Preflight artifacts are retained for diagnosis but are not acceptance results:

- `test-artifacts/national-streak-manager-4-calibration.json`;
- `test-artifacts/national-streak-manager-4-max-parity.json`;
- `test-artifacts/national-streak-manager-4-live-tactics.json`;
- `test-artifacts/full-career-balance-national-fix-24.json`.

## Deferred work

Season Pass review was explicitly deferred and is not changed by this work.
