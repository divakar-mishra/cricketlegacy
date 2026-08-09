# Cricket Legacy - Reference Benchmark

Last audited: 30 July 2026

This is a clean-room product benchmark of:

- `android-comcricketplayermanager-0.apk`
- [Cricket Career Simulator 2.0](https://cricket-career-simulator.vercel.app/)
- the current Cricket Legacy source tree

The reference products were inspected to understand product structure,
interaction patterns, and feature coverage. No proprietary code, images,
names, commentary, or other assets were copied into Cricket Legacy.

## 1. Evidence And Limits

### APK

| Item | Observed value |
| --- | --- |
| Package | `com.cricketplayermanager.apk` |
| Version | `1.19` (`versionCode 10`) |
| Size | 10,230,112 bytes |
| SHA-256 | `8979534D709369653FF13AC681DDEC296F61F51DEB3D81771918710AE733A129` |
| Runtime | Basic4Android / B4A native Android application |
| Orientation | Portrait |
| Target SDK | 23 |
| Permissions | Internet only |

The APK was inspected statically through its manifest, DEX class surface,
layout catalog, resources, and bundled media. It was not treated as source
code. A working Android runtime was not available for a complete interactive
playthrough, so exact runtime balance and screen transitions are not claimed.

### Website

The public production client was inspected as a rendered product and as its
shipped browser bundle. It is a React/Vite application using Framer Motion,
Lucide icons, Tailwind-style utility classes, Web Audio, and local browser
storage.

## 2. What The APK Does Well

The old APK's strongest idea is breadth around the cricketer's life. Its
screen/module catalog includes:

- Player profile, skills, training, statistics, records, objectives, awards,
  achievements, and career history.
- Match, tour, T20, injury, physio, non-selection, dropped-risk, and
  performance-analysis flows.
- Newspaper, email, press conference, sponsor negotiation, contract signing,
  and selection-crisis moments.
- Personal money, banking, real estate, shares, business, sponsorship, and
  auction surfaces.
- A later management layer with staff and club-management screens.

This gives the career a broad "life simulator" silhouette. Cricket Legacy
already covers the valuable core through its narrative relationships,
sponsors, contract negotiation, stock portfolio, personal academy, press
scrapbook, injuries, manager career, and persistent timeline.

The APK's implementation should not be imitated directly:

- It relies heavily on fixed bitmap backgrounds and B4A layout files, so it is
  not a good responsive-layout reference.
- Several bundled photographic assets have unclear provenance.
- Its target SDK and platform conventions are obsolete.
- A large portion of its size is static media, including one 2.14 MB audio
  file, rather than reusable native presentation systems.

## 3. What The Website Does Well

The website's strongest idea is clarity and ceremony:

- The dashboard always identifies the next match, training, coaches,
  equipment, league, achievements, and career legacy.
- Captaincy has a visible ritual: choose an XI, define batting order, review
  pitch/venue, conduct the toss, then enter the match.
- Venue and surface information appears before play rather than remaining
  hidden engine data.
- Match outcomes feed a visible career arc through followers, endorsements,
  rival progress, season goals, trophies, and a retirement Legacy Museum.
- Framer Motion gives entrances and high-value moments a deliberate pace.
- Procedural Web Audio layers clicks, impact, crowd, wicket, victory, and
  defeat cues without requiring a large audio download.
- Save/load, schedule, standings, achievements, trophies, and format records
  are easy to find.

Its weaker choices are also clear:

- The dashboard is very card-heavy and becomes dense on a phone.
- The AI toss choice is random rather than conditions-aware.
- Generated fallback roster strings can replace authoritative squad state.
- Crypto speculation, developer cheats, shortcut blocking, and developer-tool
  blocking do not improve the cricket simulation.
- The browser-only save is less resilient than Cricket Legacy's checksummed,
  migrated, multi-slot native persistence.
- It has Player Career only; Cricket Legacy also has a complete Manager Career.

## 4. Comparative Product Matrix

| Area | APK strength | Website strength | Cricket Legacy direction |
| --- | --- | --- | --- |
| Career breadth | Life, finance, press, injury, management | Rival, followers, endorsements, legacy ending | One Player Life hub for development, finance, media and legacy without crowding Career Hub |
| Dashboard | Broad menu of life systems | Obvious next action and season goals | Keep one resolver-owned next action; avoid copying the website's card density |
| Captaincy | Management-flavoured screens | XI -> order -> pitch -> toss -> match ritual | Enforce real authority and expose captain tools only after earning captaincy |
| Toss | Basic match flow | Visible ceremony | Animated deterministic Heads/Tails call, then conditions-aware AI or user Bat/Bowl choice |
| Match briefing | Match/tour screens | Clear venue and pitch report | Show venue, weather, surface character, and practical cricket consequence |
| Match control | Career choices | Three pacing modes | Keep Watch, Key Moments, Instant, plus stable 1x/2x/4x live pacing |
| Audio | One large review track | Procedural layered cues | Keep compact native assets, but distinguish sixes with pitch and crowd layering |
| Progression | Many separate career screens | Strong level/legacy arc | Keep School -> U19 -> three domestic tiers -> format-specific international duty |
| Off-field | Property, shares, business, sponsors | Phone, endorsements, crypto | Bounded Player Life systems with explicit prices, effects, limits and fictional-token disclosure |
| Persistence | Old local Android state | Browser localStorage plus export | Keep checksummed AsyncStorage envelopes, migrations and slots, plus user-facing career import/export |
| Manager mode | Secondary management surface | Not present | Keep the full 24-club, three-tier, year-round Manager Career |
| Responsive UI | Fixed portrait bitmap layouts | Responsive web grid, but dense | Keep native safe areas, measured footers, compact breakpoints, and bounded widths |

## 5. Improvements Implemented From The Benchmark

### 5.1 Captain authority is now real

Player Career no longer grants team-wide decisions merely because the user is
playing for the team.

- A normal player controls personal batting/bowling decisions only.
- A club captain controls the club XI, batting order, team tactics, toss call
  and Bat/Bowl decision when the call wins.
- A national captain controls those decisions for the national side only.
- Club captaincy does not accidentally grant national-team authority.
- A manager always has team authority.
- The engine keeps `userTeamId` for interactive play while separately tracking
  who may control the toss.
- Store actions reject unauthorised XI/tactics changes even if called outside
  the normal screen.

### 5.2 Captain tools are contextual

- Player Career shows `Set captain's XI & tactics` on the matchday card only
  when the user owns authority for that fixture.
- The Team & Selection screen is read-only for a non-captain.
- Transfer budget and transfer controls remain Manager Career concerns.
- International fixtures edit the national XI; domestic fixtures edit the
  active club/youth XI.

### 5.3 The pre-match brief now explains the match

The Matchday screen now shows:

- The actual generated venue.
- Match format.
- Pitch character.
- Weather.
- A concise cricket consequence, such as early seam on an overcast green
  surface, growing spin on a dusty Test pitch, or boundary prevention on a
  flat pitch.
- Whether the Heads/Tails call belongs to the user or the AI captain.

This improves on the website reference because the underlying toss AI remains
deterministic and conditions-aware.

### 5.4 Sixes have a distinct audio signature

Fours and sixes still reuse the compact CC0 impact recording, but they no
longer differ by volume alone:

- A four uses the normal impact transient.
- A six uses a slightly lower playback rate without pitch correction, creating
  a heavier strike.
- A delayed crowd layer follows the six.
- Heavy haptic feedback remains attached to the event.

This adds differentiation without increasing APK size with another large audio
asset.

### 5.5 Career breadth is consolidated, not scattered

`Player Life` now provides five responsive tabs:

- Overview: explicit selection risk plus the latest ten real appearances.
- Development: hireable batting/bowling/mental coaches, personal physio,
  performance analysis and one-time equipment boosts.
- Finance: bank, property, businesses, the existing shares route and a
  deterministic fictional Legacy Token exchange.
- Media: visible follower count and a bounded phone with Feed, Inbox, News and
  Money views, plus player press and sponsor negotiation.
- Legacy: trophy museum, career summary, captain disputes and career-file
  import/export.

Career Hub links to this one destination rather than duplicating each system as
a separate dashboard card.

### 5.6 Progress is sourced from authoritative match state

- Career Hub separates actual Domestic and International totals.
- Records and century lists use persisted matches/stats rather than generated
  report rows.
- The rolling report contains only the user's ten most recent appearances.
- Manager Hall of Fame has a separate board and qualification panel based on
  trophies, promotions, win rate, players produced and legacy score.

### 5.7 Matchday remains readable at every speed

- The 2D field, score context and three-line chronological commentary remain
  mounted at 2x and 4x.
- Routine renders are batched, while wickets, boundaries, milestones and over
  ends still surface immediately.
- Bowling users can skip the bowling innings without confusing that action
  with full Match Simulation.
- The career batting stance exists only in the live batting controls, avoiding
  two competing playstyle settings.

### 5.8 Training and bowling exploits are closed

- Training has six paid sessions per season and a maximum of three in one
  focus. There is no zero-coin `+1` path.
- All-rounder bowling values are guaranteed minimums of 2 T20, 4 List A and 8
  First-Class overs, not caps. Skill, form, economy and live wickets can earn
  additional legal overs.

### 5.9 Manager entry and preparation are coherent

- A new Rookie manager begins in March at the active T20 block instead of
  watching two full locked blocks simulate before the first decision.
- The forced pre-match team speech was removed. Optional Match Preparation,
  Opposition Analysis and the wallet-funded Morale Session remain deliberate
  choices.
- Youth Academy appears once in the persistent footer rather than being
  repeated across Hub and Club Office.

### 5.10 Compact adaptive audio covers missing moments

Coin, phone, trophy and defeat signatures reuse the small bundled CC0 assets at
distinct rates and volumes. Background music moves between Menu, Match Calm,
Match Tense, Victory and Defeat mixes using a phase-shifted second layer, so no
large soundtrack pack is required.

## 6. Deliberately Rejected Reference Ideas

- No copied images, player names, UI text, audio, or source logic.
- No fixed-image page backgrounds.
- No fake roster fallback when authoritative save data is unavailable.
- No random toss AI.
- No real-money, network-priced or undisclosed cryptocurrency. The Legacy
  Token is fictional, deterministic and uses only earned Wallet Coins.
- No production cheat panel.
- No context-menu or developer-tool blocking.
- No giant dashboard containing every system at once.
- No browser-only persistence.

## 7. Remaining Validation

- Run the supplied APK on a working emulator/device if exact transition timing,
  balance, and touch behaviour need to be compared.
- Complete a physical two-to-three-season Cricket Legacy playthrough to
  validate density, thermals, calendar transitions, and captaincy hand-offs.
- Test the new four/six distinction on low-volume phone speakers. If it remains
  too subtle, add a separately mastered CC0 six impact in a later audio pass.
