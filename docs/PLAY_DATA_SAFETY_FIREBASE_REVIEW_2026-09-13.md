# Firebase Data safety review — Android version 4

Status update, September 13: source/SDK review completed and the owner's CSV
was reviewed. A corrected import copy was created as
[`data-safety-corrected-2026-09-13.csv`](data-safety-corrected-2026-09-13.csv).
Screenshots later showed Data safety actioned and included in the published
closed-test submission. The final post-import export/expanded saved answers
were not inspected; do not mark the entire declaration verified. This is
engineering guidance, not legal certification. See
[the consolidated release record](PLAY_CONSOLE_RELEASE_LOG_2026-09-13.md).

The privacy update was published to the existing Cloudflare production project
on 13 September 2026: deployment `6d4377f7.sunlight-publisher-site.pages.dev`.
Both production privacy URLs returned HTTP 200 with the new Firebase text;
Terms, Support and Account Deletion routes were also checked.

## Source configuration

Firebase project `cricket-legacy`; React Native Firebase 26.4.0. Analytics and
Crashlytics have independent default-off Settings switches. SDK native collection
defaults are off. Analytics ad ID, SSAID, automatic screen reporting and ad consent
are disabled. Custom events allow only fixed names, limited enums and aggregate
numbers/booleans. No Firebase account IDs, emails or save contents are attached.
Crashlytics uses sanitized JS reports plus standard native crash diagnostics;
NDK reporting is disabled.

## Changes to merge into the existing declaration

Do not replace the existing Supabase, RevenueCat or AdMob answers with this table.

| Data type | Firebase contribution | Purpose |
| --- | --- | --- |
| App activity → App interactions | Gameplay events and sessions | Analytics |
| App info and performance → Crash logs | Crash traces/nonfatal reports | Analytics |
| App info and performance → Diagnostics | Device/app state and session quality | Analytics |
| Device or other IDs | App-instance/installation identifiers | Analytics |
| Location → Approximate location | Analytics SDK can derive coarse location from masked IP | Analytics |
| Financial info → Purchase history | SDK purchase/subscription events, separate from our sanitized custom events | Analytics |

For Firebase's contribution: **Collected: Yes; ephemeral: No; optional: Yes**
(the user can keep both switches off). Optional does not mean excluded from
the declaration. Preserve any required collection or other purposes caused by
another part of the app; answer at whole-app level, not SDK level.

Crashlytics reporting includes transitive Installations and Sessions dependencies.
Firebase documents HTTPS transport for its SDK data. See
[Firebase Android disclosures](https://firebase.google.com/docs/android/play-data-disclosure).

Analytics automatically collected location/purchase/session data is separate from
custom-event sanitization. Ad-ID collection is disabled in this build, but this
does not remove app-instance IDs. Check Google Signals, Ads linking and optional
data-sharing settings in the console; the provided setup screenshot showed
optional data sharing off. See
[Analytics disclosures](https://support.google.com/analytics/answer/11582702?hl=en).

## Sharing and other answers

Do not automatically tick “Shared” merely because Firebase receives data:
Google's service-provider exception can apply when processing is solely on your
behalf. This depends on actual terms/configuration and integrations. Do not clear
existing Shared answers used by AdMob or other providers. Check all provider
uses before answering optional/required or sharing for a combined data type.
See [Google Play definitions](https://support.google.com/googleplay/android-developer/answer/10787469).

Firebase does not justify adding payment-card data, precise location, contacts,
photos, health data, email or name. Preserve legitimate existing account-related
declarations from Supabase. Game medical/fitness stats are not real health data.
Do not claim deletion of already-uploaded Firebase reports merely because the
switch is turned off; that only stops future reporting and clears eligible local
pending data. Dashboard delivery, retention settings and deletion operations
still require verification.

## Console handoff

The following was the original navigation handoff. The owner has since completed
the Console submission; remaining verification is of the final saved answers,
not a request to repeat or replace the published declaration automatically.

Play Console → Cricket Legacy → Monitor and improve → Policy and programs →
App content → Data safety → Manage. Export the existing CSV or expand all the
answers and send screenshots. Merge the table above, retain other provider
answers, review the preview, then save. The owner still performs the console
action because there is no connected Play Console browser/session here.
