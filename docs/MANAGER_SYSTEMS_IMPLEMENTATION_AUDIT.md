# Sponsorship, Club Operations And Manager Systems Audit

Last verified against runtime source: 29 August 2026.

This document records what is implemented now, the exact balance values used by
the runtime, and the choices that remain deliberately held for approval. It does
not treat a product concept or an approved design direction as shipped unless the
current game path actually uses it.

## 1. Money boundaries

- Player sponsorship pays **Wallet Coins**.
- Manager sponsorship, ticket income, broadcast rights and prizes pay **Club
  Balance**.
- Wallet Coins, Gems and Energy do not become club money.
- Broadcast rights and kit sponsorship are separate income lines. The seasonal
  broadcast payment is `80,000 + (club reputation x 3,000)`. Kit-partner and
  gate payments are credited fixture by fixture and are not paid again at
  season rollover.
- Fixture sponsor and gate ledgers store fixture IDs, so replaying or reopening
  a result cannot pay the same fixture twice.
- Manager personal match rewards are `160/90/60` Wallet Coins for a win, tie or
  loss. The personal seasonal salary converts at one Wallet Coin per 400 salary
  units. These two faucets were halved after the full-career audit showed a
  non-spending Manager ending with an excessive Wallet balance.
- Club debt cannot fund transfers, staff, facilities, the ground or other Club
  Balance purchases. At season settlement, debt is capped at one season's
  broadcast-rights value. Any deeper overdraft triggers a visible board
  intervention, while ordinary debt costs six Board Confidence and intervention
  costs twelve. The Club Office balance and finance ledger remain synchronized.
- Once a club has an itemised season settlement, optional purchases preserve its
  committed operating reserve: active-squad wages, staff wages and complete
  infrastructure upkeep, minus guaranteed broadcast rights. New contract wages
  and new infrastructure upkeep are included before the purchase is accepted.

## 2. Earned Player kit partnership

The Player has one earned sponsor slot. It unlocks only after the first verified
selected-XI appearance in senior Domestic cricket. School, regional Under-19,
the Under-19 World Cup, senior international matches and games in which the
Player was not selected do not unlock it.

Once unlocked, three offers are guaranteed:

| Offer       | Eligible formats                | Total paid appearances | Domestic payout | Domestic signing bonus |
| ----------- | ------------------------------- | ---------------------: | --------------: | ---------------------: |
| All formats | T10, T20, Hundred, ODI and Test |                     16 |             110 |                    250 |
| White ball  | T10, T20, Hundred and ODI       |                     10 |             180 |                    250 |
| Red ball    | Test / First-Class              |                      6 |             300 |                    250 |

Rates scale once, when the offer is signed, and then remain fixed for that
contract:

| Signing stature | Qualification                                | Multiplier | All formats | White ball | Red ball | Signing bonus |
| --------------- | -------------------------------------------- | ---------: | ----------: | ---------: | -------: | ------------: |
| Domestic        | Uncapped, below 68 OVR                       |       1.00 |         110 |        180 |      300 |           250 |
| Franchise       | Uncapped and at least 68 OVR                 |       1.25 |         140 |        230 |      380 |           310 |
| International   | Capped, but not Icon                         |       1.60 |         180 |        290 |      480 |           400 |
| Icon            | Capped and either 40 caps or at least 82 OVR |       2.00 |         220 |        360 |      600 |           500 |

Scaled values are rounded to the nearest ten. Only a selected appearance in a
matching senior format pays. A contract closes when its total quota is reached
or after two season rollovers, whichever comes first. Only one offer can be
accepted in a season.

## 3. Earned Manager kit partnership

A non-National Manager has one earned sponsor slot and three guaranteed offers.
There is no signing bonus. All payments go directly to the managed club's
balance.

| Manager level | Offer       | Eligible formats          | Total fixtures | Per fixture | Win bonus |
| ------------- | ----------- | ------------------------- | -------------: | ----------: | --------: |
| Club          | All formats | All                       |             14 |      22,000 |         0 |
| Club          | T20         | T20 only                  |             10 |      32,000 |         0 |
| Club          | Results     | All                       |             14 |      14,000 |    18,000 |
| State         | All formats | All                       |             18 |      24,000 |         0 |
| State         | White ball  | T10, T20, Hundred and ODI |             14 |      32,000 |         0 |
| State         | Results     | All                       |             18 |      18,000 |    16,000 |
| Elite         | All formats | All                       |             20 |      28,000 |         0 |
| Elite         | T20         | T20 only                  |             12 |      46,000 |         0 |
| Elite         | Results     | All                       |             20 |      20,000 |    17,000 |

