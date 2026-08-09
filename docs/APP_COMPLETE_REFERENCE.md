# Cricket Legacy - Complete App Reference

Last audited: 30 July 2026

This document describes the current source implementation in `D:\APP`. It is a
code-backed product reference, not a pitch deck. It separates:

- **Active**: reachable in the current user interface and connected to state.
- **Implemented helper**: code exists, but the normal UI does not currently
  call or expose it.
- **Known limitation**: behavior or copy that is incomplete, disabled, or
  inconsistent with another part of the app.

Secrets, private keys, environment-variable values and store credentials are
deliberately excluded. The visual companion document is
[`UI_UX_COMPLETE_SPEC.md`](./UI_UX_COMPLETE_SPEC.md).

## 1. Product Snapshot

| Item                       | Current implementation                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name               | Cricket Legacy                                                                                                                              |
| Main promise               | A fictional cricket career and management simulation with persistent saves, progression, live matches, records and long-term legacy systems |
| Play modes                 | Player Career and Manager Career                                                                                                            |
| Framework                  | Expo `~57.0.2`, React Native `0.86.0`, React `19.2.3`                                                                                       |
| Runtime                    | Hermes with React Native New Architecture enabled                                                                                           |
| Navigation                 | React Navigation native stack                                                                                                               |
| State                      | Zustand plus deterministic pure game-engine modules                                                                                         |
| Persistence                | AsyncStorage save envelopes with checksums, backups and schema migrations                                                                   |
| Android package            | `com.coverdrive.cricket`                                                                                                                    |
| Android version code       | `1`                                                                                                                                         |
| iOS build number           | `1`                                                                                                                                         |
| Orientation                | Uses Expo's default orientation behavior                                                                                                    |
| Deep-link scheme           | `coverdrive`                                                                                                                                |
| Monetization               | RevenueCat IAP abstraction, AdMob rewarded/interstitial abstraction, coins, gems, energy and a 30-day pass                                  |
| Supported language setting | English; Hindi covers only selected app chrome                                                                                              |
| Themes                     | Dark, Light and System                                                                                                                      |
| Graphics choices           | Low, Medium and High                                                                                                                        |
| Save capacity              | Five standard slots per mode, with a sixth slot while any listed save has an active pass                                                    |

The app uses fictional clubs and grounds. Player Career and Manager Career use
separate club-name pools on purpose, while both adapt names to the country
selected at career creation.

## 2. App Startup And Global Flow

### 2.1 Startup sequence

1. The native splash is shown while Sora and Inter fonts load.
2. The app installs its error boundary, global JavaScript error handler and
   local crash breadcrumbs.
3. Settings are hydrated and the theme, sound, music, haptics and notification
   preferences become active.
4. RevenueCat and AdMob are configured.
5. The foreground notification listener and ambient music synchronization are
   started.
6. An `APP_OPEN` analytics event is written to the local analytics buffer.
7. The Splash route checks the daily online session gate.
8. The player reaches Main Menu.
9. On first launch, a five-page onboarding sequence appears. It can later be
   replayed from Settings.

The root stack hides native headers because every screen owns its own heading
and safe-area treatment. Most routes use a horizontal slide transition;
ceremonies and full-screen moments use route-specific fades or bottom-entry
transitions.

### 2.2 Daily session gate

- A stable local guest identity is created if no account exists.
- The first daily verification requires an online connection.
- A successful check permits offline play for the next 24 hours.
- With valid Supabase configuration, the server RPC records the verification.
  Without it, the app records an online local verification.
- A backward clock change beyond the five-minute tolerance invalidates the
  cached window.
- If NetInfo is unavailable, connectivity is treated optimistically.

This gate is separate from the seven-day daily-reward streak.

### 2.3 Registered routes

There are 42 registered destinations:

`Splash`, `MainMenu`, `NewGame`, `PlayerCreation`, `TeamSelect`, `Match`,
`SavedGames`, `Settings`, `CricketAcademy`, `Login`, `Purchase`, `CareerHub`,
`ManagerHub`, `Training`, `Squad`, `Transfers`, `PlayerProfile`, `Records`,
`Narrative`, `ClubOffice`, `Academy`, `Press`, `SeasonPass`,
`PremiumClubhouse`, `LeagueEditor`, `StaffRecruitment`, `AwardsNight`,
`MilestoneCinematic`, `PlayerCosmetics`, `NotificationInbox`,
`DailyChallenge`, `BoardMeeting`, `HallOfFameCeremony`, `InjuryReport`,
`TransferDeadlineDay`, `YouthGraduateCeremony`, `InvestmentScreen`,
`AcademyManagement`, `U19WorldCup`, `InternationalCalendar`,
`WageBreakdown`, and `ContractNegotiation`.

## 3. Visual Design System

### 3.1 Dark palette

| Token               | Value              | Typical use                        |
| ------------------- | ------------------ | ---------------------------------- |
| Background          | `#07080C`          | App canvas                         |
| Elevated background | `#0C0E15`          | Raised sections                    |
| Surface             | `#10131E`          | Cards and controls                 |
| Alternate surface   | `#171C2A`          | Selected or secondary panels       |
| Muted surface       | `#090B12`          | Low-emphasis bands                 |
| Primary             | `#00C97A`          | Main actions and positive progress |
| Primary dark        | `#00A364`          | Pressed/deeper green               |
| Primary light       | `#33D993`          | Highlights                         |
| Accent              | `#E8B332`          | Premium, trophies and emphasis     |
| Accent dark         | `#C4902A`          | Deep gold                          |
| Accent light        | `#F5CF65`          | Gold highlight                     |
| Main text           | `#ECEFF4`          | Primary copy                       |
| Muted text          | `#7A8899`          | Explanatory copy                   |
| Faint text          | `#40505E`          | Tertiary metadata                  |
| Danger              | `#E5484D`          | Loss, injury and destructive state |
| Warning             | `#F5A524`          | Workload and caution               |
| Success             | `#30D070`          | Completed or won state             |
| Info                | `#4C9AFF`          | Informational state                |
| Border              | `#1A2035`          | Standard dividers                  |
| Strong border       | `#242E45`          | Selected/high-emphasis outlines    |
| Modal overlay       | `rgba(0,0,0,0.70)` | Dark backdrop                      |

### 3.2 Light palette

| Token             | Value              |
| ----------------- | ------------------ |
| Background        | `#F3F7F4`          |
| Elevated/surface  | `#FFFFFF`          |
| Alternate surface | `#E7F0EA`          |
| Muted surface     | `#EDF3EF`          |
| Primary           | `#009B5E`          |
| Primary dark      | `#007547`          |
| Primary light     | `#00B86E`          |
| Accent            | `#B67B0B`          |
| Accent dark       | `#8A5D08`          |
| Accent light      | `#D69A28`          |
| Main text         | `#0E1B13`          |
| Muted text        | `#4C5F54`          |
| Faint text        | `#7C8B82`          |
| Danger            | `#C4362B`          |
| Warning           | `#B26A00`          |
| Success           | `#1F8A4C`          |
| Info              | `#2A6FD6`          |
| Border            | `#D3DFD8`          |
| Strong border     | `#B4C7BB`          |
| Modal overlay     | `rgba(0,0,0,0.35)` |

### 3.3 Typography and spacing

- Headings use Sora at weights 600, 700 and 800.
- Body copy uses Inter at weights 400, 500, 600 and 700.
- Standard font sizes are 11, 13, 15, 18, 22, 28, 36 and 46.
- Standard spacing increments are 4, 8, 12, 16, 24, 32 and 48.
- Standard radii are 8, 12, 16 and 24, with `999` used only for circular or
  pill-like status treatments.
- Heading/scoreboard scaling is capped at 1.2x where fixed geometry could
  otherwise break. Body text still follows screen-specific Dynamic Type rules.

### 3.4 Responsive layout

- Shared screens read safe-area insets and keep action footers as normal flex
  siblings below the scroll viewport.
- Horizontal padding is approximately 4.5% of viewport width, clamped to
  12-24 dp.
- Normal content is constrained to a maximum width of 980 dp on large screens.
- A compact breakpoint at 380 dp reduces gaps and changes multi-column layouts.
- Boards, score areas, icon controls and fixed-format tiles use explicit
  dimensions or aspect ratios to prevent text and hover/press state reflow.
- Action footers use `flexShrink: 0`, include the bottom safe area and never
  absolutely cover scroll content. The final card ends before the footer begins
  without runtime height measurement or a guessed spacer.
- Long rows wrap, truncate or switch to stacked layouts based on available
  width.

The shared footer and modular-avatar flows were audited on an Android emulator
at effective 360x800, 390x844, 412x915, 768x1024, 915x412 landscape and
1024x768 tablet viewports. Every avatar control remained reachable and the
scroll viewport ended before the active action footer. This does not replace a
full physical-device audit of every screen and unusual aspect ratio.

### 3.5 Shared controls

- Buttons use 40, 52 or 60 dp heights depending on density and importance.
- Press feedback scales to `0.96` and opacity `0.88` over 80 ms, recovering over
  120 ms.
- Buttons trigger the shared glass-tap sound and selection haptic when enabled.
- Cards are restrained surfaces, generally 8-16 dp radius, with borders and
  minimal elevation.
- Familiar commands use vector icons from the enabled icon library.
- Selection controls expose selected/disabled state and use border, color and
  icon changes rather than color alone.
- Glass surfaces use `expo-blur`; Android receives true backdrop blur on SDK 31
  and later, while earlier devices keep translucent layers and gradients.
- The global modal queue prioritizes critical messages, then engagement
  moments, then prompts, with a three-second gap between queued items.

### 3.6 Motion

| Element                | Current motion                                    |
| ---------------------- | ------------------------------------------------- |
| Section/list entrance  | `FadeInDown`, usually 220-420 ms                  |
| Staggered lists        | 20-80 ms per row, capped for long lists           |
| Progress fill          | 480 ms                                            |
| Count-up number        | 350 ms cubic ease-out                             |
| Skeleton               | 800 ms repeating opacity pulse                    |
| Fluid text             | 34 ms word/character stagger, maximum 1.4 seconds |
| New 1x commentary      | 14 ms per-character typewriter                    |
| High-quality spotlight | 4.6-second loop                                   |
| Modal fade in/out      | 180/140 ms                                        |
| Modal zoom             | 200 ms cubic ease-out                             |

There are no spring/bounce UI transitions in the current shared motion system.
Ceremonial glows and particles remain. There is no Reduce Motion setting and no
binding to the operating system reduced-motion preference.

### 3.7 Audio and haptics

| Event          | File                      | Volume | Haptic       |
| -------------- | ------------------------- | -----: | ------------ |
| General tap    | `ui_glass_tap.mp3`        |   0.42 | Selection    |
| Four           | `bat_impact_classic.mp3`  |   0.78 | Light impact |
| Six            | `bat_impact_classic.mp3`  |   0.88 | Heavy impact |
| Wicket         | `stump_clack.mp3`         |   0.86 | Warning      |
| Crowd response | `stadium_crowd_cheer.mp3` |   0.52 | None         |
| Fifty          | Crowd cheer               |   0.58 | Success      |
| Hundred        | Crowd cheer               |   0.65 | Success      |
| Win            | Crowd cheer               |   0.68 | Success      |

Audio files are loaded lazily. The app respects its Sound and Haptics settings;
unavailable hardware degrades to a no-op. Ambient menu music loops
`menu_ambient.mp3` at volume 0.25 and pauses/seeks when Music is disabled.

Fours and sixes share one compact impact recording, but no longer differ by
volume alone. A six plays at 0.90x without pitch correction, adds a crowd layer
after 70 ms and uses a heavy haptic; a four uses the normal transient and a
light haptic.

## 4. Complete Screen And Page Layout Catalog

### 4.1 Entry, setup and account

| Route           | Layout and visible content                                                                                                        | Main actions and state                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Splash          | Full-screen centered emblem, product name, tagline and loading copy over the app background                                       | Resolves fonts and the daily-session gate, then routes forward                                             |
| Main Menu       | Code-rendered cricket-ground hero; resume card showing mode, identity, season, wallet and last result; icon-led action grid below | Continue, New Game, Saves, Store, Account, Settings and Exit                                               |
| New Game        | Two large mode cards with role-specific summary and iconography                                                                   | Start Player Career or Manager Career                                                                      |
| Player Creation | Four-step flow: identity/avatar, pathway/attributes, club context, review; progress header and responsive in-flow action footer            | Name, country, role, hand/style, appearance, difficulty, stat allocation and confirmation                  |
| Team Select     | Country-aware club rows/cards with selected state and a reserved start footer                                                     | Select a valid club and begin Manager Career                                                               |
| Saved Games     | Player/manager tabs, save-slot cards, empty slots, premium sixth-slot lock, metadata and destructive confirmation                 | Load or delete a save                                                                                      |
| Login           | Account-status surface, Google action marked `Coming soon`, and active Guest action                                               | Guest play is active; email/password and cloud login are not exposed                                       |
| Settings        | Grouped audio/gameplay toggles, graphics/theme/language selectors, guide controls, handbook link, reset and build metadata        | Sound, music, haptics, notifications, quality, theme, app-chrome language, replay guides, restore defaults |
| Cricket Academy | Search field, four tabs and expandable rule articles                                                                              | Search and inspect career, match, club and physicality mechanics                                           |
| League Editor   | Competition/club text inputs and availability state                                                                               | Rename supported league/team content while the pass-gated editor is active                                 |

### 4.2 Player Career

