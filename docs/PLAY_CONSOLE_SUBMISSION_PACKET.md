# Cricket Legacy — Play Console submission packet

Prepared 11 September 2026 from source. Local preparation, NOT a submitted store
declaration or compliance certification. Dashboard-dependent answers remain
subject to confirmation. Latest IAP list: `docs/IAP_CATALOGUE_FINAL.md` (14 items).

### Follow-up implementation — 11 September

This update supersedes the missing-consent/age findings below: local age-band and
residence self-declaration now gates game mounting, auth rehydration, purchase and
integrity startup. India requires adults; outside India, 13–17 requires declared
guardian permission. This is NOT verified age/parent identity. Answers stay local;
no birthday is requested. Ads remain off for all declared minors. Adult ad SDK
initialization waits for UMP `canRequestAds`; errors fail closed. Settings exposes
Ad privacy choices. Native ad measurement initialization is delayed. AdMob's
Privacy & messaging configuration and real-device consent behavior remain unverified.

Website home/product pages now use the canonical app icon. Local Privacy and Terms
reflect these controls and permanent VIP. Neither website nor app updates have
been deployed. The site build copies `assets/icon.png` automatically, avoiding a
separate divergent icon. Final release screenshot capture remains pending.

Additional release finding: checked-in Android release signing still references
the debug signing config; EAS may inject signing on its builder, but no signed
release AAB was verified here. Do not upload the QA APK. Remote versionCode must
increase beyond existing Play uploads. Check the final merged manifest and signing
certificate, backend deployment/deletion, legal URLs, RC key and product checkout.

Publishing the website requires authenticated access to the existing Cloudflare
Pages project `sunlight-publisher-site`, not a new site or domain. No callable
Cloudflare deployment connector or local wrangler executable was found. Once
authorized/authenticated, deploy the generated `legal-site/dist` directory with
`npx wrangler pages deploy legal-site/dist --project-name sunlight-publisher-site`.
Then verify all four public routes and the icon before marking deployment complete.

Local verification: 44 focused tests across age gate/persistence, consent,
auth-session/deletion/cloud boundaries and legal rendering passed. TypeScript
passed. Website build produced seven pages and its icon matches assets/icon.png
byte-for-byte. Upload archive: `output/play-store/sunlight-website-20260911.zip`.
These are local checks, not device SDK/production-backend or public deployment tests.

## 1. English store listing — copy-ready

App name: `Cricket Legacy`

Short description (maximum 80 characters):

```text
Build a cricket career or manage a club. Train, play and leave a legacy.
```

Full description:

```text
Two careers. One cricket world.

Cricket Legacy is a single-player cricket career and club-management simulation. Build your own player story or take charge of a squad, with cricket decisions at the centre of every season.

BUILD YOUR PLAYER CAREER
Create a cricketer and begin in Grade A cricket. Train your skills, manage form and readiness, and earn opportunities at youth, domestic and international levels through performance. Follow contracts, selection decisions and the records you build along the way.

LEAD YOUR CLUB
Choose your XI, appoint leaders, plan tactics and develop your squad. Scout transfer targets, manage club funds and invest in training, medical and academy facilities. Shape your home ground as your club grows.

FOLLOW THE MATCH
Experience simulated cricket through live match presentation, key moments or faster simulation. Follow the scoreboard and commentary, then examine scorecards and career records. This is a decision-led simulation, not a swipe-to-bat action game.

MAKE THE CAREER YOURS
Personalise your player with kits and cosmetics, explore off-field opportunities and celebrate season achievements. Keep separate Player and Manager careers in multiple save slots.

Cricket Legacy contains ads and optional in-app purchases. Player VIP and Manager VIP are separate, one-time purchases for their respective modes. Internet access is required for purchases and online services. Teams, characters and competitions are fictional.
```

Type: Game. Category: Sports. Default language: English (United States).
Support email: `devsunlightpvt@gmail.com`.
Website: https://sunlight-publisher-site.pages.dev/products/cricket-legacy/
Select only available tags that accurately describe cricket/sports/simulation.
Do not paste the older Hindi draft unchanged: it mentions School cricket and a
paid Season Pass. Do not invent a phone number or registered company status.

## 2. Artwork and screenshots

Existing, visually inspected assets:
- `output/play-store/app-icon-512.png`: 512×512 PNG. Review baked rounded corners
  against Play icon guidance before final submission.
- `output/play-store/feature-graphic-1024x500.png`: 1024×500 promotional illustration,
  not gameplay. Shows the correct Player Career / Club Manager positioning.

