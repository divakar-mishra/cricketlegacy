import { SaveGame } from '../domain/types';
import { ensureSeasonPassExperience } from '../game/seasonPass';

/** Idempotent schema-18 defaults for monthly pass content and Manager spending. */
export function synchronizeSchema18State(save: SaveGame): void {
  ensureSeasonPassExperience(save, save.pass?.seasonId);
  if (save.mode !== 'manager') return;
  save.managerResources ??= {
    totalCoinsSpent: 0,
    totalGemsSpent: 0,
    transactions: [],
  };
  save.managerResources.totalCoinsSpent = Math.max(0, save.managerResources.totalCoinsSpent ?? 0);
  save.managerResources.totalGemsSpent = Math.max(0, save.managerResources.totalGemsSpent ?? 0);
  save.managerResources.transactions = [...(save.managerResources.transactions ?? [])].slice(-60);
}
