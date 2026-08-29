import { getCountry } from '../data/countries';

/**
 * Ability centre for a country's generated senior-national replacement pool.
 *
 * The selected domestic country has a complete 24-club pyramid, so its best XI
 * is drawn from hundreds of players. Other countries keep a compact virtual
 * reserve. This curve gives that reserve the standard of the country's elite
 * domestic tier without flattening genuine country-strength differences.
 */
export function nationalReplacementQuality(countryId: string): number {
  const strength = getCountry(countryId)?.strength ?? 2;
  return Math.max(64, Math.min(90, 58 + strength * 6));
}

/** Refresh a compact national reserve before its best XI falls below this. */
export function nationalReplacementQualityFloor(countryId: string): number {
  return nationalReplacementQuality(countryId) - 4;
}
