import fs from 'fs';
import path from 'path';

const {
  AGE_POLICIES,
  renderLegalSite,
  validateLegalConfig,
}: {
  AGE_POLICIES: Record<string, { id: string }>;
  renderLegalSite: (config: Record<string, unknown>) => Record<string, string>;
  validateLegalConfig: (config: Record<string, unknown>) => string[];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../../../legal-site/build-core.cjs');

const root = path.join(__dirname, '..', '..', '..');
const approvedFacts = {
  appName: 'Cricket Legacy',
  site: {
    tagline: 'Independent games and apps from Maharashtra, India.',
    description: 'Sunlight publisher site.',
  },
  products: [
    {
      slug: 'cricket-legacy',
      name: 'Cricket Legacy',
      kind: 'Cricket career game',
      status: 'In development',
      platforms: ['Android'],
      summary: 'A fictional cricket career simulation.',
      headline: 'Two careers. One cricket world.',
      description: 'Play a long-form Player or Manager career.',
      highlights: [
        { title: 'Player Career', description: 'Build a player career.' },
        { title: 'Manager Career', description: 'Build a club career.' },
      ],
    },
  ],
  publisher: {
    legalName: 'Divakar Mishra',
    tradingName: 'Sunlight',
    entityType: 'individual developer',
    location: 'Maharashtra, India',
    email: 'devsunlightpvt@gmail.com',
  },
  effectiveDate: '2026-09-01',
  compliance: { verifiedParentalConsentFlow: true },
  retention: {
    activeDataDeletionDays: 7,
    deletionRequestAuditDays: 30,
    backupRotationDays: 7,
    securityAndSupportDays: 90,
    purchaseAuditDays: 365,
  },
};

describe('Cloudflare legal and support site', () => {
  it('provides an app-specific privacy route while preserving the old app link', () => {
    const pages = renderLegalSite({ ...approvedFacts, agePolicy: 'india_18_elsewhere_13' });
    const privacy = pages['products/cricket-legacy/privacy/index.html'];
    expect(privacy).toContain('<h1>Cricket Legacy Privacy Policy</h1>');
    expect(privacy).toContain('data-legal-page="privacy"');
    expect(privacy).toContain('It does not apply to other apps');
    expect(pages['privacy/index.html']).toContain('It does not apply to other apps');
    expect(pages['products/cricket-legacy/index.html']).toContain('href="/products/cricket-legacy/privacy/"');
  });
  it('omits city-level location from every production page and metadata', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'legal-site', 'legal.config.json'), 'utf8'));
    expect(config.publisher.location).toBe('Maharashtra, India');
    for (const html of Object.values(renderLegalSite(config))) {
      expect(html).not.toMatch(/Navi\s+Mumbai/i);
      expect(html).toContain('Maharashtra, India');
    }
  });
  it('describes permanent mode-specific VIP and one-time currency grants', () => {
    const pages = renderLegalSite({ ...approvedFacts, agePolicy: 'india_18_elsewhere_13' });
    const terms = pages['terms/index.html'];
    expect(terms).toContain('one-time purchases, not a recurring Season Pass');
    expect(terms).toContain('neither unlocks the other mode');
    expect(terms).toContain('not Coins, Gems, club funds or consumable rewards');
    expect(terms).toContain('are not reissued by restoring purchases');
    expect(terms).toContain('If you have a legacy subscription');
    expect(terms).not.toContain('A Season Pass renews automatically');
  });
  it.each(Object.keys(AGE_POLICIES))('renders every route for age policy %s', (agePolicy) => {
    const pages = renderLegalSite({ ...approvedFacts, agePolicy });
    expect(Object.keys(pages).sort()).toEqual([
      'delete-account/index.html',
      'index.html',
      'privacy/index.html',
      'products/cricket-legacy/index.html',
      'products/cricket-legacy/privacy/index.html',
      'publisher/index.html',
      'support/index.html',
      'terms/index.html',
    ]);
    for (const html of Object.values(pages)) {
      expect(html).toContain('devsunlightpvt@gmail.com');
      expect(html).toContain('Maharashtra, India');
      expect(html).not.toContain('Sunlight Pvt');
    }
    expect(
      Object.values(pages).reduce(
        (count, html) => count + (html.match(/Divakar Mishra/g)?.length ?? 0),
        0,
      ),
    ).toBe(1);
    expect(pages['publisher/index.html']).toContain('data-legal-page="publisher"');
    expect(pages['privacy/index.html']).toContain('href="/publisher/"');
    expect(pages['terms/index.html']).toContain('href="/publisher/"');
  });

  it('renders a publisher-first Sunlight home and a dedicated product page', () => {
    const pages = renderLegalSite({
      ...approvedFacts,
      agePolicy: 'india_18_elsewhere_13',
    });
    expect(pages['index.html']).toContain('<h1>Sunlight</h1>');
    expect(pages['index.html']).toContain('href="/products/cricket-legacy/"');
    expect(pages['index.html']).not.toContain('Built to grow');
    expect(pages['index.html']).not.toContain('One publisher home for every future release.');
    expect(pages['products/cricket-legacy/index.html']).toContain(
      'data-legal-page="product"',
    );
    expect(pages['products/cricket-legacy/index.html']).toContain('Player Career');
    expect(pages['index.html']).toContain('src="/images/cricket-legacy-icon.png"');
    expect(pages['products/cricket-legacy/index.html']).toContain('alt="Cricket Legacy app icon"');
    expect(pages['products/cricket-legacy/index.html']).toContain('<span>Player</span>');
    expect(pages['products/cricket-legacy/index.html']).toContain('<span>Manager</span>');
    expect(pages['products/cricket-legacy/index.html']).not.toContain('<span>PLR</span>');
    expect(pages['products/cricket-legacy/index.html']).not.toContain('<span>MGR</span>');
    expect(pages['products/cricket-legacy/index.html']).toContain('href="/terms/"');
    expect(pages['products/cricket-legacy/index.html']).toContain('Terms &amp; Conditions');
  });

  it('keeps the two approved age-policy alternatives materially distinct', () => {
    const consent = renderLegalSite({
      ...approvedFacts,
      agePolicy: 'global_13_parental_consent',
    });
    const indiaAdult = renderLegalSite({
      ...approvedFacts,
      agePolicy: 'india_18_elsewhere_13',
    });
    expect(consent['terms/index.html']).toContain('at least 13 years old');
    expect(consent['privacy/index.html']).toContain('In India, this treatment applies');
    expect(indiaAdult['terms/index.html']).toContain('at least 18 years old if you live in India');
    expect(indiaAdult['privacy/index.html']).toContain('Users in India must be at least 18');
  });

  it('cannot release the parental-consent branch before its real consent flow exists', () => {
    expect(
      validateLegalConfig({
        ...approvedFacts,
        agePolicy: 'global_13_parental_consent',
        compliance: { verifiedParentalConsentFlow: false },
      }),
    ).toContain(
      'compliance.verifiedParentalConsentFlow must be true only after a real age and parent/guardian verification flow is implemented.',
    );
    expect(
      validateLegalConfig({
        ...approvedFacts,
        agePolicy: 'india_18_elsewhere_13',
        compliance: { verifiedParentalConsentFlow: false },
      }),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining('verifiedParentalConsentFlow')]));
  });

  it('records the approved India-18/elsewhere-13 policy and retention schedule', () => {
    const checkedIn = JSON.parse(
      fs.readFileSync(path.join(root, 'legal-site', 'legal.config.json'), 'utf8'),
    );
    const errors = validateLegalConfig(checkedIn);
    expect(checkedIn.effectiveDate).toBe('2026-08-20');
    expect(checkedIn.agePolicy).toBe('india_18_elsewhere_13');
    expect(errors.some((error) => error.includes('agePolicy'))).toBe(false);
    expect(errors.some((error) => error.includes('verifiedParentalConsentFlow'))).toBe(false);
    expect(errors.filter((error) => error.includes('retention.'))).toHaveLength(0);
    expect(checkedIn.retention).toEqual({
      activeDataDeletionDays: 7,
      deletionRequestAuditDays: 30,
      backupRotationDays: 7,
      securityAndSupportDays: 90,
      purchaseAuditDays: 365,
    });
    expect(renderLegalSite(checkedIn)['terms/index.html']).toContain(
      'at least 18 years old if you live in India',
    );
  });

  it('ships Cloudflare Pages security headers and deployment instructions', () => {
    const headers = fs.readFileSync(path.join(root, 'legal-site', 'static', '_headers'), 'utf8');
    const readme = fs.readFileSync(path.join(root, 'legal-site', 'README.md'), 'utf8');
    expect(headers).toContain("Content-Security-Policy: default-src 'none'");
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(
      renderLegalSite({
        ...approvedFacts,
        agePolicy: 'india_18_elsewhere_13',
      })['privacy/index.html'],
    ).toContain('data-legal-page="privacy"');
    expect(readme).toContain('Build command: `npm run build:legal-site`');
    expect(readme).toContain('Build output directory: `legal-site/dist`');
  });
});
