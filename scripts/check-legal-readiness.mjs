import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateLegalConfig } = require('../legal-site/build-core.cjs');

const requiredResources = [
  ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'Privacy Policy', '/privacy/', 'privacy'],
  ['EXPO_PUBLIC_TERMS_URL', 'Terms & Conditions', '/terms/', 'terms'],
  ['EXPO_PUBLIC_SUPPORT_URL', 'Help & Support', '/support/', 'support'],
  [
    'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    'Account & Data Deletion',
    '/delete-account/',
    'delete-account',
  ],
];

function isPublicHttpsUrl(raw) {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const parts = hostname.split('.').map(Number);
    const isIpv4 = parts.length === 4 && parts.every((part) => Number.isInteger(part));
    const privateIpv4 =
      isIpv4 &&
      (parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168));
    return (
      url.protocol === 'https:' &&
      hostname.includes('.') &&
      !url.username &&
      !url.password &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      !hostname.endsWith('.local') &&
      !privateIpv4
    );
  } catch {
    return false;
  }
}

const missing = [];
const invalid = [];
const configuredResources = [];
const configuredUrls = new Set();
let legalSiteErrors = [];

try {
  const legalSiteConfig = JSON.parse(
    fs.readFileSync(new URL('../legal-site/legal.config.json', import.meta.url), 'utf8'),
  );
  legalSiteErrors = validateLegalConfig(legalSiteConfig);
} catch (error) {
  legalSiteErrors = [
    `legal-site/legal.config.json could not be read: ${error instanceof Error ? error.message : String(error)}`,
  ];
}

for (const [variable, label, expectedPath, pageId] of requiredResources) {
  const value = process.env[variable]?.trim();
  if (!value) {
    missing.push(`${label} (${variable})`);
    continue;
  }
  if (!isPublicHttpsUrl(value)) {
    invalid.push(`${label} (${variable})`);
    continue;
  }
  const parsed = new URL(value);
  const canonicalUrl = `${parsed.origin}${parsed.pathname}`;
  if (
    parsed.pathname !== expectedPath ||
    parsed.search ||
    parsed.hash ||
    configuredUrls.has(canonicalUrl)
  ) {
    invalid.push(`${label} (${variable})`);
    continue;
  }
  configuredUrls.add(canonicalUrl);
  configuredResources.push({ label, url: value, pageId });
}

if (missing.length || invalid.length || legalSiteErrors.length) {
  console.error('Store legal readiness failed.');
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (invalid.length) console.error(`Invalid public HTTPS URL: ${invalid.join(', ')}`);
  if (legalSiteErrors.length) {
    console.error(`Legal site configuration:\n- ${legalSiteErrors.join('\n- ')}`);
  }
  process.exitCode = 1;
} else {
  const unavailable = [];
  for (const resource of configuredResources) {
    try {
      const response = await fetch(resource.url, {
        headers: { Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const finalUrlIsPublic = isPublicHttpsUrl(response.url);
      const body = response.ok && contentType.includes('text/html') ? await response.text() : '';
      if (
        !response.ok ||
        !finalUrlIsPublic ||
        !contentType.includes('text/html') ||
        !body.includes(`data-legal-page="${resource.pageId}"`) ||
        !body.includes('Sunlight') ||
        !body.includes('Cricket Legacy')
      ) {
        unavailable.push(
          `${resource.label} did not return the expected public Cricket Legacy HTML page`,
        );
      }
    } catch (error) {
      unavailable.push(
        `${resource.label} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!unavailable.length) {
    const publisherUrl = new URL('/publisher/', configuredResources[0].url).toString();
    try {
      const response = await fetch(publisherUrl, {
        headers: { Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const body = response.ok && contentType.includes('text/html') ? await response.text() : '';
      if (
        !response.ok ||
        !isPublicHttpsUrl(response.url) ||
        !contentType.includes('text/html') ||
        !body.includes('data-legal-page="publisher"') ||
        !body.includes('Divakar Mishra') ||
        !body.includes('Sunlight') ||
        !body.includes('Cricket Legacy')
      ) {
        unavailable.push('Publisher Information did not return the expected legal identity page');
      }
    } catch (error) {
      unavailable.push(
        `Publisher Information could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (unavailable.length) {
    console.error(`Store legal readiness failed.\n- ${unavailable.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('Store legal pages are configured, reachable and content-verified.');
  }
}
