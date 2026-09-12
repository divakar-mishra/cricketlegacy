/** Local, self-declared age bands; never store a date of birth or transmit answers. */
export type AgeBand = 'under13' | '13to17' | 'adult';
export type Residence = 'india' | 'elsewhere';
export interface AgeDeclaration {
  version: 1;
  band: AgeBand;
  residence: Residence;
  guardianPermission: boolean;
}
export const AGE_DECLARATION_KEY = 'privacy:age-declaration:v1';

export function isAgeDeclaration(value: unknown): value is AgeDeclaration {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AgeDeclaration>;
  return (
    record.version === 1 &&
    ['under13', '13to17', 'adult'].includes(record.band ?? '') &&
    ['india', 'elsewhere'].includes(record.residence ?? '') &&
    typeof record.guardianPermission === 'boolean'
  );
}

export function canUseGame(value: AgeDeclaration): boolean {
  return (
    value.band === 'adult' ||
    (value.residence === 'elsewhere' && value.band === '13to17' && value.guardianPermission)
  );
}

/** No ad SDK initialization for minors, irrespective of local digital-consent age. */
export function canUseAds(value: AgeDeclaration): boolean {
  return canUseGame(value) && value.band === 'adult';
}
