# Sunlight publisher, legal and support site

This is a dependency-free static site for Cloudflare Pages. The home page is the
publisher presence for **Sunlight**, the working name used by Divakar Mishra.
Products are data-driven so future games and apps can be added without turning
the site into a Cricket Legacy-only landing page.

It currently generates:

- `/` — Sunlight publisher home and product directory
- `/products/cricket-legacy/` — Cricket Legacy product page
- `/publisher/` — the single public legal-identity disclosure for Sunlight

- `/products/cricket-legacy/privacy/` — app-specific policy for Play Console
- `/privacy/` — compatibility copy for existing Cricket Legacy app links
- `/terms/`
- `/support/`
- `/delete-account/`

The four top-level legal/support routes apply specifically to Cricket Legacy
and stay stable because the app and release readiness gate use them. Do not
reuse those policies for a future product whose data, commerce or account
behavior differs. Give that product its own reviewed legal routes before it is
released.

The public site uses **Sunlight** throughout its product, support and policy
copy. The operator's legal name appears once, only on `/publisher/`; Privacy and
Terms link to that disclosure.

## Adding another product

Add a product object to `legal.config.json` with a unique slug, product kind,
status, platforms, summary, headline, description and product highlights. The
generator will add it to the Sunlight home and create
`/products/<product-slug>/` automatically.

Product copy must describe functionality that really exists. Before publishing
a future product, extend the generator with product-specific Privacy, Terms,
Support and Account Deletion routes where required.

## Approved policy configuration

`legal.config.json` also records the owner's approved Cricket Legacy
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
`dist/images/cricket-legacy-icon.png`, used on the home and Cricket Legacy product
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
that it serves the expected Cricket Legacy HTML. The Cloudflare deployment,
store-console URLs, privacy declarations and account-deletion backend remain
manual release steps; this repository does not deploy them automatically.