| Route                  | Layout and visible content                                                                                                               | Main actions and state                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Career Hub             | Stadium spotlight, identity/header, wallet, four persistent tabs, urgent story/event block and exactly one resolver-owned primary action | Continue the next canonical career step; captains can open the relevant club/national XI and tactics; open training, profile, records, calendar and store |
| Training               | Role-specific training cards, total/focus limits, escalating coin price and trainability feedback                                         | Complete a paid session; view an immediate centered result modal                                                  |
| Player Life            | Five responsive tabs for selection risk, recent form, development services, personal finance, phone/media and legacy                       | Hire coaches, use physio/analysis, buy equipment/assets, bank/trade, post, negotiate sponsors, handle captaincy and import/export |
| Player Profile         | Avatar and identity, current form/condition, contract, equipment, career/season statistics and role-relevant attributes                  | Inspect career, contract, awards and records; fielding remains engine-visible but is not a dedicated UI section  |
| Contract Negotiation   | Staged offer card, demand controls, club response, result summary and held/disabled buttons during transitions                           | Accept, negotiate and sign; a stored contract token automatically improves the next renewal                      |
| Narrative              | Full story/event copy, choices, relationship/economy effects and resolved/empty state                                                    | Make one persisted choice and return to the career resolver                                                      |
| Player Cosmetics       | Live modular preview, sex-compatible preset/manual tabs, free appearance controls, owned/gem/pass kit/frame states and save feedback       | Select modular appearance, equip owned kit/frame/celebration items and persist the result                         |
| Daily Challenge        | Date-seeded format/pitch briefing, bronze/silver/gold target, progress and reward panel                                                  | Play once per date and claim the reached coin tier                                                               |
| U19 World Cup          | Youth-international status, schedule/progress, result panel and unavailable/empty state                                                  | Play or advance eligible youth fixtures                                                                          |
| International Calendar | Format-specific selection status, reason copy, year-round fixtures, WTC standings, bilateral tours and ICC event progress                | Play selected international matches and inspect country/format status                                            |
| Injury Report          | Full-screen severity presentation, missed-match estimate, recovery timeline and action cards                                             | Continue normal recovery or pay gems to accelerate                                                               |
| Milestone Cinematic    | Full-screen colored gradient, particles, milestone number/type and short caption                                                         | Auto-closes after four seconds or closes on tap                                                                  |
| Hall Of Fame Ceremony  | Highlight reel, gold plaque, career identity and legacy statistics                                                                       | Complete induction and return                                                                                    |

Retirement is represented inside Career Hub rather than by a separate route.
The hub changes to `A Career Remembered`, displays the final legacy summary and
offers the Hall of Fame path when eligible.

### 4.3 Manager Career

| Route                   | Layout and visible content                                                                                                                         | Main actions and state                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Manager Hub             | Club or national spotlight, role identity, board/appointment alerts, one Continue action, latest result, earnings, league table and live-ops cards | Advance the calendar; enter squad, transfers, office, press, records and store               |
| Squad                   | Playing XI followed by bench, player role/fitness/morale, batting-order controls, tactics and mechanic info buttons                                | Select XI, reorder batting, set plan, use supported recovery                                |
| Transfers               | Market/Squad/Loan tabs, compact player rows, search/filter/sort, scouting uncertainty and action buttons                                           | Scout, fast-track a report, bid, sign, sell, release or loan                                |
| Transfer Deadline Day   | Full-screen countdown, current budget, urgency color, transfer ticker and deal status                                                              | Jump to the real transfer market or squad; no fake isolated transfer inventory              |
| Club Office             | Club budget, staff/facility sections, wallet services, resources and economy explanation                                                           | Opposition Analysis, Morale Session, resources, facility/staff actions and investments       |
| Academy                 | Youth prospect list with age, role and current overall; hidden development ceilings are not shown                                                   | Promote or release prospects                                                                |
| Academy Management      | Personal academy name, tier, students, income and upgrade state                                                                                    | Open or upgrade the wallet-funded personal academy                                          |
| Staff Recruitment       | Candidate cards with role, quality, effect, wage/signing cost and affordability                                                                    | Search, hire and develop staff                                                              |
| Wage Breakdown          | Club payroll totals, wage ceiling/FFP context and per-player rows                                                                                  | Audit current costs before signing or renewal                                               |
| Press                   | Event/speaker copy and response choices, followed by positive/negative/neutral effect chips                                                        | Commit one response affecting board, reputation, club budget or morale                      |
| Board Meeting           | Cinematic boardroom with sacked, praised, warned or extended theme                                                                                 | Acknowledge outcome and continue                                                            |
| Youth Graduate Ceremony | Club-colored shirt, star particles, name, role and attributes                                                                                      | Promote the revealed graduate into the first team                                           |
| Investment Screen       | Personal wallet amount input, portfolio status/history, academy/legacy funding and withdrawal controls                                             | Invest wallet coins, withdraw the portfolio or fund legacy projects                         |

### 4.4 Shared match, progression and store

| Route              | Layout and visible content                                                                                                                                                | Main actions and state                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Match              | Pre-match briefing, presentation-mode choice, responsive score header, 2D pitch, commentary/event area, role controls, speed/pause/skip controls and post-match analytics | Watch, play decisions, use tactics/DRS where eligible, pause, skip to user involvement, simulate and claim rewards |
| Records            | Mode-filtered achievement filters, progress, league history, trophies, local records and Hall of Fame entries                                                             | Inspect and share supported accomplishments                                                                        |
| Awards Night       | Sequential champion, Golden Bat, Golden Ball and user-finish reveals                                                                                                      | Continue after all staged awards appear                                                                            |
| Notification Inbox | Type-colored rows, unread state, right-entry motion, clear action and empty state                                                                                         | Open/read or clear notifications                                                                                   |
| Purchase           | Trust bar, contextual starter/energy offer, mode Legend product, gem education, pass, mode tools, account upgrade and currency sections                                   | Buy or restore RevenueCat products; unavailable live products do not display a fake localized price                |
| Season Pass        | Current cycle, tier/XP progress, free/premium tracks, 20 tier rows, activation and claim feedback                                                                         | Activate pass and claim reached rewards                                                                            |
| Premium Clubhouse  | Noir stadium/office imagery, active premium theme, monthly drop, VIP streak and exclusive scenario/cosmetic status                                                        | Claim eligible monthly content and inspect premium benefits                                                        |

## 5. Guidance And First-Time Experience

### 5.1 Global onboarding

The first-run onboarding contains five pages:

1. Live ball-by-ball cricket.
2. Build a player from prospect to legend.
3. Run a detailed manager career.
4. Chase achievements and records.
5. Use daily systems and the Season Pass.

It supports horizontal swiping, Back, Next and Skip. A swipe must travel at
least 48 dp. Dots show the current page.

### 5.2 Player guide

The Player Career guide has five focused steps:

1. Follow the single highlighted next action.
2. Train and develop attributes.
3. Perform the selected batting/bowling role.
4. Understand selection and progression.
5. Review the whole career path and records.

### 5.3 Manager guide

The Manager guide has six steps:

1. Use Continue to advance the canonical calendar.
2. Read the phase and next fixture.
3. Select a legal XI.
4. Choose a tactical plan.
5. Scout and recruit.
6. Run facilities, staff and club resources.

### 5.4 First career match

When the user reaches the crease in the first career match, the live match
pauses for three short prompts:

1. Choose a batting stance.
2. Read the chase and match situation.
3. Understand the post-match reward/progression loop.

Each prompt auto-advances after six seconds if untouched.

### 5.5 Contextual help

The searchable Cricket Academy contains 17 current topics across four tabs:

- Career Progression: pathway, selection formula, U19 readiness and
  international eligibility.
- Match Engine & Tactics: pitch/weather, tactical modifiers and format
  adaptability.
- Club Management: scout confidence, First-Class over-rate, board grace, FFP
  and facilities.
- Physicality & Injuries: First-Class workload, condition, morale, injuries
  and age development.

Info buttons are attached to complex screens such as Squad, Transfers and the
hubs. There is no permanent or absolutely positioned Coach Tip on Home,
Matchday or the live match screen. First-match coaching remains in the
dismissible guide, while mechanic explanations open on demand or render in
normal document flow so they cannot cover cards or match controls.

## 6. Player Career - Complete Game Flow

### 6.1 Creation

The user chooses:

- Name and one of 18 countries.
- Batter, Bowler, All-Rounder or Wicketkeeper.
- Batting hand, bowling hand and bowling style.
- Difficulty.
- Avatar from the supplied 300 deterministic recipes (150 male and 150 female)
  or individual appearance controls backed by 186 modular runtime assets.
- Initial attribute allocation and a country-specific starting club.

Specialist Batter and Bowler builds receive a 150-point creation budget.
All-Rounder and Wicketkeeper builds receive 230 points because their useful
attribute spread is wider. Creation allocation values begin at 35, cap at 90
and move in steps of five. The age-14 version is scaled to 52%; every Stepper
shows the exact active School rating as its main value and the allocation value
underneath. The protagonist has no hidden development ceiling and can reach 99
through earned development.

Initial form is 60.

### 6.2 Attribute model

| Group    | Attributes                                               |
| -------- | -------------------------------------------------------- |
| Batting  | Technique, timing, power, footwork, temperament, running |
| Bowling  | Pace/spin, accuracy, movement, variations, stamina       |
| Fielding | Catching, throwing, agility, keeping                     |
| Meta     | Fitness, form, confidence, aggression, discipline        |

Overall rating weighting:

| Role         | Overall calculation                              |
| ------------ | ------------------------------------------------ |
| Batter       | 70% batting, 15% fielding, 15% meta              |
| Bowler       | 70% bowling, 15% fielding, 15% meta              |
| All-Rounder  | 40% batting, 40% bowling, 10% fielding, 10% meta |
| Wicketkeeper | 55% batting, 30% keeping, 15% meta               |

Automatic trait examples:

- Power 78 or higher: Big Hitter.
- Variations 78 or higher: Death Specialist.
- Pace/spin 80 or higher: Wicket Taker.
- Temperament 38 or lower: fragile temperament trait.

### 6.3 Career pyramid

The player begins at age 14 in School cricket:

`School -> U19 -> Senior Tier 3 -> Tier 2 -> Tier 1 -> format-specific national
selection -> retirement/legacy`

Each country has a generated 24-club senior world:

- Three tiers.
- Eight clubs per tier.
- Twenty-two players per club.
- Fourteen-match double round-robin T20 block.

The selected Tier 3 club is a reserved future destination, not the age-14
player's current team. School and U19 each use a separate age-appropriate XI.
The 24-club senior world continues in the background without the user. On U19
promotion, the user enters the reserved Tier 3 roster, one same-role senior is
moved to the free-agent pool, and the user is placed in the XI.

### 6.4 Opposition curve and youth gates

| Stage  | Typical opponent OVR | Generated range | Selection requirement |
| ------ | -------------------: | --------------: | --------------------: |
| School |                   34 |           28-40 |                    34 |
| U19    |                   48 |           42-54 |                    47 |

School promotion requires at least five appearances and either 140 runs or nine
wickets. U19 promotion requires at least six appearances and either 320 runs or
16 wickets. Age safeguards force movement to U19 at 16 and senior domestic
cricket at 20 even if the statistical gate has not been completed.

Readiness combines 75% match output and 25% match rating. For an All-Rounder,
the stronger discipline contributes 70% and the secondary discipline 30%.

School injuries use a 0.3 multiplier. A School player is generally selected
unless injured, intentionally resting or below 18 condition.

### 6.5 Literal calendar events

| Stage/window      | Current events                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| School Sep-Nov    | Tactics, team strategy and examinations                                |
| School Jan-Feb    | Recovery and examinations                                              |
| School Mar onward | Selection and T20 fixtures                                             |
| U19 Sep-Nov       | ODI camp, selection and youth ODIs                                     |
| U19 Dec-Feb       | NCA camps                                                              |
| U19 Mar onward    | T20 selection and fixtures                                             |
| Senior Sep-Nov    | Preparation, selection and List A                                      |
| Senior Dec-Feb    | Recovery, Test-format selection and First-Class                        |
| Senior Mar-May    | T20 preparation, selection, league and playoffs                        |
| June-August       | Transfers, contracts, recovery, migration and major international duty |

Event choices have real state effects. Examples:

- Tactics work: `+3` adaptability, `+2` confidence, `-2` condition.
- Team strategy: `+3` coach trust, `+1` confidence.
- Fitness session: `+10` condition, `+1` confidence.
- Study in an exam window: `+2` trust, `+2` confidence.
- NCA training: `+3` adaptability, `+2` trust, `-3` condition.
- NCA rest: `+15` condition.
- Recovery event: `+18` condition.

### 6.6 Player archetypes

| Archetype    | Main behavior                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prodigy      | Training multiplier 1.20 through age 20, 1.05 in the middle years and 0.92 from 27; easier 0.68 readiness gate, one fewer required match, fast-track OVR gate reduced by three; positive reputation x1.22 and negative x1.15; higher young injury risk |
| Late Bloomer | Training x0.88 before 23 and x1.24 from 23; readiness 0.80, one additional match and OVR gate +5; reputation x0.82 before 23 and x1.22 after; lower injury risk                                                                                        |
| Specialist   | Signature-discipline growth x1.18 and other growth x0.96; standard readiness; drop threshold 28                                                                                                                                                        |
| Comeback     | Training x0.92 below 60 fitness and x1.15 otherwise; higher injury risk until the comeback and x0.82 after; readiness 0.74; negative reputation is softened to x0.70                                                                                   |

### 6.7 Selection

The normal selection score is:

`40% Overall + 35% Form + 25% Coach Trust`, followed by format readiness and
temporary modifiers.

- A same-role rival competes for the position.
- U19 receives a six-point pathway allowance.
- Senior domestic receives a two-point allowance.
- Injury, intentional rest or condition below 18 blocks selection.
- A rating of at least 9.95 (displayed as 10.0) gives `+20` form, `+15`
  confidence, `+15` coach trust and guarantees selection for the next match.
- Nearing a major record grants a temporary `+25` selection boost for three
  fixtures.
- Rest/not-selected recovery is stronger than played-match recovery, but
  unplanned rest may cost one coach-trust point.

### 6.8 Workload and recovery

Base match workload:

| Format           | Base condition load |
| ---------------- | ------------------: |
| T10/Hundred      |                   7 |
| T20              |                   9 |
| ODI/List A       |                  16 |
| Test/First-Class |                  25 |

