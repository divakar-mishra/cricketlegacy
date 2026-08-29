/**
 * Public legal and support destinations embedded at Expo build time.
 *
 * These must point to pages owned or controlled by the developer. There are
 * deliberately no placeholder fallbacks: a release check should fail instead
 * of shipping a misleading or broken legal link.
 */

export type PublicResourceKey = 'privacyPolicy' | 'terms' | 'support' | 'accountDeletion';

export type PublicResourceInput = Record<PublicResourceKey, string | undefined>;
export type PublicResourceLinks = Record<PublicResourceKey, string | undefined>;

export const PUBLIC_RESOURCE_LABELS: Readonly<Record<PublicResourceKey, string>> = {
  privacyPolicy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  support: 'Help & Support',
  accountDeletion: 'Account & Data Deletion',
};

const RAW_PUBLIC_RESOURCES: PublicResourceInput = {
  // Expo replaces direct EXPO_PUBLIC_* references at build time. Keep these
  // accesses explicit rather than indexing process.env dynamically.
  privacyPolicy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  terms: process.env.EXPO_PUBLIC_TERMS_URL,
  support: process.env.EXPO_PUBLIC_SUPPORT_URL,
  accountDeletion: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
};

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

/** Returns a normalized public HTTPS URL, or `undefined` when it is unsafe. */
export function normalizePublicHttpsUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== 'https:' ||
      !hostname.includes('.') ||
      parsed.username ||
      parsed.password ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      isPrivateIpv4(hostname)
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function evaluatePublicResourceReadiness(input: PublicResourceInput): {
  ready: boolean;
  links: PublicResourceLinks;
  missing: PublicResourceKey[];
  invalid: PublicResourceKey[];
} {
  const links = {} as PublicResourceLinks;
  const missing: PublicResourceKey[] = [];
  const invalid: PublicResourceKey[] = [];

  for (const key of Object.keys(PUBLIC_RESOURCE_LABELS) as PublicResourceKey[]) {
    const raw = input[key]?.trim();
    if (!raw) {
      missing.push(key);
      links[key] = undefined;
      continue;
    }
    const normalized = normalizePublicHttpsUrl(raw);
    if (
      !normalized ||
      (key === 'privacyPolicy' && new URL(normalized).pathname.toLowerCase().endsWith('.pdf'))
    ) {
      invalid.push(key);
      links[key] = undefined;
      continue;
    }
    links[key] = normalized;
  }

  return { ready: missing.length === 0 && invalid.length === 0, links, missing, invalid };
}

export const PUBLIC_RESOURCE_READINESS = evaluatePublicResourceReadiness(RAW_PUBLIC_RESOURCES);
export const PUBLIC_RESOURCES = PUBLIC_RESOURCE_READINESS.links;

/** Official account pages used to manage store-billed subscriptions. */
export const SUBSCRIPTION_MANAGEMENT_URLS = {
  android: 'https://play.google.com/store/account/subscriptions',
  ios: 'https://apps.apple.com/account/subscriptions',
} as const;
