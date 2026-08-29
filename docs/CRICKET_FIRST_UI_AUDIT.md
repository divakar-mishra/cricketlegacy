# Cricket-First UI/UX Audit

Status: proposal only. No runtime UI or gameplay behavior is changed by this document.

## Objective

Cricket Legacy must remain recognizable as a cricket game when its logo and screen
title are hidden. Data-heavy management remains important, but cricket context—not
generic cards, wallets or KPI dashboards—must provide the visual hierarchy.

The five-second test for every core screen is:

> If a player sees this screen without the Cricket Legacy logo, do they immediately
> identify cricket, the current place, and the next cricket decision?

## Current design-system finding

The current `Screen` and `Card` primitives are reliable and accessible, but they
make very different places look alike. A club office, training ground, stadium,
medical room, dressing room and store repeatedly become a dark rectangular card
containing labels, values, progress bars and green actions.

The dark background, emerald accent, financial values, percentage meters and dense
rows are individually reasonable. Together, when reused across most routes, they
create the same visual grammar as a finance, analytics or fitness application.

The solution is not to remove statistics. It is to place statistics inside a
recognizable cricket object or place: a scoreboard, team sheet, coach's board,
ground plan, contract sheet, scorebook, kit, newspaper or fixture ticket.

## Surface audit

Scores use 1 (weak) to 5 (strong). Fintech risk is reversed: 5 is the highest risk.

| Surface                              | Cricket identity | Fintech risk | Density | Decision                                                     |
| ------------------------------------ | ---------------: | -----------: | ------: | ------------------------------------------------------------ |
| Matchday/live innings                |                5 |            1 |       4 | Preserve; polish presentation only                           |
| Newspaper, milestones, awards        |                5 |            1 |       2 | Preserve as a signature identity                             |
| Player creation and portraits        |                4 |            1 |       3 | Add a clearer kit/crest context                              |
| U19 World Cup and competition tables |                4 |            2 |       4 | Keep bracket/scoreboard language                             |
| Career Home                          |                4 |            2 |       4 | Reduce card stacking; strengthen fixture scene               |
| Manager Home                         |                3 |            4 |       3 | Replace KPI/board meter language with matchday desk          |
| Squad and tactics                    |                3 |            3 |       4 | Convert list into a team sheet/dressing-room board           |
| Records and calendar                 |                3 |            3 |       5 | Use scorebook, season ribbon and trophy cabinet              |
| Club Office                          |                2 |            5 |       4 | Rebuild as a place with an operations desk                   |
| Stadium and tickets                  |                2 |            5 |       4 | Replace finance cards with a visual ground plan              |
| Manager Training                     |                2 |            4 |       4 | Replace fitness-app tiles with a coach's session board       |
| Leadership                           |                2 |            4 |       3 | Use shirts/locker positions and an XI leadership board       |
| Medical Centre                       |                2 |            4 |       4 | Use treatment-room/readiness presentation                    |
| Academy                              |                3 |            3 |       4 | Use nets/intake and prospect scouting presentation           |
| Sponsorship                          |                2 |            5 |       4 | Lead with the kit; make contract economics secondary         |
| Store                                |                1 |            5 |       4 | Style as a cricket pavilion/shop; isolate checkout facts     |
| Season Pass                          |                2 |            4 |       5 | Recast as a monthly cricket tour/trophy trail                |
| Player Life finance/investments      |                1 |            5 |       5 | Finance styling is appropriate here, but must stay contained |
| Settings, account and legal          |                1 |            3 |       3 | Generic utility UI is acceptable outside the game fantasy    |

## Approved visual direction proposed for review

### 1. Keep the dark premium identity, change what green means

- Keep charcoal/night backgrounds and warm trophy gold.
- Use grass green for pitch, availability and success—not as the universal action
  and money color.
- Use leather red for urgent match action, ball states and competitive emphasis.
- Use cricket white/cream for scorecards, team sheets, contracts and record pages.
- Let club/team colors provide controlled accents in Manager and Matchday surfaces.

This distinguishes Cricket Legacy from a neon-green financial dashboard without
requiring an unrelated visual rebrand.

### 2. Give every system a physical cricket metaphor

| System           | Primary visual metaphor                                 |
| ---------------- | ------------------------------------------------------- |
| Home/next action | Match ticket and stadium scoreboard                     |
| Squad/tactics    | Dressing-room team sheet and pitch map                  |
| Training         | Coach's whiteboard, nets and session cones              |
| Medical          | Physio treatment board and availability list            |
| Stadium          | Ground bowl/cutaway with stands and crowd occupancy     |
| Tickets          | Match ticket stubs plus crowd/revenue forecast          |
| Sponsorship      | Front/back jersey preview and signed contract sheet     |
| Club Office      | Operations desk, infrastructure plan and ledger         |
| Academy          | Nets, intake board and scout cards                      |
| Records          | Scorebook, trophy cabinet and season ribbon             |
| Season Pass      | Monthly tour itinerary and trophy path                  |
| Store            | Pavilion shop/kit room with a restrained checkout sheet |

### 3. Replace one universal card with contextual shells

The existing `Card` remains for utility and fallback content. Core gameplay gains
reusable shells:

- `FixtureBoard`: teams, crests, format, venue, time and one next action.
- `ScoreboardStrip`: cricket score/form/season context, never a wallet KPI.
- `TeamSheet`: numbered XI, role marks, C/VC, condition and selection state.
- `CoachBoard`: pitch/whiteboard surface for tactics and training choices.
- `GroundPlan`: stadium stands, capacity, crowd fill and upgrade zones.
- `ContractSheet`: sponsor identity, obligation, expiry and payout details.
- `ScorebookPage`: records, tables, milestones and season history.
- `CricketScene`: contextual header/background with a strict contrast overlay.

