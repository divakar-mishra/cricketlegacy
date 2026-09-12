import { canUseAds, canUseGame, isAgeDeclaration, AgeDeclaration } from '../ageEligibility';

describe('approved country/age policy', () => {
  it.each([
    ['india', 'under13', false, false],
    ['india', '13to17', true, false],
    ['india', 'adult', false, true],
    ['elsewhere', 'under13', true, false],
    ['elsewhere', '13to17', false, false],
    ['elsewhere', '13to17', true, true],
    ['elsewhere', 'adult', false, true],
  ])('%s %s guardian=%s eligible=%s', (residence, band, guardianPermission, expected) => {
    const declaration = { version: 1, residence, band, guardianPermission } as AgeDeclaration;
    expect(canUseGame(declaration)).toBe(expected);
    expect(canUseAds(declaration)).toBe(band === 'adult');
  });
  it.each([
    null,
    {},
    { version: 1, band: 'adult' },
    { version: 2, band: 'adult', residence: 'india', guardianPermission: true },
    { version: 1, band: 'adult', residence: 'unknown', guardianPermission: false },
  ])('rejects malformed stored answers %j', (value) => {
    expect(isAgeDeclaration(value)).toBe(false);
  });
  it('accepts only a complete local declaration', () => {
    expect(
      isAgeDeclaration({
        version: 1,
        band: 'adult',
        residence: 'india',
        guardianPermission: false,
      }),
    ).toBe(true);
  });
});
