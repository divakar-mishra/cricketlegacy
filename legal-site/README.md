# Sunlight publisher, legal and support site

This is a dependency-free static site for Cloudflare Pages. The home page is the
publisher presence for **Sunlight**, the working name used by Divakar Mishra.
Products are data-driven so future games and apps can be added without turning
the site into a single-game landing page.

It currently generates:

- `/` — Sunlight publisher home and product directory
- `/products/cricket-player-manager/` — Cricket: Player and Manager product page
- `/publisher/` — the single public legal-identity disclosure for Sunlight

- `/products/cricket-legacy/privacy/` — app-specific policy for Play Console
- `/privacy/` — compatibility copy for existing app links
- `/terms/`
- `/support/`
- `/delete-account/`
- `/app-ads.txt` — the publisher's authorized AdMob and Unity seller records

The old `/products/cricket-legacy/` URL redirects to the new product page. The
app-specific privacy URL and icon filename remain unchanged so existing Play
Console, AdMob and in-app links keep working.

The four top-level legal/support routes apply specifically to Cricket: Player and Manager
and stay stable because the app and release readiness gate use them. Do not
reuse those policies for a future product whose data, commerce or account
behavior differs. Give that product its own reviewed legal routes before it is
released.

The public site uses **Sunlight** throughout its product, support and policy
copy. The operator's legal name appears once, only on `/publisher/`; Privacy and
Terms link to that disclosure.

## Expired sign-in fallback

The publisher root is also Supabase Auth's existing fallback Site URL. If an
OAuth state expires before its mobile callback can be recovered, the root page
recognizes only the known state-error fragment and displays fixed retry guidance
instead of the ordinary product directory. The user explicitly chooses Return
to Cricket: Player and Manager; the link forwards only a fixed error, never a
token, code, state, email or user-supplied redirect. No automatic app-opening
loop, analytics, storage or additional network request is introduced. Other
visits and product/legal routes are unchanged.

`static/auth-return.js` is first-party only; CSP permits same-origin external
scripts, not inline scripts or eval. Test it with the `publisherAuthReturn` Jest
suite and rebuild the static site. The owner-approved fallback was deployed on
18 October 2026 (Cloudflare Pages deployment `56456ea0`); all 13 generated pages,
the fallback script, styles, ad authorization file and legacy product redirect
were checked against the production hostname. No Supabase auth
configuration/timeout change was required. Future source edits still require a
separately approved deployment.

## iOS preparation clarification (21–22 October 2026, deployed)

Owner authorized the developer-website update during the iOS preparation pass.
Cloudflare deployment `dd05cd1a` published the revised Cricket product/home,
privacy (both stable routes), terms, support, deletion, provider-neutral OAuth
fallback and shared responsive sizing. The website explicitly says iOS is in
preparation; no App Store availability, final Apple age rating or live iOS service
verification is claimed. The regional eligibility policy remains unchanged.

Privacy now distinguishes optional Android Firebase/Unity from the initial iOS
AdMob scope, describes conditional Apple relay login and avoids treating
non-personalized ads as data-free. Restore guidance distinguishes permanent
ownership, consumed bundle benefits, cloud progress and cross-store purchases.
The public age-suitability section is at the product page's `#age-suitability`.

All **20 public files** matched the generated build on the production hostname;
legacy redirect and security headers passed. Nine public files changed; Auction
XI's HTML, images and the seller file were preserved. Seven exact-viewport browser
checks passed (320/390px phones and 1440px desktop), including the age anchor.
Headless Chrome uses a fresh isolated profile, never an owner's browser session.
Verification JSON and screenshots: `docs/evidence/ios-preparation-2026-10-21/`.

Reusable checks:

```text
node scripts/checkPublisherLayout.cjs http://127.0.0.1:8765 output/website-layout
node scripts/verifyPublisherDeployment.mjs https://sunlight-publisher-site.pages.dev
```

Serve `legal-site/dist` on the local origin before the first command. The browser
check needs macOS Chrome; it does not install a browser or access private sessions.
The companion offline policy source was updated, but no previously built Android
AAB or iOS simulator ZIP was rebuilt or relabeled by this website deployment.
Full provider/store/device readiness remains separate from a passing site check.

## Android Unity mediation revision (19 October 2026, deployed)

