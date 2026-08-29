import { CELEBRATIONS, KIT_COLORS } from '../cosmetics';

describe('cosmetics catalog presentation', () => {
  it('gives every celebration a visible code-native preview', () => {
    expect(CELEBRATIONS.length).toBeGreaterThan(10);
    for (const celebration of CELEBRATIONS) {
      expect(celebration.previewIcon).toMatch(/-outline$/);
      expect(celebration.previewAccent).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('keeps free, gem and pass reward states represented', () => {
    expect(CELEBRATIONS.some((option) => option.gemCost === 0 && !option.passExclusive)).toBe(true);
    expect(CELEBRATIONS.some((option) => option.gemCost > 0)).toBe(true);
    expect(CELEBRATIONS.some((option) => option.passExclusive)).toBe(true);
    expect(KIT_COLORS.some((option) => option.passExclusive)).toBe(true);
  });
});
