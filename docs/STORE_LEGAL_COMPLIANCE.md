# Store legal and purchase compliance audit

Status date: 2026-08-20

This is an engineering compliance audit, not legal advice. Final policy wording
must be approved by the developer's legal adviser and must match the production
build, backend, SDK settings and store-console declarations.

## Implemented in the app

- Settings now exposes Privacy Policy, Terms & Conditions, Help & Support, and
  Account & Data Deletion as external links.
- The links accept only public HTTPS destinations. There are no invented or
  placeholder production URLs. Missing links are visibly marked in non-release
  builds and omitted from a production UI that should have been blocked by the
  release check.
- `npm run check:legal` fails until the legal-site policy choices are complete,
  all four public URLs are configured, and each URL returns the expected public
  Cricket Legacy HTML page at its distinct canonical route.
- Production EAS builds run that gate automatically through the supported
  `eas-build-post-install` lifecycle hook. Tagged releases and manually started
  release-readiness workflows run `npm run check:release`; ordinary development
  and preview builds remain available while launch configuration is incomplete.
  Direct Android `preReleaseBuild` also depends on the same gate, so a local
  release APK/AAB cannot bypass it.
- The Season Pass purchase surface shows the localized monthly price when the
  store supplies it, states that the subscription auto-renews until canceled,
  and links to Privacy and Terms.
- An active Season Pass exposes the platform's official subscription-management
  page: Google Play on Android and the App Store on iOS.
- The Store exposes a user-triggered Restore Purchases button backed by
  `purchases.restore()` and `careerStore.restorePurchases()` for restorable
  subscriptions and non-consumables. Consumables, including an exact-save
  sponsor purchase, are intentionally not represented as ordinary restorable
  entitlements.
- The publisher is recorded as **Divakar Mishra**, an individual developer
  trading as **Sunlight**, located in Navi Mumbai, Maharashtra, India. No
  unregistered “Pvt” suffix, street address or phone number is invented.
- `legal-site/` contains a responsive, dependency-free Cloudflare Pages
  publisher site for Sunlight, a dedicated Cricket Legacy product page, and
  distinct Privacy, Terms, Support and Account Deletion routes for the game.
  Its approved India-18 / elsewhere-13 age branch, 2026-08-20 effective date
  and first-release retention schedule now build successfully; public hosting
  URLs are the remaining website step. Future products can be added to the
  publisher catalogue, but must receive separately reviewed legal routes when
  their data, commerce or account behavior differs.
- The Account screen distinguishes local-only deletion from authenticated
  remote deletion. Remote deletion must be confirmed by the server before any
  local data is cleared, and the warning explains that account deletion does
  not cancel a store subscription.

Configure these build-time variables before a release:

```text
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://...
EXPO_PUBLIC_TERMS_URL=https://...
EXPO_PUBLIC_SUPPORT_URL=https://...
EXPO_PUBLIC_ACCOUNT_DELETION_URL=https://...
```

## Repository SDK and data inventory

This source audit can identify what the checked-in build is capable of using;
the final Play/App Store declarations must still be reconciled against enabled
console features, provider dashboards and a production device/network test.

- **On-device storage:** AsyncStorage holds careers, settings, local purchase
  ledgers and cached cloud metadata. It remains on the device until the user
  deletes it, clears app data or removes the app.
- **Supabase:** the installed client supports authentication, cloud saves,
  online leaderboard submissions, server-owned purchase bindings and account
  deletion. Those paths can process an account UUID, save/gameplay data,
  leaderboard fields, server timestamps and ordinary service/security logs.
- **RevenueCat and the app stores:** the installed RevenueCat client and
  server functions process a pseudonymous app-user ID, product and entitlement
  identifiers, store transaction identifiers/status, environment, refund and
  revocation state. Sunlight does not receive a full payment-card number.
- **Google Mobile Ads:** the Android AdMob SDK/plugin and an Android app ID are
  present. Ad requests currently ask for non-personalized inventory, but the SDK
  may still process device/ad identifiers, IP address, interactions, consent
  state and diagnostics. Final consent flow, child treatment, production unit
  IDs and Data safety answers still need provider/device verification.
- **Notifications:** Expo Notifications schedules local reminders after device
  permission. The checked-in service does not upload a push token or operate a
  remote push-notification backend.
- **Sharing:** Expo Sharing and view-shot create a local newspaper image only
  after the user chooses Share; the destination app then handles that image or
  text under its own policy.
- **Analytics/crash reporting:** gameplay events are buffered in memory and the
  crash facade logs locally in development. Firebase Analytics is described in
  optional code, but its native packages/plugins are not installed in the
  checked-in dependency/configuration set, so it must not be declared as an
  active processor unless it is deliberately added later.
- **Legal-site hosting:** Cloudflare Pages will receive ordinary HTTPS/security
  request data for the four public pages. No marketing-cookie or form backend is
  included in the static site.
- The Android manifest blocks microphone and broad external-storage
  permissions. No precise-location, contacts or camera collection path was
  found in this repository audit.

## Release blockers

### 1. Hosting and final provider declarations remain

The publisher identity, location, contact email, effective date, age policy,
retention schedule and India/Maharashtra non-exclusive governing-law clause are
now configured. The repository still cannot complete release compliance without:

- reconciliation of the repository inventory above with the exact Supabase,
  RevenueCat, Google Mobile Ads, Cloudflare and store-console configuration used
  for the release build;
