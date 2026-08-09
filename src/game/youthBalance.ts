import { CareerPathLevel } from '../domain/types';

interface YouthBalance {
  opponentQuality: number;
  trainingCeiling: number;
}

const YOUTH_BALANCE: Record<
  Exclude<CareerPathLevel, 'DOMESTIC' | 'INTERNATIONAL'>,
  YouthBalance
> = {
  SCHOOL: {
    opponentQuality: 34,
    trainingCeiling: 62,
  },
  U19: {
    opponentQuality: 48,
    trainingCeiling: 76,
  },
};

export function youthOpponentQuality(level: CareerPathLevel): number {
  if (level === 'SCHOOL' || level === 'U19') return YOUTH_BALANCE[level].opponentQuality;
  return 68;
}

export function trainingAttributeCeiling(level?: CareerPathLevel): number {
  if (level === 'SCHOOL' || level === 'U19') return YOUTH_BALANCE[level].trainingCeiling;
  return 99;
}