All of these remain code-native, theme-aware, compact-screen safe and accessible.

## High-impact screen proposals

### Manager Home: matchday desk

Current risk: identity, Continue, competition, Board Confidence, navigation and
objectives still read as stacked modules.

Proposed order:

1. Club crest/name, manager role and sponsor lockup.
2. A single scoreboard-style next-fixture hero with venue and competition.
3. Compact form and availability strip.
4. Dressing-room actions: Squad, Training and Transfers.
5. A clipped board memo: objective and qualitative confidence (`Secure`,
   `Watching`, `Ultimatum`) instead of a finance-like percentage meter.
6. One compact objectives/pass ticket.

No budget, wages, gate or sponsor income returns to Home.

### Stadium: see the ground before the money

Current risk: attendance, occupancy, capacity, experience and gate income are a
series of statistical cards.

Proposed layout:

1. A code-native ground bowl with four stands and occupancy fill.
2. Ground name, current capacity and recent crowd over the ground illustration.
3. Two tappable zones: `Expand stands` and `Improve matchday`.
4. Ticket presets shown as physical ticket stubs per format.
5. Next-home forecast shown as a fixture poster with projected crowd first and
   projected gate second.
6. Recent crowds shown as fixture receipts/scoreboard rows.

The approved price-demand formula and all economy behavior remain unchanged.

### Manager Training: coach's session board

Current risk: a grid of focus cards plus Light/Normal/High segments resembles a
workout tracker.

Proposed layout:

1. Training-ground scene and `Next session` status.
2. A coach's whiteboard/pitch showing the selected focus.
3. Focus choices as session markers around the pitch—not independent KPI cards.
4. Intensity shown as session duration/load with plain fatigue/injury consequences.
5. Player overrides shown with portrait, shirt number and current drill.
6. A post-fixture session report showing who developed or recovered.

The six plans, intensity balance and automatic processing remain unchanged.

### Club Office: operations room

Current risk: even after decluttering, infrastructure and finance still share the
same generic card hierarchy.

Proposed layout:

1. Compact office/boardroom scene with club identity.
2. A visible club operations plan: Training Ground, Medical, Academy and Stadium
   as places, each with one status and one Manage action.
3. Sponsorship as a jersey/partner panel.
4. Staff as a coaching-room panel.
5. Finance and Wage Ledger as a deliberate paper ledger deeper in the screen.

The explicit club-cash versus optional token choice remains untouched.

### Squad and Leadership: dressing-room board

- XI displayed on a pitch/team sheet before the bench list.
- Player rows gain shirt number, role mark and kit-color accent.
- Captain and vice-captain occupy visible locker/header positions.
- Leadership score is translated to a short cricket descriptor; raw detail remains
  available through the information control.
- Drag/reorder and accessibility behavior remain intact.

### Sponsorship: kit first, contract second

- Full code-native jersey preview is the hero.
- Earned sponsor appears on centre chest; permanent sponsor uses its approved
  smaller chest patch.
- Three offers look like competing kit presentations, not investment products.
- Obligations, expiry and payout appear on a contract sheet below the kit.
- Player payouts still use Wallet Coins; Manager payouts still use Club Balance.

### Store and Season Pass

Store:

- Pavilion/kit-room identity and cricket-object product categories.
- Currency remains visible only where purchase decisions require it.
- Checkout price, permanence, restore rules and legal disclosures stay plain and
  unambiguous; sporting decoration must not obscure paid terms.

Season Pass:

- Monthly cricket-tour header and trophy route through 20 stops.
- Tier rows become a vertical fixture/tour itinerary with earned kit/equipment.
- Free/Premium/Claimed/Ready states and all existing claim logic remain identical.

## What must not change

- No economy, reward, match, progression or simulation changes are part of this
  visual redesign.
- No real clubs, competitions, sponsors or trademarks are introduced.
- No cricket imagery may reduce text contrast or compact-phone usability.
- Financial and purchase facts remain explicit; visual theming cannot disguise cost.
- Light theme remains supported rather than becoming a dark-only afterthought.
- Screen reader labels, touch targets, reduced-motion behavior and sticky footers
  remain regression requirements.

## Implementation sequence after approval

### Phase 1: shared language and highest-risk manager screens

- Add contextual shells and cricket color roles.
- Redesign Manager Home, Stadium, Training and Club Office.
- Verify Pixel-width layouts, light/dark themes and navigation parity.

### Phase 2: team operations

- Squad, Leadership, Medical Centre, Academy and Sponsorship.
- Add dynamic jersey/kit presentation without changing portrait JPEGs.

### Phase 3: progression and commerce

- Career Home, Records, Season Pass and Store.
- Keep legal and purchase disclosures structurally isolated and testable.

### Phase 4: polish and identity QA

- Contextual transitions, restrained crowd/paper/kit motion and existing audio cues.
- Five-second recognition tests for every core route.
- Physical Android screenshots at compact and Pixel 8 Pro widths.
- Side-by-side originality review against known cricket-management competitors.

## Approval questions before runtime implementation

1. Approve retaining charcoal/night + gold, while limiting emerald and adding
   leather red/cricket white as contextual colors.
2. Approve the physical-metaphor system and contextual shells.
3. Approve the four-phase order, beginning with Manager Home, Stadium, Training
   and Club Office.
4. Approve replacing numeric Board Confidence on Home with a qualitative board
   memo while keeping exact values in Records/Club detail.
5. Approve a code-native stadium bowl, coach board and jersey preview rather than
   photographic backgrounds on every screen.
