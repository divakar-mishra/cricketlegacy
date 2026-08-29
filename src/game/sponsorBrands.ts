import {
  CanonicalSponsorBrandId,
  SponsorFormatScope,
  SponsorshipOffer,
} from '../domain/types';

export interface SponsorBrandDefinition {
  id: CanonicalSponsorBrandId;
  name: string;
  shortName: string;
  primary: string;
  secondary: string;
  onPrimary: string;
  generic?: boolean;
}

/** The four approved fictional kit partners. Artwork is rendered from code. */
export const SPONSOR_BRANDS: Readonly<
  Record<CanonicalSponsorBrandId, SponsorBrandDefinition>
> = {
  boundary_works: {
    id: 'boundary_works',
    name: 'Boundary Works',
    shortName: 'BW',
    primary: '#E0A52B',
    secondary: '#FFF1C2',
    onPrimary: '#171208',
  },
  pulse_xi: {
    id: 'pulse_xi',
    name: 'Pulse XI',
    shortName: 'PXI',
    primary: '#24C8D8',
    secondary: '#D9FBFF',
    onPrimary: '#061619',
  },
  longform: {
    id: 'longform',
    name: 'Longform',
    shortName: 'LF',
    primary: '#C86C4A',
    secondary: '#FFE3D8',
    onPrimary: '#1A0D08',
  },
  legacy_crown: {
    id: 'legacy_crown',
    name: 'Legacy Crown',
    shortName: 'LC',
    primary: '#D7B44A',
    secondary: '#FFF3B8',
    onPrimary: '#171206',
  },
};

export const PREMIUM_SPONSOR_BRAND = SPONSOR_BRANDS.legacy_crown;
export const SPONSOR_LOCKUP_BACKGROUND = '#071018';

function srgbChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return 0;
  const red = srgbChannel(Number.parseInt(normalized.slice(0, 2), 16));
  const green = srgbChannel(Number.parseInt(normalized.slice(2, 4), 16));
  const blue = srgbChannel(Number.parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function wcagContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

export function isCanonicalSponsorBrandId(value: unknown): value is CanonicalSponsorBrandId {
  return typeof value === 'string' && value in SPONSOR_BRANDS;
}

/**
 * Offer identity is independent from payout values. Manager's approved
 * results-based third offer keeps its economy terms while using Longform's
 * established third visual identity.
 */
export function earnedSponsorBrandFor(
  scope: SponsorFormatScope,
): SponsorBrandDefinition {
  if (scope === 'WHITE_BALL' || scope === 'T20_ONLY') return SPONSOR_BRANDS.pulse_xi;
  if (scope === 'RED_BALL' || scope === 'RESULTS') return SPONSOR_BRANDS.longform;
  return SPONSOR_BRANDS.boundary_works;
}

export function sponsorBrandFrom(
  value?: Pick<SponsorshipOffer, 'brandId' | 'brandName'> | null,
): SponsorBrandDefinition | undefined {
  if (!value) return undefined;
  if (isCanonicalSponsorBrandId(value.brandId)) return SPONSOR_BRANDS[value.brandId];
  return undefined;
}

/** Fill presentation fields without altering a contract's economy or identity. */
export function withEarnedSponsorBrand<T extends SponsorshipOffer>(offer: T): T {
  if (isCanonicalSponsorBrandId(offer.brandId) && offer.brandName?.trim()) return offer;
  // Preserve a genuine legacy endorsement name instead of relabelling history.
  if (offer.id.startsWith('legacy:') && offer.brandName?.trim()) return offer;
  const brand = earnedSponsorBrandFor(offer.scope);
  return { ...offer, brandId: brand.id, brandName: brand.name };
}
