import { drsAvailableForMatch, isReviewableDismissal } from '../drs';

describe('DRS availability', () => {
  it('blocks School and U19 matches by default', () => {
    expect(drsAvailableForMatch({ mode: 'career', careerPathLevel: 'SCHOOL' })).toBe(false);
    expect(drsAvailableForMatch({ mode: 'career', careerPathLevel: 'U19' })).toBe(false);
    expect(drsAvailableForMatch({ mode: 'career', competition: 'U19_WORLDCUP' })).toBe(false);
  });

  it('allows senior domestic and international career matches', () => {
    expect(drsAvailableForMatch({ mode: 'career', careerPathLevel: 'DOMESTIC' })).toBe(true);
    expect(drsAvailableForMatch({ mode: 'career', careerPathLevel: 'INTERNATIONAL' })).toBe(true);
    expect(drsAvailableForMatch({ mode: 'career', intl: true })).toBe(true);
    expect(drsAvailableForMatch({ mode: 'career', competition: 'INTL_TOURNAMENT' })).toBe(true);
  });

  it('requires career mode and allows youth only with explicit competition config', () => {
    expect(drsAvailableForMatch({ mode: 'manager', careerPathLevel: 'DOMESTIC' })).toBe(false);
    expect(drsAvailableForMatch({ mode: 'manager', explicitEnabled: true })).toBe(false);
    expect(drsAvailableForMatch({ mode: 'career', careerPathLevel: 'U19', explicitEnabled: true })).toBe(true);
  });
});

describe('DRS decision reviewability', () => {
  it('only reviews marginal user-dismissal types', () => {
    expect(isReviewableDismissal('LBW')).toBe(true);
    expect(isReviewableDismissal('CAUGHT')).toBe(true);
    expect(isReviewableDismissal('RUN_OUT')).toBe(true);
    expect(isReviewableDismissal('BOWLED')).toBe(false);
    expect(isReviewableDismissal('STUMPED')).toBe(false);
    expect(isReviewableDismissal(undefined)).toBe(false);
  });
});
