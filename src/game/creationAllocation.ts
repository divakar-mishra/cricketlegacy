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