Role workload can add up to ten. Age-based recovery declines from six to four,
two and then zero across older age bands. Rest recovery similarly declines
from 28 to 24, 20 and 16.

A selected career All-Rounder is guaranteed a meaningful bowling spell where
the innings lasts long enough: one over in T10, two in T20/Hundred, four in
ODI/List A and eight in Test/First-Class. The spell is scheduled early enough
to avoid disappearing in a short chase while still obeying bowler limits.

A Player Career trophy is credited only when the user participated in at least
40% of the club's matches, preventing a mostly absent player from receiving an
unearned cabinet entry.

### 6.9 Training

Training groups are role-specific. A player receives six sessions in total per
season, with at most three sessions in one focus. Prices rise with total use:

`250, 400, 550, 700, 850, 1,000 coins`.

The price curve is identical at School, Under-19, Domestic and International
level. Career level changes the development ceiling and available pathway, not
the session price. A season always has six paid uses in total and no focus can
consume more than three of them.

Training improves the two weakest relevant attributes by one to three points.
There is no zero-cost `+1` path: an empty wallet cannot change attributes or
consume a session. Active Season Pass training uses a `1.10` growth multiplier.
A one-season personal specialist multiplies matching paid gains by `1.50`. A
Training Accelerator triples the next three training-session gains and
overrides the normal multiplier for those sessions.

### 6.10 International career and dual contracts

A first national call-up requires approximately OVR 70 and national reputation 80. Selection is independent for T20I, ODI and Test cricket:

`40% Overall + 35% Form + 25% National Reputation + format readiness`.

Indicative score thresholds are 64 for short-format, 66 for ODI and 68 for
Test selection. A debut receives a guarantee. Injury, form below 40 or condition
below 25 blocks selection.

The user keeps two statuses:

1. A domestic-club contract.
2. National eligibility/selection.

International duty has priority only when dates conflict. The domestic club
still plays; that fixture is simulated without the user and is stored as
`Away on National Duty`. If no international match exists or the user is not
selected for that format, the domestic fixture remains playable.

The first played senior cap permanently stores the capped country. Birth
nationality never disappears. After three domestic seasons in another country,
that country becomes an additional pre-cap eligibility option.

During June-August, an uncapped/eligible player may queue migration to another
country. The following season the player enters that country's 24-club pyramid
at the same tier.

### 6.11 International annual rotation

Every season also contains:

- An autumn three-match bilateral in October/November. Years 1 and 3 use T20;
  years 2 and 4 use ODI.
- Two bilateral WTC Tests in January/February.

The June-August marquee rotation is:

| Rotation year | Main event                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- |
| 1             | T20 World Cup: 10 teams, four user group matches, then dynamic knockout qualification        |
| 2             | World Test Championship Final window                                                         |
| 3             | Champions Trophy: eight teams, three user group matches, then dynamic knockout qualification |
| 4             | ODI World Cup: 10 teams, nine user group matches, then dynamic knockout qualification        |

WTC standings run on a two-season cycle. Bilateral Test wins award 12 points and
draws award four. The top two countries play one standalone June final.

World Cup and Champions Trophy semifinals are not created at tournament start.
After the last group match, the table is ranked by points, wins and a stable
tie-break. Top two creates a semifinal. Winning that semifinal creates a
final. Elimination creates no knockout fixture, grants `+3` national
reputation and `+150` Pass XP once, produces an elimination newspaper, and
returns the user to domestic/off-season flow.

### 6.12 Captaincy, legend and retirement

- Club/national captaincy considers at least ten caps, OVR 76 and relative
  strength within the country.
- Earned Legend status requires the player to be capped and satisfy one major
  threshold: 8,000 runs; 300 wickets; 4,000 runs plus 150 wickets; five titles;
  60 caps; or 40 caps plus OVR 84.
- A fading-international retirement nudge begins at age 34 when the last two
  seasons added no caps, rather than checking whether the career ever had a cap.
- Standard retirement can begin at age 33 when OVR is 62 or lower.
- A completed player can transition into management after 8,000 runs, 250
  wickets, 5,000 runs plus 150 wickets, 50 caps or ten seasons.

### 6.13 Contracts, auctions, sponsors and stories

- Franchise auction eligibility begins after two senior domestic seasons, ten
  matches and star value of at least 145.
- Up to two auction bids are generated.
- Example sponsor contracts include Willow at 40 coins per match plus a
  300-coin signing bonus for three seasons, and BurgerBlast at 70 per match plus
  600 up front for two seasons.
- Relationship tracks cover coach, captain, mentor, agent, rival and selector
  from `-100` to `100`.
- Relationship memory retains up to 40 entries; the broader timeline retains
  up to 200.
- The current player-story content bank is approximately 115 events: 14 core,
  eight archetype events, 69 additional events and 24 pass-cycle events.
- Ordinary post-match story chance is 55%; milestone and dropped events are
  forced when applicable.
- The media scrapbook stores up to 40 clippings, with at most one clipping per
  match. Fifty runs, three wickets, Player of the Match, trophies and call-ups
  can make a match notable.
- Newspaper cards can be rendered to an image and shared through the native
  share sheet, with text fallback when image sharing is unavailable.

### 6.14 Player Life dashboard

Player Life consolidates the off-field career into one destination instead of
scattering duplicate cards through Career Hub:

- **Overview:** an explicit selection-risk breakdown, domestic/international
  summary and the ten most recent real appearances. No generated players or
  fabricated scorecards are used.
- **Development:** personal physio costs 9,000 coins, restores 25 condition and
  shortens an active injury by one match, with three visits per season.
  Performance Analysis costs 12,000 once per upcoming fixture. It names the
  opponent's primary threat, exposes a measurable weakness, supplies a
  role-specific match plan and recommends the training group that targets the
  user's weakest relevant attributes. It also grants real `+3` player
  confidence and `+2` coach trust; both feed selection/performance systems.
- **Personal coaches:** Batting and Bowling Specialists cost 8,000 each; the
  Mental Skills Coach costs 7,000. Each lasts one season and gives `1.50x`
  matching paid training gains.
- **Equipment:** the 5,000-coin bat grants `+1` technique and timing; 6,500-coin
  gloves grant `+2` catching; 7,500-coin shoes grant `+1` running and agility;
  the 9,000-coin protective kit grants `+1` temperament and fitness. Each item
  can be bought once and applies its listed permanent increase once.
- **Finance:** personal banking unlocks at age 18 in senior domestic cricket.
  Bank balances receive 2% at season end. Three properties cost
  `12,000/45,000/120,000` and pay `450/1,800/5,200` per season. Three businesses
  cost `25,000/60,000/150,000` and pay `1,500/4,200/11,000` per season.
- **Legacy Exchange:** a save/year-seeded fictional token can be bought and
  sold with Wallet Coins. It is labelled as fictional and has no real-money or
  real-world value.
- **Phone and media:** Feed, Inbox, News and Money views live inside one bounded
  phone surface. Followers grow from actual appearances and milestone posts.
  The player may publish three deliberate media posts per season.
- **Sponsors:** one Safe, Balanced or Bold negotiation can be completed per
  season, up to two active sponsor slots. Higher demands improve payout while
  lowering the deterministic acceptance chance. Each choice previews its exact
  acceptance chance, signing bonus, per-match fee, two-season duration and
  minimum-form requirement before the once-per-season attempt is committed.
- **Captain control:** earned club/national captains can resolve squad-role
  disputes through Support, Mediate or Discipline choices with persisted
  morale, trust or discipline effects.
- **Legacy Museum:** retirement/trophy progress, Hall of Fame route and
  user-facing JSON career export/import are grouped here. Import runs normal
  migrations and preserves account-authoritative purchases and premium wallet
  state.

## 7. Manager Career - Complete Game Flow

### 7.1 World structure

Manager Career always simulates a 24-club country pyramid:

- Three tiers.
- Eight clubs per tier.
- Twenty-two players per club.
- The user starts with a Tier 3 club.
- All other clubs and locked formats continue to simulate so tables, careers
  and promotion/relegation remain coherent.

Initial club budgets are approximately:

| Tier | Manager world | Player-career generated world |
| ---- | ------------: | ----------------------------: |
| 1    |     1,500,000 |                     1,400,000 |
| 2    |     1,050,000 |                       950,000 |
| 3    |       750,000 |                       650,000 |

The club budget is separate from personal wallet coins and gems.

### 7.2 Manager progression and calendar

| Level                 | Active competitions                      | Background competitions                | Main progression                                            |
| --------------------- | ---------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Rookie / Tier 3       | March-May T20                            | List A and First-Class                 | Finish strongly and earn Tier 2 opportunity                 |
| Professional / Tier 2 | Sep-Nov List A and Mar-May T20           | First-Class                            | Build a balanced white-ball squad and earn Tier 1           |
| Master / Tier 1       | List A, First-Class and T20              | None of the three domestic blocks      | Win elite trophies and earn National Head Coach eligibility |
| National Head Coach   | Shared year-round international calendar | Domestic world continues in background | Bilaterals, WTC cycle and ICC events                        |

The broad yearly sequence is:

1. September-November List A.
2. December-March First-Class.
3. March-May T20.
4. June-August transfer, development and international window.

When a licence-locked block finishes, the modal names the format, explains why
club staff controlled it, expands the record as wins from total matches,
states which competition table changed and itemizes the 30% wallet-coin
oversight stipend. List A and First-Class results never alter the T20 table.

The National Head Coach uses the same international generator as Player
Career: autumn white-ball bilaterals, winter WTC Tests and dynamic summer ICC
events/final qualification. National squad selection, readiness, mandatory
match preparation, analysis and match controls all target the controlled
country while domestic clubs continue to simulate.

Every manager match opens a Match Preparation stage before Watch, Key Moments
or Instant Result can be selected. The free report displays opponent
batting/bowling/fielding ratings out of 100 and the attack shape. Ratings are
labelled Manageable, Strong or Elite danger. The 650-coin full analysis names
the leading batter and bowler, identifies a technical weakness, recommends a
tactical plan and can apply that plan directly; its existing +2 XI form and +1
XI morale effects remain real.

### 7.3 League rules

- T20 standings award two points for a win and one for a tie.
- First-Class standings award four for a win and two for a draw.
- Points, wins and a stable reputation-based tie-break order clubs.
- The top two are promoted and bottom two relegated.
- The standard domestic group has seven opponents. T20 uses a double
  round-robin; List A/First-Class use their configured seasonal block.

### 7.4 Fatigue and over-rate

First-Class cricket applies a heavy condition cost. Pace bowlers lose a net
amount around nine condition per match under the typical base-plus-pace model.
Selecting four or more pace bowlers whose average stamina is below 72 creates a
one-point slow-over-rate deduction.

This makes spinner balance and squad rotation materially important. During the
off-season, player condition resets to 100.

### 7.5 Tactics

Manager choices modify ball-outcome probabilities rather than serving as
labels. For example:

- `CONTAIN` multiplies dots by 1.14.
- It multiplies fours by 0.82 and sixes by 0.78.
- It multiplies wickets by 0.95.
- Attacking plans trade control for wickets and boundary risk.

The match UI displays the selected plan and post-match tactical readout.

### 7.6 Jobs, board and salary

- A new appointment starts with board confidence 75.
- A five-match protected grace period suppresses normal firing checks.
- Club identity, roster and budget switch atomically on a job transition.
- Board target is top two around reputation 69+, top four around 66+, otherwise
  top six.
- After grace, finishing more than two positions below target can cause
  dismissal.
- Annual manager salary is approximately
  `250,000 + manager reputation x 14,000`.
- At the T20/season completion point, salary converts to wallet coins using
  `floor(contract salary / 200)` and is paid once.

### 7.7 Squad, scouting and transfers

- Maximum first-team squad size is 25; minimum legal squad is 11.
- Base transfer value is derived from OVR above 40, multiplied by 12,000 and an
  age factor, with a minimum 20,000.
- Wage is approximately 3% of value.
- The seasonal wage ceiling remains 125% of the configured cap even after a
  paid budget injection.
- A free signing charges full value in the active finance path.
- Releasing a player returns about 50% of value.
- A loan is valued around 20% of value per year.
- Renewal cost includes about 10% of value/wage plus 8%, capped by the contract
  rules.

Normal scouting spends 25,000 club-budget currency. Initial uncertainty is
roughly `0.85 - scout skill x 0.004`, clamped by the engine. Repeated scouting
reduces uncertainty by roughly `0.28 + scout skill x 0.0034`. No potential
number or band is exposed. Recommendations use current Overall and form only.
Full Scout Intelligence reveals exact overall, form, fitness, injury and
estimated value.

### 7.8 Staff

There are eight staff roles. Candidate quality caps at 92.

- Wage is approximately `8,000 + quality x 1,400`.
- Development investment costs `40,000 + quality squared x 60`.
- Development adds four to six quality points.
- Hiring uses wage times `1.5 + quality / 100`.
- An active Season Pass applies a 5% signing-fee discount.

### 7.9 Club facilities

Facilities have five levels. Due to the target-level upgrade calculation, the
current approximate costs are:

| Upgrade      | Club-budget cost |
| ------------ | ---------------: |
| Level 1 to 2 |          270,000 |
| Level 2 to 3 |          486,000 |
| Level 3 to 4 |          874,800 |
| Level 4 to 5 |        1,574,640 |

Maintenance is `sum of facility levels x 18,000` per season.

Club rating combines approximately 68% starting-XI quality, 18% staff, 7%
normalized facilities and 7% club reputation.

### 7.10 Club finance

Typical seasonal inflows:

- Sponsor/broadcast: `120,000 + reputation x 6,000`.
- League prize: 800,000 for first, 500,000 second, 300,000 top four, 150,000
  top six, otherwise 80,000.
- Gate income: `(60,000 + reputation x 3,500) x 7`.
- Continental trophy prize: 600,000.

Player wages, staff wages and facility upkeep are subtracted.

