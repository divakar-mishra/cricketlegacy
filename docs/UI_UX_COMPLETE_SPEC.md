# Cricket Legacy UI/UX Specification

Source-audited on 2026-07-30 against the current `D:\APP` working tree.

## 1. Scope and confidence

This document describes the UI and UX that the current source code implements:

- visual tokens, typography, spacing, radii, gradients, shadows and icons;
- responsive and platform-specific behavior;
- navigation and screen transitions;
- reusable controls and visual surfaces;
- every registered screen and its primary interaction model;
- custom popups, overlays, guides, alerts and ceremonial moments;
- match presentation, animation, sound and haptic behavior;
- accessibility, localization, loading, empty and error states;
- known gaps where the setting or visual promise is not fully implemented.

The descriptions below are source-audited. They are not a claim that every state
has been visually inspected on every physical Android/iOS device. Audio format,
duration and playback descriptions are derived from the bundled files and
current playback mappings.

## 2. Product identity

| Item                       | Current value                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Display name               | Cricket Legacy                                                 |
| App slug                   | `cricket-legacy`                                               |
| Deep-link scheme           | `coverdrive`                                                   |
| Android package            | `com.coverdrive.cricket`                                       |
| iOS bundle ID              | `com.coverdrive.cricket`                                       |
| Default theme              | Dark                                                           |
| Supported theme choices    | Dark, Light, System                                            |
| Supported language choices | English, Hindi (App Chrome Only)                               |
| Orientation                | `default`, so portrait and landscape are not explicitly locked |
| Tablet support             | iPad support is enabled                                        |
| Runtime                    | Expo / React Native, Hermes, new architecture enabled          |
| Main visual idea           | Night-cricket charcoal, emerald pitch green and trophy gold    |

The native launch screen and adaptive icon use a dark cricket green background:
`#0A1912`.

## 3. Global color system

### 3.1 Dark palette

Dark is the default and most fully art-directed palette.

| Token          | Hex/RGBA           | Use                                       |
| -------------- | ------------------ | ----------------------------------------- |
| `bg`           | `#07080C`          | Main app background                       |
| `bgElevated`   | `#0C0E15`          | Modal and elevated panel background       |
| `surface`      | `#10131E`          | Cards, bars and standard panels           |
| `surfaceAlt`   | `#171C2A`          | Selected rows and secondary surfaces      |
| `surfaceMuted` | `#090B12`          | Recessed controls and tracks              |
| `primary`      | `#00C97A`          | Main action green                         |
| `primaryDark`  | `#00A364`          | Active/selected green                     |
| `primaryLight` | `#33D993`          | Highlights and readable green text        |
| `accent`       | `#E8B332`          | Trophy gold and premium/reward emphasis   |
| `accentDark`   | `#C4902A`          | Dark gold                                 |
| `accentLight`  | `#F5CF65`          | Bright gold                               |
| `text`         | `#ECEFF4`          | Primary text                              |
| `textMuted`    | `#7A8899`          | Secondary text                            |
| `textFaint`    | `#40505E`          | Tertiary text and disabled context        |
| `danger`       | `#E5484D`          | Wickets, injury, destructive/error states |
| `dangerDark`   | `#B93A3E`          | Dark danger                               |
| `warning`      | `#F5A524`          | Pressure and warning states               |
| `success`      | `#30D070`          | Success, safe run rate and completion     |
| `info`         | `#4C9AFF`          | Informational and gem/blue states         |
| `border`       | `#1A2035`          | Standard hairlines and borders            |
| `borderStrong` | `#242E45`          | Focused/strong borders                    |
| `overlay`      | `rgba(0,0,0,0.70)` | Standard modal scrim                      |
| `white`        | `#FFFFFF`          | White                                     |
| `black`        | `#000000`          | Black                                     |

### 3.2 Light palette

| Token          | Hex/RGBA           |
| -------------- | ------------------ |
| `bg`           | `#F3F7F4`          |
| `bgElevated`   | `#FFFFFF`          |
| `surface`      | `#FFFFFF`          |
| `surfaceAlt`   | `#E7F0EA`          |
| `surfaceMuted` | `#EDF3EF`          |
| `primary`      | `#009B5E`          |
| `primaryDark`  | `#007547`          |
| `primaryLight` | `#00B86E`          |
| `accent`       | `#B67B0B`          |
| `accentDark`   | `#8A5D08`          |
| `accentLight`  | `#D69A28`          |
| `text`         | `#0E1B13`          |
| `textMuted`    | `#4C5F54`          |
| `textFaint`    | `#7C8B82`          |
| `danger`       | `#C4362B`          |
| `dangerDark`   | `#9E2A22`          |
| `warning`      | `#B26A00`          |
| `success`      | `#1F8A4C`          |
| `info`         | `#2A6FD6`          |
| `border`       | `#D3DFD8`          |
| `borderStrong` | `#B4C7BB`          |
| `overlay`      | `rgba(0,0,0,0.35)` |

Some cinematic, premium and newspaper surfaces intentionally use fixed dark or
paper colors even in light mode. They do not recolor completely with the theme.

### 3.3 Gradients

| Gradient | Dark                                                | Light                  |
| -------- | --------------------------------------------------- | ---------------------- |
| Night    | `rgba(11,14,28,0.96)` to `rgba(6,7,16,0.84)`        | `#EEF4F0` to `#F3F7F4` |
| Pitch    | `rgba(14,18,32,0.96)` to `rgba(7,8,12,0.84)`        | `#E7F1EA` to `#F3F7F4` |
| Brand    | `rgba(30,144,72,0.98)` to `rgba(44,201,106,0.86)`   | `#2FA55B` to `#1F8A46` |
| Gold     | `rgba(245,207,101,0.98)` to `rgba(196,144,42,0.88)` | `#D69A28` to `#B67B0B` |
| Danger   | `#E5484D` to `#B93A3E`                              | `#E5646A` to `#C4362B` |
| Surface  | `rgba(23,28,42,0.75)` to `rgba(16,19,30,0.94)`      | `#FFFFFF` to `#EDF3EF` |

`Screen` and gradient `Button` render native `expo-linear-gradient` surfaces on
both iOS and Android. There is no Android-only solid-stop branch.

### 3.4 Semantic color rules

- Emerald green means primary action, active selection, progress or safe match
  pressure.
- Gold means trophy, premium, reward, champion or high-value action.
- Red means wicket, injury, failed/collapsed deal, destructive action or danger.
- Amber means warning, moderate pressure or pending negotiation.
- Blue means information, gems, signed deal, season pass and supporting data.
- Muted gray means unavailable, locked, historical or supporting information.

## 4. Typography

### 4.1 Font families

| Role                  | Font               |
| --------------------- | ------------------ |
| Display/heaviest text | Sora ExtraBold 800 |
| Heading               | Sora Bold 700      |
| Semi heading          | Sora SemiBold 600  |
| Body                  | Inter Regular 400  |
| Medium UI             | Inter Medium 500   |
| Semibold UI           | Inter SemiBold 600 |
| Bold UI               | Inter Bold 700     |

`AppText` maps requested weight to the bundled family. Weights 800 and above use
Sora; weights 400 to 700 use the matching Inter asset. An explicitly supplied
font family wins.

### 4.2 Type scale

| Token     | Size |
| --------- | ---- |
| `xs`      | 11   |
| `sm`      | 13   |
| `md`      | 15   |
| `lg`      | 18   |
| `xl`      | 22   |
| `xxl`     | 28   |
| `xxxl`    | 36   |
| `display` | 46   |

Font weights are 400, 500, 600, 700, 800 and 900. Scores, major ceremony names,
award titles and selected product titles generally use Sora. Dense tables and
supporting copy use Inter.

All text rendered with a Sora family through `AppText`, including headings and
scoreboard digits, uses `maxFontSizeMultiplier={1.2}` unless a stricter local
value is supplied. Buttons can also shrink labels to 72% if required. Inter body
copy continues to follow its local Dynamic Type configuration.

## 5. Spacing, shape and elevation

### 5.1 Spacing

| Token  | Pixels/dp |
| ------ | --------- |
| `xs`   | 4         |
| `sm`   | 8         |
| `md`   | 12        |
| `lg`   | 16        |
| `xl`   | 24        |
| `xxl`  | 32        |
| `xxxl` | 48        |

### 5.2 Radius

| Token  | Radius |
| ------ | ------ |
| `sm`   | 8      |
| `md`   | 12     |
| `lg`   | 16     |
| `xl`   | 24     |
| `pill` | 999    |

The standard card uses the deliberately restrained 8px radius. Buttons use
12px. Hero, premium and cinematic surfaces can use 16px or 24px.

