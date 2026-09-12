import type { SaveGame } from '../../domain/types';
import { STADIUMS } from '../../data/stadiums';
import { fieldGeometry } from '../fieldGeometry';
import {
  matchGroundAppearance,
  previewGround,
  stageStatus,
  standSections,
  standSector,
  visualLevel,
} from '../venueVisuals';

describe('saved venue presentation', () => {
  const clubs = {
    home: { stadium: { capacityLevel: 5, experienceLevel: 2 } },
    away: { stadium: { capacityLevel: 2, experienceLevel: 4 } },
  } as unknown as SaveGame['managerClubs'];

  it('uses the fixture ground ID, not whichever club the user manages', () => {
    expect(matchGroundAppearance('club-ground:home', clubs)).toEqual({
      capacityLevel: 5,
      experienceLevel: 2,
    });
    expect(matchGroundAppearance('club-ground:away', clubs)).toEqual({
      capacityLevel: 2,
      experienceLevel: 4,
    });
    expect(matchGroundAppearance(undefined, clubs)).toEqual({
      capacityLevel: 1,
      experienceLevel: 1,
    });
  });

  it('keeps generic away, neutral-final and national venues independent of owned upgrades', () => {
    for (const venue of STADIUMS) {
      expect(matchGroundAppearance(venue.id, clubs)).toEqual(
        matchGroundAppearance(venue.id, undefined),
      );
    }
  });

  it('does not initialize, change or erase any save state during a preview', () => {
    const before = JSON.stringify(clubs);
    const current = Object.freeze({ capacityLevel: 2, experienceLevel: 4 });
    expect(previewGround(current, 'capacity', 5)).toEqual({ capacityLevel: 5, experienceLevel: 4 });
    expect(previewGround(current, 'experience', 1)).toEqual({
      capacityLevel: 2,
      experienceLevel: 1,
    });
    matchGroundAppearance('club-ground:missing', clubs);
    expect(JSON.stringify(clubs)).toBe(before);
    expect(current).toEqual({ capacityLevel: 2, experienceLevel: 4 });
  });

  it('distinguishes already built, current and future levels without fabricated dates', () => {
    expect([1, 2, 3, 4, 5].map((level) => stageStatus(level, 3))).toEqual([
      'Built',
      'Built',
      'Current',
      'Not built',
      'Not built',
    ]);
    expect([NaN, -5, 0, 3.9, 20].map(visualLevel)).toEqual([1, 1, 1, 3, 5]);
    expect([1, 2, 3, 4, 5].map((level) => standSections(level).length)).toEqual([4, 8, 12, 12, 12]);
  });

  it.each([220, 280, 360, 420])(
    'fits every stand sector outside the playing area at %ipx',
    (size) => {
      const { cx, cy, groundR, stadiumR } = fieldGeometry(size);
      const inner = groundR + size * 0.016;
      const outer = stadiumR - size * 0.008;
      expect(inner).toBeGreaterThan(groundR);
      expect(outer).toBeLessThan(size / 2);
      for (const index of standSections(5)) {
        const sector = standSector(
          cx,
          cy,
          inner,
          outer,
          (index * Math.PI) / 6 + 0.024,
          ((index + 1) * Math.PI) / 6 - 0.024,
        );
        expect(sector).not.toMatch(/NaN|Infinity/);
        expect(sector).toMatch(/^M .* Z$/);
      }
    },
  );
});
