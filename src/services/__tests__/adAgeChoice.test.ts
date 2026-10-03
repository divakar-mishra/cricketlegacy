import {
  AD_AGE_CHOICE_KEY,
  adAudience,
  ageToAdBand,
  isAgeChoiceEligible,
  readAdAgeChoice,
  saveAdAgeChoice,
} from '../adAgeChoice';
import { getJSON, removeKey, setJSON } from '../../storage/storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('on-device ad age choice', () => {
  afterEach(async () => {
    await removeKey(AD_AGE_CHOICE_KEY);
    await removeKey('privacy:ad-age-choice:v2');
    await removeKey('privacy:ad-age-choice:v1');
  });

  it('never infers adulthood when a new user has not answered', async () => {
    expect(await readAdAgeChoice()).toBeNull();
  });

  it('persists only the age band and needed eligibility answers', async () => {
    const choice = { band: 'teen', residence: 'elsewhere', guardianPermission: true } as const;
    await saveAdAgeChoice(choice);
    expect(await getJSON(AD_AGE_CHOICE_KEY)).toEqual(choice);
    expect(await readAdAgeChoice()).toEqual(choice);
  });

  it('classifies a neutral age entry without saving the number', () => {
    expect(ageToAdBand('12')).toBe('under13');
    expect(ageToAdBand('17')).toBe('teen');
    expect(ageToAdBand('18')).toBe('adult');
    expect(ageToAdBand('0')).toBeNull();
    expect(ageToAdBand('121')).toBeNull();
    expect(ageToAdBand('18 years')).toBeNull();
  });

  it('migrates prior numeric adult answers but re-prompts prior under-18 answers', async () => {
    await setJSON('privacy:ad-age-choice:v1', 'adult');
    expect(await readAdAgeChoice()).toBeNull();
    await setJSON('privacy:ad-age-choice:v2', 'under18');
    expect(await readAdAgeChoice()).toBeNull();
    await setJSON('privacy:ad-age-choice:v2', 'adult');
    expect(await readAdAgeChoice()).toEqual({
      band: 'adult',
      residence: null,
      guardianPermission: false,
    });
  });

  it('only admits adult or permitted teen outside India', () => {
    expect(adAudience(null)).toBe('none');
    expect(adAudience({ band: 'under13', residence: null, guardianPermission: false })).toBe(
      'none',
    );
    expect(adAudience({ band: 'teen', residence: 'india', guardianPermission: true })).toBe('none');
    expect(adAudience({ band: 'teen', residence: 'elsewhere', guardianPermission: false })).toBe(
      'none',
    );
    expect(adAudience({ band: 'teen', residence: 'elsewhere', guardianPermission: true })).toBe(
      'teen',
    );
    expect(adAudience({ band: 'adult', residence: null, guardianPermission: false })).toBe('adult');
    expect(isAgeChoiceEligible(null)).toBe(false);
    expect(
      isAgeChoiceEligible({ band: 'under13', residence: null, guardianPermission: false }),
    ).toBe(false);
    expect(
      isAgeChoiceEligible({ band: 'teen', residence: 'india', guardianPermission: true }),
    ).toBe(false);
    expect(
      isAgeChoiceEligible({ band: 'teen', residence: 'elsewhere', guardianPermission: false }),
    ).toBe(false);
    expect(
      isAgeChoiceEligible({ band: 'teen', residence: 'elsewhere', guardianPermission: true }),
    ).toBe(true);
    expect(isAgeChoiceEligible({ band: 'adult', residence: null, guardianPermission: false })).toBe(
      true,
    );
  });
});