### 5.3 Shadows

| Shadow | Details                                                        |
| ------ | -------------------------------------------------------------- |
| Card   | Black, 35% opacity, radius 12, offset 0/6, Android elevation 6 |
| Soft   | Black, 20% opacity, radius 6, offset 0/3, Android elevation 3  |

Standard cards use Android elevation 1 or the soft iOS shadow. Heavy shadows are
reserved for modals, hero cards and high-value moments.

## 6. Responsive layout

### 6.1 Base screen behavior

`Screen` is the shared full-screen wrapper:

- safe-area top and bottom insets are respected;
- horizontal padding is about 4.5% of viewport width, clamped to 12-24dp;
- padded content is centered and capped at 980dp;
- scrolling screens hide the vertical indicator and disable overscroll;
- Android scroll content is not aggressively clipped, avoiding disappearing
  transformed/dynamic children during fast updates;
- action footers are normal flex siblings below the scroll viewport, never
  absolute overlays;
- action footers use `flexShrink: 0` and include the bottom safe area, so the
  final scroll item ends before the footer begins without a calculated spacer;
- native gradients are retained on both Android and iOS.

### 6.2 Compact breakpoint

The compact breakpoint is 380dp:

- card padding drops from 16 to 12;
- responsive two-column card layouts can collapse to one column;
- store rows move purchase actions under their copy;
- modal and list layouts use flex wrapping, minimum widths and bounded heights.

The codebase contains extensive use of `flexWrap`, `minWidth: 0`, full-width
containers, bounded modal heights and responsive dimensions. It does not rely on
one fixed phone width.

### 6.3 Orientation and large screens

The app does not lock orientation and iPad support is enabled. The 980dp content
cap prevents tablet layouts from stretching indefinitely, but many screens are
still phone-first rather than tablet-specific split views.

The shared footer and modular-avatar paths were exercised on an Android
emulator at effective 360x800, 390x844, 412x915, 768x1024, 915x412 landscape
and 1024x768 tablet viewports. In each case, the scroll viewport ended before
the Player Creation or Cosmetics action footer and every avatar control remained
reachable. This is targeted Android coverage, not a claim that every screen has
been approved on every physical Android/iOS device.

### 6.4 Career action state

Player and Manager Home screens derive their primary action from the shared
career-step resolver instead of independently rendering boolean-driven cards.
Only one primary action is presented at a time.

Player steps cover mandatory calendar events/training, selected matchday,
benched/rested matchday, pending story decisions, off-season transfers, season
wrap-up and youth promotion. The selected step owns its title, explanation,
button label and action. A player who cannot afford training receives `Free
Basic Nets`, which costs zero coins and improves exactly one weakest eligible
attribute by one.

Manager steps cover urgent job offers, appointment acknowledgement, world
simulation, squad readiness, matchday, press events, off-season work and season
rollover. Job offers take priority over routine cards. Accepting a job
atomically switches the club and roster, resets board confidence to 75, starts
a five-match grace period and queues the appointment presentation.

Schema version 23 persists selection guarantees/boosts and manager appointment,
job-match and grace-period state so reopening the app cannot recreate
contradictory cards.

## 7. Reusable interaction system

### 7.1 Buttons

Sizes:

- small: 40dp;
- medium: 52dp;
- large: 60dp.

Variants:

| Variant   | Surface                     | Text             |
| --------- | --------------------------- | ---------------- |
| Primary   | Brand green gradient        | White            |
| Gold      | Gold gradient               | Theme background |
| Danger    | Red gradient                | White            |
| Secondary | `surfaceAlt`, strong border | White            |
| Ghost     | Transparent, 1.5px border   | `primaryLight`   |

Button press feedback:

- scale and opacity move to 0.96/0.88 over 80ms using timing animation;
- release returns both values over 120ms without spring overshoot;
- Android gets a bounded white 18% ripple;
- disabled opacity is 0.45;
- loading replaces the label with a spinner;
- labels stay on one line and can shrink to 72%;
- a recorded glass-tap sound and selection haptic fire when the action runs;
  Sound and Haptics settings gate the two feedback channels independently.

### 7.2 Cards and choices

- Standard `Card`: themed surface, 8px radius, 1px border, overflow clipped.
- Interactive cards fade to 92% and fire a selection haptic.
- `SelectableCard`: 1.5px border, 12px radius, selected green border and
  `surfaceAlt`; selected state has a filled 20px radio dot.
- `FluidChoice`: highlighted glass choice, enters over 420ms with 70ms row
  staggering, presses to 0.96 and commits through a timed 0.9 scale dip.
- `LockedFeatureCard`: muted surface, lock icon, reason and optional gold
  progress bar.

### 7.3 Glass surfaces

`GlassSurface` uses `expo-blur`, a translucent themed surface, a diagonal white
sheen and an 18% white border. Highlighted glass adds an accent wash. Blur
intensity is calculated as `24 + 36 * intensity`.

On Android, `GlassBlurProvider` exposes an explicit `BlurTargetView` and each
surface uses `dimezisBlurViewSdk31Plus` with a blur reduction factor of 3. Modern
Android devices therefore receive backdrop blur instead of elevation-based fake
glass. Unsupported Android versions retain the translucent surface and sheen.
There is no Android elevation fallback in `GlassSurface`.

### 7.4 Header and navigation controls

- `ScreenHeader` has a visible 44x44 `surfaceAlt` back button with a
  `borderStrong` outline and chevron icon, a one-line title, optional subtitle
  and optional right-side action.
- `HubTabBar` is a glass bottom bar with Ionicons. Active tabs use a filled icon,
  gold text and a 28x3 gold top indicator.
- Hub tabs support 46dp horizontal swipe navigation as well as taps.
- Player hub tabs: Home, Stats, Progress, Profile. Pending story decisions are
  priority cards in Home rather than a hidden footer destination.
- Manager hub tabs: Home, Club, Store, Academy, Records.

### 7.5 Progress, counters and loading

- Progress bars animate width for 480ms and clamp values to 0-100%.
- Number counters use a 350ms cubic ease-out from the previous value.
- Skeleton placeholders pulse from 35% to 85% opacity every 800ms.
- The global error boundary replaces a crash/white screen with a themed
  "Something went wrong" screen and a Try Again action.
- Standard buttons show an `ActivityIndicator` during async work.

### 7.6 Icon and illustration language

- The primary UI icon set is Ionicons through a shared `Icon` wrapper.
- Cricket/player identity uses the supplied modular 512x512 PNG avatar pack:
  186 registered assets and 300 deterministic recipes (150 male and 150
  female). Every saved appearance stores stable asset IDs rather than image
  objects or preset positions.
- The shared layered renderer supports male/female appearance, narrow/medium/
  wide rigs, skin tone, eyes, paired front/back hair, male beard and moustache,
  headwear, outfit and the existing premium/legend profile frames. Headwear
  hides hair visually while retaining the selected hairstyle.
- A legendary/gold frame uses `#D5B56D`; its secondary dashed ring uses
  `#B9F23D`.
- Operational player status uses platform-independent vector/view badges:
  captain is a gold `#D5B56D` circle with a Sora SemiBold "C"; injury is a
  `#E5484D` badge with a white cross; fitness is a 4x22 vertical progress pill;
  mood is a 6px green/amber/red glow dot paired with a numeric score.
- Squad, academy and transfer rows expose those status badges with accessibility
  labels and numeric progress values.
- Emojis are restricted to narrative, achievement and ceremonial content where
  they are part of the prose or event identity.

### 7.7 Career spotlight, wallet and data surfaces

The Career Hub and Manager Hub share a 190dp stadium spotlight:

- generated floodlit-stadium bitmap at 96% opacity;
- dark overlay `rgba(1,5,10,0.42)`;
- mode and status chips use `rgba(4,8,12,0.78)`;
- lower copy band uses `rgba(2,5,9,0.78)`;
- a 42x3 rule inherits the active club/team accent;
- the title remains white so club colors cannot reduce its contrast;
- the spotlight is static. It does not replay an entrance or looping sheen when
  hub state updates, so cards do not black out or appear to rise from the
  bottom during normal play.

The wallet bar is one horizontal themed surface:

- cash icon is gold;
- gems icon is info blue;
- energy icon is warning amber;
- values animate with CountUp and energy shows current/maximum.

The league table is deliberately dense. It shows position, team, played, wins,
losses, ties, no-results, points and NRR. The user's team gets a `surfaceAlt`
row and bold white team text. The rivalry card uses a success border/bar while
the user leads and danger while behind.

## 8. Navigation and screen transitions

The default native stack transition is slide from right. Exceptions:

