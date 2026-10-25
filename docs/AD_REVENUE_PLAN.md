# Cricket Legacy: practical AdMob revenue plan

Checked against the repository on 2026-09-27. This is a prioritized operating
plan, not a promise of impressions or earnings. AdMob account settings and the
currently published Play/Cloudflare state still require console verification.

## What is already in the app

- Android production builds have rewarded, interstitial and banner unit IDs in
  `src/config/monetization.ts`; debug builds normally use Google test units.
- Rewarded opportunities: double post-match coins and refill Store energy. A
  reward is granted only after the ad SDK's earned-reward callback. Buying
  Remove Ads removes banners and interstitials, **not** these optional rewards.
- Interstitials are attempted only when returning to the Player Career hub,
  after at least three matches, with a 15-minute minimum gap and a maximum of
  four actually shown in a rolling hour. These are *ceilings*, not a target.
- Banners appear on Records, Player Life and Club Office, away from live play.
- Age eligibility and the Google UMP consent response gate SDK initialization.
  Adults let Google select the permitted ad mode from their consent signals;
  eligible teens outside India get stricter G-rated, non-personalized treatment.

These statements describe **local source**, not proof that the current Play
release or AdMob account is serving. The latest screenshot supplied by the owner
showed AdMob **Requires review / Limited ad serving / Add store to lift limit**;
its current status has not been rechecked. The last supplied EU consent-message
screenshot was an editor view, not evidence of publication.

## Do these next, in order

1. **Finish the EU consent setup.** In AdMob → Privacy & messaging → European
   regulations, select Cricket Legacy, enter
   `https://sunlight-publisher-site.pages.dev/products/cricket-legacy/privacy/`,
   offer clear consent and decline choices, and **Publish** the message. Confirm
   the live privacy page matches the released app; the updated local site source
   is not itself a Cloudflare deployment. In AdMob → Settings → Account
   information, check **Programmatic limited ads** if you intend to request
   eligible limited ads after a decline. Google says it is on by default; do not
   assume the account still has it on. A decline must never be converted into
   consent or a guaranteed ad. [EU message setup](https://support.google.com/admob/answer/10113207?hl=en),
   [limited ads and account switch](https://support.google.com/admob/answer/10105530?hl=en).
2. **Clear app-readiness limits.** Make the app publicly available in a
   supported store when it is ready for release, then link that exact Play
   listing to Cricket Legacy in AdMob → Apps → App settings. In Play Console,
   use `https://sunlight-publisher-site.pages.dev/` as the developer website;
   verify the published `/app-ads.txt` contains the correct seller line, then
   complete AdMob's **Verify app** step if shown. Wait for AdMob's app-readiness
   status to become **Ready**; a closed/private test alone is not proof of
   readiness. Check Policy center for any separate account or app restriction.
   Do not rush an unfinished production release solely to lift a limit.
   [App readiness](https://support.google.com/admob/answer/10564477?hl=en),
   [app-ads.txt verification](https://support.google.com/admob/answer/14538460?hl=en).
3. **Verify the actual build, not just unit IDs.** On a registered AdMob test
   device, test adult accept, adult decline, eligible teen, ineligible age,
   Remove Ads ownership, offline/no-fill, and both rewarded placements. Confirm
   that the consent form appears when required, denied users only get an ad when
   Google's SDK permits the request, and rewards arrive exactly once after a
   completed ad. Use Ad Inspector to see requests, privacy signals and no-fill
   errors. Do not repeatedly load or click your own live ads; use test inventory.
   [Ad Inspector](https://support.google.com/admob/answer/13063114?hl=en),
   [testing guidance](https://support.google.com/admob/answer/9388275?hl=en).
4. **Publish the matching app and site updates.** The consent-mode and Remove
   Ads fixes currently in the worktree are not automatically in the installed
   app or Play release. Deploy the reviewed site change, run the release gates,
   build a production AAB, and roll it through the intended Play track only
   after QA and owner approval. Check actual AdMob reports after rollout.

## Then improve revenue with evidence

- In AdMob Reports, compare **estimated earnings, impressions, observed eCPM,
  requests, match rate and show rate** by ad unit, country and format. A request
  that never fills is different from a filled ad that is never shown. Track
  rewarded completion and game retention alongside ad revenue; more ads per
  session can reduce sessions or purchases. [Report overview](https://support.google.com/admob/answer/2751663?hl=en),
  [match/show definitions](https://support.google.com/admob/answer/13547458?hl=en).
- Keep the current interstitial safe point and caps as the initial baseline.
  Experiment with *one* frequency or placement change at a time only after
  there is enough traffic to compare revenue per active user, retention and
  complaints. Never place a surprise ad during an innings, before an unsettled
  result is saved, or immediately beside a critical button. Google recommends
  natural transitions and avoiding accidental clicks.
  [Placement guidance](https://support.google.com/admob/answer/2936217?hl=en).
- Improve the optional rewarded experience before adding prompts: clear reward
  text, no pressure to consent, no reward without the earned callback, and a
  useful non-ad route when there is no fill. Consider preloading after consent
  so the user does not wait on a tap, but verify SDK readiness, expiry and
  privacy behavior before implementing. [Rewarded-ad model](https://support.google.com/admob/answer/7372450?hl=en),
  [rewarded loading guidance](https://developers.google.com/admob/android/rewarded).
- Review the three banner locations on small phones. If they remain useful,
  test a responsive/adaptive banner in an appropriate layout; do not place
  banners over gameplay or navigation. This is a possible experiment, not a
  change already shipped. [Banner guidance](https://developers.google.com/admob/android/banner).
- If match rate stays low **after** approval and real traffic arrives, inspect
  no-fill errors, country mix, account/policy status, ad-content restrictions
  and any high eCPM floors before increasing ad frequency. Excess blocking or
  floors can reduce competition and fill. Later, evaluate mediation/bidding
  with an A/B test; it requires additional SDK/ad-source integration and must
  respect the game's age treatment. It is not a one-click guaranteed uplift.
  [Low match-rate guide](https://support.google.com/admob/answer/9655701?hl=en),
  [bidding](https://support.google.com/admob/answer/9234488?hl=en),
  [mediation A/B testing](https://support.google.com/admob/answer/9572326?hl=en).

## Rules that protect both revenue and players

- A user's decline can still permit an **eligible limited-ad attempt**, but
  Google may return no ad. Limited ads after a privacy decline are different
  from an AdMob **limited ad serving** restriction on the app/account.
- Never hide or bias consent choices, make a reward conditional on consenting,
  click your own live ads, inflate requests, or add disruptive placements just
  to lift impression counts. Keep Play age, AdMob treatment, the privacy policy
  and actual app behavior aligned. [Google ad-serving modes](https://developers.google.com/admob/android/privacy/ad-serving-modes),
  [invalid-traffic rules](https://support.google.com/admob/answer/2753860?hl=en).
- Do not promise a revenue number before the app is approved and has real
  traffic. First establish a clean baseline; then optimize *total sustainable
  revenue per player*, not raw ad count.
