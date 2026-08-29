import {
  AvatarOverlayRect,
  largeAvatarBrandingLayout,
  overlayRectsOverlap,
} from '../sponsorAvatarLayout';

function inBounds(rect: AvatarOverlayRect, size: number): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= size &&
    rect.y + rect.height <= size
  );
}

describe.each([96, 128])('large avatar sponsor geometry at %ipx', (avatarSize) => {
  it.each([
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, false],
    [false, false, true],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ] as const)('keeps earned=%s premium=%s role=%s in bounds and disjoint', (
    hasEarned,
    hasPremium,
    showRole,
  ) => {
    const layout = largeAvatarBrandingLayout({
      avatarSize,
      hasEarned,
      hasPremium,
      showRole,
    });
    const rects = [layout.earned, layout.premium, layout.role].filter(
      (rect): rect is AvatarOverlayRect => Boolean(rect),
    );

    expect(rects.every((rect) => inBounds(rect, avatarSize))).toBe(true);
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        expect(overlayRectsOverlap(rects[left], rects[right])).toBe(false);
      }
    }
  });

  it('reserves positive width for all three simultaneous placements', () => {
    const layout = largeAvatarBrandingLayout({
      avatarSize,
      hasEarned: true,
      hasPremium: true,
      showRole: true,
    });
    expect(layout.earned!.width).toBeGreaterThanOrEqual(40);
    expect(layout.premium!.width).toBeGreaterThanOrEqual(17);
    expect(layout.role!.width).toBeGreaterThanOrEqual(28);
  });
});
