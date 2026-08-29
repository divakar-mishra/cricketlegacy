# All-Rounder, National Manager And Club Debt Correction Audit

> **Superseded for National Manager balance.** The strength-tier comparison in
> this report did not prove actual late-career XI parity, and the live match
> path was not applying AI tactics. Use
> `NATIONAL_MANAGER_STREAK_CORRECTION_AUDIT_2026-08-29.md` for the corrected
> 12-Player/12-Manager evidence. The All-Rounder and club-debt sections remain
> historical evidence for their respective changes.

Verified 29 August 2026 against the canonical career simulator.

This follow-up closes the three balancing priorities exposed by
`FULL_CAREER_SIMULATION_AUDIT_24_RUNS.md`. It preserves that report and its JSON
as the before-state evidence instead of replacing them.

## Accepted outcomes

| Area | Before | Final evidence | Result |
| --- | ---: | ---: | --- |
| All-Rounder retirement OVR | 83.25 average, 81–85 | 87.50 average, 86–89 | Approved 87–88 average reached |
| National Manager decisive wins | 96.4% overall | 79.1% overall; 73.7% against strength-five peers | Peer balance is inside the approved 65–75% range |
| Domestic Manager decisive wins | 49.6% | 51.3% | Neutral domestic balance preserved |
| National appointment | 9/12 before the balance pass; 6/12 after the first reserve-only correction | 12/12 earned the appointment; 11/12 managed at least one National season | Majority access restored through merit, not a percentage roll |
| Careers ending in debt | 8/12 | 0/12 | Corrected |
| Careers with any negative-balance season | Not previously separated | 0/12 | Corrected |
| Average ending Club Balance | -73,730 | 818,743 | Sustainable |
| Ending Club Balance range | Included eight negative endings | 313,153–1,202,530 | No insolvency and no unlimited cash result |

## 1. All-Rounder progression

The old path applied both the All-Rounder's dual-discipline allowance and a
`0.90` workload factor. The compounded reduction put the role below both
specialists even when the audit spent virtually every affordable earned coin on
training.

The workload factor is now `0.98`. Every valid session still visibly raises an
attribute; there is no hidden dead session, artificial end-career OVR assignment
or role-specific retirement bonus.

| Seed | Start→end OVR | Sessions | Coins spent | Runs | Wickets |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 83003 | 26→88 | 105 | 91,018 | 11,779 | 591 |
| 93006 | 26→87 | 103 | 90,643 | 12,255 | 602 |
| 103009 | 26→89 | 108 | 99,906 | 14,031 | 516 |
| 113012 | 26→86 | 104 | 86,856 | 12,995 | 570 |

Average retirement OVR is `87.50`; the range is `86–89`. All four careers
retired normally with no errors or warnings.

## 2. National Manager difficulty

The match engine remains neutral on Normal. The correction is in the world it
simulates:

1. International calendars are seeded by the explicit country-strength model,
   not by raw player-pool size. Repeated reserve refreshes can no longer make a
   small country's object count turn it into the default tour or knockout seed.
2. A national pool refreshes when it has fewer than eleven active under-40
   players or its best XI falls below its country standard.
3. During a National Manager career, generated opponents follow the controlled
   country's current generation. Equal-strength peers receive an equal target;
   each country-strength tier creates a two-OVR target gap.
4. Generated technical, fielding, fitness, confidence and discipline attributes
   can rise to meet that target. Temporary form and aggression are not inflated.

Final 12-career population:

| Sample | Matches | Wins | Losses | Draw/NR | Decisive win rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| All National fixtures | 1,257 | 926 | 245 | 86 | 79.1% |
| Strength-five peers | 653 | 459 | 164 | 30 | 73.7% |
| Australia only | 560 | 391 | 139 | 30 | 73.8% |
| Domestic Manager fixtures | 4,456 | 2,218 | 2,104 | 134 | 51.3% |

The overall National number is higher because India should remain favoured
against lower-strength countries. The equal-strength figure is the relevant
Normal-difficulty acceptance measure. The 12 careers won 76 world titles across
118 National seasons, compared with 96 titles in the original easier sample.

## 3. Merit-based National access

The first finance correction exposed a separate progression bottleneck: only
6/12 engaged careers reached National duty. The standard top-two Tier 2 T20
route remains unchanged, but a professional manager can now earn Elite status
through a broader record:

- at least six completed State seasons;
- reputation 73 or higher;
- at least four domestic trophies; and
- at least a 50% career win rate.

A ten-season, six-trophy route recognizes a longer decorated career. Existing
Elite-to-National gates remain unchanged. There is no random appointment chance
and no hardcoded 70% population outcome.

Appointments in the final seeds occurred at ages:
`46, 52, 44, 45, 48, 55, 54, 60, 47, 52, 48, 51`.
Eleven managers had time to lead National fixtures; the age-60 appointment was
earned at the final rollover and remains evidence of meaningful timing spread.

## 4. Club debt frequency

Debt limits and Board Confidence consequences remain as the last-resort safety
net. The primary correction now happens before an optional purchase.

After the first itemised settlement, the club preserves an operating reserve
for:

- active-squad annual wages;
- current staff wages;
- facility and stadium upkeep; and
- any new wage or upkeep commitment created by the proposed transaction.

Guaranteed broadcast rights reduce the amount that must be held. Transfers,
renewals, free agents, loans, scouting, staff investment, cash facility upgrades
and stadium upgrades all use the same guard. A paid facility token remains an
independent payment route, but the upgraded facility's later upkeep is still a
real club commitment.

Across 300 Manager seasons in the final run:

- zero careers ended below zero;
- zero careers had any negative-balance season;
- average ending Club Balance was 818,743;
- the minimum was 313,153; and
- the maximum was 1,202,530.

## 5. Reproducible evidence

- Before state: `test-artifacts/full-career-audit-4x-player-12x-manager-2026-08-29.json`
- Final All-Rounder sample: `test-artifacts/calibration-allrounder-4-final.json`
- First Manager correction, before the merit route:
  `test-artifacts/balance-correction-manager-12-final.json`
- Final Manager population:
  `test-artifacts/balance-correction-manager-12-final-v2.json`

Focused regression coverage includes All-Rounder stochastic gain scaling,
ageing national-squad replenishment, late-career peer parity, country-strength
tournament seeding, operating-reserve purchase rejection and sustained State
merit promotion.

## 6. Verification gate

- Focused correction suites: 57/57 passed.
- Canonical All-Rounder retirement sample: 4/4 completed.
- Canonical Manager retirement population: 12/12 completed across 300 seasons.
- TypeScript: passed.
- ESLint (`--quiet`): passed.
- Full Jest repository: 179/179 suites, 1,014/1,014 tests and 2/2 snapshots
  passed.
- `git diff --check`: passed for the complete worktree and the correction file
  set.
