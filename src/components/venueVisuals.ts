import type { SaveGame } from '../domain/types';
import { STADIUMS } from '../data/stadiums';

export type GroundTrack = 'capacity' | 'experience';
export type FacilityKind = 'academy' | 'training' | 'medical';
export interface GroundAppearance {
  capacityLevel: number;
  experienceLevel: number;
}

// Presentation only. These stages do not add mechanics or an upgrade history.
export const CAPACITY_ART = [
  'Boundary terraces',
  'East & west seating',
  'Complete seating bowl',
  'Upper-tier stands',
  'Roofed grandstands',
] as const;
export const EXPERIENCE_ART = [
  'Pavilion entrance',
  'Fan-zone marquees',
  'Hospitality pavilion',
  'Premium stand frontage',
  'Landmark entrance & lights',
] as const;
export const FACILITY_ART: Record<FacilityKind, readonly string[]> = {
  academy: [
    'Nets & coaching pavilion',
    'Twin practice lanes',
    'Third practice lane',
    'Learning wing',
    'Academy campus',
  ],
  training: [
    'Nets & equipment pavilion',
    'Twin practice lanes',
    'Third practice lane',
    'Covered training hall',
    'Performance campus',
  ],
  medical: [
    'Treatment room',
    'Second treatment bay',
    'Rehabilitation space',
    'Recovery wing',
    'Sports-health centre',
  ],
};

export function visualLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(5, Math.floor(level))) : 1;
}

export function stageStatus(level: number, current: number): 'Built' | 'Current' | 'Not built' {
  return level < visualLevel(current)
    ? 'Built'
    : level === visualLevel(current)
      ? 'Current'
      : 'Not built';
}

export function previewGround(
  current: GroundAppearance,
  track: GroundTrack,
  level: number,
): GroundAppearance {
  return {
    capacityLevel: visualLevel(track === 'capacity' ? level : current.capacityLevel),
    experienceLevel: visualLevel(track === 'experience' ? level : current.experienceLevel),
  };
}

// Resolve the venue chosen by the match engine, never the user's club by default.
// Read-only: activeManagerClub() can initialize save state and must not run here.
export function matchGroundAppearance(
  stadiumId: string | undefined,
  clubs: SaveGame['managerClubs'],
): GroundAppearance {
  if (stadiumId?.startsWith('club-ground:')) {
    const stadium = clubs?.[stadiumId.slice('club-ground:'.length)]?.stadium;
    if (stadium)
      return {
        capacityLevel: visualLevel(stadium.capacityLevel),
        experienceLevel: visualLevel(stadium.experienceLevel),
      };
  }
  const capacity = STADIUMS.find((venue) => venue.id === stadiumId)?.capacity ?? 8000;
  // Generic venues get a scale of architecture, not claimed purchased levels.
  const scale =
    capacity >= 42000
      ? 5
      : capacity >= 28000
        ? 4
        : capacity >= 18000
          ? 3
          : capacity >= 12000
            ? 2
            : 1;
  return { capacityLevel: scale, experienceLevel: scale };
}

export function standSector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const point = (radius: number, angle: number) =>
    `${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z`;
}

export function standSections(level: number): number[] {
  const count = [4, 8, 12, 12, 12][visualLevel(level) - 1];
  return Array.from({ length: count }, (_, index) => Math.floor((index * 12) / count));
}