| Route                   | Transition/presentation |
| ----------------------- | ----------------------- |
| Splash                  | Fade                    |
| Main Menu               | Fade                    |
| Match                   | Fade                    |
| Career Hub              | Fade                    |
| Narrative               | Slide from bottom       |
| Press                   | Slide from bottom       |
| Awards Night            | Fade                    |
| Milestone Cinematic     | Fade, transparent modal |
| Notification Inbox      | Slide from right        |
| Daily Challenge         | Slide from bottom       |
| Board Meeting           | Fade, transparent modal |
| Hall of Fame Ceremony   | Fade                    |
| Injury Report           | Slide from bottom       |
| Transfer Deadline Day   | Fade                    |
| Youth Graduate Ceremony | Fade                    |

The status bar uses light content in dark mode and dark content in light mode.
Android hardware back is guarded in active matches and both career hubs where
leaving could interrupt the current flow.

## 9. Popup and overlay catalog

Queued app overlays use one global priority slot so career-hub startup cannot
stack several prompts:

| Priority | Class      | Current queued surfaces                               |
| -------- | ---------- | ----------------------------------------------------- |
| 1        | Critical   | Glass alerts, Injury Report, Board Meeting            |
| 2        | Engagement | Reward popup, Starter Pack, achievement presentation  |
| 3        | Prompt     | Contextual offer, mode guide, first-launch onboarding |

The queue is priority ordered, FIFO within the same priority and enforces a
3-second gap after one queued overlay closes before the next opens. A component
can still render independently in isolated tests when no queue provider exists.

### 9.1 Global onboarding

- Trigger: first hydrated launch unless onboarding is complete.
- Five slides: live match, player legend, manager detail, records, daily
  rewards/season pass.
- Accent sequence: `#31A85A`, `#E9B23B`, `#4C9AFF`, `#CD7F32`, `#E9B23B`.
- Card: theme surface, 24px radius, 1px strong border, maximum width 400 and
  maximum height 92%.
- Header wash: slide accent at 13% opacity to transparent.
- Icon: 64px circle with 2px accent border.
- Motion: modal fade; slide 260ms; icon 300ms after 80ms; copy 320ms after
  120ms.
- Interaction: Next, Previous, Skip, dots and 48dp horizontal swipe.

### 9.2 Player and manager mode guide

- Backdrop: `rgba(0,0,0,0.78)`.
- Card: `bgElevated`, 16px radius, strong border, max width 480.
- Gold icon: `#F7D06E`; close icon: `#A9B7AD`.
- Each step slides from right in 220ms; backdrop fades in 180ms/out 140ms.
- The "Your next action" box uses `surfaceAlt` and a 3px primary-green left rule.
- Interaction: Previous, Next/Start Playing, dots, 54dp swipe and close.
- Player guide has five steps: next action, purposeful training, match role,
  selection/progression and career review.
- Manager guide has six steps: Continue flow, domestic year, XI preparation,
  match plan, evidence-led recruitment and running the club.

### 9.3 First-match guide

- Full-screen scrim: `rgba(0,0,0,0.48)`.
- Themed glass card with `bgElevated` and `primaryDark` border.
- Slides in from below over 200ms and fades out over 200ms.
- Three six-second prompts: stance, chase reading and post-match review.
- Can auto-advance, skip or move manually.

### 9.4 Coach guidance placement

- No Coach Tip is permanently or absolutely overlaid on the Career Hub,
  Manager Hub or Matchday screen.
- First-match instruction remains in the dismissible `FirstMatchGuide`.
- Complex rules use inline info buttons and in-flow contextual guidance, so a
  coaching message cannot cover a home card, scoreboard or match control.

### 9.5 Just-in-time mechanic guidance

Complex simulation rules use a three-layer guidance system:

1. Inline info buttons are 36dp square by default, use the Ionicons
   `information-circle-outline` symbol and open the shared `GlassAlert` surface.
   Each alert has one short summary and no more than three rule bullets.
2. Contextual mechanic tips render in normal document flow, never as an
   absolute overlay. They use `bgElevated`, a 1px primary border, a bulb icon,
   concise copy, a "See the rule" action and a 36dp close action. Entry is a
   220ms `FadeInDown`; exit is a 160ms fade. Dismissal is persisted in
   `settingsStore`, and Replay game guides clears it.
3. Cricket Academy is the searchable handbook in Settings. Its stable
   four-segment control switches between Career, Match, Club and Physical
   topics. Search spans all categories. Topic cards expand in place to reveal
   exact rule bullets.

Current inline placements cover Scout Confidence, tactical modifiers,
First-Class over-rate, board grace, selection formula, U19 readiness, manager
First-Class workload and Player Career match condition. Contextual tips are
prioritized so only one is shown at a time; after dismissal, the next relevant
undismissed mechanic can appear.

### 9.6 Reward popup

- Used by daily rewards, daily/weekly quests and season-pass claims.
- Backdrop: `rgba(0,0,0,0.78)`.
- Card: `bgElevated`, gold border, 16px radius, max width 420, max height 82%.
- Icon disc: `#3A2800`, border `#C6902A`, icon `#F7D06E`.
- Reward checks: `#7FD89A`.
- CTA: gold Collect button.
- Motion: 180ms eased backdrop fade, 200ms cubic card zoom and 140ms exit.
- Feedback: success notification haptic when data becomes visible.

### 9.7 Starter pack popup

- Backdrop: `rgba(0,0,0,0.75)`.
- Card: `#0F241A`, gold border `#C6902A`, 24px radius.
- Header gradient: `#17211B` to `#0B100D` to `#17211B`.
- Header and badge text: `#D5B56D`.
- Badge: `#17211B`, border `#8A6A26`.
- Content lists coins, gems and seven-day ad removal.
- Motion: 180ms eased backdrop fade, 200ms cubic card zoom and 140ms exit.
- Feedback: medium impact on show, success haptic on the CTA.

### 9.8 Contextual monetization popup

Common shell:

- backdrop `rgba(0,0,0,0.7)`;
- theme surface-to-elevated gradient;
- 24px radius, 1.5px border;
- 200ms timed ZoomIn without spring overshoot;
- icon glow pulses from 30% to 100% opacity every 900ms.

| Trigger           | Accent    | Main behavior                  |
| ----------------- | --------- | ------------------------------ |
| Energy empty      | `#31A85A` | 10-gem refill or wait          |
| Injury recovery   | `#E5484D` | Fast-track recovery or sit out |
| Streak protection | `#4C9AFF` | 10-gem refill to continue      |
| First gem pack    | `#4C9AFF` | Opens gem packs                |
| VIP/remove ads    | `#E9B23B` | Opens the account upgrade      |

The compact in-hub banner uses the same accent at 13% and 3% opacity, enters
with a 400ms fade and includes an accent-colored CTA pill.

### 9.9 Achievement presentation

Achievement tier colors:

| Tier     | Color     | Tint                     |
| -------- | --------- | ------------------------ |
| Bronze   | `#CD7F32` | `rgba(205,127,50,0.12)`  |
| Silver   | `#B8BEC5` | `rgba(184,190,197,0.12)` |
| Gold     | `#E9B23B` | `rgba(233,178,59,0.14)`  |
| Platinum | `#B4E4FF` | `rgba(180,228,255,0.14)` |

Achievement catalogs are filtered by the active save mode. Player-only
batting/bowling milestones do not appear in Manager Mode; manager team and
career achievements have their own score denominator and unlock checks.

Bronze:

- compact 240px toast at the upper right;
- slides in/out from the right;
- 2-second auto-dismiss;
- title/description density is reduced.

Silver:

- full-width lower toast;
- slides up from the bottom;
- pulses 500ms up/500ms down three times;
- 3.5-second auto-dismiss.

Gold and platinum:

- full-screen `rgba(0,0,0,0.82)` cinematic;
- gold background `#1A1000 / #2A1F00 / #1A1000`;
- platinum background `#000D1A / #001A2E / #000D1A`;
- two continuously pulsing rings;
- icon scales in over 200ms without spring overshoot;
- 4.5-second auto-dismiss or tap to dismiss;
- impact haptic on show.

### 9.10 Share achievement popup

- Native fade modal with `rgba(0,0,0,0.8)` backdrop.
- Share card is fixed at 320px wide with a 24px radius.
- Bronze/gold cards: `#2A1C08` to `#1A1005`.
- Silver card: `#1A1E22` to `#0E1215`.
- Platinum card: `#081828` to `#040E18`.
- Modal card enters with a 350ms ZoomIn.
- Native builds capture a PNG through `react-native-view-shot` and use
  `expo-sharing`; Expo Go falls back to text sharing.

### 9.11 Newspaper clipping

