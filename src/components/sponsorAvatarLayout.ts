export interface AvatarOverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LargeAvatarBrandingLayout {
  earned?: AvatarOverlayRect;
  premium?: AvatarOverlayRect;
  role?: AvatarOverlayRect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic lg/xl geometry: every visible item owns a disjoint rectangle. */
export function largeAvatarBrandingLayout({
  avatarSize,
  hasEarned,
  hasPremium,
  showRole,
}: {
  avatarSize: number;
  hasEarned: boolean;
  hasPremium: boolean;
  showRole: boolean;
}): LargeAvatarBrandingLayout {
  const margin = clamp(Math.round(avatarSize * 0.025), 2, 4);
  const gap = clamp(Math.round(avatarSize * 0.025), 2, 4);
  const bottom = avatarSize - margin;
  const roleWidth = showRole ? clamp(Math.round(avatarSize * 0.29), 28, 38) : 0;
  const roleHeight = showRole ? clamp(Math.round(avatarSize * 0.18), 17, 24) : 0;
  const premiumSize = hasPremium ? clamp(Math.round(avatarSize * 0.18), 17, 24) : 0;
  const earnedHeight = hasEarned ? clamp(Math.round(avatarSize * 0.19), 18, 25) : 0;

  const role = showRole
    ? {
        x: avatarSize - margin - roleWidth,
        y: bottom - roleHeight,
        width: roleWidth,
        height: roleHeight,
      }
    : undefined;
  let contentRight = role ? role.x - gap : avatarSize - margin;
  const premium = hasPremium
    ? {
        x: contentRight - premiumSize,
        y: bottom - premiumSize,
        width: premiumSize,
        height: premiumSize,
      }
    : undefined;
  if (premium) contentRight = premium.x - gap;
  const earned = hasEarned
    ? {
        x: margin,
        y: bottom - earnedHeight,
        width: Math.max(1, contentRight - margin),
        height: earnedHeight,
      }
    : undefined;

  return { earned, premium, role };
}

export function overlayRectsOverlap(a: AvatarOverlayRect, b: AvatarOverlayRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
