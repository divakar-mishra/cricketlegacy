import { SaveGame } from '../domain/types';

/** Idempotent defaults for manager calendar workload state. */
export function synchronizeSchema19State(save: SaveGame): void {
  if (!save.managerCalendar) return;
  for (const player of Object.values(save.players ?? {})) {
    player.condition = Math.max(0, Math.min(100, player.condition ?? 100));
  }
  if (save.managerCareerLevel === 'NATIONAL') {
    save.managerWonTierOneFirstClass = true;
  }
}