- Backdrop: `rgba(8,10,12,0.82)`.
- Paper: `#EEE1BD`; paper border/rules: `#8B7657` and `#AA9875`.
- Main ink: `#33291D`; headline: `#211B14`; subheadline: `#443728`.
- Kicker/trophy/brand: `#7A271D`; footer: `#5A4935`.
- Share button: `#176B3A` with white text.
- Headline is 34px/38px, centered and newspaper-like.
- The modal captures only the paper clipping, not the toolbar or share button.
- Share targets are exposed through the system share sheet, including WhatsApp
  and Instagram when installed.

### 9.12 Manager pre-match talk

- Backdrop: `rgba(0,0,0,0.68)`.
- Standard card with 1.5px gold border.
- Talk choices use `surfaceAlt`, themed border and stacked label/description.
- Native modal fade; Skip Talk remains available.

### 9.13 Manager world simulation

- Backdrop: `rgba(0,0,0,0.68)`.
- Panel: theme surface, 12px radius, gold border, max width 420.
- Gold activity spinner and gold 8px progress fill.
- Live-region copy announces progress while all 24 clubs are simulated.

### 9.14 Transfer bid war

- Backdrop: `rgba(0,0,0,0.75)`.
- Card: `bgElevated`, 24px radius, 2px gold border, max height 76%.
- Enters from below over 220ms.
- Timer color is gold normally, warning below 20 seconds and danger below 10.
- User offer is green; rival offer is red.
- Primary counter button is green; Withdraw is bordered with green text.
- Detail body scroll height is clamped from 190-300dp according to viewport.

### 9.15 Commentary archive

- Full-screen native slide modal.
- Uses active theme background and safe areas.
- Last ball has a 2px gold top rule.
- Tabs: This Over, Previous, Innings; active tab gets a primary-green underline.
- Rows enter over 180ms with up to 180ms of stagger.
- Outcome chips inherit the commentary tone.

### 9.16 Glass alerts

Confirmations and errors use the app-owned `GlassAlert` service rather than
React Native `Alert.alert`. This includes save deletion, prospect/player
release, transfer confirmation, career exits, investments, login errors and
purchase/ad failures.

- Backdrop: `rgba(0,0,0,0.78)`.
- Glass card: `#0C0E15`, 1px `#1A2035` border, 16px radius, max width 420 and
  max height 78%.
- Title: Sora, 22px, bold, centered, `#ECEFF4`.
- Message: Inter, 13px/21px, centered, `#A8B1C0`, scrollable up to 300dp.
- Primary confirm: green `#00C97A`; destructive action: red `#E5484D`;
  cancel: ghost button.
- Motion: backdrop fades in over 180ms; card uses a 200ms cubic `ZoomIn`; exit
  fade is 140ms.
- Alerts enter the global queue at priority 1 and retain native-style
  cancelable, destructive, dismiss and button-callback semantics.

### 9.17 Training result popup

- This is a transparent native modal centered over a full-screen scrim, so it
  cannot be clipped by the training list or overlap the action footer.
- Card: `bgElevated`, 24px radius, 2px primary-green border.
- It fades in over 180ms and uses the shared 200ms cubic card zoom.
- Overall improvement uses a gold pill with black text.
- New attribute values use primary-light green; gain pills use success green.
- Individual rows enter over 220ms with 80ms staggering.
- It appears immediately after a successful action and remains until dismissed.
- A failed/blocked training action instead shows a themed card with warning
  border/text.

### 9.18 Match DRS prompt and result

- A reviewable user dismissal pauses the live loop.
- Prompt: theme surface, 12px radius, 1.5px danger border.
- Review action is info blue; Accept uses `surfaceAlt`.
- The prompt enters from below over 200ms.
- Overturned result is full success green; upheld result is full danger red.
- Result text is white with an 80%-white subtitle.
- Result enters over 200ms and fades out over 300ms.

## 10. Match UI and UX

### 10.1 Match phases

The screen has loading, pre-match, live, done and empty states.

Pre-match offers three presentation modes:

- watch ball by ball;
- key moments;
- instant simulation.

It also exposes legal tactics, team/role context and a guarded back action.

Live match supports:

- headline score, overs, run rates and target/chase context;
- current batter/bowler matchup;
- required-run-rate pressure;
- partnership;
- one recent-commentary feed directly below the score/tactical header, plus a
  full ball-by-ball archive;
- one stable 2D live-field view with no live tabs;
- manager live tactics;
- career batting stance;
- DRS review prompt;
- pause/resume, skip-to-my-batting/rest-of-innings, 1x/2x/4x and full simulate.

### 10.2 Match speeds

| Speed | Typical non-user ball | Typical user batting ball | Rich UI |
| ----- | --------------------- | ------------------------- | ------- |
| 1x    | 1800ms                | 2600ms                    | Full    |
| 2x    | 1080ms                | 1560ms                    | Reduced |
| 4x    | 450ms                 | 650ms                     | Reduced |

Wicket/milestone linger starts at 3300ms; innings-break linger starts at
3800ms. The same speed formula is applied. Non-key balls in key-highlights mode
use 45ms.

At 2x and 4x:

- rich panels and cinematic overlays are hidden;
- numeric score CountUp is bypassed;
- typewriter commentary is bypassed;
- only the fast score/commentary essentials remain;
- ordinary React UI updates are batched every two balls at 2x and every four
  balls at 4x, while wickets, boundaries, milestones, over ends, innings ends
  and match ends always render;
- every delivery still enters the scorecard and commentary archive;
- simulation outcome is unchanged; speed changes presentation pacing only.

### 10.3 Score and pressure colors

- RRR 9 or below: success green.
- RRR above 9: warning amber.
- RRR above 12: danger red.
- RRR bar normalizes 0-20 into a 0-100% width.
- Final over receives a dedicated "FINAL OVER" badge.
- End-of-over summary uses `surfaceAlt`, primary border and primary-light title,
  stays for two seconds and is suppressed in fast UI.
- A paused button keeps the secondary surface and gains a 1.5px gold border. It
  does not become a full solid green block.

### 10.4 Boundary, wicket and milestone motion

Full cinematic feedback runs only at 1x:

- particle count: low 8, medium 16, high 26;
- particle size: 6-16px;
- duration: 1100-1600ms with 12ms staggering;
- normal events burst upward; wicket shards fall down;
- particle rotation can reach +/-360 or 720 degrees;
- center label scales in over 200ms, holds 620ms, or 950ms for hundred/win,
  then fades over 260ms;
- center plate is `rgba(6,9,15,0.94)`, 8px radius;
- floodlight beams use `rgba(185,242,61,0.09)`.

Event particle colors:

| Event         | Colors                                      |
| ------------- | ------------------------------------------- |
| Four          | Primary, primary-light, white               |
| Six           | Gold, accent-light, primary-light, white    |
| Fifty         | Gold, primary-light, white                  |
| Hundred       | Gold, accent-light, success, white          |
| Win           | Gold, accent-light, primary, success, white |
| Wicket        | Danger, danger-dark, `#7A1216`              |
| Innings break | Info, primary-light, white                  |
| Floodlights   | `#B9F23D`, `#D5B56D`, `#F5F7F4`             |

Wicket additionally produces:

- red full-screen flash: 0 to 35% in 60ms, 18% in 80ms, then 0 in 300ms;
- horizontal camera shake: -8, +8, -5, +5, 0 over
  50/50/50/50/80ms.

### 10.5 Commentary motion

- At 1x, the newest commentary types at 14ms per character.
- At 2x/4x, the full line appears immediately.
- The live feed stores 12 recent entries and displays four at 1x or one at
  2x/4x.
- Full archive is bounded to 2400 deliveries.
- End-of-over and first-match coaching surfaces are hidden from fast UI.

### 10.6 Field presentation

2D field:

- Standard palette: outfield `#0E2A1A`, pitch `#B9915A`, boundary/30-yard
  ring `#176536`;
- Stadium Noir palette: outfield `#050806`, pitch `#233D22`,
  boundary/30-yard ring `#B9F23D`;
- selecting Stadium Noir in Premium Clubhouse immediately supplies the Noir
  palette to `FieldView` on Player and Manager matchdays;
- normal trajectory uses muted text color;
- four green, six gold, wicket red and extra blue;
- ball flight lasts 460ms, or 620ms for a six.

The 3D/GL match path has been removed. `expo-gl`, Three.js and their type
packages are not runtime dependencies. This avoids black/blank canvases and
keeps Player and Manager matches on the same predictable 2D renderer.

### 10.7 Match charts

- Wagon wheel: normal 1-3 runs gray, four green, six gold.
- Manhattan chart: over-by-over bars with wickets called out in danger color.
- Radar chart: role/attribute comparison around a themed polygon.
- Sparkline: 15% translucent area, 2px line and latest-point dot.

