import { clamp } from '../utils/math';

export const BASE_ATTRIBUTE_MIN = 0;
export const BASE_ATTRIBUTE_MAX = 100;

export function baseAttributeValue(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.round(clamp(n, BASE_ATTRIBUTE_MIN, BASE_ATTRIBUTE_MAX));
}

export function baseAttributeProgress(value: unknown): number {
  return baseAttributeValue(value) / BASE_ATTRIBUTE_MAX;
}