### 7.11 Academy

The club academy generates three to seven prospects based on facilities and
world state. Prospects expose age, role and current ability, but no hidden
potential estimate. Promoted youth receive a three-year contract.

The separate personal Cricket Academy is funded with wallet coins:

| Tier | Upgrade/opening cost | Periodic revenue | Students |
| ---- | -------------------: | ---------------: | -------: |
| 1    |               15,000 |              800 |       15 |
| 2    |               50,000 |            2,500 |       60 |
| 3    |              150,000 |            7,000 |      200 |

### 7.12 Manager stories and Hall of Fame

Manager Career has 11 static events plus 24 pass-cycle events, for 35 current
event definitions. Choices can alter board confidence, manager reputation,
club budget, squad morale or form. The same event has a five-match cooldown.

Manager Hall of Fame is separate from Player Hall of Fame and tracks trophies,
promotions, players produced, win rate, seasons and legacy score. Qualification
requires a trophy/promotion or score of at least 100.

Manager score:

`titles x 100 + cup wins x 60 + promotions x 40 + legends produced x 35 +
win rate x 2 + seasons x 5 + max(0, 60 - best position x 5)`.

Player Hall of Fame qualification requires 10,000 runs, 400 wickets or a legacy
score of 9,000. Player score is:

`runs + wickets x 20 + highest score x 2 + hundreds x 60 + caps x 12 +
titles x 40`.

Each Hall of Fame board retains up to 25 entries.

## 8. Match Engine And Match-Day UI

### 8.1 Formats

| Format           | Innings overs/sets | Balls per over/set | Innings per side |            Bowler cap | Powerplay |
| ---------------- | -----------------: | -----------------: | ---------------: | --------------------: | --------: |
| T10              |                 10 |                  6 |                1 |               2 overs |   3 overs |
| T20              |                 20 |                  6 |                1 |               4 overs |   6 overs |
| Hundred          |            20 sets |                  5 |                1 |                4 sets |    5 sets |
| ODI/List A       |                 50 |                  6 |                1 |              10 overs |  10 overs |
| Test/First-Class |       Soft cap 450 |                  6 |                2 | Effectively unlimited |      None |

### 8.2 Base legal-ball weights

These are relative weights, not percentages. Attribute, pressure, pitch,
weather, delivery, tactic, field and difficulty modifiers are applied before
normalization.

| Format  |  Dot |    1 |   2 |   3 |    4 |   6 | Wicket |
| ------- | ---: | ---: | --: | --: | ---: | --: | -----: |
| T20     |   35 |   33 | 6.5 | 0.5 | 13.5 | 6.2 |    4.2 |
| ODI     | 46.5 | 33.5 | 7.5 | 0.7 |  9.6 | 3.3 |   1.95 |
| Test    |   66 |   21 | 5.5 | 0.4 |  8.5 | 1.1 |   1.35 |
| Hundred |   33 |   33 | 6.5 | 0.5 | 14.5 | 6.8 |    4.4 |
| T10     |   29 |   31 | 6.5 | 0.4 |   17 | 9.5 |    5.4 |

Extra-event rates:

- Wide: 2.8%.
- No-ball: 1.1%.
- Bye on a legal ball: 0.6%.
- Leg-bye on a legal ball: 1.2%.

### 8.3 Attribute and pressure calculation

The batter attack score combines timing, technique, power, temperament and
current confidence. Bowler control combines accuracy, pace/spin, movement and
current stamina. Their normalized difference becomes an edge from `-1` to `1`.

- Positive batting edge increases four/six weights and reduces dots.
- Negative edge and match pressure increase wicket weight.
- High temperament, confidence and discipline protect against panic under
  pressure.
- Weak footwork is punished more by spin.
- Weak technique is punished more by pace.
- Keeper quality and poor footwork influence stumping threat.
- Powerplay raises wicket and dot pressure.
- Death overs raise fours, sixes and wickets while reducing dots.
- Traits such as Fragile, Big Hitter, Death Specialist and Wicket Taker apply
  their own multipliers.

### 8.4 Pitch and weather

| Pitch   | Boundary x | Dot x | Wicket x |
| ------- | ---------: | ----: | -------: |
| Green   |       0.90 |  1.10 |     1.28 |
| Dry     |       1.00 |  1.00 |     1.00 |
| Dusty   |       0.92 |  1.08 |     1.20 |
| Flat    |       1.13 |  0.88 |     0.82 |
| Cracked |       0.95 |  1.05 |     1.32 |

| Weather  | Boundary x | Dot x | Wicket x |
| -------- | ---------: | ----: | -------: |
| Clear    |       1.00 |  1.00 |     1.00 |
| Overcast |       0.93 |  1.08 |     1.22 |
| Humid    |       0.97 |  1.03 |     1.09 |

The stadium catalog contains 55 fictional grounds, each with small pace, spin
and scoring biases centered around 1.0. The fixture's country/club selects the
relevant ground.

### 8.5 Difficulty

User-batting outcome multipliers:

| Difficulty | User wicket risk x | User scoring x |
| ---------- | -----------------: | -------------: |
| Easy       |               0.68 |           1.15 |
| Normal     |               0.82 |           1.09 |
| Hard       |               1.00 |           1.00 |
| Pro        |               1.08 |           0.96 |

Opponent-batting multipliers:

| Difficulty | Opponent wicket risk x | Opponent scoring x |
| ---------- | ---------------------: | -----------------: |
| Easy       |                   1.28 |               0.86 |
| Normal     |                   1.16 |               0.92 |
| Hard       |                   1.00 |               1.00 |
| Pro        |                   0.94 |               1.04 |

AI aggression also scales by 0.78, 1.00, 1.08 and 1.15 for Easy through Pro.
Easy therefore helps the user both while batting and while bowling; it is not
only a cosmetic label.

### 8.6 User batting and bowling decisions

The engine supports four batting intents:

| Intent | Aggression | Purpose                             |
| ------ | ---------: | ----------------------------------- |
| Block  |       0.10 | Preserve wicket                     |
| Rotate |       0.42 | Find singles and keep strike moving |
| Attack |       0.72 | Hunt boundaries                     |
| Big    |       0.95 | Maximum boundary intent and risk    |

The active persistent stance UI currently exposes Defend, Balanced/Rotate and
Attack. The `Big` engine intent exists but is not a separate persistent stance
button.

Bowling plans:

| Plan    | Direct ball-weight effect                           |
| ------- | --------------------------------------------------- |
| Attack  | Wicket x1.20, fours/sixes x1.08, dots x0.95         |
| Contain | Dots x1.14, fours x0.82, sixes x0.78, wickets x0.95 |
| Vary    | Wickets x1.12, dots x1.05, fours x0.95              |

Field presets move from Catching/Attacking to Balanced, Defensive and Sweeper.
Examples:

- Catching: wickets x1.22 but fours x1.12 and sixes x1.06.
- Defensive: fours x0.90, sixes x0.88, dots x1.08, wickets x0.96.
- Sweeper: fours x0.80, sixes x0.82, singles x1.16, wickets x0.94.

Illegal field settings are corrected to a legal option for the current match
phase.

The coin face is deterministic from the match seed. A manager, club captain or
national captain first calls Heads or Tails through an animated coin ceremony.
If the call wins, the user chooses Bat First or Bowl First; if it loses, the AI
uses format, pitch, weather and a seeded variation. A normal Player Career user
does not receive team-level toss authority. Club captaincy does not grant
national authority. The UI explains the generated venue, surface implications,
coin result and who bats first.

T20 has no hidden individual run or wicket cap. Realism is guarded through ball
probabilities and a deterministic 56-match double-round-robin test that checks
average totals, innings extremes and 14-match player aggregates.

### 8.7 Match presentation modes

- **Watch**: full live presentation and user decisions when the controlled
  player/team is involved.
- **Key Moments**: advances routine play and pauses at selected important
  events. It is not a full interactive choice on every delivery.
- **Instant**: resolves the complete match and shows the result.

Known copy discrepancy: one pre-match description still implies Watch gives a
new shot choice for every delivery. The active implementation uses persistent
batting stance with event-driven decisions.

### 8.8 Score and field presentation

The live page is vertically organized as:

1. Match/competition context and innings status.
2. Main score, wickets, overs/sets, target or result requirement.
3. Current batter/bowler and rate information.
4. Responsive 2D field.
5. Latest commentary and important event/milestone presentation.
6. User batting stance, bowling plan, field or DRS controls when relevant.
7. Speed, pause and skip controls.

The personal objective is shown once in the pre-match briefing only when the
user is selected, and then in the result summary. A benched player receives
explicit `No personal challenge` copy. There is no persistent mission card
covering the pitch/scoreboard while the user is not batting.

Standard field palette:

| Part            | Color     |
| --------------- | --------- |
| Outfield        | `#0E2A1A` |
| Pitch           | `#B9915A` |
| Inner/ring line | `#176536` |

Premium Stadium Noir palette:

| Part        | Color     |
| ----------- | --------- |
| Outfield    | `#050806` |
| Pitch       | `#233D22` |
| Ring/accent | `#B9F23D` |

Trajectory colors:

- Four: green.
- Six: gold.
- Wicket: red.
- Extra: blue.

The old 3D stadium component and GL path have been removed. Match day uses one
responsive, readable 2D view, reducing blank-canvas and GPU compatibility risk.

### 8.9 Speed, batching and pause

| Speed | Ordinary delivery delay | User-involvement delay | UI batching              |
| ----- | ----------------------: | ---------------------: | ------------------------ |
| 1x    |                1,800 ms |               2,600 ms | Every ball               |
| 2x    |                1,080 ms |               1,560 ms | Up to two routine balls  |
| 4x    |                  450 ms |                 650 ms | Up to four routine balls |

Boundaries, wickets, over ends and milestones force an immediate visual flush,
so a fast batch cannot hide a major event. Speed changes pacing only; the
deterministic simulation result does not change.

The final over automatically reduces a 4x match to 2x. Pause uses a neutral
button with a gold outline; the whole button no longer fills solid green.
`Skip to my batting` locks after the first tap, runs continuously until the
user's next involvement, and prevents repeated-tap races.

### 8.10 DRS

DRS is available in Player Career domestic/international matches, but not in
School, U19 or Manager simulation.

- Two reviews per innings.
- Successful review is retained.
- Failed review is consumed.
- The deterministic review can rewind the dismissal.

Configured overturn rates:

| Dismissal  | Overturn chance |
| ---------- | --------------: |
| LBW        |             35% |
| Caught     |             20% |
| Run out    |             25% |
| Bowled     |              4% |
| Hit wicket |              2% |
| Stumped    |              8% |
| Fallback   |             15% |

### 8.11 Post-match sequence

The result surface includes:

- Result and margin.
- Player of the Match.
- User match rating.
- Match objective completion.
- Tactical evidence/readout.
- Coin/XP reward.
- One optional rewarded-ad double-coins action.
- "Why it happened" context.
- Wagon wheel and score analytics where relevant.
- Newspaper, achievement and milestone overlays when newly eligible.

## 9. Economy Overview

### 9.1 Four separate resources

| Resource     | Ownership and use                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Wallet Coins | Personal/save currency used for training, services, academy, investment, legacy projects and store-facing economy |
| Gems         | Scarce premium currency used for cosmetics, recovery, elite search and energy refill                              |
| Energy       | Real-time match/training access resource                                                                          |
| Club Budget  | Manager club money used for transfers, wages, staff and facilities; it is not interchangeable with wallet coins   |

Starting wallet:

- 750 coins.
- 0 gems.
- 36 energy.

### 9.2 Energy

- Standard cap: 36.
- Permanent VIP cap: 60.
- Regeneration: one energy every five real minutes.
- Gem refill: ten gems restores energy to the standard cap of 36.
- Store rewarded ad: `+4` energy, capped at the standard 36.

Match energy costs:

| Format           | Youth | Domestic | International |
| ---------------- | ----: | -------: | ------------: |
| T10              |     2 |        3 |             5 |
| T20              |     3 |        4 |             6 |
| Hundred          |     3 |        4 |             6 |
| ODI/List A       |     5 |        6 |             8 |
| Test/First-Class |     7 |        8 |            10 |

Youth applies `-1` to format base with a minimum cost of two. International
applies `+2`.

### 9.3 Match coin rewards

Base result reward:

| Result | Base coins |
| ------ | ---------: |
| Win    |        320 |
| Tie    |        180 |
| Loss   |        120 |

The active Player Career live-match path scales the base with user impact:

`base x (0.5 + impact x 1.1)`, with impact clamped from zero to one.

- A benched/not-selected reward is 35% of the applicable reward.
- International reward is doubled before VIP.
- Completing the match objective adds 150 coins.
- Batter/Wicketkeeper objective: 30 runs.
- Bowler objective: two wickets.
- All-Rounder objective: 20 runs or two wickets.
- Permanent VIP multiplies match coins by 1.20.
- The post-match rewarded ad doubles that completed transaction once.

There is also a generic economy helper that adds:

- 50 coins for 50 runs.
- 100 coins for 100 runs.
- 50 coins for three wickets.
- 100 coins for five wickets.

That generic helper is used by compatible simulation paths; the main live
Player Career reward path primarily uses impact plus objective, so these
bonuses must not be added a second time when describing one live match.

## 10. Daily, Quest And Challenge Rewards

### 10.1 Daily login streak

| Day in cycle | Base coins | Gems |
| ------------ | ---------: | ---: |
| 1            |        100 |    0 |
| 2            |        150 |    0 |
| 3            |        200 |    0 |
| 4            |        250 |    0 |
| 5            |        300 |    0 |
| 6            |        400 |    0 |
| 7            |        600 |   10 |

After each completed seven-day cycle, coin payout gains another `0.5x`, capped
at `3x`. Day-seven gems remain 10 and are never multiplied. Missing more than
one day or moving the device day backward resets the streak to day one.

Permanent VIP streak extras:

- Day 7: additional 10 gems.
- Day 30: exclusive avatar frame.

