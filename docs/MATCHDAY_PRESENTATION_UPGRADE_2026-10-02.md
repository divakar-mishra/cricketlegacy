# Matchday presentation upgrade — 2 October 2026

Status: first timing pass implemented in source; device review pending. No engine replacement.

Reference read: `/Users/divakarmishra/Desktop/Auction XI/Auction_XI/docs/HOW_LIVE_GAMEPLAY_WORKS.md`.
Also inspected Auction XI's delivery clock, delivery plan/frame logic, native sprite
wrapper, live stage, stadium atmosphere, audio feedback hook and CareerScreens
reveal/commit flow. Adapted the shared-clock idea, not its engine or scene geometry.

## What fits Cricket Legacy

The strongest reusable idea is a delivery timeline shared by the visible ball,
actors, audio, score reveal and commentary. Cricket Legacy already has outcome-led
pitch geometry and actor movement in `src/components/FieldView.tsx`, plus the
incremental `LiveMatch.nextBall(intent)` engine driven by `MatchScreen.tsx`.
It does not need Auction XI's precomputed-result/tactical-replay architecture.
Keep the existing engine, format support, tactics and exactly-once settlement.

Presentation gaps identified before this timing pass:

- `MatchScreen` advances a delivery and updates the UI/audio through `applyStep`;
  `FieldView` separately starts native animations when `lastShot.key` changes.
  There is no shared contact/resolve callback coordinating these paths.
- `FieldView` has independent ball and role animation values. It receives no
  explicit manual-pause state, even though the simulation loop waits for pause.
- At higher speed the screen deliberately uses `animate={!fastMatchUi}`; a future
  clock should compress the delivery presentation rather than depend on this
  all-or-nothing switch. Reduced-motion and low-performance options must remain.

## Proposed implementation order

1. Introduce a pure delivery presentation plan from the existing resolved event:
   run-up, release, bounce, contact, fielding/running, outcome reveal and hold.
   Animation must never decide runs, wickets or rewards.
2. Drive scene progress and feedback from one pausable clock. Contact emits the
   bat sound once; resolution reveals the score/commentary once. Cancel stale
   callbacks on fixture change, skipping or unmount. Backgrounding, manual pause
   and existing blocking overlays must freeze the same clock.
3. Preserve a visible pre-delivery snapshot until resolution so totals and crease
   identities do not reveal the event early. Keep all innings, extras, DRS and
   Watch/Key/Instant outcomes consistent.
4. Improve readable batting, chasing, catches, running and umpire poses using the
   existing shared coordinates. Reuse venue/facility/attendance data where it
   exists; never invent attendance or change matchday finance for decoration.
5. Treat restart-resume persistence as a separate change with schema migration,
   legacy coverage and exactly-once reveal/settlement tests before adopting it.

Acceptance checks: pause during flight/contact; change speed mid-delivery;
background/resume; open tactics/commentary; skip during pending callbacks; DRS;
wides/no-balls/byes; boundaries on milestones; all formats and both careers;
identical final outcomes in Watch/Key/Instant; reduced motion; low-end Android.

## Implemented timing pass

- `src/game/deliveryPlayback.ts` owns a pausable delivery clock, once-only contact
  and resolution callbacks, and cancellable completion. Lifecycle epochs prevent
  background time from becoming a burst of catch-up frames on return.
- `MatchScreen` starts the existing field movement before exposing the resolved
  score/commentary/crease snapshot. The engine still generates each delivery once;
  presentation does not reroll outcomes, finalize fixtures or grant rewards.
- Manual pause, backgrounding, commentary, tactics, stance and guide pauses freeze
  the same clock. Speed changes keep progress and the existing pacing/readability
  factors. Skip/Instant finish the pending reveal without a second engine delivery.
- Ball and role Animated.Values receive clock progress directly; there is no
  whole-screen React state update each frame. The reading hold stops redundant
  animation-value writes once the visual action has completed.
- Bat impact is triggered at the ball's existing contact coordinate. Boundary
  feedback/wicket sound occur at resolution. Delayed native impact rewinds are
  guarded against pause, skip, background transitions and stale deliveries.
- Existing fast-mode batching, low graphics and reduced motion remain. Static
  modes reveal their field result at resolution rather than animate every ball.
- Field widths, responsive sizing, pitch/actor geometry, score/commentary/control
  positions and pause-button dimensions were not changed. The existing normal
  versus fast layout distinction remains; no Auction XI viewport was imported.

Focused verification: 7 suites / 91 tests passed, covering clock order, pause,
background/resume, speed, skip, cancellation, audio rewind, field rendering,
existing pacing and source integration. Final TypeScript, scoped lint and
`git diff --check` passed. No full suite,
APK/AAB, installation or store submission was performed for this pass.

At the end of the clock pass, remaining work included chasing/catches/run-out
sequences, directional actor poses, umpire signals and crowd reactions. That pass
does not claim a full Auction XI visual port. Physical Android playback, DRS and
innings transitions still need an owner-approved device QA pass.

## Small UI changes implemented now

- Shared greens changed from saturated emerald to muted sage/forest; primary
  button gradients are opaque and retain white-label contrast. Charcoal, gold
  and semantic colours remain shared across both careers. This does not recolour
  baked artwork or every custom cosmetic asset.
- Pause/resume no longer grows across the footer. Minimum width is 72 dp and
  minimum touch height 48 dp, with flexible height for larger text. Text uses
  the theme's foreground instead of white on light surfaces.
- Focused palette-contrast and match-presentation tests pass (22 tests). This is
  not a screenshot/device verification or a new Play release. No build/install.

## Movement and visual polish — October 3

Implemented within the existing field viewport, responsive sizes and delivery
duration. This is presentation of engine-decided events, not new simulation rules.

- Running uses separate lanes, alternating stride poses, planted-bat pauses and
  directional turns; run-out attempts stop short. The user marker follows the runner.
- Nearest-fielder collection, a backup chase and a return throw share the ball's
  timeline. The keeper/bowler moves to receive the return at the relevant stumps.
- Catch, bowled, LBW, run-out, stumping and hit-wicket have distinct staging,
  with bails only for appropriate dismissals and a departing batter pose.
- Existing SVG cricketers now have cached directional movement/action poses;
  kits remain intact. No Auction XI native renderer or raster atlas was imported.
- A compact field-local umpire signals wickets, boundaries and extras at reveal.
  Sparse crowd arm/lift reactions follow major results; the stadium pulse is reduced.
- Movement and post-result reactions use the shared pause/speed/background clock.
  Low graphics/reduced motion stay static. Engine outcomes, save data, rewards,
  matchday dimensions and control placement are unchanged.

Verification: 7 focused suites / 124 tests passed, TypeScript and scoped lint
passed. Physical Android timing/appearance still requires review. No full suite,
APK/AAB build, installation or store submission was performed.