### 10.8 Visible match and progression rules

- T20 performance has no hidden individual run or wicket cap. Delivery
  probabilities determine outliers; a deterministic 56-match/14-match-per-team
  distribution test guards plausible season totals and innings extremes.
- The pre-match brief names the generated venue, format, pitch and weather, then
  explains the practical cricket consequence of those conditions.
- The Toss card names the winner. Bat First and Bowl First are selectable only
  when the user is the manager, club captain or national captain for that
  fixture; otherwise the AI captain's decision and the team batting first are
  explained. Club captaincy never grants national-team authority. AI choices
  account for format, pitch and weather.
- A user all-rounder in the XI receives a minimum bowling allocation of two
  overs in T20, four in ODI/List A and eight in a Test/First-Class innings.
- Match speed never changes the deterministic engine result.
- School/U19 match injury risk is reduced by 70%. School selection is
  guaranteed unless the player is injured, deliberately rested or below 18
  condition.
- A 10.0 match rating grants +20 form, +15 confidence and +15 coach trust, plus
  a next-match selection guarantee.
- Being within three matches of a tracked record grants a +25 selection boost.
- A player receives major tournament/trophy career credit only after appearing
  in at least 40% of that tournament's team matches.
- Manager lineups below 55 condition or 45 morale receive a temporary 15%
  match-performance penalty. Interactive preparation with custom tactics
  applies a fixture-scoped 10% performance boost and post-match morale gain.
- Pause uses a neutral secondary surface with an amber outline; Skip to My
  Batting locks immediately on the first tap and continues across an innings
  break when required.

### 10.9 Manager personal economy

- Wallet Coins pay for personal services; Club Budget remains the only source
  for transfers, facilities, staff and player contracts.
- Opposition Analysis costs 650 Wallet Coins once per upcoming fixture and
  grants the selected XI +2 form and +1 morale for that match preparation.
- Match Preparation is a required pre-match stage for every manager fixture.
  Watch, Key Moments and Instant Result remain unavailable until the plan is
  confirmed. The basic report explains all unit ratings out of 100 with
  Manageable/Strong/Elite danger labels; paid analysis names both threats,
  identifies a weakness and can apply its recommended tactics directly.
- Morale Session costs 8,000 Wallet Coins once per upcoming fixture and adds
  +5 morale to the three lowest-morale squad players. It is an optional
  preparation service, not a forced pre-match speech.
- Fast-Track Scouting costs 6,000 Wallet Coins once per target per season. It
  requires an existing report and adds 25 percentage points of Scout
  Confidence immediately.
- The annual contract salary is paid once when the T20 block completes. The
  personal payout is `floor(contractSalary / 200)` Wallet Coins, appears in the
  phase summary and creates one inbox notification.
- AI-simulated user-club matches in locked manager competitions pay a 30%
  oversight stipend from the normal match reward. Active VIP then applies its
  20% multiplier. The phase modal labels the competition, licence reason,
  wins-from-matches record, table effect and stipend.

## 11. Sound design

All effects are recorded-source, CC0-derived MP3 assets normalized to 44.1kHz,
stereo. They play through `expo-audio`, seek to zero for each trigger and fail
silently if audio cannot initialize. The app explicitly allows game audio while
the iOS silent switch is active.

| Event   | Bundled asset             | Length | Volume | Trigger                             |
| ------- | ------------------------- | ------ | ------ | ----------------------------------- |
| Tap     | `ui_glass_tap.mp3`        | 0.52s  | 0.42   | Shared `Button` actions             |
| Four    | `bat_impact_classic.mp3`  | 0.60s  | 0.78   | User boundary at 1x                 |
| Six     | `bat_impact_classic.mp3`  | 0.60s  | 0.88   | 0.90x heavy impact plus delayed crowd at 1x |
| Wicket  | `stump_clack.mp3`         | 1.25s  | 0.86   | Every wicket, including fast speeds |
| Fifty   | `stadium_crowd_cheer.mp3` | 6.03s  | 0.58   | Fifty milestone                     |
| Hundred | `stadium_crowd_cheer.mp3` | 6.03s  | 0.65   | Hundred milestone                   |
| Win     | `stadium_crowd_cheer.mp3` | 6.03s  | 0.68   | Match win                           |
| Crowd   | `stadium_crowd_cheer.mp3` | 6.03s  | 0.52   | Innings break                       |
| Coin    | `ui_glass_tap.mp3`        | 0.52s  | 0.62   | Toss reveal at 1.55x playback       |
| Phone   | `ui_glass_tap.mp3`        | 0.52s  | 0.48   | Player Life inbox at 1.28x playback |
| Trophy  | `stadium_crowd_cheer.mp3` | 6.03s  | 0.72   | Hall of Fame plaque at 1.06x        |
| Defeat  | `stump_clack.mp3`         | 1.25s  | 0.62   | Match loss at 0.68x playback        |

Important current behavior:

- wicket and milestone sound/haptics still fire at 2x/4x;
- four and six sound/haptics fire only when the 1x cinematic is shown;
- fours use the normal impact transient; sixes disable pitch correction at a
  0.90 playback rate and add a crowd layer after 70ms, making the events
  distinguishable without a second impact asset;
- innings-break crowd plays at every speed;
- sound toggle independently gates these effects;
- the app-level music controller loops `assets/audio/menu_ambient.mp3`
  (2m 6.9s, 44.1kHz stereo MP3) and adapts its two-layer mix between Menu,
  Match Calm, Match Tense, Victory and Defeat scenes;
- the second layer reuses the same compact track from a shifted position with
  scene-specific volume/rate, so tension changes without adding APK media;
- disabling Music pauses and seeks the ambient track back to zero; enabling it
  starts playback and persisted settings are synchronized at app startup.

## 12. Haptic design

The unified match mapping is:

| Event        | Haptic               |
| ------------ | -------------------- |
| Standard tap | Selection            |
| Four         | Light impact         |
| Six          | Heavy impact         |
| Wicket       | Warning notification |
| Fifty        | Success notification |
| Hundred      | Success notification |
| Win          | Success notification |
| Crowd        | None                 |

Buttons, selectable cards, hub tabs and fluid choices use selection feedback.
Reward claims use success notification feedback.

Ceremonial screens add stronger patterns:

- Milestone: success notification, then heavy impact 300ms later.
- Youth graduate: success notification, then heavy impact 400ms later.
- Hall of Fame plaque: success notification, heavy at 500ms, medium at 1000ms.
- Awards champion: success notification, then heavy/medium/light at
  300/480/650ms; later awards use medium.
- Board meeting: error, success or warning notification according to outcome.
- Injury report: warning notification.

All normal controls, match moments and cinematic/ceremonial screens route
through the centralized haptic wrapper. Every vibration therefore respects the
Haptics setting and degrades to a no-op when the platform haptic engine is
unavailable.

## 13. Animation system

### 13.1 Shared motion

| Element                        | Motion                                                      |
| ------------------------------ | ----------------------------------------------------------- |
| Standard section/list entrance | FadeInDown, usually 220-420ms                               |
| Staggered lists                | Usually 20-80ms per item, capped on long lists              |
| Progress fill                  | 480ms                                                       |
| CountUp                        | 350ms cubic ease-out                                        |
| Skeleton                       | 800ms repeated opacity pulse                                |
| Button                         | Timed scale + 80/120ms opacity                              |
| Fluid text                     | Word/character FadeInDown, 34ms default stagger, 1400ms cap |
| Typewriter                     | 14ms/character for newest match commentary at 1x            |

Shared modal presets are `FadeIn` 180ms with quadratic ease-out, `FadeOut`
140ms with quadratic ease-in and `ZoomIn` 200ms with cubic ease-out. No
`spring`, `withSpring`, `springify` or `BounceIn` animation remains in the
application UI. Ambient glows, particles and ceremonial timing loops remain.

### 13.2 Screen-specific motion