- confirmation from provider dashboards/device tests of which production SDK
  data is linked to an identity or used for tracking/advertising;
- refund/support process and final virtual-currency/IAP rules;
- the final Cloudflare Pages hostname or custom domain on which the four public
  pages will be hosted.

The two implemented age branches are:

- `global_13_parental_consent`: 13+ worldwide with verified parent/guardian
  consent where required, including the applicable Indian child-data treatment.
- `india_18_elsewhere_13`: 18+ in India and 13+ elsewhere.

The owner selected `india_18_elsewhere_13` on 2026-08-20. Cricket Legacy is
18+ in India and 13+ elsewhere, is not directed to children, and will not use or
claim an Indian parent-verification flow. Outside India, a user below their
local age of majority must have parent/guardian permission where local law
requires it. Store target-audience and age-rating declarations must match this
policy and must not list the app in a children/families category.

The approved first-release retention schedule is: active-account deletion
within 7 days, pseudonymous deletion-request status 30 days, provider backup
rotation 7 days, security/support records 90 days, and minimum pseudonymized
purchase/refund/chargeback/fraud evidence 365 days. Supabase production plan,
function secrets, scheduled pruning and support operations must match those
published limits before release.

The Privacy Policy must identify the developer/app, data and purposes, sharing,
security, retention/deletion, user choices, and a privacy contact. Google says
the URL must be public, non-geofenced, non-editable by visitors, and not a PDF.
The Terms should cover the game licence, accounts, acceptable use, virtual
currency, sponsorship and save-bound purchase behavior, subscriptions,
refunds, suspension/termination, intellectual property, disclaimers, liability,
governing law and contact details. Do not copy another app's legal text.

Apple supplies a Standard EULA if no custom EULA is submitted. A developer
Terms & Conditions page is still useful here and is required on the subscription
surface together with Privacy under Apple's paid-app agreement. Decide with
legal counsel whether to rely on Apple's Standard EULA or submit a custom EULA.

### 2. Account deletion has a secure foundation but is not deployed

Local-only accounts delete device data. Authenticated Supabase accounts now call
the `delete-account` Edge Function with an empty body. The function verifies the
bearer session, derives the user ID from the JWT, purges cloud/game rows and
configured storage, removes server-owned sponsor bindings, and deletes the Auth
user with the server-only admin API. It keeps only an expiring HMAC-derived
request reference for retries/status; no raw user ID is stored there. Before
removing a premium-sponsor purchase, it also retains an expiring pepper-HMAC
transaction tombstone so the consumed transaction cannot be rebound. The
tombstone has no user, save, entitlement or sponsor-branding linkage.

Remaining production work:

1. Apply the migration and deploy the Edge Function with JWT verification on.
2. Supply a strong server-only HMAC secret and approved request-retention days.
3. Configure every user-owned Storage bucket and add future user-owned tables
   to the purge contract before those features ship.
4. Schedule pruning of expired pseudonymous request rows and purchase
   tombstones.
5. Retain only records that counsel confirms are legally necessary, and disclose
   their exact category, reason and retention period in the Privacy Policy.
6. Deploy the external deletion page and operate its manually verified email
   path for users who cannot access the app; do not treat unverified email as
   authority to delete another person’s account.
7. Run sandbox deletion tests for anonymous, linked, subscribed, sponsored,
   offline, partial-failure and retry cases.

Apple explicitly includes automatically created/guest accounts in its deletion
requirement. Google requires both an in-app path and an external web resource
when an app supports account creation.

### 3. Store-console and backend work remains

- Google Play Console: add the Privacy Policy URL, external account-deletion
  URL, and accurate Data safety answers for the app and every included SDK.
- App Store Connect: add the Privacy Policy and Support URLs, complete App
  Privacy answers, choose Standard versus custom EULA, and configure the first
  subscription with its app-version submission.
- Verify that `season_pass` is actually configured as a one-month auto-renewing
  subscription on both stores and mapped to the expected RevenueCat entitlement.
  The repository expresses that intent but cannot inspect either store console.
- Configure server notifications/webhooks and server-side purchase verification
  for renewals, cancellations, refunds, revocations, billing retry and account
  association. The exact-save premium sponsor remains correctly release-gated
  until unique receipt-to-save binding and revocation handling exist.
- Test purchase, pending purchase, restore, expiration, cancellation, refund,
  reinstall, device change and account deletion in Play license testing and
  App Store sandbox/TestFlight.
- Review Google Mobile Ads consent requirements and Apple tracking disclosure
  against the final SDK configuration. `requestNonPersonalizedAdsOnly` is not a
  substitute for a complete consent and privacy assessment.
- Confirm age rating and children/families declarations before enabling ads or
  analytics for younger audiences.
- `app.json` currently declares only `"platforms": ["android"]`. iOS settings
  exist, but an iOS/App Store build is not currently an enabled output. Enabling
  iOS requires its native build, RevenueCat Apple key/products, App Store
  metadata, privacy declarations and sandbox review.

## Official sources

- [Apple App Review Guidelines 3.1.1 and 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple: In-App Purchase — restore and purchase management](https://developer.apple.com/in-app-purchase/)
- [Apple: Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Apple: Standard versus custom EULA](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement)
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533)
- [Google Play subscription-management links](https://developer.android.com/google/play/billing/subscriptions)
- [Google Play subscription lifecycle and Restore](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- [Expo SDK 57 Linking reference](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)
- [Supabase user deletion and JWT behavior](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase server-only `auth.admin.deleteUser`](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