The contract closes at its quota or the next season rollover. A Results deal
pays its appearance amount for every eligible fixture and adds its win bonus
when the managed club wins.

The deal belongs to the club where it was signed. After a job move, that club
continues receiving its contract payments from simulated eligible fixtures until
the quota or season rollover ends the deal. It never follows the Manager. The new
club restores its own existing contract or receives its own three offers.

## 4. Permanent per-save sponsor products

The fulfillment and save-state foundation exists for two separate products:

- `player_save_sponsor` for one Player Career save.
- `manager_save_sponsor` for one Manager Career save.

Each purchase is permanently bound to the exact save that received it. It is not
account-wide, does not cover the other mode and does not grant the stipend to
another save.

The first qualifying completed fixture in each Monday-to-Monday UTC week pays
once. There is no missed-week catch-up. A Player must be selected in an eligible
senior official fixture. A Manager fixture must involve the managed club.
Under-19 fixtures never qualify, and Manager payments pause during a National
job.

| Current stature       | Player weekly Wallet Coins | Manager weekly Club Balance |
| --------------------- | -------------------------: | --------------------------: |
| Domestic / Club       |                        250 |                      30,000 |
| Franchise / State     |                        350 |                      40,000 |
| International / Elite |                        500 |                      55,000 |
| Player Icon           |                        650 |                           - |

The weekly amount uses the save's current stature when the qualifying fixture
is settled. Premium and earned sponsorship can both pay for the same fixture.

Both products use the approved INR 499 reference price and appear in the
relevant mode Store after ordinary sponsorship unlocks. They are configured in
code as repeat-purchasable consumables, not account-wide entitlements. Release
checkout remains disabled until an authenticated backend can verify the store
receipt and atomically bind its unique transaction to one exact save.

## 5. Sponsor presentation

The app has a dynamic `SponsorMark` presentation rather than modifying the 128
portrait files. It is connected to Player Life, the user Player Profile, the
Cosmetics preview, the Matchday presentation and the Manager Club Office.

The approved code-native brands are Boundary Works, Pulse XI, Longform and the
premium Legacy Crown. Small portrait surfaces receive clipped, dynamic chest
marks, while the kit preview renders earned centre-chest branding and the
premium upper-chest badge without modifying any of the 128 portrait files.
Manager and Matchday surfaces use the same active identities. Manager national
duty hides the retained domestic club marks.

## 6. Club-owned state and job changes

Save schema 36 stores the following by club ID:

- staff and recruitment candidates;
- Training Ground, Medical Centre and Youth Academy levels;
- academy prospects and next intake;
- scout reports and club finances;
- Manager training plan, individual overrides and development progress;
- home-ground levels, ticket presets, fan base and attendance ledger;
- earned sponsor offers, contract, fixture ledger and club income;
- captain and vice-captain appointments.

Before a job move, the current club state is persisted. The new club's own state
is then activated. Returning later restores that club's saved assets; facilities,
staff, academy, stadium, earned sponsorship and appointments do not travel with
the Manager. Existing sponsor contracts continue settling from simulated club
fixtures, but clubs do not autonomously sign new sponsors or buy facility or
stadium upgrades while the Manager is away.

Every Training Ground, Medical Centre and Youth Academy upgrade requires an
explicit payment method. Club Balance remains available whether or not a paid
token is owned. A stored `₹199` token is an optional shortcut: choosing it spends
one token and no club cash; choosing Club Balance spends the displayed cash cost
and preserves all tokens. Both choices are validated before mutation, never
fall back to each other, and normal seasonal facility upkeep still applies.

The standard State-to-Elite route remains a top-two Tier 2 T20 finish. A Manager
can also earn the appointment through at least six State seasons, reputation 73,
four domestic trophies and a 50% career win rate; a ten-season, six-trophy route
recognizes a longer decorated record. Winning the Elite First-Class title
remains the fastest National appointment. A sustained Elite record can also
qualify a Manager after three completed Elite seasons with reputation 73 plus
either a title or two top-two finishes; after five completed Elite seasons,
reputation 75 is sufficient. These are merit routes, not a hardcoded appointment
percentage. The rollover that earns the appointment still belongs to the Elite
club and settles that final club season once before it is applied. Every later full National season freezes the retained club: no club
prizes, broadcast, kit-sponsor rollover, wages/upkeep, contract tick, academy
intake, board verdict, pyramid movement, player development/reset or training
block is applied to it. The next National calendar is still built and the
domestic tables are preserved. Returning to club management therefore restores
the retained club at the state in which it was left.