### 10.2 Player daily quests

Three consecutive definitions from this pool rotate each day:

| Quest           |                      Target | Coins | Gems | Pass XP after claim |
| --------------- | --------------------------: | ----: | ---: | ------------------: |
| Match Fit       |              Play 2 matches |   120 |    0 |                 100 |
| Winning Feeling |                 Win 1 match |   150 |    0 |                 100 |
| Run Machine     |               Score 50 runs |   140 |    0 |                 100 |
| Strike Bowler   |              Take 3 wickets |   140 |    0 |                 100 |
| Find the Fence  |            Hit 6 boundaries |   130 |    0 |                 100 |
| Sharpen Up      | Complete 1 training session |   100 |    0 |                 100 |

### 10.3 Player weekly quests

| Quest      |          Target | Coins | Gems | Pass XP after claim |
| ---------- | --------------: | ----: | ---: | ------------------: |
| Grinder    | Play 10 matches |   600 |    0 |                 300 |
| On a Roll  |   Win 5 matches |   800 |    0 |                 300 |
| Big Week   |  Score 300 runs |   700 |    0 |                 300 |
| Demolition | Take 15 wickets |   700 |    0 |                 300 |

### 10.4 Manager daily quests

| Quest          |           Target | Coins | Gems | Pass XP after claim |
| -------------- | ---------------: | ----: | ---: | ------------------: |
| Matchday Ready |   Manage 1 match |   140 |    0 |                 100 |
| Three Points   |      Win 1 match |   170 |    0 |                 100 |
| Double Header  | Manage 2 matches |   220 |    0 |                 100 |
| Squad Builder  |    Sign 1 player |   180 |    0 |                 100 |

### 10.5 Manager weekly quests

| Quest             |           Target | Coins | Gems | Pass XP after claim |
| ----------------- | ---------------: | ----: | ---: | ------------------: |
| Touchline General | Manage 8 matches |   800 |    0 |                 300 |
| Winning Culture   |    Win 4 matches |   950 |    0 |                 300 |
| Market Moves      |   Sign 2 players |   900 |    0 |                 300 |

Quests deliberately do not award gems. Gems are concentrated in achievements,
day seven, the pass and purchases.

### 10.6 Daily Challenge

The challenge is deterministic for the calendar date and can be completed once
per date.

| Format  | Target generation            |
| ------- | ---------------------------- |
| T10     | 16-27 runs from eight balls  |
| Hundred | 20-31 runs from ten balls    |
| T20     | 22-33 runs from twelve balls |

Pitch rotates between Green, Dry, Dusty, Flat and Cracked.

| Medal  | Coins | Gems |
| ------ | ----: | ---: |
| Bronze |   120 |    0 |
| Silver |   200 |    0 |
| Gold   |   350 |    0 |

The result can be shared through the native share sheet.

## 11. Season Pass

### 11.1 Core rules

- Reference price: INR 299, replaced by RevenueCat's localized price when
  available.
- Duration: 30 days.
- Twenty tiers.
- Pass XP per match: 50.
- Additional Pass XP per win: 40.
- Daily quest claim: 100.
- Weekly quest claim: 300.
- Purchase is blocked until two matches have been played.
- A second pass cannot be bought while the current pass is active.
- Earned cosmetics stay in inventory after expiration.

### 11.2 Exact 20-tier ladder

Premium rewards are additional to the free reward when Premium is active.

| Tier | Cumulative XP | Free reward       | Premium reward                                 |
| ---: | ------------: | ----------------- | ---------------------------------------------- |
|    1 |            80 | 110 coins         | 325 coins, 8 gems, Stadium Noir kit            |
|    2 |           176 | 120 coins         | 230 coins, 3 gems                              |
|    3 |           288 | 130 coins         | 245 coins, 3 gems                              |
|    4 |           416 | 140 coins         | 260 coins, 3 gems                              |
|    5 |           560 | 275 coins, 2 gems | 425 coins, 8 gems, Championship profile frame  |
|    6 |           720 | 160 coins         | 290 coins, 3 gems                              |
|    7 |           896 | 170 coins         | 305 coins, 3 gems                              |
|    8 |         1,088 | 180 coins         | 320 coins, 3 gems                              |
|    9 |         1,296 | 190 coins         | 335 coins, 3 gems                              |
|   10 |         1,520 | 350 coins, 2 gems | 550 coins, 8 gems, Floodlight celebration      |
|   11 |         1,760 | 210 coins         | 365 coins, 3 gems                              |
|   12 |         2,016 | 220 coins         | 380 coins, 3 gems                              |
|   13 |         2,288 | 230 coins         | 395 coins, 3 gems                              |
|   14 |         2,576 | 240 coins         | 410 coins, 3 gems                              |
|   15 |         2,880 | 425 coins, 2 gems | 675 coins, 8 gems, Stadium Noir theme          |
|   16 |         3,200 | 260 coins         | 440 coins, 3 gems                              |
|   17 |         3,536 | 270 coins         | 455 coins, 3 gems                              |
|   18 |         3,888 | 280 coins         | 470 coins, 3 gems                              |
|   19 |         4,256 | 290 coins         | 485 coins, 3 gems                              |
|   20 |         4,640 | 500 coins, 2 gems | 800 coins, 8 gems, Executive office theme      |

Full free track total: **4,750 coins and 8 gems**.

Full premium track additional total: **8,160 coins and 85 gems**.

Claiming both tracks completely gives **12,910 coins, 93 gems and five
milestone items**.

### 11.3 Active pass benefits

- Player training growth x1.10.
- Positive selection reputation x1.05.
- Superstar recruitment interest `+0.04`.
- Staff signing fee `-5%`.
- Ads disabled for the pass duration.
- Sixth save slot while any listed save has an active pass.
- Active team/league naming editor.
- Monthly kit, celebration, Manager office, collectible, scenario and story
  chain.

### 11.4 Twelve monthly content cycles

Each cycle contains one kit, one celebration, one Manager office theme, one
collectible, a two-step Player story, a two-step Manager story and this
scenario:

| Cycle            | Objective         | Coins | Gems |
| ---------------- | ----------------- | ----: | ---: |
| Monsoon Nights   | Win 2 of next 3   | 1,250 |   18 |
| Coastal Clash    | Win 3 of next 4   | 1,650 |   24 |
| Heritage Cup     | Win 3 consecutive | 1,900 |   28 |
| Neon Finals      | Win 3 of next 4   | 1,700 |   25 |
| Winter Tour      | Win 2 of next 4   | 1,300 |   20 |
| Champions Month  | Win 4 of next 5   | 2,200 |   32 |
| Rising Stars     | Win 2 of next 3   | 1,350 |   20 |
| Red Soil Rivalry | Win 3 of next 5   | 1,700 |   24 |
| Night Derby      | Win 3 consecutive | 1,950 |   29 |
| Festival Cricket | Win 2 of next 4   | 1,250 |   18 |
| Record Breakers  | Win 4 of next 6   | 2,250 |   32 |
| Legacy Finals    | Win 4 of next 5   | 2,400 |   35 |

Exact monthly ownership items:

| Cycle            | Kit                       | Celebration      | Manager office        | Collectible           |
| ---------------- | ------------------------- | ---------------- | --------------------- | --------------------- |
| Monsoon Nights   | Monsoon Teal `#0B6B62`    | Rainmaker salute | Monsoon strategy room | Monsoon pennant       |
| Coastal Clash    | Coastal Coral `#D94F4F`   | Breaking Wave    | Harbour boardroom     | Coastal rivalry crest |
| Heritage Cup     | Heritage Maroon `#7B1E2B` | Crest touch      | Heritage gallery      | Founders medal        |
| Neon Finals      | Neon Finals `#42D77D`     | Pulse point      | Analytics lab         | Finals light badge    |
| Winter Tour      | Winter Ice `#D8E7F0`      | Ice Veins        | Winter tour suite     | Winter tour patch     |
| Champions Month  | Champions Gold `#C9972B`  | Champion stance  | Champions room        | Champions ribbon      |
| Rising Stars     | Rising Violet `#7B5CC7`   | Star trail       | Academy loft          | Rising star pin       |
| Red Soil Rivalry | Red Soil `#B84232`        | Dust storm       | Rivalry room          | Rivalry shield        |
| Night Derby      | Night Derby `#152B52`     | Lights Out       | Derby war room        | Night derby ticket    |
| Festival Cricket | Festival Rose `#E04F87`   | Firework finish  | Festival lounge       | Festival wristband    |
| Record Breakers  | Record Blue `#2970B5`     | Number One       | Records vault         | Record book plate     |
| Legacy Finals    | Legacy Black `#20252A`    | Legacy salute    | Legacy boardroom      | Legacy year plate     |

## 12. Achievements And Exact Gem Rewards

### 12.1 Tier rewards

Achievements award gems and Gamerscore, never coins.

| Tier     | Gems | Gamerscore |
| -------- | ---: | ---------: |
| Bronze   |    2 |         10 |
| Silver   |    5 |         25 |
| Gold     |   12 |         50 |
| Platinum |   30 |        100 |

The active catalog contains 56 achievements, despite a stale source comment
that says 60. Tier count is 10 Bronze, 22 Silver, 18 Gold and six Platinum.
Player Career can see all 56, worth at most **526 gems and 2,150
Gamerscore**. Manager Career sees the six team achievements plus eight
Manager-compatible meta achievements, worth at most **124 gems and 520
Gamerscore**.

### 12.2 Complete catalog

`Hidden` means the title/description is concealed until unlocked.

|   # | Achievement         | Requirement                                    | Tier     | Gems | Hidden |
| --: | ------------------- | ---------------------------------------------- | -------- | ---: | ------ |
|   1 | Off the Mark        | Score the first career run                     | Bronze   |    2 | No     |
|   2 | Half Century        | Score 50 or more                               | Bronze   |    2 | No     |
|   3 | Century Club        | Score 100 or more                              | Silver   |    5 | No     |
|   4 | Double Glory        | Score 200 or more in a Test                    | Gold     |   12 | Yes    |
|   5 | Run Machine         | Reach 1,000 career runs                        | Silver   |    5 | No     |
|   6 | Elite Batter        | Reach 5,000 career runs                        | Gold     |   12 | No     |
|   7 | Immortal            | Reach 10,000 career runs                       | Platinum |   30 | Yes    |
|   8 | Boundary King       | Hit 50 career fours                            | Bronze   |    2 | No     |
|   9 | Fence Finder        | Hit 100 career fours                           | Silver   |    5 | No     |
|  10 | Big Hitter          | Hit 30 career sixes                            | Silver   |    5 | No     |
|  11 | Maximum Machine     | Hit 100 career sixes                           | Gold     |   12 | Yes    |
|  12 | Centurion           | Score five career hundreds                     | Gold     |   12 | No     |
|  13 | First Blood         | Take the first career wicket                   | Bronze   |    2 | No     |
|  14 | Five-fer            | Take five or more wickets in an innings        | Silver   |    5 | No     |
|  15 | Ten Wicket Match    | Take ten wickets in a Test match               | Gold     |   12 | Yes    |
|  16 | Wicket Machine      | Reach 100 career wickets                       | Silver   |    5 | No     |
|  17 | Strike Force        | Reach 300 career wickets                       | Gold     |   12 | No     |
|  18 | All-Time Great      | Reach 500 career wickets                       | Platinum |   30 | Yes    |
|  19 | Firestarter         | Record ten five-wicket hauls                   | Gold     |   12 | Yes    |
|  20 | Match Double        | Score 50 and take three wickets in one match   | Silver   |    5 | No     |
|  21 | Complete Cricketer  | Reach 1,000 runs and 100 wickets               | Gold     |   12 | No     |
|  22 | Player of the Match | Win the first POTM award                       | Bronze   |    2 | No     |
|  23 | Match Winner        | Win five POTM awards                           | Silver   |    5 | No     |
|  24 | Domestic Pro        | Reach senior domestic cricket                  | Bronze   |    2 | No     |
|  25 | Franchise Star      | Reach franchise-level cricket                  | Silver   |    5 | No     |
|  26 | Cap Number          | Earn the first senior international cap        | Silver   |    5 | No     |
|  27 | International Icon  | Earn 50 caps                                   | Gold     |   12 | No     |
|  28 | Centurion of Caps   | Earn 100 caps                                  | Platinum |   30 | Yes    |
|  29 | Legend              | Reach Legend career tier                       | Platinum |   30 | Yes    |
|  30 | Skipper             | Become club captain                            | Silver   |    5 | No     |
|  31 | National Captain    | Captain the national team                      | Gold     |   12 | Yes    |
|  32 | Comeback Kid        | Score 50 in the first match back from injury   | Silver   |    5 | Yes    |
|  33 | Evergreen           | Complete 15 career seasons                     | Gold     |   12 | Yes    |
|  34 | Legacy Continues    | Retire and begin New Game Plus                 | Gold     |   12 | No     |
|  35 | Champions           | Win a league title                             | Silver   |    5 | No     |
|  36 | Cup Hero            | Win a cup                                      | Silver   |    5 | No     |
|  37 | Continental Kings   | Win a continental competition                  | Gold     |   12 | No     |
|  38 | The Double          | Win league and cup in the same season          | Gold     |   12 | Yes    |
|  39 | Dynasty             | Win three league titles                        | Gold     |   12 | Yes    |
|  40 | Invincibles         | Complete an unbeaten season                    | Platinum |   30 | Yes    |
|  41 | Brand Ambassador    | Sign the first sponsor                         | Bronze   |    2 | No     |
|  42 | Global Icon         | Sign a global sponsor deal                     | Gold     |   12 | Yes    |
|  43 | Man of Honour       | Keep integrity at 90 for five seasons          | Silver   |    5 | Yes    |
|  44 | Fan Favourite       | Reach brand/fan value 80                       | Silver   |    5 | No     |
|  45 | Going Once          | Accept a franchise auction deal                | Silver   |    5 | No     |
|  46 | Fierce Rivals       | Maintain a rivalry for three seasons           | Silver   |    5 | Yes    |
|  47 | Veteran             | Play 100 matches                               | Silver   |    5 | No     |
|  48 | Iron Man            | Play 500 matches                               | Gold     |   12 | Yes    |
|  49 | Winner              | Win 10 matches                                 | Bronze   |    2 | No     |
|  50 | On a Roll           | Win 50 matches                                 | Silver   |    5 | No     |
|  51 | Five in a Row       | Win five consecutive matches                   | Silver   |    5 | Yes    |
|  52 | Unstoppable         | Win ten consecutive matches                    | Gold     |   12 | Yes    |
|  53 | Dedicated           | Reach a seven-day login streak                 | Bronze   |    2 | No     |
|  54 | Devoted             | Reach a 30-day login streak                    | Silver   |    5 | Yes    |
|  55 | Gym Rat             | Complete ten training sessions                 | Bronze   |    2 | No     |
|  56 | World Beater        | Hold the world's all-time highest-score record | Platinum |   30 | Yes    |

