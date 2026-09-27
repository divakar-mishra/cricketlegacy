import { ATTR_META, CREATION } from '../data/attributes';
import { BattingAttrs, BowlingAttrs, FieldingAttrs, MentalPhysical } from '../domain/types';

export type CreationMetaAttrs = Omit<MentalPhysical, 'form'>;

export interface CreationAttrs {
  batting: BattingAttrs;
  bowling: BowlingAttrs;
  fielding: FieldingAttrs;
  meta: CreationMetaAttrs;
}

export function allocatedCreationPoints(attrs: CreationAttrs): number {
  let total = 0;
  for (const group of ['batting', 'bowling', 'fielding', 'meta'] as const) {
    for (const [key] of ATTR_META[group]) {
      total += (attrs[group] as Record<string, number>)[key] - CREATION.base;
    }
  }
  return total;
}

/** Budget the attributes the Grade A player will actually see after scaling. */
export function allocatedActiveCreationPoints(attrs: CreationAttrs, scale: number): number {
  const base = Math.round(CREATION.base * scale);
  let total = 0;
  for (const group of ['batting', 'bowling', 'fielding', 'meta'] as const) {
    for (const [key] of ATTR_META[group]) {
      total += Math.round((attrs[group] as Record<string, number>)[key] * scale) - base;
    }
  }
  return total;
}

/** Move one visible Grade A attribute by up to three points per tap. */
export function activeCreationAttributeDelta(
  current: number,
  direction: number,
  remaining: number,
  scale: number,
  base = CREATION.base,
  max = CREATION.maxPerAttr,
): number {
  if (!direction) return 0;
  const currentVisible = Math.round(current * scale);
  const baseVisible = Math.round(base * scale);
  const maxVisible = Math.round(max * scale);
  const target = direction > 0
    ? Math.min(currentVisible + 3, currentVisible + Math.max(0, remaining), maxVisible)
    : Math.max(currentVisible - 3, baseVisible);
  if (target === currentVisible) return 0;
  if (direction > 0) {
    for (let raw = current + 1; raw <= max; raw++) {
      if (Math.round(raw * scale) >= target) return raw - current;
    }
  } else {
    for (let raw = current - 1; raw >= base; raw--) {
      if (Math.round(raw * scale) <= target) return raw - current;
    }
  }
  return 0;
}

export function creationAttributeDelta(
  current: number,
  delta: number,
  remaining: number,
  base = CREATION.base,
  max = CREATION.maxPerAttr,
): number {
  if (delta > 0) return Math.min(5, Math.max(0, remaining), Math.max(0, max - current));
  if (delta < 0) return -Math.min(5, Math.max(0, current - base));
  return 0;
}
