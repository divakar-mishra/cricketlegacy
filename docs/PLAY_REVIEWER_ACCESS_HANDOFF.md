# Play Console reviewer-access handoff

## Latest: reviewer allowance implemented locally

Both VIPs, Player Legend frame and Manager Legend Boardroom were demonstrated
by the owner. The remaining coaching/scout/conditioning route now has local
implementation; see [REVIEWER_ACCESS_SETUP.md](REVIEWER_ACCESS_SETUP.md).
It requires a separately approved migration, operator enrollment and updated
candidate build. No backend change or new build was performed for this route.
Do not tick full access until the deployed route is verified on the candidate.
The older source-only responsiveness/build notes below are historical, not a
description of the currently installed QA build.

## September 12 — current status (supersedes historical build notes below)

The owner demonstrated email sign-in in the installed QA app and granted Player
VIP and Manager VIP with unlimited duration in RevenueCat. Restore showed success
and Manager VIP showed Active. Active is the expected result, not a restore bug.
Bundle/consumable reviewer access and the actual Play upload candidate remain
unverified. No Console submission is authorized by this handoff.

New responsiveness changes are source-only, not yet built or installed:

- Local archive saves no longer wait for remote cosmetic merges. Late replies
  merge into the latest local archive without granting ownership or currency.
- Healthy encrypted save writes reuse verified ciphertext as the rolling backup;
  they no longer decrypt the old backup or re-encrypt the previous save.
- Startup auth hydration runs independently of store setup. Unchanged VIP and
  absent legacy-pass responses avoid redundant career save/UI updates.
- The Store countdown stops offscreen/when inactive; Restore has explicit width;
  purchases without a career are disabled and failures have recovery messaging.

Before shipping, build an approved QA update without clearing saves and compare
career opening, screen changes, and match simulation on the same device/save.
Check Restore alignment and both modes' VIP access. Focused tests are not proof
that all device lag is gone. Full suite/build/install remain pending approval.

September 12 startup update: the owner requested removal of the age/region
questionnaire. App navigation and account login no longer wait for that screen.
Do not include age-screen steps in reviewer instructions. Existing stored age
declarations are preserved only for ad eligibility; new/unknown-age installs do
not initialize AdMob. UMP consent checks remain unchanged. Target-audience policy
and an appropriate no-questionnaire ad configuration still require reconciliation
before release. This source change is not yet in the installed QA APK.

## Updated route: Supabase email/password (owner approved)

This supersedes the Google-account creation route below. Local code now exposes
Account > Sign in with email > Existing account / reviewer sign-in when signed
out. If already a guest, use Sign out first; saves are not deleted. It uses
Supabase signInWithPassword followed by getUser verification, persists only the
normal account identity/session, and does not grant premium access. No signup,
hardcoded reviewer credential or QA bypass was added. Email is an additive auth
provider value; existing guest and Google profiles remain compatible.

Owner setup, one step at a time:

1. Open the Cricket Legacy Supabase project's Authentication > Users.
2. Use Add user / Create new user, not an email invitation. Enter an email or
   alias you control and a unique strong password. Confirm the email through
   the admin creation option for this single account; do not disable email
   confirmation or security settings globally. Do not create a Google account,
   add a phone number, or grant this account any Supabase administrative role.
   Keep Email/password authentication enabled. Never share a service-role key.
3. Record the generated user UUID privately. Build/install a candidate containing
   the new email-login code, then test it on a fresh device/profile. No updated
   APK/AAB has been built by this change. The old installed APK lacks this UI.
4. Sign in using the provided account email/password. Verify the UUID matches
   the RevenueCat customer, then grant the two VIP entitlements as described
   below. Do not instruct reviewers to purchase VIP. Test Restore Purchases.
5. Complete separate bundle/consumable access testing before claiming every
   restricted feature is accessible. Email login alone does not complete this.

Console Sign in details: Yes; Name = Cricket Legacy - Reviewer Access; enter
the actual email and password privately. Tested route will be Main menu > Account
> Sign out (if necessary) > Sign in with email > enter credentials > Sign in.
Do not claim no extra verification until live backend configuration is tested.
Credentials must remain reusable throughout future reviews.

Revisit Data safety account-creation methods for the new email/password route;
do not leave the declaration describing only Google OAuth. Review whether this
admin-provisioned, login-only method falls under the exact displayed question
before adding Username and password. There is still no public email signup.

https://supabase.com/docs/reference/javascript/auth-signinwithpassword

