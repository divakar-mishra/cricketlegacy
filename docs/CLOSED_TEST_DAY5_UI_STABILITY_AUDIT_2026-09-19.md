# Cricket Legacy — closed-test Day 5 UI and stability audit

Recorded: 19 September 2026. This note covers the Day 5 closed-testing review
requested for copy, selector alignment, long-session responsiveness, possible
follow-up improvements, and Google sign-in. It supplements
[the Play Console release log](PLAY_CONSOLE_RELEASE_LOG_2026-09-13.md).

## Outcome

Two tester-facing upgrades were implemented in the working tree:

1. Removed the Player Career `Recommended` and Manager Career `Advanced` badges.
2. Made four-option choice rows responsive: a single equal-width row on wide
   layouts and a balanced 2 × 2 grid on phone widths. This fixes the orphaned
   `Leg-spin` chip while keeping every label on one line.

Related visible wording was also neutralized so the same labels do not reappear
elsewhere:

- `Recommended` was removed from the scout report.
- `Analyst recommendation` became `Analyst focus`.
- `Apply Recommended Plan` became `Apply Scouting Plan`.
- `Recommended plan` became `Match plan`.
- `Advanced Analytics` became `Career Analytics`.
- Natural-language progress messages now use `progressed` or `completed` instead
  of `advanced`.

Internal property names such as `recommendedTactics` remain because they are
not rendered text and changing persisted/domain identifiers would add migration
risk without changing the interface.

These source changes are **not in the currently published version-code 4 Play
build**. They require a later reviewed build and closed-track update.

## Verification completed

- Five focused Jest suites passed: **42 tests**.
- TypeScript check passed.
- Focused ESLint check passed with no errors.
- Source scan found no remaining rendered `Recommended`, `recommendation`, or
  `Advanced` copy in the reviewed screens. Remaining matches are internal
  variables, styles, comments, and domain state.
- No full test suite, Android build, install, upload, or Play release was run in
  this task.

## Long-session performance and touch audit

### Static findings

The primary live-match loop does not show an accumulating timer leak. Its
cleanup marks the loop cancelled, clears banner, over-summary, DRS and toss
timers, and resolves pending plan/review waits so they cannot leave the screen
blocked after navigation. The reviewed recurring timers and AppState listener
also remove themselves during cleanup.

That is useful evidence, but it does not prove that touch response stays healthy
through a long real session. The main remaining risks are render cost and memory
pressure rather than one obvious runaway interval:

- several high-complexity screens are very large and render growing collections
  inside scroll views;
- match, career and manager screens contain many state-driven sections that can
  re-render together;
- a few short UI/cinematic timeouts outside the match screen are not centrally
  tracked, which is worth hardening even though they are not evidence of a
  sustained leak.

### Version-code 4 emulator baseline

The installed package was confirmed as version code 4, version 1.0.0, installed
by `com.android.vending`. A warm foreground launch of the Play build took
approximately **1.44 seconds** on the connected emulator.

One startup/foreground sample reported:

| Metric | Observed value |
| --- | ---: |
| Total PSS | 209,159 KB |
| Total RSS | 348,476 KB |
| Frames sampled | 88 |
| Janky frames | 6 (6.82%) |
| Frame time p50 / p90 / p95 | 20 / 29 / 34 ms |
| Android high-input-latency counter | 164 |

This is a small startup sample on an emulator, not a before/after soak test. The
input-latency counter is a reason to test further; it does **not** by itself show
that taps were dropped or that performance worsens over time.

### Required soak test before claiming the issue fixed or absent

Run the Play-installed build for 30–45 minutes and repeat the same route at
least three times:

1. Resume a Player Career, visit Training and Player Profile, then play a match.
2. Resume a Manager Career, visit Squad/Transfers, prepare a match, and play or
   simulate it.
3. Repeatedly open and dismiss match guidance, tactics, settings and back
   navigation while recording any delayed or ignored tap.
4. Capture memory and frame statistics at the start, after each route, and after
   returning to the main menu.

Escalate if memory rises monotonically across identical loops, frame jank grows
after returning to an idle screen, an invisible overlay intercepts touches, or
the same control misses two or more deliberate taps. No random-input/monkey test
should be used against a valuable save or purchase flow.

## Google sign-in verification

The app has Google OAuth through Supabase. This is distinct from automatic
Google Play Games Services sign-in and does not silently use the Play Store
account.

Verified without entering or exposing account credentials:

- the installed Play build registers the `coverdrive` deep-link scheme;
- app code generates `coverdrive://auth/callback` and validates the returned
  Supabase session as a non-anonymous Google identity;
- the production EAS environment contains `EXPO_PUBLIC_SUPABASE_ENABLED`,
  `EXPO_PUBLIC_SUPABASE_URL`, and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- the production Supabase Auth settings endpoint returned HTTP 200 with Google
  enabled;
- a read-only OAuth initiation using `coverdrive://auth/callback` returned HTTP
  302 to `accounts.google.com`.

Configuration and OAuth initiation are therefore verified. End-to-end account
completion remains a human check because Google must display and receive consent
for a real account. On the Play build, open Account, choose **Continue with
Google**, approve a non-owner test account, confirm the app returns to Account as
that Google user, restart the app, and confirm the identity persists. Do not use
the Play Console owner account as a shared tester credential.

## Follow-up implementation

The approved stability work is tracked in
[the Day 5 stability implementation](CLOSED_TEST_DAY5_STABILITY_IMPLEMENTATION_2026-09-19.md).

## Original candidate follow-up improvements

These are deliberately proposals for discussion:

1. **Virtualize growing lists.** Replace long player, transfer, record and
   transaction collections rendered through `ScrollView`/`.map()` with
   `FlatList` or `FlashList`, stable keys, and memoized rows.
2. **Split high-churn screens.** Extract memoized match, Career Hub and Manager
   Hub panels so an update to one counter or animation does not re-render the
   whole screen tree.
3. **Centralize timeout cleanup.** Track transient banners, cinematic haptics and
   delayed navigation through a reusable cleanup-safe hook.
4. **Run a touch-target/overlay audit.** Standardize at least 48 dp targets on
   compact controls, verify accessibility state, and check that dismissed
   absolute overlays always stop intercepting touches.
5. **Add repeatable performance QA.** Maintain one safe, deterministic long-run
   route that records memory, frame jank, navigation time and touch misses on the
   same Play-installed build before and after every test update.
6. **Fix build metadata display.** Ensure Settings shows the native Play version
   code rather than stale generated build data so tester reports identify the
   exact artifact.
7. **Review large asset residency.** Measure which images/fonts remain decoded
   after leaving the relevant screen before changing caches or compression.

Do not bundle all of these into one closed-test update. After the current UI
patch is reviewed, the best next stability upgrade is the deterministic soak
test plus one measured rendering fix from its evidence.