Final screenshots are PENDING. Capture the actual signed upload candidate with
QA tools disabled, preserving the owner's saves. Recommended six phone shots:
Player hub, live match, Manager squad, stadium, academy/training, kit/profile.
Avoid QA balances, personal information, errors and old pass pricing. Generated
art and visual-review sheets must NOT be presented as gameplay screenshots.

Minimum two screenshots. PNG/JPEG, 320–3840 px per side; longest side no more than
twice shortest side. Prefer genuine 1080×1920 portrait compositions. Capture
tablet UI separately if needed; never stretch phone shots. Leave video blank
until there is a real trailer.
Source: https://support.google.com/googleplay/android-developer/answer/9866151

## 3. Public legal pages and release configuration

Existing hostname from project records; current reachability NOT verified:

| Resource | URL |
| --- | --- |
| Privacy | https://sunlight-publisher-site.pages.dev/privacy/ |
| Terms | https://sunlight-publisher-site.pages.dev/terms/ |
| Support | https://sunlight-publisher-site.pages.dev/support/ |
| External deletion | https://sunlight-publisher-site.pages.dev/delete-account/ |

Configure the corresponding four EXPO_PUBLIC_* legal variables in the release
environment using `.env.example`. No local .env was found; remote EAS values are
unknown. Run `npm run check:legal` with those values. This audit's public fetches
failed and the network-enabled retry was denied by the environment approval limit;
this is NOT proof the site itself is down.

Local Terms now describe permanent mode-specific VIP, legacy-only subscriptions,
cosmetics-only retirement and no repeated currency grant on restore. Build with
`npm run build:legal-site`; deployment is separate and has NOT occurred. Approved
policy date and retention values are unchanged; review the publication revision
date before deploying. Confirm actual provider/support retention matches promises.

In-app deletion: Main menu → Account → Delete account & data (remote account),
or Delete local account & data (local guest). Verify remote deletion and external
email requests on disposable accounts, plus RevenueCat and backup retention.
Do not test deletion on the owner's real saves.

## 4. App content declarations

### Ads: Yes

Current app includes AdMob rewarded/interstitial ads. VIP ad removal does not
make the free app ad-free. App.tsx initializes src/services/ads.ts. Requests are
non-personalized, but no AdsConsent/UMP flow or user-age gate was found. Resolve
consent/age handling before advertising to affected audiences. Use test ads/test
devices for testers; never ask them to click live ads.

### Data safety: source-backed draft, do not certify without provider checks

Collects/shares required data types: **Yes**. SDK and optional online collection
count even when core gameplay works locally.

| Data type | Evidence / proposed treatment | Verify before submission |
| --- | --- | --- |
| Purchase history | RevenueCat: collected, not ephemeral; functionality and analytics; required per provider guidance | Sharing depends on integrations |
| User IDs | Supabase account IDs and RC purchase identity | Anonymous auth and release flags determine optionality |
| Name/email | Google OAuth/Supabase account fields | Actual returned fields and optional sign-in path |
| App interactions / other user-generated content | AdMob; online leaderboard/save fields if enabled | Which online paths actually run; Account currently says cloud save unavailable |
| Approximate location | AdMob IP-derived location | Installed SDK/configuration; not a GPS permission |
| Device/other identifiers | AdMob, enabled integrity/authentication signals | Merged manifest AD_ID and provider integrations |
| Diagnostics/app performance | AdMob diagnostics | Exact data subtypes and purposes |

AdMob discloses collection/sharing for advertising, analytics and fraud prevention.
Do not mark all third parties “not shared”; assess Google's service-provider
exception separately for Supabase/RevenueCat. Determine required/optional and
ephemeral flags per data type from the final configuration/network evidence.
Answer encrypted in transit only after verifying ALL endpoints/providers, not
because local save files are encrypted. Disclose Google OAuth and automatic
server guest accounts where enabled. Supply deletion URL after operational tests.
Do not claim an independent security audit.

No camera, contacts, precise GPS, microphone or real health collection path found.
Fictional player injuries/fitness are game data, not a user's health data. Local
data not transmitted off-device is not collection. Native Firebase analytics
packages are absent; do not reuse the old claim that Firebase analytics is live.

Sources:
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://developers.google.com/admob/android/privacy/play-data-disclosure
- https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety

### Target audience

