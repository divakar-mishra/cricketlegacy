# Cricket Legacy — Play Console, policies and closed-testing record

Last recorded: 13 September 2026. This is the consolidated handoff for this
release session. External status below comes from the owner's Console/provider
screenshots and the verification recorded during the session, not a live API
connection. Times are as displayed by Play Console; timezone was not independently
verified. Publication is for **closed testing, not public production access**.

## Day 5 follow-up — 19 September 2026

A focused copy, responsive-layout, performance/touch and Google sign-in audit
was completed during closed testing. The working tree now removes rendered
`Recommended`/`Advanced` labels and aligns four-option creation selectors across
phone and wide layouts. These changes are not yet in the published version-code
4 artifact. Focused verification passed: five suites, 42 tests, TypeScript and
focused ESLint.

The Play-installed version-code 4 package and OAuth configuration were checked
without using account credentials. The native callback scheme, production EAS
variables, enabled Supabase Google provider and redirect to Google were all
confirmed. A real account consent/return/restart test is still required. The
startup performance sample found some frame/input-latency pressure but is not a
long-session degradation test. Full findings, raw metric summary, soak protocol
and unimplemented proposals are in the
[Day 5 UI and stability audit](CLOSED_TEST_DAY5_UI_STABILITY_AUDIT_2026-09-19.md).

## Current position

| Item | Recorded outcome |
| --- | --- |
| Android app | Cricket Legacy; `com.coverdrive.cricket` |
| Play build | Version code **4**, version name **1.0.0** |
| Internal release | `Cricket Legacy Internal Test 4`, available to internal testers |
| Closed release | `Cricket Legacy Closed Test 1`, Alpha track active |
| Submission | Submission 1; 15 changes; submitted 13 September at 04:24 AM |
| Publication | Status **Published**, 13 September at 04:35 AM (about 11 minutes) |
| Managed publishing | Off during this submission |
| Distribution | Closed Alpha showed 177 countries/regions after publication |
| Google Play Games on PC | Owner opted out before submitting; pending changes fell from 16 to 15 |
| Testing provider | Testers Community submission succeeded; dashboard **In testing**, Day **0/16**, reports pending |
| Provider plan/credits | Pro: 25 testers and detailed ASO report, as displayed; one of three credits used, two remaining |

## Accounts, links and access

- Play Console remains under the owner's personal Google account. Firebase and
  Testers Community were set up using the developer account. The account display
  name “Sunlight Pvt” does not change the approved legal publisher identity.
- Developer/support/feedback email: `devsunlightpvt@gmail.com`.
- Firebase project: `cricket-legacy`; Android app registered for
  `com.coverdrive.cricket`. The previous personal `test-e7934` configuration was
  replaced in both client `google-services.json` files.
- Closed-test opt-in URL:
  <https://play.google.com/apps/testing/com.coverdrive.cricket>.
- Alpha tester access: **Google Groups**, not an email list:
  `testers-community@googlegroups.com`.
- Provider submission: <https://www.testerscommunity.com/submit-app>.
- Provider setup reference:
  <https://www.testerscommunity.com/google-play-setup-guide>.
- No Google password, MFA code, signing secret or service-account private key is
  stored in this record. Provider submission is not permission to grant Console
  administrator access. No phone number is recorded here.

## Firebase changes and verification

Installed React Native Firebase app, Analytics and Crashlytics **26.4.0**;
configured Expo plugins and Android Gradle integration. Owning files include
`firebase.json`, `app.json`, `android/build.gradle`, `android/app/build.gradle`,
`src/services/telemetry.ts`, analytics/crash facades, `App.tsx`, Settings and the
settings store. See [Firebase handoff](FIREBASE_RELEASE_HANDOFF.md).

- Independent Usage analytics and Crash reports switches are optional and
  default off, including native startup defaults.
- Analytics advertising consent, ad-ID/SSAID collection and automatic screen
  reporting are disabled. This does **not** disable the separate AdMob SDK.
- Custom events use fixed names/enums and aggregate numeric/boolean values;
  account identifiers, email, receipts and save contents are not attached by
  the custom telemetry layer. Standard SDK-generated data is separate.
- JS error messages/context are sanitized; native reports use standard SDK
  diagnostics. NDK reporting is disabled.
- Firebase Realtime screenshot showed one active user, `first_open` and
  `session_start`: **basic Analytics delivery confirmed**.
