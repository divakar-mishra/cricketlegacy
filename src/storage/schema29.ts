import { SaveGame } from '../domain/types';

/**
 * Begin exact current-season format ledgers. Historical mixed-format season
 * totals cannot be split reliably, so migration never fabricates allocations.
 */
export function synchronizeSchema29State(save: SaveGame): void {
  for (const player of Object.values(save.players ?? {})) {
    player.seasonFormatStats ??= {};
  }
}