The Cricket policy and offline app policy disclose Unity Ads, consent flags and
the conservative personalization fallback. The seller file preserves Google's
existing DIRECT record and includes the complete Unity dashboard seller list
provided by the owner (Unity Developer ID `143233260`, not Game ID `800404108`).
The owner approved deployment in the follow-up. Deployment `eb5da5bb` published
the seller file and both Cricket privacy routes; all 20 public files, the
legacy product redirect and security headers matched the generated build at
15:34 UTC on 19 October 2026. The other 17 public files already matched live
before deployment. A successful upload alone is not crawler certification.
Keep AdMob mediation groups paused until consent partners, Unity content controls,
the hosted policy/seller file and device test-ad serving have been verified.
See `docs/UNITY_ADMOB_INTEGRATION_2026-10-19.txt` for the activation checklist.
Reusable instructions: `docs/UNITY_ADMOB_REUSABLE_SETUP_GUIDE.txt`.

## Adding another product

Auction XI was added on 5 October 2026 at `/products/auction-xi/`, with its own
`privacy/`, `terms/`, `support/` and `delete-data/` routes. Its copy lives in
`auction-xi.cjs` and describes local careers, conditional RevenueCat purchasing,
disabled testing-build ads and provider-data requests. Do not copy Cricket's
cloud accounts, Firebase diagnostics, age policy or timed retention commitments
into Auction XI without checking its implementation and owner decisions.
Run `node --test legal-site/auction-xi.test.cjs` before deployment.
Publish with `npx wrangler pages deploy legal-site/dist --project-name sunlight-publisher-site --branch main`.


Add a product object to `legal.config.json` with a unique slug, product kind,
status, platforms, summary, headline, description and product highlights. The
generator will add it to the Sunlight home and create
`/products/<product-slug>/` automatically.

Product copy must describe functionality that really exists. Before publishing
a future product, extend the generator with product-specific Privacy, Terms,
Support and Account Deletion routes where required.

## Approved policy configuration

`legal.config.json` also records the owner's approved game
first-release policy:

1. The policy is effective from `2026-08-20`, its first publication date.
2. Users must be 18+ in India and 13+ elsewhere. The app is not directed to
   children and does not claim to operate an Indian parent-verification flow.
3. Active account deletion is targeted within 7 days; deletion-request audit
   status is retained for 30 days; provider backups rotate within 7 days;
   security/support records are retained for 90 days; and minimum pseudonymized
   purchase/fraud evidence is retained for 365 days.

The server environment and real operating process must continue matching these
published values. Change the policy effective date when those practices change.

Run `npm run build:legal-site`. Output is written to `legal-site/dist` and is
ignored by Git.

The build copies the canonical `assets/icon.png` to
`dist/images/cricket-legacy-icon.png`, used on the home and game product
pages. Updating the app icon therefore also updates the website on the next build.
The local September 11 revision describes mode-specific permanent VIP and the
new local age/UMP controls. Publish it alongside the matching app update after
reviewing the effective/revision date; a successful build is not a deployment.

## Cloudflare Pages

Connect the repository in Workers & Pages and use:

- Root directory: repository root
- Build command: `npm run build:legal-site`
- Build output directory: `legal-site/dist`
- Framework preset: None

After Cloudflare provides the production HTTPS hostname, configure these exact,
distinct canonical routes (no query strings, fragments or homepage aliases):

```text
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://YOUR_HOST/privacy/
EXPO_PUBLIC_TERMS_URL=https://YOUR_HOST/terms/
EXPO_PUBLIC_SUPPORT_URL=https://YOUR_HOST/support/
EXPO_PUBLIC_ACCOUNT_DELETION_URL=https://YOUR_HOST/delete-account/
```

Run `npm run check:release` before any store build. Production EAS builds run
the legal gate automatically, and tagged/manual release-readiness workflows run
the complete release check. The gate fetches each configured URL and verifies
that it serves the expected game HTML. The Cloudflare deployment,
store-console URLs, privacy declarations and account-deletion backend remain
manual release steps; this repository does not deploy them automatically.

For AdMob verification, set the Play Store listing's developer website to the
published site origin (`https://sunlight-publisher-site.pages.dev/`). The build
copies `static/app-ads.txt` to the site root, where AdMob expects to retrieve it
at `https://sunlight-publisher-site.pages.dev/app-ads.txt`. Confirm the file is
publicly reachable after deployment, then use AdMob's app-ads.txt verification
flow once the Play listing can be linked.
