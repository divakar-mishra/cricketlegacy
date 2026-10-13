# Muted iOS simulator build and QA

11 October 2026. This is an isolated first iOS build of the 1.0.11 game,
not an App Store release or a certification of Apple purchases. No paid Apple
membership, customer payment, refund, TestFlight upload or App Store submission
was used. The Android hotfix under Google review is unchanged.

The requested fixes-and-tests handoff was written first:
[Android 1.0.11 fixes, account/save/deletion and IAP evidence](HOTFIX_1.0.11_FIXES_AND_TESTS_2026-10-11.md).

## Build and artifact

- Xcode 26.6, build 17F113; iOS simulator SDK 26.5, build 23F81a;
  simulator runtime 26.5, build 23F77.
- Expo SDK 57; existing React Native 0.86.2 and dependency lockfile retained.
- Release configuration: standalone Hermes bundle, no Metro dependency,
  `__DEV__` false and no mock checkout grants or QA tools.
- Simulator architectures: arm64 and x86_64. Minimum iOS deployment target: 16.4.
- Display name: `Cricket Simulator`; isolated bundle ID:
  `com.coverdrive.cricket.simulator`; version 1.0.11, iOS build 1.
- Generated workspace:
  `output/ios-simulator/workspace/ios/CricketSimulator.xcworkspace`.
- Installed on a newly-created **Cricket QA iPhone 16 Pro** simulator, UUID
  `6A85EC9A-070E-41D0-AC4B-D1C578B02886`. Existing Android careers were not touched.
- [Simulator ZIP](../output/ios-simulator/cricket-player-manager-1.0.11-ios-simulator.zip):
  66,233,500 bytes (approximately 63 MiB), containing a locally signed simulator
  `.app`, not an iPhone IPA. No paid Apple certificate is required for this build.
- ZIP SHA-256:
  `134bac20e99f78b99fcab606ffe981ff48183f033f619cf66240746aab2f7a01`.
- App directory:
  `output/ios-simulator/derived-data/Build/Products/Release-iphonesimulator/CricketSimulator.app`.