Manager mode's visible subset is achievements 35-40 plus 47-54.

## 13. In-App Purchase Catalog

### 13.1 Store behavior and safety

- Development builds use local purchase mocks.
- Release builds use RevenueCat only when the platform API key, store products
  and RevenueCat mapping are configured.
- A release product without verified store metadata shows
  `Connect to view price`; the app does not pretend the fallback INR price is a
  live charge.
- Pending, cancelled, refunded and revoked transactions are not fulfilled.
- Purchase-token ledger flags make fulfillment idempotent.
- Repeated taps on the same save/product are locked while a request is active.
- RevenueCat currently uses its platform-generated purchase identity; the app
  does not call a separate account-login bridge.
- Restore restores durable entitlements. Consumable coins, gems, energy and
  tokens are not replayed as fresh grants.

The INR amounts below are reference/fallback catalog prices. The Google Play or
App Store localized price is authoritative in production.

### 13.2 Complete product table

| Product ID               | Product                    | Reference price | Exact grant                                                                                                                              | Intended mode | Main Store visibility |
| ------------------------ | -------------------------- | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------- |
| `starter_pack`           | Starter Pack               |          INR 99 | 3,000 coins, 50 gems, seven days ad-free                                                                                                 | Either        | Contextual only       |
| `coins_medium`           | Bag of Coins               |         INR 299 | 5,000 coins                                                                                                                              | Either        | Yes                   |
| `coins_large`            | Sack of Coins              |         INR 599 | 15,000 coins                                                                                                                             | Either        | Yes                   |
| `gems_medium`            | Bag of Gems                |         INR 299 | 300 gems                                                                                                                                 | Either        | Yes                   |
| `gems_large`             | Chest of Gems              |         INR 999 | 1,200 gems                                                                                                                               | Either        | Yes                   |
| `bundle_legend`          | Player Legend Edition      |         INR 999 | 20,000 coins, 600 gems, permanent ads off, VIP 60-energy cap, Legend frame, all kit colors                                               | Player        | Player hero only      |
| `remove_ads`             | VIP Upgrade + Remove Ads   |         INR 299 | Permanent ads off, 60-energy cap and +20% match coins                                                                                    | Shared        | Yes                   |
| `season_pass`            | Season Pass Premium        |         INR 299 | 30-day premium track, monthly content, benefits and ad-free period                                                                       | Shared        | Yes                   |
| `energy_refill`          | Energy Refill              |          INR 99 | +30 energy                                                                                                                               | Either        | Shown when low        |
| `manager_legend_pack`    | Manager Legacy Edition     |         INR 599 | Permanent backing/office, board floor 82, first-grant club rep +3 capped 95, two scout tokens, one facility token and one recovery token | Manager       | Manager hero only     |
| `transfer_budget_sm`     | Transfer Budget Boost      |         INR 149 | +500,000 club transfer budget                                                                                                            | Manager       | Yes                   |
| `scout_full_reveal`      | Full Scout Intelligence    |          INR 49 | One exact-reveal scout token                                                                                                             | Manager       | Yes                   |
| `facility_upgrade_token` | Instant Facility Upgrade   |         INR 149 | One no-club-budget facility level                                                                                                        | Manager       | Yes                   |
| `recovery_pack`          | Squad Conditioning Pack    |          INR 99 | One squad conditioning token                                                                                                             | Manager       | Yes                   |
| `contract_boost`         | Contract Negotiation Boost |          INR 99 | One stored next-renewal token: wage and signing bonus +25%                                                                               | Player        | Yes                   |
| `form_recovery`          | Mental Coaching Session    |          INR 49 | Form floor 70 and confidence floor 65                                                                                                    | Player        | Only when needed      |
| `training_accelerator`   | Training Accelerator       |         INR 149 | Three training sessions at 3x gains; maximum six charges stored                                                                          | Player        | Yes                   |

### 13.3 Starter and first-gem rules

The Starter Pack:

- Unlocks only after the first completed match.
- Remains available for 24 hours.
- Disappears after any first purchase in that save.
- Can be bought only once for the account/device purchase identity, using a
  global AsyncStorage marker rather than a career-save flag.
- Gives a real seven-day `removeAdsUntil` entitlement, not permanent VIP.

The first purchased gem pack receives one extra copy of its base gems:

| First gem pack | Normal | First-pack total |
| -------------- | -----: | ---------------: |
| Medium         |    300 |              600 |
| Large          |  1,200 |            2,400 |

Buying a non-gem item first does not consume this bonus.

### 13.4 Mode separation

The active Purchase screen shows Player Legend Edition only inside Player
Career and Manager Legacy Edition only inside Manager Career. The mode-tool
rows are also separate:

- Player: training accelerator, contract boost and form recovery.
- Manager: scout reveal, facility token, conditioning and 500,000 budget.
- Shared: VIP, pass, energy, coins and gems.

Player Legend does not grant Manager backing. Manager Legacy does not grant
Player stats, selection or cosmetics. Season Pass and VIP are intentionally
shared-value products.

The fulfillment guard also rejects `bundle_legend` in Manager saves, so a
direct internal call cannot bypass the mode-specific Store surface.

### 13.5 What premium editions do not do

- Player Legend does not advertise or grant named commentary or early seasonal
  access.
- Manager Legacy does not force wins, league position, trophies or Manager Hall
  of Fame entry.
- Budget products do not bypass the 125% wage ceiling.
- Squad Conditioning does not heal injuries.

Manager premium assistance is recorded in a history ledger for transparency.

## 14. Coin And Gem Spending

### 14.1 Player cosmetics

Avatar appearance:

- Core face, skin, eye, hair, beard, moustache and supplied headwear choices
  are free appearance controls; the integration does not invent new prices.
- Existing owned profile frames, Season Pass cosmetics, Legend/VIP visual
  entitlements and kit ownership remain authoritative.
- Saves persist stable modular asset IDs. Existing frame selection is rendered
  above the modular layers and legacy appearance fields remain available for
  rollback compatibility.

Kit:

| Item              | Color     | Gem cost |
| ----------------- | --------- | -------: |
| Classic White     | `#F7F7F7` |        0 |
| Navy Blue         | `#1A3A7C` |        0 |
| Forest Green      | `#1F7C40` |       40 |
| Championship Gold | `#C6902A` |       60 |
| Power Red         | `#C4362B` |       60 |
| Royal Purple      | `#6B2FA0` |       80 |
| Midnight Black    | `#1A1A1A` |      100 |
| Blaze Orange      | `#E86910` |       80 |

Celebration:

| Item          | Gem cost |
| ------------- | -------: |
| Classic Wave  |        0 |
| Fist Pump     |        0 |
| Helmet Off    |       30 |
| Sky Salute    |       50 |
| Victory Dance |       70 |
| Legend Walk   |      100 |

Stadium Noir and all monthly pass cosmetics cost zero gems but require prior
pass ownership/unlock.

### 14.2 Injury and energy gems

- Energy refill to standard cap: 10 gems.
- Injury fast recovery:
  `max(10, min(50, matches out x 8))` gems.

### 14.3 Manager recovery

Standard squad recovery:

- Price: 79 gems or one stored conditioning token.
- Non-injured players: `+20` condition capped at 95, `+20` fitness capped at
  100 and `+15` morale.
- Injured players are skipped.
- Cooldown ends after either three completed fixtures or seven days, whichever
  occurs first. The action is blocked only while both limits remain unmet.

Full fitness:

- Price: 149 gems.
- Non-injured condition and fitness become 100.
- Morale `+15`.
- Five-fixture cooldown.
- Does not heal injuries.

### 14.4 Scouting and staff gems

- Exact player scout reveal: 49 gems or one reveal token.
- Elite staff search: 35 gems.
- Elite search adds three stronger candidates; signing the selected candidate
  still consumes club budget and normal wages.

### 14.5 Manager wallet-coin services

| Service                 |        Cost | Effect                                                                               | Limit                      |
| ----------------------- | ----------: | ------------------------------------------------------------------------------------ | -------------------------- |
| Opposition Analysis     |   650 coins | Selected XI receives +2 form and +1 morale                                           | Once per upcoming fixture  |
| Morale Session          | 8,000 coins | Three lowest-morale squad players receive +5 morale                                  | Once per upcoming fixture  |
| Fast-Track Scout Report | 6,000 coins | Report uncertainty falls by 25 percentage points and known rating moves toward truth | Once per target per season |

Manager match and background-simulation rewards use the same 320/180/120 base
for matches the user actively manages. Locked background matches pay 30% of
that base as an oversight stipend; VIP then applies its 1.20 multiplier.
Background stipends are accumulated and explained in the phase summary. The
annual salary payout is another wallet-coin faucet.

### 14.6 Legacy Fund

These are one-time vanity contributions. They grant no match or income
advantage.

| Project                 | Coin cost | Legacy points |
| ----------------------- | --------: | ------------: |
| Academy Wing            |    25,000 |            10 |
| Scholarship Fund        |    75,000 |            30 |
| Stadium Stand           |   200,000 |            75 |
| Charitable Foundation   |   500,000 |           175 |
| Bronze Statue           | 1,000,000 |           400 |
| National Cricket Museum | 2,500,000 |         1,000 |

Legacy ranks:

| Points | Rank                 |
| -----: | -------------------- |
|      0 | Rising Name          |
|     10 | Community Patron     |
|     50 | Regional Benefactor  |
|    150 | National Icon        |
|    500 | Cricketing Statesman |
|  1,500 | Immortal Legend      |

### 14.7 Investment portfolio

- Minimum investment: 500 wallet coins.
- The current UI caps one entered amount at 50,000.
- End-of-season return uses
  `(win rate - 0.5) x 0.14 + random -5% to +5%`.
- Eight history entries are retained.
- Withdraw removes the full current portfolio balance.

Known validation gap: the store function itself does not enforce the UI's
50,000 maximum, so a future alternate caller must add or preserve that guard.

## 15. Advertising

### 15.1 Ad-free rules

Ads are suppressed by any of:

- Permanent VIP/remove-ads entitlement.
- Unexpired seven-day Starter Pack ad-free window.
- Active Season Pass.

Only permanent VIP receives the 60-energy cap and +20% match coins.

### 15.2 Rewarded ads

Two active rewards exist:

- Post-match: double the just-completed match coin award once.
- Store: add four energy up to the standard 36 cap.

The reward is granted only after AdMob emits `EARNED_REWARD`. A 30-second
safety timeout prevents a hanging promise. Requests are non-personalized.

Development builds have local ad simulation disabled and the default rewarded
unit is empty, so a normal debug build does not fake a reward. Release Android
has a configured rewarded-unit fallback unless overridden by environment.

### 15.3 Interstitials

- Maximum two in any rolling hour.
- Minimum 30 minutes between interstitials.
- Frequency history is persisted.
- Career Hub may request one at supported moments.

The current interstitial environment default is an empty string. Because that
empty value is treated as configured input rather than falling through to an
SDK test ID, interstitials are effectively unavailable until a real unit ID is
supplied.

## 16. Popup, Overlay And Ceremony Inventory

| Surface                         | Appearance and behavior                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glass Alert                     | `rgba(0,0,0,0.78)` backdrop, `#0C0E15` panel, `#1A2035` border; queued actions replace native alerts                                                    |
| Reward Modal                    | `rgba(0,0,0,0.78)` backdrop, themed elevated panel with gold border, `#3A2800` reward badge and `#C6902A` outline; used by daily, quest and pass claims |
| Starter Pack                    | `rgba(0,0,0,0.75)` backdrop, `#0F241A` card, `#C6902A` outline and `#17211B/#0B100D/#17211B` header                                                     |
| Contextual Offer                | Themed surface-to-elevated gradient with product-specific accent glow and explicit dismiss control                                                      |
| Onboarding                      | Full-screen paged modal with swipe, dots and fixed navigation                                                                                           |
| Mode Guide                      | Mode-colored step modal, persisted as seen until replayed                                                                                               |
| First Match Guide               | Match-local prompt that pauses live progression                                                                                                         |
| Coach/Mechanic Tip              | Compact contextual explanation; persisted dismissal where configured                                                                                    |
| Achievement Toast               | Surface panel outlined by tier color; Bronze auto-closes at two seconds and Silver at 3.5 seconds                                                       |
| Gold Achievement                | Full-screen `#1A1000/#2A1F00/#1A1000` cinematic with `#E9B23B` rings                                                                                    |
| Platinum Achievement            | Full-screen `#000D1A/#001A2E/#000D1A` cinematic with `#B4E4FF` rings                                                                                    |
| Newspaper                       | `rgba(8,10,12,0.82)` backdrop; paper `#EEE1BD`, ink `#33291D`, rule `#8B7657`, green share action `#176B3A`                                             |
| Match Celebration               | Near-black `rgba(6,9,15,0.94)` event panel, expanding ring and result-colored particles                                                                 |
| Bid War/Negotiation             | Interaction-owned route/local modal with held buttons while state commits                                                                               |
| DRS                             | Match-local review panel; review result controls the deterministic rewind                                                                               |
| Delete/Destructive Confirmation | Danger action routed through Glass Alert, with cancel option                                                                                            |

