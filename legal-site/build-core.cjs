const AGE_POLICIES = Object.freeze({
  global_13_parental_consent: Object.freeze({
    id: 'global_13_parental_consent',
    shortLabel: '13+ with parent or guardian consent where required',
    terms: [
      'You must be at least 13 years old to use Cricket Legacy.',
      'If the law where you live requires consent from a parent or guardian before you can use online services, advertising or paid features, you may use those features only after that consent has been verified. In India, users under 18 are treated as children wherever applicable law requires it.',
      'Cricket Legacy is not directed to children below 13 and must not be listed or marketed as a children-only app.',
    ],
    privacy: [
      'Cricket Legacy is not directed to children below 13. We do not knowingly create an online account for, collect personal data from, or offer paid or advertising features to a child below 13.',
      'For users who are old enough to use the app but are below the digital-consent age that applies where they live, online features require verified permission from a parent or guardian. In India, this treatment applies to users under 18 wherever applicable law requires it. A parent or guardian may contact us to review or delete a child’s data.',
    ],
  }),
  india_18_elsewhere_13: Object.freeze({
    id: 'india_18_elsewhere_13',
    shortLabel: '18+ in India and 13+ elsewhere',
    terms: [
      'You must be at least 18 years old if you live in India, and at least 13 years old elsewhere, to use Cricket Legacy.',
      'Outside India, if you are below the age of legal majority where you live, you confirm that a parent or guardian has reviewed these Terms and permits your use of the app.',
      'Cricket Legacy is not directed to children and must not be listed or marketed as a children-only app.',
    ],
    privacy: [
      'Cricket Legacy is not directed to children. Users in India must be at least 18. Users elsewhere must be at least 13 and, where local law requires it, have permission from a parent or guardian.',
      'We do not knowingly collect personal data from anyone below the applicable minimum age. A parent or guardian who believes a child supplied personal data may contact us so that we can investigate and delete it.',
    ],
  }),
});

const REQUIRED_RETENTION_FIELDS = Object.freeze([
  'activeDataDeletionDays',
  'deletionRequestAuditDays',
  'backupRotationDays',
  'securityAndSupportDays',
  'purchaseAuditDays',
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateLegalConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['legal.config.json must contain an object.'];

  if (typeof config.appName !== 'string' || !config.appName.trim()) {
    errors.push('appName is required.');
  }
  for (const field of ['tagline', 'description']) {
    if (typeof config.site?.[field] !== 'string' || !config.site[field].trim()) {
      errors.push(`site.${field} is required.`);
    }
  }
  if (!Array.isArray(config.products) || config.products.length === 0) {
    errors.push('products must contain at least one app or game.');
  } else {
    const slugs = new Set();
    for (const [index, product] of config.products.entries()) {
      const prefix = `products[${index}]`;
      if (typeof product?.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) {
        errors.push(`${prefix}.slug must be a lowercase URL slug.`);
      } else if (slugs.has(product.slug)) {
        errors.push(`${prefix}.slug must be unique.`);
      } else {
        slugs.add(product.slug);
      }
      for (const field of ['name', 'kind', 'status', 'summary', 'headline', 'description']) {
        if (typeof product?.[field] !== 'string' || !product[field].trim()) {
          errors.push(`${prefix}.${field} is required.`);
        }
      }
      if (
        !Array.isArray(product?.platforms) ||
        product.platforms.length === 0 ||
        product.platforms.some((platform) => typeof platform !== 'string' || !platform.trim())
      ) {
        errors.push(`${prefix}.platforms must contain at least one platform.`);
      }
      if (
        !Array.isArray(product?.highlights) ||
        product.highlights.length === 0 ||
        product.highlights.some(
          (highlight) =>
            typeof highlight?.title !== 'string' ||
            !highlight.title.trim() ||
            typeof highlight?.description !== 'string' ||
            !highlight.description.trim(),
        )
      ) {
        errors.push(`${prefix}.highlights must contain titled product highlights.`);
      }
    }
    if (!config.products.some((product) => product?.name === config.appName)) {
      errors.push('products must include the app named by appName.');
    }
  }
  for (const field of ['legalName', 'tradingName', 'entityType', 'location', 'email']) {
    if (typeof config.publisher?.[field] !== 'string' || !config.publisher[field].trim()) {
      errors.push(`publisher.${field} is required.`);
    }
  }
  if (
    typeof config.publisher?.email === 'string' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.publisher.email)
  ) {
    errors.push('publisher.email must be a valid email address.');
  }
  if (!isIsoDate(config.effectiveDate)) {
    errors.push('effectiveDate must be selected in YYYY-MM-DD format.');
  }
  if (!Object.hasOwn(AGE_POLICIES, config.agePolicy)) {
    errors.push(
      `agePolicy must be one of: ${Object.keys(AGE_POLICIES).join(', ')}. It is intentionally unselected until the owner decides.`,
    );
  }
  if (
    config.agePolicy === 'global_13_parental_consent' &&
    config.compliance?.verifiedParentalConsentFlow !== true
  ) {
    errors.push(
      'compliance.verifiedParentalConsentFlow must be true only after a real age and parent/guardian verification flow is implemented.',
    );
  }

  for (const field of REQUIRED_RETENTION_FIELDS) {
    const value = config.retention?.[field];
    const boundedAudit = ['deletionRequestAuditDays', 'purchaseAuditDays'].includes(field);
    const minimum = boundedAudit ? 1 : 0;
    if (!Number.isInteger(value) || value < minimum || (boundedAudit && value > 3650)) {
      errors.push(
        `retention.${field} must be an approved ${boundedAudit ? 'whole number of days between 1 and 3650' : 'non-negative whole number of days'}.`,
      );
    }
  }
  return errors;
}

