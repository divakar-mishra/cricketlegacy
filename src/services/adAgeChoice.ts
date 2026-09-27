import { getJSON, setJSON } from '../storage/storage';
export const AD_AGE_CHOICE_KEY = 'privacy:ad-age-choice:v3';
const PREVIOUS_AD_AGE_CHOICE_KEY = 'privacy:ad-age-choice:v2';

export type AdAgeBand = 'under13' | 'teen' | 'adult';
export type AdAgeChoice = {
  band: AdAgeBand;
  residence: 'india' | 'elsewhere' | null;
  guardianPermission: boolean;
};

/** Exact age is never persisted. */
export function ageToAdBand(ageText: string): AdAgeBand | null {
  if (!/^\d{1,3}$/.test(ageText)) return null;
  const age = Number(ageText);
  if (age < 1 || age > 120) return null;
  return age < 13 ? 'under13' : age < 18 ? 'teen' : 'adult';
}

export function adAudience(choice: AdAgeChoice | null): 'none' | 'teen' | 'adult' {
  if (choice?.band === 'adult') return 'adult';
  if (choice?.band === 'teen' && choice.residence === 'elsewhere' && choice.guardianPermission) return 'teen';
  return 'none';
}

function isChoice(value: unknown): value is AdAgeChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Partial<AdAgeChoice>;
  return ['under13', 'teen', 'adult'].includes(choice.band ?? '')
    && (choice.residence === null || choice.residence === 'india' || choice.residence === 'elsewhere')
    && typeof choice.guardianPermission === 'boolean';
}

export async function readAdAgeChoice(): Promise<AdAgeChoice | null> {
  const current = await getJSON<unknown>(AD_AGE_CHOICE_KEY);
  if (isChoice(current)) return current;
  // The prior adult path used a neutral numeric entry. Prior "under18" cannot
  // distinguish younger children from teens, so those players answer again.
  const previous = await getJSON<unknown>(PREVIOUS_AD_AGE_CHOICE_KEY);
  if (previous === 'adult') return { band: 'adult', residence: null, guardianPermission: false };
  return null;
}

export async function saveAdAgeChoice(choice: AdAgeChoice): Promise<void> {
  if (!isChoice(choice)) throw new Error('Invalid age choice');
  await setJSON(AD_AGE_CHOICE_KEY, choice);
}
