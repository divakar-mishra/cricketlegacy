import { baseAttributeProgress, baseAttributeValue } from '../attributeDisplay';

describe('base attribute display values', () => {
  it('never displays negative or overflowing base attributes', () => {
    expect(baseAttributeValue(-12)).toBe(0);
    expect(baseAttributeValue(0)).toBe(0);
    expect(baseAttributeValue(42.4)).toBe(42);
    expect(baseAttributeValue(42.6)).toBe(43);
    expect(baseAttributeValue(144)).toBe(100);
    expect(baseAttributeValue(Number.NaN)).toBe(0);
  });

  it('keeps progress values in the expected display range', () => {
    expect(baseAttributeProgress(-50)).toBe(0);
    expect(baseAttributeProgress(55)).toBe(0.55);
    expect(baseAttributeProgress(500)).toBe(1);
  });
});