Celebration colors:

- Four: primary green, light green and white.
- Six: gold, light gold, light green and white.
- Fifty: gold, light green and white.
- Hundred: gold, light gold, success green and white.
- Win: gold, primary, success and white.
- Wicket: danger red, dark danger and `#7A1216`.
- Innings transition: info blue, light green and white.

Full-screen ceremony palettes:

| Ceremony              | Palette                                        |
| --------------------- | ---------------------------------------------- |
| Century milestone     | `#E9B23B -> #7A4A08`, particles `#F7D06E`      |
| Five-wicket milestone | `#E5484D -> #7A1216`, particles `#FF9090`      |
| National cap          | `#1F8A46 -> #0A1912`, particles `#5BD183`      |
| Title                 | `#C6902A -> #4A2800`, particles `#F7D06E`      |
| Awards Night          | `#0D0A04/#1A1305/#0D0A04`                      |
| Hall of Fame          | `#1A1005/#2A1C08/#0F0A03`, main gold `#E9B23B` |
| Youth Graduate        | `#050C08/#0A1912/#050C08`, club-colored shirt  |
| Deadline Day          | `#080808/#12100A/#0A0A18`, red live banner     |
| Injury Report         | `#1A0808 -> #0F1912`, severity orange/red      |

## 17. Settings, Persistence And Accounts

### 17.1 Settings

Settings persist under `cricket:settings`.

| Setting           | Default       | Options/effect                    |
| ----------------- | ------------- | --------------------------------- |
| Sound             | On            | Match/UI sound effects            |
| Music             | On            | Ambient loop                      |
| Haptics           | On            | Shared haptic wrapper             |
| Notifications     | On            | Allows future reminder scheduling |
| Graphics          | High          | Low, Medium or High               |
| Theme             | Dark          | Dark, Light or System             |
| Language          | English       | English or Hindi app chrome       |
| Global onboarding | Not completed | Set after first onboarding        |
| Played matches    | 0             | Account/device-wide store gate    |
| Dismissed tips    | Empty         | Persisted contextual-tip IDs      |

`Replay Guides` clears onboarding and dismissed-tip state. `Restore Defaults`
returns these preferences to their defaults.

Known behavior: disabling Notifications prevents future scheduling, but the
settings setter does not cancel reminders that were already scheduled.

### 17.2 Local saves

- Storage keys use `sg:<mode>:<slot>`.
- Each slot also has a rolling `:bak` copy.
- Save schema version is 30.
- Migrations support legacy schema versions 2 through 30. Schema 25 adds the
  dynamic ICC knockout state; schema 26 separates School/U19 teams from the
  reserved senior club and removes persisted potential-band labels. Schema 27
  begins exact domestic/international ledgers, schema 28 initializes Player
  Life, schema 29 begins exact current-season per-format player ledgers without
  inventing historical format splits, and schema 30 adds normalized modular
  `AvatarConfig` IDs while retaining the legacy appearance fields.
- Before a new primary write, the previous valid primary becomes the backup.
- Saves are wrapped in an FNV-1a checksum envelope.
- A corrupt/truncated primary falls back to the backup.
- Legacy unwrapped save objects are accepted and migrated.
- A save written by a newer unsupported schema is rejected rather than
  destructively guessed.

The checksum detects accidental corruption and basic tampering. It is not a
cryptographic signature and should not be described as unbreakable anti-cheat.

### 17.3 Account screen

Current reachable account behavior:

- Guest sign-in.
- Online verification once every 24 hours.
- Sign out without deleting local saves.
- Delete all local career/manager save slots and sign out.
- Google sign-in is marked `Coming soon`.
- Cloud backup is marked unavailable.

Known copy/data gap: `Delete account data` deletes local save slots, clears the
active career and signs out. It does not visibly clear settings, the global
Starter Pack marker or durable local Hall of Fame data. The success copy `All
account data deleted` is broader than the actual deletion.

### 17.4 Cloud implementation status

Supabase supports anonymous authentication, the once-per-day online verification
RPC and an RLS-protected `cloud_saves` table. Runtime configuration reads
`EXPO_PUBLIC_*` environment variables.

`src/services/cloud.ts` can push, pull and list authenticated cloud slots while
retaining a local development fallback. The service foundation is present, but
there is no user-facing sync/conflict screen deciding whether a local or remote
save wins. Login therefore correctly keeps Cloud Backup unavailable, and Google
remains marked `Coming soon`.

## 18. Notifications

### 18.1 Active scheduling

Career/Manager hubs call the reminder scheduler when Notifications is enabled.
Currently connected reminders are:

| Notification   |                                       Default delay |
| -------------- | --------------------------------------------------: |
| Energy full    | Calculated from missing energy at five minutes each |
| Daily reward   |                                            24 hours |
| Streak at risk |                                            20 hours |
| Match ready    |                                             4 hours |
| Season ending  |                                              3 days |

Foreground notifications display an in-app banner and do not request sound or
badge behavior.

## 19. Analytics, Crash Reporting And Review

### 19.1 Analytics taxonomy

The typed event list includes:

`app_open`, `onboarding_complete`, `match_start`, `match_end`, `purchase`,
`purchase_initiated`, `ad_watched`, `sign_player`, `season_rollover`,
`daily_claim`, `quest_complete`, `career_start`, `starter_pack_shown`,
`offer_shown`, `offer_accepted`, `offer_dismissed`, `share_newspaper` and
`legacy_contribution`.

Every event is held in a 200-item in-memory ring buffer and printed in
development. Firebase Analytics is loaded lazily, but the Firebase Analytics
package is not currently installed in `package.json`. Remote Firebase event
delivery is therefore inactive in the current project.

### 19.2 Crash handling

- A React error boundary protects the app shell.
- A global JavaScript error handler reports to the local crash facade and then
  preserves the previous platform handler.
- Development builds print captured errors and optional context.
- No remote crash-reporting SDK or disabled Sentry plugin is carried in the
  current project.

### 19.3 Store review

The app may request the native store review after at least three wins, no more
than once every seven days, and only in a production/native environment where
the review API is available.

## 20. Records, Leaderboards And Integrity

Records, achievements and Hall of Fame entries are derived from the active
save or the device-local Hall of Fame store. `src/game/leaderboard.ts` provides
save-local rankings for runs, wickets and overall rating.

The Supabase foundation also includes public `leaderboard` rows, private
`shadow_leaderboard` review rows, an online fetch/submit service and a client
sanity prototype. Implausible global limits, score-per-match values,
titles-per-season values, wallet balances and long-sample win rates are routed
away from public rankings. No reachable online leaderboard screen or automatic
career submission hook is wired yet, so this is preserved infrastructure rather
than a completed player-facing feature.

Save envelopes use checksums and rolling backups to detect corruption and
recover the previous valid local state. This protects reliability, not
competitive server authority or cryptographic tamper resistance. The
leaderboard sanity filter is also client-side and must not be described as
unbreakable anti-cheat.

## 21. Countries, Clubs And Grounds

### 21.1 Country catalog

| Country          | Strength | Generated-city pool                                   |
| ---------------- | -------: | ----------------------------------------------------- |
| India            |        5 | Mumbai, Delhi, Chennai, Kolkata, Bengaluru, Hyderabad |
| Australia        |        5 | Sydney, Melbourne, Brisbane, Perth, Adelaide          |
| England          |        5 | London, Manchester, Birmingham, Leeds, Nottingham     |
| Pakistan         |        4 | Karachi, Lahore, Islamabad, Faisalabad, Multan        |
| South Africa     |        4 | Johannesburg, Cape Town, Durban, Pretoria             |
| New Zealand      |        4 | Auckland, Wellington, Christchurch, Hamilton          |
| Sri Lanka        |        3 | Colombo, Kandy, Galle                                 |
| West Indies      |        3 | Bridgetown, Kingston, Port of Spain, Georgetown       |
| Bangladesh       |        3 | Dhaka, Chattogram, Khulna                             |
| Afghanistan      |        2 | Kabul, Kandahar                                       |
| Zimbabwe         |        2 | Harare, Bulawayo                                      |
| Ireland          |        2 | Dublin, Belfast                                       |
| Scotland         |        2 | Edinburgh, Glasgow, Aberdeen                          |
| Netherlands      |        2 | Amsterdam, Rotterdam, The Hague                       |
| UAE              |        2 | Dubai, Abu Dhabi, Sharjah                             |
| USA              |        2 | New York, Los Angeles, Dallas, Houston                |
| Namibia          |        1 | Windhoek, Walvis Bay                                  |
| Papua New Guinea |        1 | Port Moresby, Lae                                     |

Country strength feeds progression/world difficulty. No real current player
names are generated.

### 21.2 Separate mode branding

Player Career nicknames:

`Blades`, `Royals`, `Thunder`, `Spartans`, `Phoenix`, `Warriors`, `Cyclones`,
`Dynamos`, `Knights`, `Stars`, `Raiders`, `Dragons`.

Manager Career nicknames:

`Northstar`, `Foundry`, `Meridian`, `Vanguard`, `Wayfarers`, `Citadel`,
`Eclipse`, `Navigators`, `Arclight`, `Summit`, `Keystone`, `Truewind`.

The selected country's city pool is combined with these lists. The names
therefore change with country and intentionally differ between Player and
Manager careers.

### 21.3 Complete fictional-ground catalog

`Pace`, `Spin` and `Score` are engine multipliers centered on 1.00.

| Ground                       | City/country                   | Capacity | Pace | Spin | Score |
| ---------------------------- | ------------------------------ | -------: | ---: | ---: | ----: |
| Marine Drive Oval            | Mumbai, India                  |   33,000 | 1.02 | 0.95 |  1.12 |
| The Furnace                  | Chennai, India                 |   38,000 | 0.90 | 1.15 |  0.93 |
| Eastern Fortress             | Kolkata, India                 |   66,000 | 0.97 | 1.08 |  1.02 |
| Capital Bowl                 | Delhi, India                   |   41,000 | 1.00 | 1.05 |  1.04 |
| Garden City Ground           | Bengaluru, India               |   36,000 | 1.01 | 1.03 |  1.08 |
| Diamond Park                 | Hyderabad, India               |   35,000 | 0.98 | 1.06 |  1.10 |
| Westland Speedbowl           | Perth, Australia               |   24,000 | 1.15 | 0.90 |  1.05 |
| Southern Colosseum           | Melbourne, Australia           |   98,000 | 1.05 | 0.98 |  0.95 |
| Harbour City Ground          | Sydney, Australia              |   46,000 | 1.06 | 0.96 |  1.07 |
| River Canyon Oval            | Brisbane, Australia            |   42,000 | 1.12 | 0.91 |  1.04 |
| Riverbank Stadium            | Adelaide, Australia            |   50,000 | 1.04 | 1.00 |  1.09 |
| Greenmoss Park               | Manchester, England            |   26,000 | 1.13 | 0.92 |  0.90 |
| Kingsmeadow Ground           | London, England                |   30,000 | 1.00 | 0.98 |  1.05 |
| Edgewood Fortress            | Birmingham, England            |   25,000 | 1.08 | 0.95 |  0.94 |
| Headrow Ground               | Leeds, England                 |   18,000 | 1.10 | 0.93 |  0.92 |
| Sherwood Oval                | Nottingham, England            |   17,000 | 1.07 | 0.96 |  1.00 |
| Seaside Arena                | Karachi, Pakistan              |   34,000 | 0.98 | 1.00 |  1.14 |
| Sandstorm Ground             | Multan, Pakistan               |   22,000 | 1.02 | 1.12 |  0.96 |
| Liberty Stadium              | Lahore, Pakistan               |   28,000 | 1.00 | 1.04 |  1.08 |
| Capital Cricket Ground       | Islamabad, Pakistan            |   18,000 | 1.03 | 1.00 |  1.05 |
| Highveld Amphitheatre        | Johannesburg, South Africa     |   34,000 | 1.12 | 0.90 |  1.10 |
| Cape Point Ground            | Cape Town, South Africa        |   25,000 | 1.08 | 0.95 |  1.00 |
| Beachfront Arena             | Durban, South Africa           |   25,000 | 1.05 | 0.97 |  1.08 |
| Jacaranda Ground             | Pretoria, South Africa         |   22,000 | 1.09 | 0.93 |  1.05 |
| Windward Garden              | Wellington, New Zealand        |   34,000 | 1.12 | 0.90 |  0.92 |
| Rivermeadow Park             | Hamilton, New Zealand          |   12,000 | 1.00 | 0.97 |  1.08 |
| Volcano Park                 | Auckland, New Zealand          |   25,000 | 1.04 | 0.96 |  1.06 |
| Cathedral Oval               | Christchurch, New Zealand      |   18,000 | 1.08 | 0.94 |  1.01 |
| Old Fort Ground              | Galle, Sri Lanka               |   15,000 | 0.92 | 1.15 |  0.94 |
| Lagoonside Stadium           | Colombo, Sri Lanka             |   30,000 | 0.97 | 1.05 |  1.03 |
| Highlands International      | Kandy, Sri Lanka               |   20,000 | 0.94 | 1.12 |  0.96 |
| Tradewinds Oval              | Bridgetown, West Indies        |   28,000 | 1.10 | 0.93 |  1.02 |
| Carnival Grounds             | Kingston, West Indies          |   20,000 | 1.03 | 0.95 |  1.12 |
| Queen's Oval                 | Port of Spain, West Indies     |   22,000 | 1.05 | 0.97 |  1.06 |
| Providence Park              | Georgetown, West Indies        |   15,000 | 1.02 | 1.00 |  1.09 |
| Delta Bowl                   | Dhaka, Bangladesh              |   26,000 | 0.90 | 1.13 |  0.90 |
| Port City Arena              | Chattogram, Bangladesh         |   20,000 | 0.92 | 1.10 |  0.94 |
| Highland Arena               | Kabul, Afghanistan             |   14,000 | 0.95 | 1.14 |  0.98 |
| Southside Plateau            | Kandahar, Afghanistan          |   10,000 | 0.97 | 1.12 |  0.99 |
| Sunflower Park               | Harare, Zimbabwe               |   10,000 | 1.00 | 1.02 |  1.00 |
| Queen's Meadow               | Bulawayo, Zimbabwe             |    8,500 | 1.04 | 0.98 |  1.06 |
| Emerald Field                | Dublin, Ireland                |   11,000 | 1.12 | 0.90 |  0.90 |
| Titanic Arena                | Belfast, Ireland               |    9,000 | 1.10 | 0.92 |  0.88 |
| Castle Ridge Ground          | Edinburgh, Scotland            |    8,000 | 1.13 | 0.88 |  0.87 |
| Clyde Valley Oval            | Glasgow, Scotland              |    7,000 | 1.11 | 0.90 |  0.89 |
| Windmill Park                | Amsterdam, Netherlands         |   10,000 | 1.06 | 0.94 |  0.96 |
| Harbor Bowl                  | Rotterdam, Netherlands         |    8,500 | 1.05 | 0.95 |  0.98 |
| Desert International Stadium | Dubai, UAE                     |   25,000 | 1.00 | 1.08 |  1.10 |
| Sharjah Arena                | Sharjah, UAE                   |   16,000 | 0.97 | 1.10 |  1.12 |
| Zayed Oval                   | Abu Dhabi, UAE                 |   20,000 | 0.99 | 1.06 |  1.08 |
| Nassau County Arena          | New York, USA                  |   34,000 | 1.08 | 0.94 |  1.05 |
| Lone Star Cricket Ground     | Dallas, USA                    |   18,000 | 1.04 | 0.96 |  1.08 |
| Pacific Oval                 | Los Angeles, USA               |   15,000 | 1.02 | 0.97 |  1.10 |
| Oryx Ground                  | Windhoek, Namibia              |    6,000 | 1.06 | 1.00 |  1.02 |
| Amini Park                   | Port Moresby, Papua New Guinea |    8,000 | 1.00 | 1.04 |  1.05 |

