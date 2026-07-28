import { Conditions } from '../../domain/types';
import { generateSquad } from '../../generation/players';
import { makeRng } from '../rng';
import { TeamSide } from '../simulateMatch';

/** Two balanced XIs built from a fixed seed (so tests are reproducible). */
export function makeTeams(quality = 66): { home: TeamSide; away: TeamSide } {
  const rng = makeRng(42);
  const home: TeamSide = {
    teamId: 'home',
    players: generateSquad({ nationality: 'india', quality, idPrefix: 'home', rng }),
  };
  const away: TeamSide = {
    teamId: 'away',
    players: generateSquad({ nationality: 'australia', quality, idPrefix: 'away', rng }),
  };
  return { home, away };
}

export const NEUTRAL_CONDITIONS: Conditions = { pitch: 'DRY', weather: 'CLEAR' };
export const FLAT_CONDITIONS: Conditions = { pitch: 'FLAT', weather: 'CLEAR' };

export const seedFor = (i: number): number => Math.imul(i, 2654435761) >>> 0;