The following original Google route is retained as an alternative/reference,
not the current onboarding instruction.

Prepared 2026-09-12. Instructions and source review only: no reviewer account
created, no RevenueCat grant made, no new build installed, no Console submission.

## 1. Establish access before completing the declaration

Current app: Account supports Guest and Google OAuth, not a standalone
email/password login. RevenueCat uses the authenticated Supabase user UUID as
its App User ID. Restore reads the active entitlement keys. Do not invent an
email/password login screen, expose QA tools, or ask reviewers to buy access.

Owner actions using existing Google sign-in:

1. Create a dedicated review-only Google account with no personal mail, payment
   methods, publisher access, or administrative permissions. Keep its password
   out of this repository, chat and the public website.
2. Sign into the actual upload candidate through Main menu > Account > Continue
   with Google. Confirm Supabase creates the expected account and RevenueCat
   receives the same UUID. Resolve the exact customer before granting anything.
3. RevenueCat > Customers > that exact App User ID > Entitlements > Grant:
   grant player_vip and manager_vip with a duration that remains valid throughout
   initial and future reviews. Keep access maintained; do not rely on a 14-day
   tester window. This is a complimentary grant, not a purchase or billing change.
4. In the app, use Restore Purchases and verify both career modes' VIP content.
   Check on a second fresh device/profile without clearing existing user saves.
5. Verify access without approval from the owner's phone, an OTP, geographic
   restrictions or new-device challenges. Google account creation alone does
   NOT guarantee this. If Google challenges block unattended access, stop and
   implement a server-authenticated demo login, then retest the release build.
6. Separately test access to bundle-specific content and consumable features.
   VIP entitlement grants do NOT credit coins, gems, facility/scout/conditioning
   tokens or exact-save purchases. Do not mark full reviewer access complete
   until a documented free access path covers restricted features. Do not attach
   permanent RevenueCat entitlements to consumables to work around this.

Google permits third-party sign-in instructions, but requires reusable access
available regardless of location and free access to restricted functionality:
https://support.google.com/googleplay/android-developer/answer/15748846

RevenueCat granted entitlements:
https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile

## 2. Play Console > App content > Sign in details

After the tests above pass:

- Is any part restricted? Yes.
- Add details > Name: Cricket Legacy - Reviewer Access
- Username/email: the actual tested dedicated review-account email.
- Password: its actual password, entered privately in Play Console only.
- Other information: explain the exact tested Google sign-in route, age gate,
  both career creation paths, Restore Purchases, and the verified free access
  route for all other restricted features. State that the dedicated account has
  complimentary access only after confirming it does.
- Save the entry, then Save the parent Sign in details page.

Do not paste placeholder credentials or an unverified claim that all content
is unlocked. There is no final copy-ready access paragraph until the route is
tested. Core guest gameplay alone is not full premium reviewer access.

## 3. App content > Target audience and content

For an India-only adult launch/test: select 18 and over, consistent with the
approved India policy. Use adult testers. Do not choose a younger audience just
because the IARC content rating is lower.

If releasing to other countries with the approved 13+ audience: reconcile the
global declaration (13-15, 16-17, 18+) with actual distribution and the regional
age gate before saving. Do not silently change the product to globally 18+.
An adult-only access restriction, if offered by Console, must not be enabled
globally while claiming to serve teenagers outside India.

The app is not designed for children. Answer any further child-appeal questions
against the actual artwork/listing, not merely the desired policy outcome.

https://support.google.com/googleplay/android-developer/answer/9867159

## 4. Return to App content > Data safety

- Preserve the filled draft.
- Check Purchase history: Collected only if its processors act as service
  providers and no non-exempt onward sharing occurs. Extra disclosure is not
  automatically safer. Inspect RevenueCat integrations before finalizing.
- Verify release HTTPS/TLS for every data-transmission path, operational account
  deletion, anonymous-account configuration and actual enabled online features.
- Reconcile account-creation answers if a new demo authentication method is added.
- Review the entire preview, including both collected and shared sections.
- Save when accurate. Sending for review is a separate action in Publishing
  overview and must wait for the remaining release requirements.

## Outstanding owner input/access

No authenticated Google-account provisioning, Supabase administration, RevenueCat
administration or Play Console session is available to this agent. The dedicated
review account and provider grants require the owner's authenticated action.
If the existing Google route fails the unattended test, approval and backend
configuration for a dedicated server-authenticated demo login are required.