- With owner authorization, an ADB-induced native crash was triggered on the
  test emulator and the app reopened. Firebase later showed one event:
  `android.app.RemoteServiceException$CrashedByAdbException: shell-induced crash`.
  **Native Crashlytics delivery confirmed**. The 0% crash-free metric in that
  screenshot resulted from this deliberate single-user test, not evidence of
  a newly discovered gameplay crash.
- Earlier session verification recorded `npm run check` passing: 225 suites,
  1,349 tests, two snapshots. This documentation task did not rerun that suite.

Still unverified: custom gameplay-event receipt, complete opt-out/restart
network behavior, sanitized JS nonfatal delivery and readable Hermes source-map
symbolication. Dashboard success is not proof that every reporting path works.

## Signed Android artifact and observed warnings

- EAS production build ID: `71c35176-9299-40dd-93fe-ddce8a18ce65`.
- [Build record](https://expo.dev/accounts/sunlightpvt/projects/cricket-legacy/builds/71c35176-9299-40dd-93fe-ddce8a18ce65).
- [Signed AAB artifact](https://expo.dev/artifacts/eas/uz0N2zxiOIov4v4pC47WMiV6sLla3AzNYyUMLMJwj3c.aab).
- Production build used remote signing, remote version increment and QA tools
  disabled. The existing AAB was added from Play's library for closed Alpha.
- Play reported min API 24, target SDK 36, four ABIs, 19,276 supported devices,
  60.9 MB new-install download size and 16 KB memory-page support.
- On the emulator, Android package inspection confirmed version code 4 and
  installer `com.android.vending` after installing from Play.
- Settings displayed **Build 1** because generated in-app build metadata was
  stale. This display defect was diagnosed but not fixed; it does not override
  the native version code 4 verification.
- Play warned that no deobfuscation file was associated with the AAB. It did not
  block publication. Low app optimization / 2% obfuscation were also displayed;
  no R8 optimization or matching mapping-file fix was completed in this session.
- Keep the matching AAB, build logs and JS source map together. PC compatibility
  was not verified. Android XR was visible as active in Advanced settings; no
  XR-specific compatibility verification or opt-out was recorded.

## Public policies and deployment

Approved publisher: Divakar Mishra, individual trading as Sunlight. Public
location wording: **Maharashtra, India** (September 11 override). The approved
age policy remains **18+ in India, 13+ elsewhere**; do not infer that the global
Play audience selector alone enforces the India-specific policy.

- Policy effective date remains 20 August 2026; Firebase revision dated
  13 September 2026.
- Updated Privacy Policy describes optional Analytics/Crashlytics, data and
  purposes, SDK identifiers, coarse location/purchase considerations, choices
  and retention/deletion limits. Turning reporting off is not a promise to
  delete already-uploaded provider data.
- Website source change: `legal-site/build-core.cjs`; related tests:
  `src/config/__tests__/legalSite.test.ts`.
- Cloudflare Pages project `sunlight-publisher-site`, production branch `main`;
  deployment `6d4377f7.sunlight-publisher-site.pages.dev`.
- Production privacy URLs were checked live for HTTP 200 and updated Firebase
  text during the session:
  <https://sunlight-publisher-site.pages.dev/products/cricket-legacy/privacy/>
  and <https://sunlight-publisher-site.pages.dev/privacy/>.
- Terms, Support and Account Deletion routes were also checked during deployment.
  External deletion URL recorded in the CSV:
  <https://sunlight-publisher-site.pages.dev/delete-account/>.
- This was a direct Cloudflare deployment; no Git commit/push was required or
  performed as part of that deployment. Hosting a deletion page does not prove
  backend deletion, retention pruning or support operations are verified.

## Data safety and App content

Original owner export: `/Users/divakarmishra/Downloads/data_safety_export (1).csv`.
It was left unchanged. Corrected import copy:
[data-safety-corrected-2026-09-13.csv](data-safety-corrected-2026-09-13.csv).
The session recorded 783 rows, five columns and 21 response-value changes, with
question/response metadata preserved. See the
[focused source/SDK review](PLAY_DATA_SAFETY_FIREBASE_REVIEW_2026-09-13.md).

Recorded corrections included:

- Name: non-ephemeral, optional; removed unsupported Analytics/advertising purposes.
- Email: removed advertising purpose.
- Crash logs: optional; removed fraud purpose, retaining Analytics.
- Device IDs: retained whole-app AdMob advertising collection/sharing purposes.
- Diagnostics and other performance data: included AdMob-related sharing and
  advertising/analytics/fraud purposes rather than treating these as Firebase-only.

The existing declaration included name, email, user IDs, purchase history,
approximate location, crash logs, diagnostics, other performance information,
app interactions and device IDs. Supabase, RevenueCat and AdMob contributions
must not be removed simply because Firebase is optional. The separate
data-deletion-request question was unanswered in the reviewed export and was
not silently invented in the corrected file.

Screenshots subsequently showed Data safety actioned on September 13 and then
included in the published submission. **A final post-import export/expanded
preview was not inspected**, so publication is not certification of every saved
answer or provider behavior.

Advertising ID: Play detected `com.google.android.gms.permission.AD_ID`. The
owner selected Yes; guidance was to select Analytics, Advertising/marketing,
and Fraud prevention/security/compliance for the whole app. Submission history
confirmed the declaration was updated, but no final expanded answers were captured.

The published submission also recorded English-US listing, Sports game category,
content-rating questionnaire, target audience 13+, privacy URL, Ads declaration
and Health apps declaration. Sign-in/app-access, Advertising ID, government and
financial-feature declarations appeared in the separate “What you've told us”
section. Their appearance is not a new field-by-field audit of those forms.

## Closed-test setup and tester brief

PC opt-in was removed in Advanced settings → Form factors before submission.
No new AAB was needed. Internal testing and public production access are separate
from the published closed Alpha track.

Release notes submitted:

```text
First closed test of Cricket Legacy.
Explore Player and Manager careers, match simulation, training, and club management.
Please report crashes, save issues, confusing screens, and gameplay balance feedback.
Optional usage analytics and crash reporting are available in Settings and disabled by default.
```

Testers Community submission used Cricket Legacy's existing square icon and
the opt-in URL above. The PWABuilder/Bubblewrap question was answered **No**:
this is an Expo/React Native Android app, not a TWA website wrapper.

Tester instructions submitted:

```text
Please test Player and Manager careers, matches, training, and club management.
Check that progress is saved after closing and reopening the app.
Report crashes, confusing screens, and gameplay balance problems.
Usage analytics and crash reporting are optional and can be enabled in Settings.
Do not make real-money purchases.
```

The submitted credentials field contained those notes, not a login. If testers
encounter restricted functionality, establish a dedicated, appropriately scoped
test access path; never give them the owner's Google login. Actual successful
provider tester installations/opt-ins were not yet evidenced at Day 0.

## Follow-up checklist

- [ ] Confirm provider testers can opt in, install and reach the requested modes.
- [ ] Track tester eligibility/progress in Play Console, not only the provider's
  Day 0/16 counter. The recorded Play requirement is at least 12 testers opted
  in continuously for at least 14 days before applying for production access.
- [ ] Read and preserve genuine feedback; record fixes and retests before the
  production-access application. No feedback reports were available yet.
- [ ] Treat the provider's “100% Production Access Guarantee” as its advertised
  refund promise, not a guarantee that Google will approve production access.
- [ ] Obtain a final saved Data safety export and reconcile remaining answers,
  deletion/retention operations and age/ad-consent behavior against the build.
- [ ] Complete remaining Firebase checks listed above.
- [ ] Fix stale Settings build display; review R8/mapping and symbolication.
- [ ] Verify actual commerce checkout/restore/refund and consumable fulfillment
  separately. Closed-test publication does not establish money flows as tested.
- [ ] Keep PC/XR compatibility explicitly unverified until platform-specific QA.

This session's work does not establish that older balance-audit figures still
apply; no new full-career population balance audit was run for this record.
No public production release, iOS release or automatic ongoing monitoring was
performed. Update this log when new evidence arrives, with date and source.

## Reference links used during the session

- [Google review and publishing controls](https://support.google.com/googleplay/android-developer/answer/9859654)
- [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Firebase Android disclosures](https://firebase.google.com/docs/android/play-data-disclosure)
- [AdMob Android disclosures](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Google Play Games on PC distribution](https://developer.android.com/games/playgames/development-submit)

These are reference links, not a fresh legal review. This record and the related
handoffs were saved locally; committing/pushing is a separate owner action.