Approved policy: 18+ in India, 13+ elsewhere; not directed to children. For the
planned India-only closed test, use adult testers and target **18 and over**.
Before global expansion, reconcile age bands with real country/age controls.
Do not select all ages or children merely because cricket is family-friendly.
The fictional player starting at age 16 is unrelated to the user's age.
No matching user-age enforcement was located; policy text alone is not a gate.
Changing the approved age policy requires owner approval.

### Content rating

Complete the Game questionnaire; contact devsunlightpvt@gmail.com; IAP **Yes**.
All 14 launch products have specified rewards: Chest of Gems is not random loot.
No real-money wagering/cash-out identified. Review exact gambling, simulated
gambling, injury/violence, language and social/content-sharing questions against
shipped stories, fictional investments and leaderboard names; do not blanket
answer No. No chat identified, but user names and external newspaper sharing need
accurate disclosure where asked. IARC calculates the rating; do not manually
force an 18+ content rating to match the target audience.

## 5. Reviewer access

Select **some functionality restricted** if sign-in or purchases gate features.
Do not claim all functionality unrestricted because the core game is free.
Draft instructions to verify on the upload candidate:

```text
Cricket Legacy is a single-player cricket career simulation. Core careers do not require a developer-provided account. From the main menu create a Player or Manager career. If an account choice is shown, choose Play as Guest.

For Player Career, create a cricketer and follow the career hub's next action. For Manager Career, choose a club, review the squad and follow the next fixture action. Purchases are optional; the Store contains mode-specific VIP and consumable products.

Google sign-in is available from Main menu > Account and links purchase ownership. The Account screen currently states that cloud save is unavailable. Account deletion is available from the same screen.

Support: devsunlightpvt@gmail.com
```

Restricted premium/account review access remains to be verified. Provide stable
reviewer credentials or another accepted access method if required; do not
instruct reviewers to buy VIP or invent a working account. Never use the owner's
personal Google credentials. Complete Console access fields after this test.

## 6. Closed testing and TesterCommunity handoff

Personal account created after 13 November 2023: **Closed testing first**, at least
12 testers continuously opted in for 14 days; then apply for production access.
Paid testers and a 14-day wait do not guarantee approval. Google reviews real
engagement/feedback and may require more testing. Open testing follows production
access, not the other way around.

1. Complete app setup and create a signed AAB with QA tools off, real RC Android
   configuration, legal URLs and unused versionCode. Internal-test purchases first.
2. Console → Test and release → Testing → Closed testing. Create track, choose
   eligible countries (India for the planned adult-only test), add tester list or
   Google Group, upload the AAB, add release notes and submit/roll out as prompted.
3. Once live, send opt-in and install instructions. Paying a service is not opting
   into Play. Verify actual opt-in dates; keep 12 enrolled continuously, including
   at application time. Invite extra testers to cover dropouts.
4. Collect real reports, ship fixes and retest. Add designated IAP testers to
   License testing separately; confirm test instruments, never real charges.
5. When eligible, apply on Dashboard using actual engagement, feedback and fixes.
   After approval, use Open testing if useful. BillDesk must separately confirm
   acceptance of a live beta; merchant approval remains unresolved.

Before paying TesterCommunity confirm: real adult testers in eligible countries,
continuous Play enrollment, device coverage, written bug reports and retests.
No passwords, admin access, signing keys, paid reviews or live-ad clicks needed.
This audit does not endorse or verify that service's approval claims.

### Test assignment

- Days 1–3: fresh Player and Manager careers, onboarding, selection and matches.
- Days 4–6: saves, background/relaunch, offline play, interrupted matches.
- Days 7–9: training, transfers, facilities, insufficient-resource popups.
- Days 10–12: license testers cover all products, cancelled/pending purchases,
  mode-specific VIP, duplicate-grant protection and restore without consumable replay.
- Days 13–14: regressions, compact screens, larger fonts, app update preserving
  saves; privacy/support and deletion on disposable accounts only.

Bug report: tester alias; device/Android; versionCode; mode; steps; expected;
actual; screenshot/video; severity; fix version; retest. No passwords or unrelated
personal/financial data. Keep reports for the production-access application.

Source: https://support.google.com/googleplay/android-developer/answer/14151465

## Completion record

Prepared locally: listing copy, declaration draft, reviewer instructions, screenshot
brief, tester plan, Terms correction and regression coverage. No Console submission,
legal deployment, AAB build/upload, screenshots captured or tester purchase.
Remaining: consent/age controls; provider evidence; deletion test; restricted
review access; final screenshots; legal deployment and release configuration.