| Screen         | Main motion                                                          |
| -------------- | -------------------------------------------------------------------- |
| Splash         | 220ms fade plus timed scale from 0.85                                |
| Main Menu      | 600ms hero fade, 320ms right-entering menu rows, 400ms continue card |
| Career Hub     | Stable in-place hub sections; tab content is not remounted on updates |
| Manager Hub    | Stable in-place hub sections; no repeating spotlight entrance         |
| Training       | Progress/card entrances, stat pulse, temporary feedback popup        |
| Transfers      | Fade/FadeInDown rows; timed bid-war entrance                         |
| Records        | Extensive staged FadeInDown lists                                    |
| Inbox          | FadeInRight messages, slide-left dismissal                           |
| Press          | 300ms native opacity transition                                      |
| Season Pass    | FadeInDown sections and FadeInRight reward tiers                     |
| Purchase       | Staggered product rows, 600ms repeating starter badge pulse          |
| Cosmetics      | Fade/ZoomIn selection feedback                                       |
| Deadline Day   | Clock digit pop, repeating urgency glow and staggered ticker         |
| Awards Night   | Sequential 1.1-second award reveals with pulsing glows               |
| Board Meeting  | 200ms emoji scale, timed card rise and repeating 1.05 scale pulse    |
| Injury Report  | 200ms icon scale/pulse and 300-900ms staged sections                 |
| Milestone      | 200ms hero scale, repeated particles, auto-dismiss after 4 seconds   |
| Hall of Fame   | 1.6-second highlight beats, rotating stars, staged gold plaque       |
| Youth Graduate | 200ms jersey scale, name rise, glow pulse and star bursts            |

There is no user-facing Reduce Motion setting and no explicit binding to the
operating system reduced-motion preference.

### 13.3 Graphics quality

| Setting | Intended behavior                         |
| ------- | ----------------------------------------- |
| Low     | Best battery/performance on older devices |
| Medium  | Balanced                                  |
| High    | Full effects/richest presentation         |

Current source-level effects of this setting include particle density and
selected presentation effects. It is not a global switch that disables every
animation in the app.

## 14. Ceremonial and high-emotion screens

### 14.1 Milestone cinematic

| Kind         | Gradient               | Particle  |
| ------------ | ---------------------- | --------- |
| Century      | `#E9B23B` to `#7A4A08` | `#F7D06E` |
| Five wickets | `#E5484D` to `#7A1216` | `#FF9090` |
| National cap | `#1F8A46` to `#0A1912` | `#5BD183` |
| Title        | `#C6902A` to `#4A2800` | `#F7D06E` |
| Default      | `#1F8A46` to `#0A1912` | `#5BD183` |

Twelve particles repeatedly rise 180-280dp. The hero scales from 0.1 to 1 over
200ms, copy enters after 400ms, the tap hint after 1.5 seconds and the screen
closes after four seconds or on tap.

### 14.2 Board meeting

| Outcome  | Gradient                      | Accent    | Haptic  |
| -------- | ----------------------------- | --------- | ------- |
| Sacked   | `#2A0A0A / #3D1515 / #1A0505` | `#E5484D` | Error   |
| Praised  | `#1A2A0A / #2A4010 / #0A1912` | `#31A85A` | Success |
| Warning  | `#2A1A0A / #3D2A10 / #1A1005` | `#F5A524` | Warning |
| Extended | `#0A1A2A / #10253D / #061015` | `#4C9AFF` | Success |

The screen includes a custom boardroom SVG, outcome-colored glow, club/season
badge, message card and outcome-specific CTA.

### 14.3 Injury report

| Duration  | Label                    | Color     |
| --------- | ------------------------ | --------- |
| 1 week    | Minor knock              | `#F5A524` |
| 2-3 weeks | Moderate injury          | `#E8852A` |
| 4-6 weeks | Serious injury           | `#E5484D` |
| 7+ weeks  | Severe long-term absence | `#C4362B` |

The screen uses a `#1A0808` to `#0F1912` background, pulsing medical shield,
breaking-news badge, stats, recovery timeline and a blue-purple fast-track card
`#1A1A3D` to `#0F0F28`.

### 14.4 Awards Night

- Background: `#0D0A04 / #1A1305 / #0D0A04`.
- Champion: gold.
- Golden Bat: primary green.
- Golden Ball: `#E5484D`.
- User top-three finish: gold for first, green for second/third.
- Initial delay: 800ms; each new award: 1100ms; Continue appears 1200ms after
  the final reveal.

### 14.5 Hall of Fame

- Background: `#1A1005 / #2A1C08 / #0F0A03`.
- Main gold: `#E9B23B`; highlight gold `#F7D06E`; dark plaque `#1A1005`.
- Each highlight reel beat stays for 1600ms.
- Star particles pulse and rotate 360 degrees every three seconds.
- Seal, name and stats card arrive at 200ms, 700ms and 1000ms.
- Player reel emphasizes caps, titles and legacy score.
- Manager reel emphasizes trophies, seasons at the helm and legacy score.

### 14.6 Youth graduate

- Background: `#050C08 / #0A1912 / #050C08`.
- The jersey uses the club primary/secondary colors.
- Eight fixed star bursts use gold, primary green and `#4C9AFF`.
- Jersey arrives after 200ms; name after 600ms; stats after 800ms; CTA after
  1200ms.

### 14.7 Transfer Deadline Day

- Base: `#080808 / #12100A / #0A0A18`.
- Live banner: `#E5484D` to `#B93A3E`.
- Clock boxes: `#1A1A2A`, blue border `#4C9AFF40`.
- Final five minutes: box `#2A0A0A`, red border/text, warning haptic.
- Deal status: pending `#F5A524`, agreed `#31A85A`, collapsed `#E5484D`,
  signed `#4C9AFF`.

### 14.8 Player Life

- The five-tab control wraps within the viewport and keeps each target at least
  44dp high. It never uses absolute positioning for content layout.
- Overview uses a single unframed flow: selection score, reason breakdown,
  Domestic/International totals and a ten-row recent-appearance list.
- Development and Finance use responsive rows with bounded minimum widths.
  They collapse to one column before labels or actions can overlap.
- The phone is one bounded surface, not nested cards. Feed, Inbox, News and
  Money use compact icon tabs and vertically scrolling content.
- Finance actions use theme success for positive balances/income, warning for
  gated features and primary green only for active selection/actions.
- The Legacy Museum uses the gold accent at 9% background and 33% border
  opacity for earned-history emphasis, while empty states stay neutral.
- Result feedback uses the shared serialized alert/reward surfaces, so purchase
  and claim copy cannot render behind another popup.
- Personal Physio costs 9,000 Wallet Coins, restores 25 condition and removes
  one match from an active injury, up to three times per season.
- Performance Analysis costs 12,000 Wallet Coins once per upcoming fixture.
  Its persistent report names the threat, explains a weakness and match plan,
  and links to/highlights the recommended Training focus. The real preparation
  effects are +3 player confidence and +2 coach trust.
- Sponsor negotiation choices wrap responsively and preview acceptance chance,
  signing bonus, per-match income, two-season duration and form requirement.
  Used negotiations and full two-sponsor slots disable all three choices.

## 15. Screen-by-screen UX catalog

### Entry, setup and account

| Screen          | Current UX                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Splash          | Centered emblem, app name, tagline and Loading copy; fades/scales in while daily session gate resolves.                                                                                               |
| Main Menu       | Cricket-ground code hero, resume card with mode/name/season/wallet/last result, then icon-led New Game, Saves, Store, Account, Settings and Exit actions.                                             |
| New Game        | Two large mode choices describing Player Career and Manager Career.                                                                                                                                   |
| Player Creation | Multi-step identity, country, role, difficulty and visual avatar creation; includes the supplied 300 deterministic modular presets, male/female and manual part controls, exact active School ratings beside allocation values, a future Tier 3 destination choice and a responsive progress footer. |
| Team Select     | Country-aware club selection with selected state and fixed start action.                                                                                                                              |
| Saved Games     | Save-slot cards, empty slots, premium-slot lock and destructive delete confirmation.                                                                                                                  |
| Login           | Guest access is active. Google sign-in is visibly marked "Coming soon"; cloud sign-in and email/password controls are not exposed by the current screen.                                               |
| Settings        | Audio/gameplay switches, theme/language/graphics choices, Cricket Academy entry, guide replay, defaults and build metadata.                                                                           |
| Cricket Academy | Searchable four-tab handbook with expandable, engine-audited rules for career progression, match tactics, club management and physicality.                                                            |
| League Editor   | Competition and club text inputs with active/inactive editor state.                                                                                                                                   |

### Player career