National eligibility does not depend on holding a domestic club contract.
Every National calendar refresh uses active players below age 40 and creates a
season-specific replacement pool whenever a country's eligible population
falls below eleven. This keeps every opponent playable through the complete
age-35-to-60 Manager span. Separately, domestic contract expiry cannot reduce a
managed club below eleven active players: the final eleven receive a one-year
emergency extension at their existing wage when required.

## 7. Home ground, attendance and tickets

The Home Ground screen is reached from Club Office. It exposes the club's
balance, capacity, fan base, average attendance/occupancy, current-season gate
receipts, two upgrade tracks, format ticket presets, a next-home forecast and
the five most recent crowds.

### 7.1 Capacity

| Level | Capacity | Upgrade to this level | Seasonal upkeep |
| ----: | -------: | --------------------: | --------------: |
|     1 |    8,000 |                     - |          60,000 |
|     2 |   12,000 |               600,000 |          90,000 |
|     3 |   18,000 |             1,200,000 |         135,000 |
|     4 |   28,000 |             2,400,000 |         210,000 |
|     5 |   42,000 |             4,500,000 |         320,000 |

New Tier 3, Tier 2 and Tier 1 clubs start at Capacity levels 1, 2 and 3
respectively.

### 7.2 Matchday Experience

| Level | Name                | Demand | Spend per fan | Upgrade to this level | Seasonal upkeep |
| ----: | ------------------- | -----: | ------------: | --------------------: | --------------: |
|     1 | Essentials          |     0% |             0 |                     - |               0 |
|     2 | Fan Zone            |    +4% |             2 |               250,000 |          15,000 |
|     3 | Hospitality         |    +8% |             4 |               500,000 |          30,000 |
|     4 | Premium Stands      |   +12% |             7 |             1,000,000 |          55,000 |
|     5 | Landmark Experience |   +16% |            10 |             1,800,000 |          90,000 |

Capacity upkeep and Matchday Experience upkeep are added together.

### 7.3 Ticket prices

| Format group         | Low | Standard | Premium |
| -------------------- | --: | -------: | ------: |
| T10, T20 and Hundred |  14 |       20 |      28 |
| ODI / List A         |  11 |       16 |      22 |
| Test / First-Class   |   8 |       12 |      17 |

Low, Standard and Premium multiply ticket demand by `1.15`, `1.00` and `0.70`
respectively. Short-format, ODI and Test demand multipliers are `1.15`, `0.92`
and `0.70`. Opponent reputation, recent form, derby status, fan base and
Matchday Experience also affect the projection.

Regular occupancy is bounded by the chosen preset: Low `70-80%`, Standard
`65-75%` and Premium `60-68%`. Higher prices therefore trade crowd size for
yield even when the fan base exceeds capacity. Home knockout fixtures receive
`1.35x` demand with a 90% capacity floor. Finals use a neutral ground at 92%
occupancy, Standard pricing and a 25% finalist share of
distributable receipts. Ordinary home net receipts are:

`attendance x (ticket price + ancillary spend) x 0.78`

Away league fixtures do not pay a gate. Completed gates are credited once and
reconciled from the exact fixture ledger in the season statement. Fan-base
movement is bounded from -8% to +12% per season. The persistent club-ground
name and current capacity are used for Manager home-fixture presentation.

Home-ground controls and gate settlement are unavailable during a National job.

## 8. Automatic Manager training and readiness

Manager training has no Wallet Coin or Club Balance cost. A club stores one
team focus and optional per-player overrides. The plan runs through the shared
post-result path for watched, instant and background Manager fixtures, and each
fixture can create only one development/recovery block.

| Focus    | Development allocation                                            |
| -------- | ----------------------------------------------------------------- |
| Balanced | 50% role skills, 20% fielding, 15% fitness, 15% mental            |
| Batting  | 70% batting, 15% fielding, 15% fitness                            |
| Bowling  | 70% bowling, 15% fielding, 15% fitness                            |
| Fielding | 70% fielding, 15% role skills, 15% fitness                        |
| Fitness  | 60% fitness, 20% stamina/agility, 20% discipline                  |
| Recovery | No development; restore condition and remove training-injury risk |

| Intensity | Base development points | Base condition recovery | Base training-injury chance |
| --------- | ----------------------: | ----------------------: | --------------------------: |
| Light     |                    0.16 |                      +7 |                          0% |
| Normal    |                    0.25 |                      +5 |                       0.08% |
| High      |                    0.36 |                      +2 |                       0.30% |

