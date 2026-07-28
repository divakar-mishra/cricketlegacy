export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export const round1 = (v: number): number => Math.round(v * 10) / 10;