function paragraphs(lines) {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n');
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function contactBlock(config) {
  const publisher = config.publisher;
  return `<address>
    <strong>${escapeHtml(publisher.tradingName)}</strong><br>
    ${escapeHtml(publisher.location)}<br>
    <a href="mailto:${escapeHtml(publisher.email)}">${escapeHtml(publisher.email)}</a>
    <br><a href="/publisher/">Publisher information</a>
  </address>`;
}

function productPath(product) {
  return `/products/${product.slug}/`;
}

function primaryProduct(config) {
  return config.products.find((product) => product.name === config.appName) ?? config.products[0];
}

function layout(config, { title, description, path, body }) {
  const pageId =
    {
      '/privacy/': 'privacy',
      '/products/cricket-legacy/privacy/': 'privacy',
      '/terms/': 'terms',
      '/support/': 'support',
      '/delete-account/': 'delete-account',
      '/publisher/': 'publisher',
    }[path] ?? (path.startsWith('/products/') ? 'product' : 'home');
  const featuredProduct = primaryProduct(config);
  const nav = [
    ['/', 'Studio'],
    [productPath(featuredProduct), featuredProduct.name],
    ['/terms/', 'Terms'],
    ['/support/', 'Support'],
  ];
  const widePage = path === '/' || path.startsWith('/products/');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#07140f">
  <title>${escapeHtml(title)} · ${escapeHtml(config.publisher.tradingName)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHtml(config.publisher.tradingName)} home">
      <span class="brand-mark" aria-hidden="true"><span></span></span>
      <span><strong>${escapeHtml(config.publisher.tradingName)}</strong><small>Games &amp; apps</small></span>
    </a>
    <nav aria-label="Legal and support">
      ${nav.map(([href, label]) => `<a href="${href}"${path === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
  </header>
  <main id="main" class="page-shell${widePage ? ' page-shell-wide' : ''}" data-legal-page="${pageId}">${body}</main>
  <footer>
    <div>
      <p><strong>${escapeHtml(config.publisher.tradingName)}</strong></p>
      <p>© ${new Date(`${config.effectiveDate}T00:00:00Z`).getUTCFullYear()} ${escapeHtml(config.publisher.tradingName)}.</p>
      <p>${escapeHtml(config.publisher.location)}</p>
    </div>
    <div class="footer-links">
      <a href="/products/cricket-legacy/privacy/">Cricket Legacy Privacy</a>
      <a href="/terms/">Terms</a>
      <a href="/delete-account/">Account deletion</a>
      <a href="/publisher/">Publisher</a>
      <a href="mailto:${escapeHtml(config.publisher.email)}">Email</a>
    </div>
  </footer>
</body>
</html>`;
}

function pageHeading(kicker, title, intro, config) {
  return `<section class="hero">
    <p class="kicker">${escapeHtml(kicker)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(intro)}</p>
    <p class="effective">Effective ${escapeHtml(config.effectiveDate)}</p>
  </section>`;
}

function privacyPage(config, age) {
  const retention = config.retention;
  return `${pageHeading('Your data', `${config.appName} Privacy Policy`, `How ${config.publisher.tradingName} handles information in ${config.appName}.`, config)}
  <article>
    <section><h2>Scope of this policy</h2>
      <p>This policy applies specifically to ${escapeHtml(config.appName)} and its related support and web pages. It does not apply to other apps published by ${escapeHtml(config.publisher.tradingName)}; those apps have their own privacy policies.</p>
    </section>
    <section><h2>Who is responsible</h2>
      <p>${escapeHtml(config.publisher.tradingName)} provides ${escapeHtml(config.appName)} and is responsible for the personal data described here. The legal operator is identified on the <a href="/publisher/">Publisher Information</a> page.</p>
      ${contactBlock(config)}
    </section>
    <section><h2>Information the app handles</h2>
      ${list([
        '<strong>Local game data:</strong> careers, squads, match history, settings, rewards and other progress stored on your device.',
        '<strong>Account and cloud data:</strong> an anonymous or linked account identifier, authentication records and cloud saves when the online backend is enabled.',
        `<strong>Purchases:</strong> product, entitlement, transaction status and pseudonymous verification identifiers supplied by Google Play, Apple or RevenueCat. ${escapeHtml(config.publisher.tradingName)} does not receive your full payment-card number.`,
        '<strong>Online play and security:</strong> leaderboard entries you submit, server timestamps, app/build version, fraud checks, IP address and service logs.',
        '<strong>Age preferences:</strong> the app stores your self-declared age band, India/outside-India residence choice and, where applicable, parent or guardian permission on your device. It does not ask for a date of birth or upload these answers. This is a self-declaration, not verified identity or parental consent.',
        '<strong>Advertising:</strong> Google Mobile Ads may process device or advertising identifiers, IP address, ad interactions, diagnostics and consent choices according to the build and your settings. The app does not initialize ads for users who declare they are under 18. For adults, ad initialization waits for the Google consent flow to permit requests. Ad privacy choices are available in Settings. Requests remain non-personalized, which does not prevent all technical processing.',
        '<strong>Support:</strong> your email address, message and attachments if you contact support.',
        '<strong>Device features:</strong> notification permission and locally scheduled reminders. The current app does not upload a push-notification token.',
      ])}
      <p>The public legal site does not intentionally set advertising or analytics cookies. Cloudflare may process ordinary network and security logs when it hosts these pages.</p>
    </section>
    <section><h2>Why it is used</h2>
      ${list([
        'Run the game, save progress and provide requested online features.',
        'Verify purchases, restore eligible entitlements and prevent duplicate or fraudulent grants.',
        'Show and measure ads where enabled, subject to the applicable consent and age rules.',
        'Secure the service, diagnose failures, answer support requests and comply with law.',
      ])}
      <p>Depending on the context and applicable law, processing is based on providing the service you request, your consent, legitimate service-security interests, or a legal obligation. You may withdraw consent for optional processing, although this does not affect earlier lawful processing.</p>
    </section>
    <section><h2>Service providers and disclosures</h2>
      <p>Information may be processed for ${escapeHtml(config.publisher.tradingName)} by Supabase (authentication and cloud data), RevenueCat (purchase entitlement management), Google Play and Apple (billing), Google Mobile Ads (advertising), and Cloudflare (site delivery and security). Their handling is also governed by their own terms and privacy notices.</p>
      <p>Information may also be disclosed when required by law, to protect users or the service, or in connection with a business transfer. ${escapeHtml(config.publisher.tradingName)} does not sell personal data. Public leaderboard information is shared publicly only when that feature is enabled and you submit an entry.</p>
    </section>
    <section><h2>Storage, transfers and retention</h2>
      <p>Local data remains on the device until you delete it or remove the app. Active account and cloud-game data remains while the account is used and is removed after a verified deletion request, normally within ${retention.activeDataDeletionDays} days. Residual backup copies, where present, rotate out within ${retention.backupRotationDays} days and are not returned to the active service.</p>
      <p>Pseudonymous deletion-request status is retained for up to ${retention.deletionRequestAuditDays} days so interrupted requests can be retried safely. Security and support records are retained for up to ${retention.securityAndSupportDays} days. Minimum pseudonymized purchase, refund, chargeback, fraud and accounting evidence is retained for up to ${retention.purchaseAuditDays} days when needed for legal compliance or dispute handling. Provider-controlled records may follow the provider’s independently disclosed schedule.</p>
      <p>Providers may process data outside India. Where required, ${escapeHtml(config.publisher.tradingName)} uses provider terms and safeguards intended to protect transferred data.</p>
    </section>
    <section><h2>Your choices and rights</h2>
      ${list([
        'Use local play without enabling optional cloud or leaderboard features.',
        'Control notifications in the app or device settings.',
        'Manage subscriptions through Google Play or the App Store.',
        'Ask for access, correction, a copy, deletion, withdrawal of consent or grievance review where applicable law provides those rights.',
      ])}
      <p>Use the <a href="/delete-account/">account-deletion instructions</a> or contact the email above. We may need to verify that you control the relevant account before acting.</p>
    </section>
    <section><h2>Children and younger users</h2>${paragraphs(age.privacy)}</section>
    <section><h2>Security and changes</h2>
      <p>${escapeHtml(config.publisher.tradingName)} uses access controls, encrypted transport and restricted server credentials, but no service can guarantee absolute security. Material policy changes will be posted here with a new effective date and, when appropriate, explained in the app.</p>
    </section>
  </article>`;
}

function termsPage(config, age) {
  return `${pageHeading('Rules of play', 'Terms & Conditions', `The rules for using ${config.appName} and its paid features.`, config)}
  <article>
    <section><h2>Agreement</h2>
      <p>These Terms are between you and ${escapeHtml(config.publisher.tradingName)}, whose legal operator is identified on the <a href="/publisher/">Publisher Information</a> page. By downloading, using or purchasing through ${escapeHtml(config.appName)}, you agree to these Terms and the <a href="/privacy/">Privacy Policy</a>. If you do not agree, do not use the app.</p>
    </section>
    <section><h2>Age and authority</h2>${paragraphs(age.terms)}</section>
    <section><h2>Your licence and conduct</h2>
      <p>${escapeHtml(config.publisher.tradingName)} grants you a limited, personal, revocable, non-exclusive, non-transferable licence to use the app for private entertainment, subject to the store licence terms that apply to your download.</p>
      ${list([
        'Do not cheat, automate, exploit bugs, manipulate purchases, harass others or interfere with the service.',
        'Do not reverse engineer, redistribute or commercially exploit the app except where applicable law expressly permits it.',
        'Keep account and device access secure. Contact support promptly if you suspect unauthorized use.',
      ])}
    </section>
    <section><h2>Game progress and virtual items</h2>
      <p>Coins, gems, energy, tokens, passes, sponsorship rewards, cosmetics and similar items are licensed game content. They have no cash value, are not property, cannot be traded outside the app and may be adjusted to correct errors or maintain game balance. Local-only progress can be lost if the app or device data is removed.</p>
    </section>
    <section><h2>Purchases, VIP and save-bound rewards</h2>
      <p>The store processes payment and supplies the final localized price, taxes and refund rules. The current Android catalogue offers one-time purchases, not a recurring Season Pass. Player VIP and Manager VIP are permanent purchases for their respective modes; neither unlocks the other mode. Player Legend includes Player VIP, and Manager Legacy Edition includes Manager VIP.</p>
      <p>VIP collection progress is earned through completed in-game seasons. Retirement grants remaining eligible collection cosmetics, not Coins, Gems, club funds or consumable rewards.</p>
      <p>Eligible permanent purchases can be restored through the app. Currency, boosts and tokens, including those bundled with a permanent purchase, are granted once to the purchased save and are not reissued by restoring purchases or moving to another save. Local-only progress is not a cloud backup.</p>
      <p>If you have a legacy subscription, it continues under its original store terms until cancelled. Deleting the app or account does not cancel it. Legacy save-bound sponsors remain attached to their original save and mode and may require periodic online verification; they are not offered in the current launch catalogue.</p>
      <p>Refunds, reversals, chargebacks or revocations may end future access, branding and stipends associated with that purchase. Rewards already used are not automatically reclaimed unless required to correct fraud or an error. Statutory consumer rights are not excluded.</p>
      <p><a href="https://play.google.com/store/account/subscriptions">Manage Google Play subscriptions</a> · <a href="https://apps.apple.com/account/subscriptions">Manage App Store subscriptions</a></p>
    </section>
    <section><h2>Online services and changes</h2>
      <p>Online backup, rankings, ads and store services depend on networks and third parties and may be interrupted. ${escapeHtml(config.publisher.tradingName)} may update, rebalance, suspend or discontinue features for security, legal or product reasons. Where practical, reasonable notice will be given for material adverse changes.</p>
    </section>
    <section><h2>Intellectual property and fictional content</h2>
      <p>The app, code, art, design and ${escapeHtml(config.publisher.tradingName)} branding are protected by applicable intellectual-property laws. Unless explicitly identified otherwise, generated teams, players, sponsors and competitions are fictional and do not imply endorsement by a real person, club or brand.</p>
    </section>
    <section><h2>Suspension and termination</h2>
      <p>${escapeHtml(config.publisher.tradingName)} may restrict or terminate access for serious or repeated breaches, fraud, security threats or legal requirements. You may stop using the app or request account deletion at any time. Provisions concerning purchases, intellectual property, liability and disputes survive where their nature requires it.</p>
    </section>
    <section><h2>Disclaimers and liability</h2>
      <p>The app is provided on an “as available” basis. To the maximum extent permitted by law, ${escapeHtml(config.publisher.tradingName)} does not guarantee uninterrupted operation or preservation of local-only saves. ${escapeHtml(config.publisher.tradingName)} is not liable for indirect or consequential loss that was not reasonably foreseeable. Nothing in these Terms excludes liability or consumer rights that cannot lawfully be excluded or limited.</p>
    </section>
    <section><h2>Governing law</h2>
      <p>These Terms are governed by the laws of India. Nothing in these Terms limits any non-waivable consumer right. Subject to those rights and the jurisdiction of competent consumer forums, courts of competent jurisdiction in Maharashtra, India have non-exclusive jurisdiction.</p>
    </section>
    <section><h2>Contact</h2>${contactBlock(config)}</section>
  </article>`;
}

function supportPage(config) {
  const subject = encodeURIComponent(`${config.appName} support request`);
  return `${pageHeading('Help', 'Support', 'Get help with gameplay, purchases, access or privacy.', config)}
  <article>
    <section class="action-card"><h2>Email support</h2>
      <p>Describe what happened, the screen involved, device model, app version and whether you use Player or Manager mode. Never send a password, full payment-card number or private store credentials.</p>
      <p><a class="button" href="mailto:${escapeHtml(config.publisher.email)}?subject=${subject}">Email ${escapeHtml(config.publisher.email)}</a></p>
    </section>
    <section><h2>Purchase help</h2>
      <p>Use Restore Purchases in the in-app Store for eligible non-consumables and active subscriptions. For a charge, refund or billing problem, include the product name, store, approximate purchase date and the store’s non-secret order reference. Billing and refunds are ultimately handled under Google Play or Apple policies.</p>
    </section>
    <section><h2>Account and privacy help</h2>
      <p>For deletion, follow the <a href="/delete-account/">account-deletion instructions</a>. For access, correction or another privacy request, use the support email and put “Privacy request” in the subject.</p>
    </section>
    <section><h2>Publisher</h2>${contactBlock(config)}</section>
  </article>`;
}

function deletePage(config) {
  const retention = config.retention;
  const subject = encodeURIComponent(`${config.appName} account deletion request`);
  const body = encodeURIComponent(
    `I want to delete my ${config.appName} account and associated data. Please send me the secure verification steps.`,
  );
  return `${pageHeading('Privacy control', 'Delete your account and data', `Request deletion of a ${config.appName} account and associated cloud data.`, config)}
  <article>
    <section class="notice"><h2>Before deleting</h2>
      <p>Deletion is permanent. It removes the account, cloud saves, online rankings and server-owned save bindings. It also removes local data when completed from the app. Account deletion does not cancel an active Google Play or App Store subscription.</p>
      <p><a href="https://play.google.com/store/account/subscriptions">Manage Google Play subscriptions</a> · <a href="https://apps.apple.com/account/subscriptions">Manage App Store subscriptions</a></p>
    </section>
    <section><h2>Delete from the app</h2>
      <ol>
        <li>Open ${escapeHtml(config.appName)} and go to <strong>Account</strong>.</li>
        <li>Choose <strong>Delete account &amp; data</strong>.</li>
        <li>Read the warning and confirm. The signed-in account is verified by the server; the app never asks you to type or send your account identifier in the deletion request.</li>
      </ol>
      <p>If the account is local-only, the same screen deletes the data stored on that device.</p>
    </section>
    <section class="action-card"><h2>Cannot access the app?</h2>
      <p>Email ${escapeHtml(config.publisher.tradingName)} to start a manually verified deletion request. Support will ask only for information needed to establish control of the account or purchase. Do not email a password, access token, full receipt or payment-card information.</p>
      <p><a class="button" href="mailto:${escapeHtml(config.publisher.email)}?subject=${subject}&amp;body=${body}">Request deletion by email</a></p>
    </section>
    <section><h2>What is deleted or retained</h2>
      <p>Active account credentials, cloud gameplay, rankings and save-bound sponsor records are targeted for deletion within ${retention.activeDataDeletionDays} days after verification. Backup copies, where present, rotate out within ${retention.backupRotationDays} days.</p>
      <p>A pseudonymous deletion-request status may remain for up to ${retention.deletionRequestAuditDays} days so retries are safe. Security and support records may remain for up to ${retention.securityAndSupportDays} days. Minimum pseudonymized purchase, refund, chargeback, fraud or accounting evidence may remain for up to ${retention.purchaseAuditDays} days when required for compliance or dispute handling. It is not used to restore gameplay or market to you.</p>
    </section>
    <section><h2>Contact</h2>${contactBlock(config)}</section>
  </article>`;
}

function publisherPage(config) {
  const publisher = config.publisher;
  return `${pageHeading('Studio details', 'Publisher Information', `The legal operator of ${publisher.tradingName} and ${config.appName}.`, config)}
  <article>
    <section><h2>Publisher identity</h2>
      <p><strong>${escapeHtml(publisher.legalName)}</strong> is an ${escapeHtml(publisher.entityType)} trading as ${escapeHtml(publisher.tradingName)} and publishes ${escapeHtml(config.appName)}.</p>
    </section>
    <section><h2>Contact</h2>${contactBlock(config)}</section>
  </article>`;
}

function productCard(config, product) {
  return `<article class="product-card">
    <div class="product-art product-art-${escapeHtml(product.slug)}">${product.slug === 'cricket-legacy' ? '<img class="app-icon" src="/images/cricket-legacy-icon.png" alt="Cricket Legacy app icon" width="512" height="512" loading="lazy">' : '<span class="pitch-mark" aria-hidden="true"></span><span class="ball-mark" aria-hidden="true"></span>'}</div>
    <div class="product-copy">
      <div class="meta-row"><span>${escapeHtml(product.kind)}</span><span>${escapeHtml(product.status)}</span></div>
      <h3>${escapeHtml(product.name)}</h3>
      <p>${escapeHtml(product.summary)}</p>
      <div class="chip-row">${product.platforms.map((platform) => `<span class="chip">${escapeHtml(platform)}</span>`).join('')}</div>
      <p class="card-actions"><a class="button" href="${productPath(product)}">View product</a>${product.name === config.appName ? ' <a class="text-link" href="/terms/">Terms &amp; Conditions</a>' : ''}</p>
    </div>
  </article>`;
}

function homePage(config) {
  const body = `<section class="studio-hero">
    <div class="studio-hero-copy">
      <p class="kicker">Independent studio · ${escapeHtml(config.publisher.location)}</p>
      <h1>${escapeHtml(config.publisher.tradingName)}</h1>
      <p class="lede">${escapeHtml(config.site.tagline)}</p>
      <p class="hero-detail">${escapeHtml(config.site.description)}</p>
      <div class="hero-actions"><a class="button" href="${productPath(primaryProduct(config))}">Explore ${escapeHtml(config.appName)}</a><a class="text-link" href="/support/">Contact ${escapeHtml(config.publisher.tradingName)}</a></div>
    </div>
    <div class="sun-stage" aria-hidden="true"><span class="sun-disc"></span><span class="sun-orbit sun-orbit-one"></span><span class="sun-orbit sun-orbit-two"></span><span class="sun-dot"></span></div>
  </section>
  <section class="section-intro">
    <div><p class="kicker">Current work</p><h2>Products</h2></div>
    <p>Each ${escapeHtml(config.publisher.tradingName)} release has a dedicated home for product information, support and policies.</p>
  </section>
  <section class="product-list" aria-label="${escapeHtml(config.publisher.tradingName)} products">
    ${config.products.map((product) => productCard(config, product)).join('')}
  </section>
  <section class="contact-summary"><div><p class="kicker">Publisher</p><h2>Independent, reachable, transparent.</h2></div>${contactBlock(config)}</section>`;
  return layout(config, {
    title: config.publisher.tradingName,
    description: config.site.description,
    path: '/',
    body,
  });
}

function productPage(config, product) {
  const isPrimaryApp = product.name === config.appName;
  const legalCards = [
    ['/products/cricket-legacy/privacy/', 'Cricket Legacy Privacy Policy', 'How Cricket Legacy and its providers handle information.'],
    ['/terms/', 'Terms & Conditions', 'Rules for using the game and its paid features.'],
    ['/support/', 'Support', 'Help with gameplay, purchases, access or privacy.'],
    ['/delete-account/', 'Delete account', 'Delete local data or request deletion of an online account.'],
  ];
  const body = `${pageHeading(`${config.publisher.tradingName} product`, product.name, product.summary, config)}
  <section class="product-overview">
    <div>
      <p class="kicker">${escapeHtml(product.status)}</p>
      <h2>${escapeHtml(product.headline)}</h2>
      <p>${escapeHtml(product.description)}</p>
    </div>
    ${isPrimaryApp ? '<div class="product-icon-panel"><img class="app-icon" src="/images/cricket-legacy-icon.png" alt="Cricket Legacy app icon" width="512" height="512"><div class="chip-row"><span>Player</span><span>Manager</span></div></div>' : '<div class="product-glyph" aria-hidden="true"><span></span></div>'}
  </section>
  <section class="highlight-grid" aria-label="${escapeHtml(product.name)} highlights">
    ${product.highlights.map((highlight, index) => `<article><span class="highlight-number">0${index + 1}</span><h3>${escapeHtml(highlight.title)}</h3><p>${escapeHtml(highlight.description)}</p></article>`).join('')}
  </section>
  ${
    isPrimaryApp
      ? `<section class="section-intro legal-intro"><div><p class="kicker">Official information</p><h2>Legal &amp; support</h2></div><p>These pages apply specifically to ${escapeHtml(config.appName)}. Future ${escapeHtml(config.publisher.tradingName)} products will receive their own product-specific policies before release.</p></section>
  <section class="link-grid" aria-label="${escapeHtml(config.appName)} legal and support pages">
    ${legalCards.map(([href, title, copy]) => `<a class="link-card" href="${href}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></a>`).join('')}
  </section>`
      : ''
  }`;
  return layout(config, {
    title: product.name,
    description: product.summary,
    path: productPath(product),
    body,
  });
}

function renderLegalSite(config) {
  const errors = validateLegalConfig(config);
  if (errors.length) {
    const error = new Error(`Legal site configuration is incomplete:\n- ${errors.join('\n- ')}`);
    error.validationErrors = errors;
    throw error;
  }
  const age = AGE_POLICIES[config.agePolicy];
  return {
    'index.html': homePage(config),
    ...Object.fromEntries(
      config.products.map((product) => [
        `products/${product.slug}/index.html`,
        productPage(config, product),
      ]),
    ),
    'privacy/index.html': layout(config, {
      title: 'Privacy Policy',
      description: `${config.appName} Privacy Policy.`,
      path: '/privacy/',
      body: privacyPage(config, age),
    }),
    'products/cricket-legacy/privacy/index.html': layout(config, {
      title: `${config.appName} Privacy Policy`,
      description: `Privacy Policy specifically for ${config.appName}, published by ${config.publisher.tradingName}.`,
      path: '/products/cricket-legacy/privacy/',
      body: privacyPage(config, age),
    }),
    'terms/index.html': layout(config, {
      title: 'Terms & Conditions',
      description: `${config.appName} Terms & Conditions.`,
      path: '/terms/',
      body: termsPage(config, age),
    }),
    'support/index.html': layout(config, {
      title: 'Support',
      description: `${config.appName} support.`,
      path: '/support/',
      body: supportPage(config),
    }),
    'delete-account/index.html': layout(config, {
      title: 'Delete account and data',
      description: `Request deletion of a ${config.appName} account and associated data.`,
      path: '/delete-account/',
      body: deletePage(config),
    }),
    'publisher/index.html': layout(config, {
      title: 'Publisher Information',
      description: `Publisher information for ${config.publisher.tradingName} and ${config.appName}.`,
      path: '/publisher/',
      body: publisherPage(config),
    }),
  };
}

module.exports = {
  AGE_POLICIES,
  REQUIRED_RETENTION_FIELDS,
  renderLegalSite,
  validateLegalConfig,
};