| Screen                 | Current UX                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Career Hub             | Four persistent tabs, career stadium spotlight, wallet and exactly one resolver-owned primary action; pending stories appear on Home above routine match/training content. Club/national captains receive a contextual XI/tactics action for the relevant fixture only. |
| Training               | Role-group cards with six total/three-per-focus limits, the same 250/400/550/700/850/1,000 price curve at every career level, analyst focus highlighting, trainability, progress bars and an immediate centered result modal that cannot overlap the footer. |
| Player Life            | Five responsive tabs: selection risk/recent ten, personal development services, finance/assets, bounded phone/media and a visual Legacy Museum with career backup tools.      |
| Player Profile         | Identity/avatar, a code-rendered England cross that does not depend on Android emoji support, current and career stats, role-relevant batting/bowling attributes, contract/equipment and record details; fielding is engine-only and hidden. |
| Contract Negotiation   | Staged offer, demands, club response and signed states with animated cards and held/disabled actions.                                                                      |
| Narrative              | Story event, choices, result effects and empty-story state; entered from bottom.                                                                                           |
| Cosmetics              | Live player preview, category tabs, ownership/pass locks, equip actions and selection animation.                                                                           |
| Daily Challenge        | Bronze/silver/gold target presentation, progress and reward claim.                                                                                                         |
| U19 World Cup          | Youth international status, fixtures/progress, result and unavailable/empty states.                                                                                        |
| International Calendar | Year-round white-ball tours, bilateral WTC Tests, June-August ICC events, format-specific selection reasons, WTC standings, fixtures and empty schedule state.             |
| Injury Report          | Cinematic injury severity, time out, missed matches, recovery plan and optional gem fast-track.                                                                            |
| Career retirement      | Career Hub switches to "A Career Remembered", final legacy summary and Hall of Fame route when retired.                                                                    |

### Manager career

| Screen                     | Current UX                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manager Hub                | Club spotlight, urgent job/appointment alerts, one resolver-owned Continue action, matchday result with league-position change/earnings, required per-fixture Match Preparation, league table and live ops. |
| Squad & Tactics            | Vertical Playing XI and bench lists, role/fitness context, batting-order controls, tactic selection and contextual info for tactics, condition and First-Class over-rate.                                     |
| Transfers                  | Market/squad/loan tabs, compact rows, search/filter/sort, scout/sign actions, 6,000-coin report fast-track, bid-war modal and an engine-aligned Scout Confidence explanation.                                 |
| Transfer Deadline Day      | Live countdown, budget, world transfer ticker and links to real market/squad actions.                                                                                                                         |
| Club Office                | Budget, staff/facilities, wages, analysis, recovery and club resource actions.                                                                                                                                |
| Academy                    | Youth prospect list with age/role/overall and promotion/release actions.                                                                                                                                      |
| Cricket Academy Management | Naming/opening and academy investment/upgrade flow.                                                                                                                                                           |
| Staff Recruitment          | Candidate cards, costs, role effects and affordability states.                                                                                                                                                |
| Wage Ledger                | Wage totals, cap/finance context and per-player wage rows.                                                                                                                                                    |
| Press Room                 | Speaker/event copy and response choices; result chips show good/bad/neutral effects.                                                                                                                          |
| Board Meeting              | Full-screen sacked/praised/warning/extension ceremony.                                                                                                                                                        |
| Youth Graduate             | Full-screen first-team debut ceremony.                                                                                                                                                                        |

### Shared game and progression

| Screen                | Current UX                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match                 | Venue/surface briefing, animated Heads/Tails captain toss, persistent 2D live view, chronological commentary, decisions, stable 1x/2x/4x speed, pause/skip-innings/simulate and post-match analytics. |
| Records & Glory       | Player career scope tabs plus manager season leaders filtered to the active T20/List A/First-Class format. Manager tables rank runs, wickets, high scores and best bowling, with every managed-club player shown on a gold background. Achievements, trophies and separate player/manager Hall of Fame views remain available. |
| Awards Night          | Sequential season champion, Golden Bat, Golden Ball and user finish reveals.                                                                                    |
| Hall of Fame Ceremony | Career highlight reel followed by gold plaque induction.                                                                                                        |
| Milestone Cinematic   | Four-second century/five-for/debut/title moment.                                                                                                                |
| Notification Inbox    | Type-colored notifications with right-entering rows, read states, clear and empty state.                                                                        |
| Investment Portfolio  | Amount entry, risk/return status, withdraw flow and legacy funding tiers.                                                                                       |

### Store and live operations

| Screen            | Current UX                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store/Purchase    | Trust bar, starter window, first-purchase bonus, low-energy action, mode-specific Legend pack, gem-use education, season pass, mode tools, account upgrade, coins and gems. |
| Season Pass       | Free/premium tracks, XP progress, claim flash/reward popup, premium activation and tier rows.                                                                               |
| Premium Clubhouse | Noir stadium/office presentation, live-match Noir field palette, monthly reward, VIP progress and exclusive scenarios/cosmetics.                                            |

## 16. Store visual system

- Product rows use glass surfaces with a 14% product-accent icon tile.
- Mode-specific Legend pack uses charcoal `#12121A / #0D0D15 / #12121A` with a
  gold `#E9B23B / #C6902A / #E9B23B` top line.
- First-purchase bonus uses success color at 9% background and success border.
- Low-energy card uses danger color at 9% background and danger border.
- Gem education uses an info-blue border at 33% opacity.
- Season pass uses info blue at 13% into the theme surface.
- Non-premium season-pass teaser uses
  `#0F2A3D / #1A3D5C / #0F2238`.
- Premium-holder pass teaser uses `#1A3D5C / #0F2238`.
- Legend products are presented only for the active player or manager mode and
  explicitly say that they apply only to that mode.
- Shared season pass is presented as dual-mode value.

## 17. Visual assets

### Used by the app shell or current UI

| Asset                                             | Purpose                               |
| ------------------------------------------------- | ------------------------------------- |
| `assets/icon.png`                                 | App icon                              |
| `assets/splash-icon.png`                          | Native splash                         |
| Android foreground/background/monochrome icons    | Adaptive Android icon                 |
| `assets/favicon.png`                              | Web favicon                           |
| `assets/generated/career-stadium.png`             | Player/manager career spotlight       |
| `assets/generated/season-pass-manager-office.png` | Club office premium scene             |
| `assets/generated/season-pass-stadium-noir.png`   | Premium Clubhouse scene               |
| `assets/sfx/bat_impact_classic.mp3`               | Four/six bat impact                   |
| `assets/sfx/stump_clack.mp3`                      | Wicket impact                         |
| `assets/sfx/stadium_crowd_cheer.mp3`              | Milestone, victory and crowd response |
| `assets/sfx/ui_glass_tap.mp3`                     | Shared button press                   |
| `assets/audio/menu_ambient.mp3`                   | Looping low-volume ambient music      |

Audio source/license provenance:

- bat impact: [GH0STY_XD, Freesound 594342](https://freesound.org/s/594342/),
  CC0;
- stump/wood clack: [Sadiquecat, Freesound 742277](https://freesound.org/s/742277/),
  CC0;
- crowd cheer:
  [FoolBoyMedia, Freesound 397434](https://freesound.org/s/397434/), CC0;
- glass tap:
  [zembacraftworks, Freesound 427389](https://freesound.org/s/427389/), CC0;
- ambient loop:
  [msx2plus, Freesound 678365](https://freesound.org/s/678365/), CC0.

The previous synthesized WAV files and generator script have been removed.
Unreferenced `assets/menu-hero.png` and `assets/victory.png` have also been
removed; main-menu and victory presentation continue to use code-driven visual
surfaces.

### Code-generated hero backgrounds

The shared cricket-ground SVG supports:

- dark menu: `#1A4A2C / #0F2E1B / #0A1912`;
- dark victory: `#1C3A15 / #2A5C20 / #0A1912`;
- dark match: `#0F2A1A / #1A3D28 / #071410`;
- dark neutral: `#0A1912 / #071410 / #04100C`;
- light equivalents based around `#2A6B3E`, `#1F5530` and `#183F24`.

Victory state is green `#1C4A25 / #1F7A3A / #0A1912`; defeat state is red
`#3A1515 / #5A2020 / #1A0A0A`.

## 18. Accessibility

Current strengths:

- more than 120 explicit accessibility declarations are present across
  components and screens;
- major buttons expose button role, label and disabled/selected state;
- hub and commentary tabs expose tab roles;
- player avatar and 2D field expose image/context labels;
- modal close, guide dots, onboarding actions and transfer actions are labeled;
- captain, injury, fitness and morale badges expose semantic labels, and fitness
  exposes a numeric progress-bar value;
- manager simulation uses `accessibilityLiveRegion="polite"`;
- touch controls commonly use 40-44dp minimum targets or hit slop;
- Sora headings and scoreboard digits cap OS scaling at 1.2x to protect
  fixed-format layouts;
- foreground status-bar style follows theme.

Current gaps:

- explicit accessibility coverage is concentrated in shared components and 12
  screen files, not every custom `Pressable`;
- some custom icon-only controls still depend on surrounding context;
- Inter body copy and direct native text can still have screen-specific Dynamic
  Type behavior;
- no reduced-motion option is available;
- color is often paired with text/icon labels, but a full contrast audit has
  not been run on every light-theme cinematic state.

## 19. Localization

- English is the default.
- Hindi translations cover menu, common actions, new-game mode copy, settings
  and core hub labels.
- Missing keys fall back to English, then to the key.
- Dynamic story, commentary, product detail and most deep-screen prose remain
  English by design/current implementation.
- Therefore selecting Hindi localizes the app chrome, not the full game.
- Settings labels the option exactly `हिंदी (App Chrome Only)` so the limitation
  is visible before selection.

## 20. UX flow summary

### 20.1 First launch

Native splash -> daily session gate -> Main Menu -> five-slide onboarding.
Guides can be replayed from Settings. Settings also opens the searchable Cricket
Academy for on-demand rule lookup.

### 20.2 Player career

New Game -> Player Creation -> country/future-club setup -> separate School XI -> Career Hub guide -> one
highlighted next action plus relevant persisted-once mechanic tip ->
training/story/match -> result/rewards/progression -> contracts and pathway
advancement -> international career -> retirement -> career remembrance/Hall
of Fame.

At senior international level the player keeps both the domestic club contract
and format-specific national eligibility. September-November can contain an
ODI/T20I bilateral over List A; January-February contains bilateral WTC Tests
over First-Class cricket; March-May remains the domestic/franchise T20 block;
June-August hosts the current ICC event, WTC Final or overseas assignment.
National selection takes priority on an exact date clash. The club match is
simulated without the user, its calendar result says `Away on National Duty`,
and an inbox item explains the absence. If no national fixture exists, or the
player is not selected in that format, the normal domestic fixture remains the
active match.

Selection is independent for T20, ODI and Test assignments. Overall contributes
40%, form 35%, national reputation 25%, with the existing format-readiness
modifier added. Form below 40 drops the player from that squad and the
remaining assignment fixtures are completed without the user; domestic matches
remain available for rebuilding form. A call-up does not lock allegiance. The
first played senior cap stores `cappedCountry` permanently.

WTC league points come from the January-February bilateral Test series across a
two-season cycle: 12 for a win and 4 for a draw. At the end of season two, the
top two countries play one June Final. The Final stores the champion but does
not add another league-table result. In years where the ODI World Cup also
occurs, its group stage starts after the WTC Final slot.

ICC World Cup and Champions Trophy knockouts are dynamic. A new tournament
creates only the user's group fixtures. After the final group result, the table
is ranked by points, wins and a stable tie-break. A top-two finish creates one
semifinal; a semifinal win creates the Final. Finishing outside the top two
creates no knockout fixture, grants `+3` national reputation and `+150` Season
Pass XP exactly once, opens an `ELIMINATED FROM ...` newspaper clipping and
returns the calendar to domestic duty or the remaining off-season.

### 20.3 Manager career

New Game -> Team Select -> Manager Hub guide -> Continue action plus relevant
board/tactics/workload tip -> calendar phase -> XI/preparation/analysis -> match ->
board/calendar consequences -> transfers, office and academy ->
awards/promotion/jobs -> Hall of Fame.

At National Head Coach level, the same shared international generator used by
Player Career schedules the controlled country. Autumn ODI/T20I bilaterals run
during the List A phase, bilateral WTC Tests run during the First-Class phase,
and ICC events or the WTC Final run in June-August. Domestic fixtures continue
to simulate in the background. The active Manager Hub identity, next-opponent
copy, Squad screen, XI changes, readiness, recovery, preparation and Opposition
Analysis all target the national team during this level. ICC semifinals and
Finals use the same result-driven qualification state described above.

### 20.4 Match

Venue/surface briefing -> captain Heads/Tails call and Bat/Bowl decision when
won -> presentation mode -> live
decision loop -> event feedback -> result summary -> reward/ad option ->
newspaper/achievement/milestone moment when eligible -> return to the owning
hub. Non-captain Player Career users retain personal match control without
receiving team XI, tactics or toss authority.

### 20.5 Rewards and store

Daily/quest/pass claims use the same reward modal. The store separates active
mode tools, shared account upgrade, currency and dual-mode season pass. Native
store price is displayed only when the product is available.

## 21. Current limitations and inconsistencies

These are part of the current behavior and should not be mistaken for missing
documentation:

1. There is no Reduce Motion setting or OS reduced-motion integration.
2. Hindi coverage is partial and intentionally limited to app chrome.
3. Sora text has an app-wide 1.2x cap, but Inter body copy and direct native text
   still follow local Dynamic Type behavior.
4. High/Medium/Low graphics affects selected expensive effects, not every
   animation.
5. Some fixed-color cinematic and premium surfaces remain dark in Light mode.
6. Native Android backdrop blur uses the SDK 31+ method. Earlier Android
   versions retain translucent glass layers and true gradients but do not get
   the same backdrop sampling.
7. Popup serialization covers the central alert and named critical,
   engagement and prompt overlays. Full-screen route modals and local,
   interaction-owned match dialogs remain outside that startup queue.
8. The updated rendering and audio paths are source-tested, but their exact
   appearance, performance and mix have not been exhaustively checked on every
   physical Android/iOS device.

## 22. Source map

Primary implementation sources:

- Design tokens: `src/theme/index.ts`, `src/theme/fonts.ts`
- App shell/navigation: `App.tsx`, `app.json`
- Layout: `src/components/Screen.tsx`, `src/hooks/useResponsive.ts`
- Controls: `Button.tsx`, `Card.tsx`, `SelectableCard.tsx`, `HubTabBar.tsx`,
  `GlassSurface.tsx`, `PlayerStatusBadges.tsx`
- Guides/modals: `Onboarding.tsx`, `ModeGuideModal.tsx`,
  `FirstMatchGuide.tsx`, `RewardModal.tsx`,
  `StarterPackModal.tsx`, `ContextualOffer.tsx`, `GlassAlertModal.tsx`,
  `src/context/ModalQueueContext.tsx`
- Mechanic guidance: `src/guidance/mechanics.ts`,
  `MechanicInfoButton.tsx`,
  `src/screens/CricketAcademyScreen.tsx`
- Achievement/share: `AchievementToast.tsx`, `AchievementCinematic.tsx`,
  `NewspaperModal.tsx`
- Match: `src/screens/MatchScreen.tsx`, `CelebrationOverlay.tsx`,
  `FieldView.tsx`, `CommentaryArchive.tsx`, `src/game/matchTiming.ts`,
  `src/engine/toss.ts`, `src/game/matchAuthority.ts`,
  `src/engine/__tests__/seasonDistribution.test.ts`
- Career state/transition: `src/game/careerStep.ts`,
  `src/game/careerTransition.ts`, `src/storage/schema23.ts`,
  `src/storage/schema24.ts`, `src/storage/schema25.ts`,
  `src/storage/schema26.ts`, `src/storage/schema27.ts`,
  `src/storage/schema28.ts`, `src/storage/schema29.ts`,
  `src/storage/schema30.ts`
- Avatar system: `src/avatar/*`, `src/components/avatar/*`,
  `assets/avatar/runtime/*`, `scripts/generate-avatar-registry.mjs`,
  `scripts/validate-avatar-pack.mjs`
- Player Life: `src/screens/PlayerLifeScreen.tsx`,
  `src/game/playerLife.ts`
- International duty: `src/game/intlCalendar.ts`,
  `src/game/playerCalendar.ts`, `src/game/season.ts`
- Audio/haptics: `src/audio/*`, `assets/sfx/*.mp3`,
  `assets/audio/menu_ambient.mp3`
- Settings: `src/state/settingsStore.ts`, `src/screens/SettingsScreen.tsx`
- Screen implementations: `src/screens/*.tsx`

## 23. Verification snapshot

Verification on 2 August 2026:

- `npm run generate:avatars`: generated 186 literal Metro asset registrations
  and 300 deterministic presets.
- `npm run validate:avatars`: validated all 186 assets and 300 unique presets.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors and zero warnings.
- `npm test -- --runInBand --silent`: 119 suites, 579 tests and two snapshots
  passed.
- `npx expo-doctor`: all 20 checks passed.
- Fresh Player and Manager careers crossed the previous post-team-selection
  crash boundary on Android; process restart/resume preserved the Player avatar.
- Settled Player and Manager hub screenshots were pixel-identical across timed
  captures, confirming that removed entry loops no longer replay while idle.
- Male hair/beard, female paired hair, helmet hair-hiding, preset selection,
  Cosmetics saving and Profile reload were visually checked in the emulator.
- The fresh release APK was installed and cold-launched with Metro stopped. It
  reached the Account screen without an ErrorBoundary or Android runtime crash.
  Play Billing is unavailable on the test emulator, and the configured
  RevenueCat offering currently reports no registered Play Store products.
