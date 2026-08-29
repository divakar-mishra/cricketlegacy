import type { SaveGame } from '../domain/types';

export const MANAGER_START_AGE = 35;
export const MANAGER_RETIREMENT_AGE = 60;

/**
 * Add the canonical Manager lifespan without erasing legacy progress. Older
 * saves derive their current age from total completed career seasons.
 */
export function synchronizeSchema41ManagerAge(save: SaveGame): void {
  if (save.mode !== 'manager') return;
  const completedSeasons = Math.max(0, Math.floor(save.careerSeasons ?? 0));
  const inferredAge = Math.min(MANAGER_RETIREMENT_AGE, MANAGER_START_AGE + completedSeasons);
  const currentAge = Number.isFinite(save.managerAge) ? Math.floor(save.managerAge!) : inferredAge;
  save.managerAge = Math.max(MANAGER_START_AGE, Math.min(MANAGER_RETIREMENT_AGE, currentAge));
  save.managerRetired = Boolean(save.managerRetired || save.managerAge >= MANAGER_RETIREMENT_AGE);
}
