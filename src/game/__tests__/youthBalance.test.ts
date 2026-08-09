import { trainingAttributeCeiling, youthOpponentQuality } from '../youthBalance';

describe('youth balance policy', () => {
  it('keeps youth opponent strength and training caps below senior levels', () => {
    expect(youthOpponentQuality('SCHOOL')).toBe(34);
    expect(youthOpponentQuality('U19')).toBe(48);
    expect(trainingAttributeCeiling('SCHOOL')).toBe(62);
    expect(trainingAttributeCeiling('U19')).toBe(76);
    expect(trainingAttributeCeiling('DOMESTIC')).toBe(99);
  });
});
