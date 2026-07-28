import { CareerPathLevel } from '../domain/types';
import { TeamBlueprint } from '../content/teams';

type YouthStart = 'u14' | 'u19' | 'domestic';

interface YouthBalance {
  label: string;
  competitionTier: string;
  opponentQuality: number;
  opponentRange: [number, number];
  trainingCeiling: number;
  selectionRequirement: number;
  selectionChanceLabel: string;
}

export const YOUTH_BALANCE: Record<
  Exclude<CareerPathLevel, 'DOMESTIC' | 'INTERNATIONAL'>,
  YouthBalance
> = {
  SCHOOL: {
    label: 'Under-14',
    competitionTier: 'School district cricket',
    opponentQuality: 34,
    opponentRange: [28, 40],
    trainingCeiling: 62,
    selectionRequirement: 34,
    selectionChanceLabel: 'starter pathway',
  },
  U19: {
    label: 'Under-19',
    competitionTier: 'State youth cricket',
    opponentQuality: 48,
    opponentRange: [42, 54],
    trainingCeiling: 76,
    selectionRequirement: 47,
    selectionChanceLabel: 'competitive starter',
  },
};

export function careerStartToPath(start: YouthStart): CareerPathLevel {
  if (start === 'u14') return 'SCHOOL';
  if (start === 'u19') return 'U19';
  return 'DOMESTIC';
}

export function youthOpponentQuality(level: CareerPathLevel): number {
  if (level === 'SCHOOL' || level === 'U19') return YOUTH_BALANCE[level].opponentQuality;
  return 68;
}

export function trainingAttributeCeiling(level?: CareerPathLevel): number {
  if (level === 'SCHOOL' || level === 'U19') return YOUTH_BALANCE[level].trainingCeiling;
  return 99;
}

export function teamSelectionSummary(team: TeamBlueprint, start: YouthStart): string {
  const level = careerStartToPath(start);
  if (level === 'SCHOOL' || level === 'U19') {
    const balance = YOUTH_BALANCE[level];
    const [low, high] = balance.opponentRange;
    return `${balance.label} pathway - ${balance.competitionTier} - Opponents ${low}-${high} OVR - Selection ${balance.selectionChanceLabel}`;
  }
  return `${team.tier === 1 ? 'Top division' : 'Second division'} - Squad strength ${team.strength}`;
}

export function youthSelectionRequirement(level: CareerPathLevel): number | undefined {
  if (level === 'SCHOOL' || level === 'U19') return YOUTH_BALANCE[level].selectionRequirement;
  return undefined;
}