## 22. Accessibility, Localization And Performance

### 22.1 Accessibility

Current strengths:

- More than 120 explicit accessibility declarations.
- Major buttons expose role, label and disabled/selected state.
- Hub/commentary tabs expose tab roles.
- Player avatar and field expose image/context labels.
- Guide dots, modal close and transfer actions are labeled.
- Captain, injury, fitness and morale badges expose semantic labels.
- Fitness exposes numeric progress-bar value.
- Manager simulation uses a polite live region.
- Most controls target at least 40-44 dp or add hit slop.
- Status-bar contrast follows the theme.

Current gaps:

- Not every custom Pressable has an explicit label.
- Some icon-only actions still rely on surrounding context.
- Dynamic Type behavior is not uniform across every native Text use.
- No full light-theme contrast audit has been completed.
- No Reduce Motion option exists.

### 22.2 Localization

- English is complete/default.
- Hindi covers menu, common actions, mode setup, Settings and selected hub
  labels.
- Missing translations fall back to English and then the key.
- Stories, commentary, product detail and most deep-screen prose remain
  English.

The Hindi option is app-chrome localization, not a fully translated game.

### 22.3 Graphics/performance

- Low/Medium/High affects selected expensive effects and particle density.
- Career and Manager hub spotlights are static so ordinary state updates do not
  replay card entrances or briefly black out their content.
- It does not disable every animation on Low.
- Match speed batches state presentation but never changes the simulation RNG.
- FlashList is available for efficient long lists.
- The 3D/GL stadium path was removed in favor of the lighter 2D field.
- Android blur is strongest on SDK 31+.

## 23. Platform And Privacy-Relevant Configuration

Android permissions declared by the project:

- `VIBRATE`.
- `SCHEDULE_EXACT_ALARM`.
- `POST_NOTIFICATIONS`.
- `INTERNET`.
- `ACCESS_NETWORK_STATE`.

Android backup is disabled. Predictive back is disabled. iPad support is
enabled. Ads request non-personalized inventory.

No private environment values or service-account keys belong in source
control. Dependencies, build output and APK files are also excluded from the
repository because they are reproducible artifacts rather than source.

## 24. Active Asset Inventory

| Asset                                             | Current use                  |
| ------------------------------------------------- | ---------------------------- |
| `assets/icon.png`                                 | Main app icon                |
| `assets/splash-icon.png`                          | Native splash                |
| `assets/android-icon-foreground.png`              | Android adaptive foreground  |
| `assets/android-icon-background.png`              | Android adaptive background  |
| `assets/android-icon-monochrome.png`              | Android monochrome icon      |
| `assets/favicon.png`                              | Web favicon                  |
| `assets/generated/career-stadium.png`             | Career/manager hub spotlight |
| `assets/generated/season-pass-manager-office.png` | Premium Manager office       |
| `assets/generated/season-pass-stadium-noir.png`   | Premium Stadium Noir         |
| `assets/sfx/bat_impact_classic.mp3`               | Four and six contact         |
| `assets/sfx/stump_clack.mp3`                      | Wicket                       |
| `assets/sfx/stadium_crowd_cheer.mp3`              | Crowd, milestones and win    |
| `assets/sfx/ui_glass_tap.mp3`                     | Shared button tap            |
| `assets/audio/menu_ambient.mp3`                   | Ambient menu loop            |

Menu, match and victory hero surfaces are code-rendered. The obsolete 3D
stadium component, old synthesized WAV files and unreferenced menu/victory
bitmap files have been removed.

## 25. Current Content Inventory

| Content area                                  | Current count/state           |
| --------------------------------------------- | ----------------------------- |
| Registered routes                             | 42                            |
| Play modes                                    | 2                             |
| Countries                                     | 18                            |
| Fictional grounds                             | 55                            |
| Senior clubs per generated country/mode world | 24                            |
| Domestic tiers                                | 3                             |
| Clubs per tier                                | 8                             |
| Generated players per club                    | 22                            |
| Player roles                                  | 4                             |
| Match formats                                 | 5                             |
| Difficulty settings                           | 4                             |
| Achievements                                  | 56                            |
| Pass tiers                                    | 20                            |
| Monthly pass cycles                           | 12                            |
| Player story definitions                      | Approximately 115             |
| Manager story definitions                     | 35                            |
| Searchable handbook topics                    | 17                            |
| Contextual Coach Tip definitions              | 3                             |
| Local save schema                             | 29                            |
| Standard saves                                | 5 per mode                    |
| Pass save                                     | 1 additional slot             |
| Hall of Fame entries retained                 | 25 player and 25 manager      |
| Media scrapbook entries retained              | 40                            |
| Relationship memories retained                | 40                            |
| Career timeline entries retained              | 200                           |
| Analytics ring-buffer events                  | 200                           |
| Investment history entries                    | 8                             |

## 26. Implemented But Not Fully User-Facing

These boundaries are deliberately incomplete and must not be advertised as
available:

- Google sign-in: button says coming soon; no token-exchange helper is shipped.
- Firebase forwarding: facade exists; native package is absent.
- Restore-purchase service/state action: implemented, but the current Purchase
  screen has no visible `Restore Purchases` control.

## 27. Known Gaps And Release Risks

This is the consolidated honest list as of this audit:

1. A two-to-three-season physical Android playthrough has not been completed
   in this documentation pass. Calendar transitions, thermal performance,
   density and long-idle behavior still need real-device evidence.
2. Responsive foundations are shared across the app, but every route has not
   been visually approved on every phone/tablet/aspect ratio.
3. Cloud-save and online-leaderboard backend/client foundations exist, but their
   user-facing conflict and rankings flows are not implemented. Google account
   sign-in is also not implemented.
4. Remote Firebase analytics and remote crash reporting are inactive.
5. Interstitial ads need a configured production unit ID.
6. A visible Restore Purchases action is absent even though restore logic
   exists.
7. The Purchase trust bar says `Google Play` even on a potential iOS build.
8. No dedicated Privacy Policy or Terms route is registered in the app.
9. Turning Notifications off does not cancel reminders already scheduled.
10. Account deletion copy overstates which settings, global purchase markers
    and Hall of Fame records are removed.
11. The achievement source header says 60 while the real catalog contains 56.
12. Watch-mode copy contains the engine discrepancy documented above.
13. The fourth `Big` batting intent exists in the engine but is not directly
    exposed by the persistent stance selector.
14. National central-contract grades and international match fees are not
    implemented.
15. Normal scouting has uncertainty progression but no literal two-week
    calendar cooldown.
16. `Away on National Duty` is stored and shown in calendar/inbox state, but
    there is no dedicated historical scorecard row.
17. Overseas AI matches use aggregate deterministic simulation rather than
    global ball-by-ball storage. This is intentional for mobile save size and
    performance.
18. Hindi is only partial app chrome.
19. There is no reduced-motion setting.
20. Low graphics is selective rather than a universal animation-off mode.
21. Some ceremonial/premium screens remain dark even when Light theme is
    selected.
22. Pre-Android-31 devices do not receive the same true backdrop blur.
23. Fours and sixes share one source recording. Rate, pitch, crowd and haptics
    now differentiate them, but the final mix still needs a small-speaker
    physical-device check.
24. The Investment screen enforces its 50,000 input ceiling, but the underlying
    function does not.

None of these gaps changes the exact reward, price or gameplay tables earlier
in this document. They identify what still needs release validation or
hardening.

## 28. Verification And Source Map

This reference was audited against current local source, including:

- App shell/routes: `App.tsx`, `src/navigation/index.ts`, `app.json`.
- Design/layout: `src/theme/*`, `src/components/Screen.tsx`,
  `src/hooks/useResponsive.ts`.
- Screens: `src/screens/*.tsx`.
- Player flow: `src/game/career.ts`, `src/game/playerCalendar.ts`,
  `src/game/careerStep.ts`, `src/game/careerTransition.ts`,
  `src/game/progression.ts`.
- Manager flow: `src/game/managerCalendar.ts`, `src/game/managerCareer.ts`,
  `src/game/managerJobs.ts`, `src/game/finance.ts`,
  `src/game/managerResources.ts`.
- International flow: `src/game/intlCalendar.ts`, `src/game/season.ts`.
- Match engine: `src/engine/*`, `src/data/gameConfig.ts`.
- Rewards/pass: `src/game/liveops.ts`, `src/game/seasonPass.ts`,
  `src/data/seasonPassContent.ts`.
- Achievements: `src/game/achievements.ts`.
- Purchases/ads: `src/services/purchases.ts`,
  `src/services/purchaseLedger.ts`, `src/services/ads.ts`,
  `src/config/monetization.ts`.
- State fulfillment: `src/state/careerStore.ts`.
- Cosmetics/legacy: `src/data/cosmetics.ts`, `src/data/legacy.ts`.
- Countries/grounds: `src/data/countries.ts`, `src/data/stadiums.ts`,
  `src/game/domesticBranding.ts`.
- Persistence: `src/storage/*`, current schema 30.
- Account/session/notifications: `src/services/auth.ts`,
  `src/services/sessionGate.ts`, `src/services/supabaseClient.ts`,
  `src/services/notifications.ts`.
- Cloud/rankings/integrity: `src/services/cloud.ts`,
  `src/services/onlineLeaderboard.ts`, `src/services/antiCheat.ts`,
  `src/game/leaderboard.ts`.
- Analytics/crash: `src/services/analytics.ts`, `src/services/crash.ts`.

Verification on 2 August 2026:

- `npm run generate:avatars`: generated 186 literal Metro asset registrations
  and 300 deterministic presets.
- `npm run validate:avatars`: validated 186 assets and 300 unique presets.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors and zero warnings.
- `npm test -- --runInBand --silent`: 119 suites, 579 tests and two snapshots
  passed.
- `npx expo-doctor`: 20/20 checks passed.
- Android regression run: fresh Player and Manager careers crossed the former
  post-team-selection crash boundary; save/restart/resume retained the Player
  career and modular avatar.
- Android visual run: male hair/beard alignment, female paired hair,
  headwear-driven hair hiding, preset/manual selection, Cosmetics saving and
  Profile reload were checked. The footer remained structurally separate at
  six phone/tablet/landscape viewport sizes.
- Hub stability run: settled Player and Manager hub captures were pixel-identical
  across timed samples, with no recurring entry animation or black-card flash.
- Production import traversal: active modules are reachable; explicitly retained
  cloud, leaderboard and integrity foundations may remain UI-unwired until their
  release flows are completed.
- Deleted-reference scan: no stale reference to a removed module or product.
- `git diff --check`: passed; Git reported only the repository's expected
  LF-to-CRLF checkout notices.

Standalone Android test APK produced on 2 August 2026:

- Path: `android/app/build/outputs/apk/release/app-release.apk`.
- Size: 129,892,347 bytes (123.87 MiB).
- SHA-256: `1E5398B47FC5E6A401D834EF6B30B3AE5846E459B96B6AF2C3201E3C4B2FB2A3`.
- Package: `com.coverdrive.cricket`, version `1.0.0` (code 1), minimum SDK
  24 and target SDK 36.
- Archive verification found 1,920 entries and the embedded
  `assets/index.android.bundle`; ARM64, ARMv7, x86 and x86_64 are included.
- Android `apksigner` verified the v2 signature. This test artifact uses the
  Android debug certificate and is suitable for sideload QA, not Play upload.
- The exact APK installed successfully and cold-launched with Metro stopped. It
  reached the Account screen with no ErrorBoundary or Android runtime crash.
- External commerce caveat: Play Billing is unavailable on the emulator, and
  RevenueCat reports that the configured offering has no registered Play Store
  products. Dashboard/catalog validation remains a release-owner task.
- iOS release caveat: the Google Mobile Ads plugin has no `iosAppId`. The
  Android APK is unaffected, but an iOS build must not ship until that value is
  configured and tested.