Recovery focus restores `+10` condition before the Medical Centre/physio bonus.
A player below 45 condition is automatically treated as Recovery; a player from
45 to 54 condition develops at half rate. Age, potential headroom, Training
Ground level and coaching quality scale development. Each selected bucket feeds
the two weakest valid attributes in a 60/40 split, and accumulated fractions are
retained until a full attribute point is earned. Growth cannot push effective
OVR beyond potential plus three or any attribute above 99.

Regular-season development is capped at 28 blocks per club season. Playoffs
still recover condition but do not add development. The actual resolved XI is
used for match load, including players who did not bat or bowl, while the bench
receives the between-fixture recovery. Existing injuries count down once per
club fixture.

Manager match readiness is now a continuous temporary match modifier rather
than a condition/morale cliff:

- condition multiplier:
  `max(0.88, 1 - max(0, 70 - condition) x 0.003)`;
- morale multiplier:
  `1 + clamp((morale - 50) x 0.001, -0.03, +0.03)`;
- confirmed Match Preparation adds `1.10x` to the controlled side.

The condition and morale curve applies symmetrically to the user and AI sides.
It scales cloned match ratings only and does not rewrite saved attributes or
OVR. National-camp training is currently unavailable and the stored domestic
club plan is left unchanged.

Manager ODI innings use a symmetric `0.86x` scoring environment for both teams
in Instant Sim, Key Moments and Watch Match. It is calibrated to move the prior
327-run audit mean toward 280 without changing Player Career ODI scoring or
either side's relative strength; the full audit still needs to be rerun.

### 8.1 Personal Manager reputation

Personal reputation is recalculated from experience, win rate, trophies and
career level. Earned progression is capped at 88; sustained successful free
careers therefore finish around 87-88 rather than being stuck at 66. Completed
match-reward ads can add up to three points, at one point per 15 ads, while
recorded premium assistance can add up to eight further points. The combined
cap is 99. Club reputation remains a separate, club-owned value.

## 9. Captain and vice-captain

A new club receives distinct sensible defaults once and asks the Manager to
review them. The Manager can appoint either role from Team Leadership; Squad
rows display `C` and `VC`. If a leader leaves, the slot is cleared and review is
requested instead of silently appointing a replacement.

Leadership score is based on 35% discipline, 25% batting temperament, 20%
confidence and 20% age/match experience. It creates a small match-only pressure
effect:

| Leadership score | Bonus |
| ---------------: | ----: |
|         Below 55 |    0% |
|            55-69 |  0.5% |
|            70-84 |  1.0% |
|              85+ |  1.5% |

A selected vice-captain with at least 70 Leadership adds 0.25 percentage points
to the selected captain, capped at 1.75%. If the captain misses the XI, the
vice-captain leads with their own bonus. An emergency XI captain receives no
bonus. Leadership never changes stored OVR or attributes. National-team
leadership is currently unavailable pending policy.

## 10. Manager Home and Club Office information architecture

Manager Home is the action dashboard. It keeps the career spotlight, exactly
one resolver-owned Continue action, the current competition/next fixture,
Squad/Training/Transfers shortcuts, Board Confidence and the compact Objectives
& Pass card. The duplicate Club Balance, duplicate win-streak presentation,
duplicate top-of-table callout, full league table and recovery purchase are not
part of Home. Detailed manager-level progression, unlocked formats and the ICC
calendar live in Records.

Club Office owns the club-management information: Kit Partnership, prominent
Training Ground/Medical Centre/Youth Academy cards, the Home Ground entry,
Club Balance, wage/upkeep summary, resource desk, coaching
staff, expiring contracts and treatment room. Stadium capacity, Matchday
Experience, ticket strategy, projections and attendance history have their own
Home Ground screen instead of being hidden inside a small facility row.

Medical Centre has its own screen reached from the infrastructure card. It owns
the squad recovery-token purchase, preview, confirmation and application flow,
plus facility effect, readiness, injury and low-condition summaries. The feature
and its existing values/cooldown are unchanged; only its placement moved from
Manager Home. It and the underlying state action are frozen during National duty.

## 11. Held decisions and current safe behavior

These items require explicit approval before their behavior or public copy is
changed:

1. **Premium sponsor backend.** INR 499 is approved. Production checkout stays
   gated until server-owned receipt verification, unique transaction-to-save
   binding, refund handling and same-save recovery are deployed.
2. **National training and leadership.** Decide whether a National Manager gets
   neutral national-camp training/leadership controls or waits until returning
   to a club. Current screens disable both and retain the club state.
3. **Preparation stacking cap.** At full morale and healthy condition, the
   current `1.10x` Match Preparation effect can combine to `1.133x` before each
   rating is clamped to 99. No separate aggregate cap has been approved.
