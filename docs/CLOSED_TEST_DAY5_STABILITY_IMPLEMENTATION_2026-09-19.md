# Cricket Legacy — Day 5 stability implementation

Recorded: 19 September 2026. This is the implementation companion to
[the original Day 5 audit](CLOSED_TEST_DAY5_UI_STABILITY_AUDIT_2026-09-19.md).

## Implemented in this update

- Added one cleanup-safe timer registry and migrated transient banners,
  contract messages, calendar simulation steps, ceremony haptics and award
  reveal sequences to it.
- Changed the Manager wage ledger to a `FlashList` with a memoized row instead
  of mounting every player row inside one scrolling tree. Transfers already
  used `FlashList` and was left intact.
- Kept Records as a bounded collection: achievements are a fixed catalog and
  each Hall of Fame list is capped at 25 entries. A nested virtualized list
  inside its existing scroll container would add complexity without evidence
  of a current bottleneck.
- Enlarged undersized squad reorder controls, record/transfer filters and hub
  tabs to at least 44 dp, and added selected/disabled accessibility states to
  the reviewed custom controls.
- Added Android back-button behavior to the starter-pack, transfer bid-war and
  manager-simulation modals. Non-interactive modal backdrops are hidden from
  the accessibility focus order.
- Settings now reads the version and build number from the installed native
  package through `expo-application`, so remote EAS version-code increments are
  no longer displayed as a stale generated value.
- Shared buttons and the achievement cinematic now respect the device's
  reduced-motion preference. Existing reduced-motion handling remains in the
  field, celebration and loading components.
- Added `npm run audit:assets` for repeatable compressed and decoded PNG memory
  estimates.
- Added `npm run qa:android:soak` for repeatable 30–45 minute Android memory,
  frame, crash and ANR capture while a tester follows the approved manual route.
  Set `ANDROID_SERIAL` when more than one device is connected.

The first asset audit found 380 files using 27.02 MB on disk. The PNG decoded
upper bound is 170.52 MB if every PNG were resident simultaneously (it should
not be). The three largest presentation backgrounds each decode to about 6 MB;
the one directly bundled custom font is 0.44 MB. These figures identify what to
profile on-device without assuming all assets are loaded at once.

## Architectural scope

The large Match, Player Career and Manager Career files were reviewed for
high-churn work. Their live timers already clean up on unmount, and only the
active hub panel is mounted. This update extracts/memoizes the wage row and
centralizes transient timer work, but deliberately does not mechanically split
thousands of lines across files without a profiler-backed render boundary.
Moving code alone does not reduce renders and would create unnecessary gameplay
regression risk during an active closed test.

The next extraction should be selected from an actual React render profile on
the slowest device, then verified independently. Likely candidates are the
live-match presentation panels and the active Career/Manager dashboard panel.

## Manual soak route

Run `npm run qa:android:soak` with the updated build installed, then repeat:

1. Player Career: dashboard, Training, Profile, one match, save and return.
2. Manager Career: dashboard, Squad reorder, Transfers scrolling/filtering,
   match preparation, one match or simulation, save and return.
3. Open and close guidance, tactics and reward modals; use Android Back where
   appropriate.
4. Background and resume the app after every route.

Record any control that misses two deliberate taps. Treat steadily increasing
memory across identical idle points, increasing frame jank, a crash/ANR, or an
invisible input-blocking overlay as a failure.

## Verification completed

- `npm run check` passed: TypeScript, lint, 226 Jest suites, 1,353 tests and 2
  snapshots.
- A production-mode QA APK assembled successfully and passed APK signature
  verification. It was installed only on a clean, isolated emulator so the
  Play-installed build and its save data were not replaced.
- Cold launch completed in 886 ms. Onboarding, the main menu, Settings and the
  career-selection screen rendered; Android Back returned correctly; no
  crash-level log appeared.
- Settings displayed native `Version 1.0.0` and `Build 1` for that local QA
  package. The career selector displayed Player Career and Manager Career
  without the removed `Recommended` or `Advanced` badges.
- A 45-second harness smoke captured four samples. Total PSS settled from
  172,744 KB to 166,267 KB, reported janky frames remained 0%, and Android's
  crash and ANR dropboxes contained no entries.

The short run validates installation, navigation and the capture tooling; it
does **not** replace the 30–45 minute interactive touch soak described above.
The QA APK is debug-signed and must not be uploaded to Play. A Play update must
be a release AAB with a new version code produced through the approved EAS
release workflow.

## Deliberate follow-ups

- Use the asset audit and Android memory samples to choose images for WebP/AVIF
  conversion; do not recompress art without visual comparison.
- Capture rendered screenshots for Player and Manager dashboards at compact,
  standard and wide widths before undertaking a broad visual redesign.
- Extract the profiler-identified Match/Career/Manager render boundary and add
  a regression test for that behavior in its own update.
