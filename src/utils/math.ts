export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
