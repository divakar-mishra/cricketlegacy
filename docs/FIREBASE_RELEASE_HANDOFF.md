# Firebase Android integration — 13 September 2026

Project: `cricket-legacy`. Android application: `com.coverdrive.cricket`.
Both client configuration files replace the former personal test project.
Client configuration is not a service-account credential.

Analytics and Crashlytics are optional and off by default, including native
startup defaults. Settings has independent consent switches. No startup dialog
or gameplay wait is added. Advertising consent remains denied for Analytics.
Only fixed event names, aggregate numeric/boolean values and fixed enums are
forwarded; no account ID, receipt, player ID, save contents or arbitrary text.
JS error messages/context are removed; bundle offsets are retained when present.
Native crash reporting uses the standard SDK after crash-report opt-in; NDK
reporting is disabled. Hermes offsets require the matching build's source map
for manual symbolication; readable original-source frames are not yet verified.

## Required release verification

September 13 update: version 4 was installed from Google Play. Firebase Realtime
showed `first_open` and `session_start`; Crashlytics received the owner-authorized
ADB `CrashedByAdbException` test crash after reopening. Basic Analytics and native
crash delivery are confirmed. The remaining checks below are not all complete.
See [the consolidated release record](PLAY_CONSOLE_RELEASE_LOG_2026-09-13.md).

- Privacy Policy published and live-verified on 13 September 2026. Cloudflare
  deployment: `6d4377f7.sunlight-publisher-site.pages.dev`. Both `/privacy/` and
  `/products/cricket-legacy/privacy/` on the production hostname serve the update.
- Reconcile Play Data safety: optional app interactions, crash logs, diagnostics
  and device/other IDs; review SDK-derived location and purchase data against
  Firebase's disclosure documentation and actual console configuration. Do not
  infer that optional data is undeclared or automatically counted as sharing.
- Install the new Play build, enable Usage analytics, complete a match and verify
  events in Firebase. Verify opting out stops events and survives reopening.
- With Crash reports opted in, verify a controlled nonfatal report on a test
  device; native forced-crash testing must use a disposable test session, not a
  user's unsaved career. Check dashboard receipt after restarting.
- Keep the AAB and its matching JS source map/build logs together.

The owner submitted and published closed Alpha version 4 on September 13;
Testers Community subsequently accepted the app (Day 0/16). This is not a public
production launch. See
`PLAY_DATA_SAFETY_FIREBASE_REVIEW_2026-09-13.md` for the source/SDK review and
remaining saved-form verification.
