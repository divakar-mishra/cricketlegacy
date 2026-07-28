import { SaveGame } from '../domain/types';
import { ensureCareerExperience } from '../game/careerExperience';

/** Deterministically initialize the persistent career-experience layer. */
export function synchronizeSchema15State(save: SaveGame): void {
  ensureCareerExperience(save);
}