The Expo versioned requirements and local/simulator build process were checked
against [SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/),
[local native development](https://docs.expo.dev/guides/local-app-development/)
and [simulator builds](https://docs.expo.dev/build-reference/ios-simulator/).

## Isolation and service configuration

The source was copied into ignored `output/ios-simulator/workspace/`; the
generated iOS native project, CocoaPods installation, test harness and evidence
also stay under that ignored directory. No production iOS configuration was
silently enabled in the root app.

At the owner's request, music and sound effects are forcibly disabled in the
staged `src/audio/music.ts` and `src/audio/sfx.ts`, including when saved settings
have sound enabled. This muted source was bundled into the installed Release
app and ZIP. Root audio code and the Mac's system volume were not changed.

The reusable [simulator configuration](../scripts/ios-simulator.config.cjs)
preserves its input and Android settings, enables only iOS in the staged copy,
and gives the app a separate install identity. Its two
[configuration tests](../scripts/ios-simulator-config.test.cjs) pass.

- **AdMob:** Google's provider-owned iOS test app ID is installed in the actual
  native Info.plist. Banner, interstitial and rewarded unit environment values
  also use [Google's iOS test IDs](https://developers.google.com/admob/ios/test-ads).
  No real advertising-unit credentials were invented. This does not verify
  live ad delivery, consent or tracking disclosures.
- **RevenueCat/Apple billing:** both public SDK key environment variables were
  explicitly empty. Apple checkout is intentionally unavailable in this Release
  build, not replaced with simulated successful purchases.
- **Account backend:** `EXPO_PUBLIC_SUPABASE_ENABLED=false`; no cloud login or
  account-backup network verification is implied by local simulator testing.
- **Firebase:** the existing telemetry facade is Android-only and no iOS service
  file is provided. Firebase config plugins and native packages were excluded
  only in the staged iOS project, using
  [Expo's per-platform autolinking exclusion](https://docs.expo.dev/modules/autolinking/).
- **Tooling:** CocoaPods 1.16.2 and compatible gems were installed locally under
  `output/ios-simulator/tooling/`, not as a global Ruby/toolchain replacement.

## Verification record

| Check | Outcome |
| --- | --- |
| Non-mutating simulator configuration tests | 2/2 passed; Android settings and original plugin objects unchanged. |
| Expo iOS prebuild, staged source only | Passed; root Android project not regenerated. |
| CocoaPods install | Passed: 113 dependencies, 116 installed pods. |
| Standalone iOS JavaScript/assets export | Passed, including a 9.8 MB Hermes export. |
| Native Xcode Release build | Muted, locally signed build: `BUILD SUCCEEDED`; bundled 9.3 MB Hermes `main.jsbundle`, arm64/x86_64 app. |
| App signature verification | `codesign --verify --deep --strict` passed. |
| ZIP integrity and unpacked signature | `unzip -tq` passed; unpacked app passed signature verification and its native executable hash matched the built app. |
| Native install and launch | Passed on fresh iPhone 16 Pro simulator. |
| Navigation XCUITest on the muted, signed build | Passed, 41.238 seconds, zero failures or skips. |
| Player/Manager encrypted creation and reload | Verified through native UI assertions and actual encrypted-storage inspection; the composite attempts are not counted as fully passing. |
| Active Player save deletion, restart and guest-account cleanup | Verified across the retained runs, screenshots and storage checks; see the case-by-case record below. Composite attempts failed at harness assumptions, not silently counted as passes. |
| Fresh-save-after-local-deletion XCUITest | Passed, 110.845 seconds: both modes empty, guest profile removed, new Manager created and persisted across restart. |
| Final focused XCUITest run | 2 tests passed, 0 failures/skips, 152.083 seconds of test execution. |

The passing navigation workflow covered the main menu, Player/Manager Saved
Games tab switching, Account screen, both career-creation screens, disabled
Manager start without a club, back navigation and cold restart. The startup
age choice and dismissed onboarding persisted across restart.

Early harness runs failed because the iOS menu/cards expose grouped labels
rather than exact Android-style button names, and because onboarding follows
the age prompt. These were test-selector/order fixes, not changes to game code.
The first deeper test was interrupted by Apple's native
`UIContinuousPathIntroductionView` keyboard tutorial. That animated overlay
covered the Next footer. The harness now dismisses the system tutorial and
submits the name field before continuing. Failed-run evidence is retained;
unreached save assertions are not treated as passes. Subsequent harness fixes
handled the observed optional appearance/guide prompts and removed an incorrect
assumption that a new Manager must receive a job-change appointment newspaper.
The source only creates that newspaper for the applicable job-change state.
The persistence follow-up verified both cold-restarted careers, the unavailable
Apple store, background/relaunch persistence, both playable hubs and cancelled
save deletion. It then failed because the harness selected the underlying card's
Delete button instead of the dialog confirmation. The retained screenshot shows
the visible confirmation; the revised harness selects the hittable button.
The next attempt successfully deleted the Player save but expected a separate
StaticText for the empty slot; iOS instead exposes the slot as a grouped label.
The later account follow-up successfully cleared local data, then failed because
it expected the age prompt immediately. The actual mounted app returned to
onboarding; the age prompt returned on cold restart. The final focused run
followed this observed flow and verified the post-deletion state and a new save.
Failed results remain in the evidence and are not relabelled as passing suites.

### Native encrypted-save failure and fix

The first unsigned simulator build launched but failed to create the first
career. The UI reported **Career not created**, and native logs also contained
Keychain access error `-34018`. This was not accepted as a successful save test.

The staged app was rebuilt with `CODE_SIGNING_ALLOWED=YES` and
`CODE_SIGN_IDENTITY=-`. Xcode generated its simulator application identity and
embedded simulator entitlements, including
`FAKETEAMID.com.coverdrive.cricket.simulator`. This is Xcode's local simulator
identity, not a production Apple team or certificate. See
[Apple's Keychain troubleshooting guidance](https://developer.apple.com/forums/thread/114456)
and [Expo SDK 57 SecureStore documentation](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

After rebuilding, both Player and Manager career creation succeeded. A read-only
check of actual persisted data found version-2 `AES-256-GCM` envelopes in four
storage chunks per career, with no plaintext save objects. The Player ciphertext
was 676,879 bytes and Manager ciphertext 755,331 bytes. Both careers were then
found in Saved Games after terminating and relaunching the app. Encryption source
was not disabled or altered to make this work.

### Local save/account case record

All destructive exercises targeted only careers created by QA in the dedicated
simulator. No Android, customer or remote-account data was deleted. At handoff,
one newly-created QA Manager career remains for manual review.

| Native case | Observed result |
| --- | --- |
| Player creation prerequisites | Empty name and missing club disabled Next; valid India/club choices reached Review and created the career. |
| Manager creation prerequisites | Start disabled without a club; selecting Chennai Arclight enabled creation. |
| First encrypted save in each mode | Both created successfully after local signing was enabled; actual stored envelopes were AES-256-GCM. |
| Background and cold restart | Both original careers survived and reopened in their correct playable hubs. |
| Apple store without SDK keys | Store unavailable; no enabled Buy buttons. No mock or real purchase grant was made. |
| Cancel Player save deletion | The original Player career remained available. |
| Confirm active Player save deletion | Slot 1 became empty; storage contained only the Manager save/backup afterward. |
| Background/restart after deletion | Player did not reappear; Manager remained available. |
| Guest sign-out | Guest sign-in became available again; the Manager career was preserved. |
| Cancel local account/data deletion | Guest profile remained. |
| Confirm local account/data deletion | Read-only storage check found zero career envelopes; later restart showed both modes empty and no guest profile. |
| Create after local-data deletion | New Manager creation and cold-restart persistence passed; its stored envelope was version-2 AES-256-GCM, 754,845 ciphertext bytes in four chunks. |

The complete creation-through-deletion composite test was not rerun end to end
after every harness correction. Coverage above combines executed assertions,
retained screenshots, actual storage checks and the two final passing focused
tests; it is not a claim that all iOS app tests or Apple account/IAP flows pass.

Evidence under `output/ios-simulator/evidence/`:

- `pod-install.log`, `ios-export.log`, `xcode-build.log`,
  `xcode-build-muted-signed.log`.
- `ios-smoke-3.xcresult`, `smoke-3-summary.json`, `smoke-3-attachments/`:
  passing native navigation, screenshots and accessibility trees.
- `ios-save-lifecycle.xcresult`: initial keyboard-overlay-interrupted attempt.
- `ios-save-lifecycle-2.xcresult`: unsigned app's first-save failure.
- `ios-save-lifecycle-3.xcresult`: appearance-prompt harness interruption.
- `ios-save-lifecycle-4.xcresult`, `lifecycle-4-attachments/`: both careers
  created successfully; the run failed at the incorrect newspaper assertion,
  so the whole test is not counted as passing.
- `encrypted-save-envelopes-both-modes.json`: encrypted storage inspection,
  without exporting a decryption key.
- `ios-persistence-delete.xcresult`, `persistence-delete-run.log`,
  `persistence-delete-attachments/`: passing persistence/store/reload assertions
  followed by the hidden-button selector failure.
- `ios-delete-dialog.png`: observed dialog with visible Cancel/Delete controls.
- `ios-delete-guest-corrected.xcresult`, `delete-guest-corrected-run.log`:
  visible confirmation succeeded; empty-slot StaticText assumption then failed.
- `ios-post-delete-guest.xcresult`, `post-delete-guest-run.log`,
  `post-delete-guest-attachments/`: restart preservation, sign-out and cancelled
  deletion assertions; local deletion succeeded before the immediate-age-prompt
  assumption failed.
- `ios-muted-final.xcresult`, `muted-final-summary.json`, `muted-final-run.log`,
  `muted-final-attachments/`: final two passing tests with screenshots and
  accessibility trees.
- `envelopes-after-player-deletion.json`,
  `envelopes-after-guest-deletion.json`, `envelopes-after-fresh-manager.json`:
  actual storage evidence before and after local cleanup/fresh creation.
- `ios-app-errors.log`: earlier simulator audio warnings;
  `ios-muted-native-errors.log` and `ios-muted-native-errors-2.log`: no matching
  fresh Keychain, fatal, unhandled or `FigFilePlayer` errors in the checked windows.
- `ios-muted-final-errors.log`: the same scoped error scan over the latest
  20-minute window found no matching app errors.
- `ios-muted-handoff-errors.log`: final 15-minute test-window scan found no
  matching app audio, Keychain, fatal or unhandled errors.
- `android-isolation-and-muted-artifact.json`: all 1,073 Android build inputs
  matched their production baseline, plus Android AAB, simulator ZIP and staged
  mute-override hashes.
- `handoff-integrity.json`: final post-test recheck of Android inputs and both
  artifact hashes; zero changed Android build inputs.

XCTest sometimes waited 60 seconds for ongoing UI animations to become idle
before proceeding. Those waits are included in test durations; they are not
measurements of gameplay performance. This pass does not certify iOS performance.

## Remaining iOS release work and warnings

This first simulator artifact is not ready to upload to the App Store. Before
release we still need:

1. The intended production iOS bundle/app registration, signing and App Store
   Connect/TestFlight setup.
2. Apple IAP products and RevenueCat Apple configuration; real Apple sandbox
   purchase, pending/interrupted delivery, restore and existing-account tests.
   Google Play results cannot substitute for these.
3. Real iOS account sign-in/cloud recovery and review of the App Store's login
   requirements, including whether Sign in with Apple is required for the
   offered Google login. Local guest tests do not certify these services.
4. Production iOS AdMob configuration, consent/tracking decisions, privacy
   disclosures and Firebase setup if iOS telemetry is wanted.
5. Physical iPhone testing: touch, safe areas, performance, audio, background
   saving and payment/account flows. Other iOS versions and iPad layouts have
   not been exercised here.
6. Match/progression and extended negative-case testing on iOS. The first
   navigation/local-save pass is not a full-platform regression certification.

The build emitted dependency deprecation/Hermes warnings and CocoaPods fell back
to building Expo modules from source because macOS's old Ruby lacks
`filter_map`; these did not prevent a successful build. The AdMob build script
warns about a missing legacy app.json key but explicitly permits the Expo config
plugin. The installed Info.plist contains the correct iOS test app ID and the
app launched, so this is not an absent-ID startup crash.

Earlier simulator runs emitted CoreMedia `FigFilePlayer` error `-12864` warnings,
and the owner heard audio from that earlier app. The source WAVs were valid PCM
according to Apple's `afinfo`. The rebuilt QA app now suppresses game playback;
the checked muted-run log windows did not contain those errors. Physical-device
audio quality still needs testing when audio is deliberately re-enabled for a
production iOS build.

## Open the installed simulator build

For the existing QA simulator on this Mac:

```sh
open -a Simulator --args -CurrentDeviceUDID 6A85EC9A-070E-41D0-AC4B-D1C578B02886
xcrun simctl launch 6A85EC9A-070E-41D0-AC4B-D1C578B02886 com.coverdrive.cricket.simulator
```

If it is shut down, boot that exact QA simulator first. To reinstall the app in
place without deleting its QA saves:

```sh
xcrun simctl install 6A85EC9A-070E-41D0-AC4B-D1C578B02886 output/ios-simulator/derived-data/Build/Products/Release-iphonesimulator/CricketSimulator.app
```

Do not erase an existing device or uninstall a customer's app as an installation
step. The simulator ZIP cannot be installed directly on the owner's iPhone.

The Cricket Legacy skill kept native QA separate from production and retained
the approved gameplay, economy and recovery rules. All 1,073 hashed Android
build inputs and the submitted code-16 AAB matched their production baseline
after the muted iOS build. The Android AAB SHA-256 remains
`301522f9e0c1ae9555c3f0c9689286666c1095498d3962534fe6e4d816c2db4d`.
