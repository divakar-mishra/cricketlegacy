import type { SaveGame } from '../domain/types';
import { managerClubOperationsPaused } from './managerClubState';

/** Call only after live server authorization. Max-based grants make retry safe. */
export function applyReviewerSupplies(save: SaveGame, energyCap: number): boolean {
  if (save.mode === 'manager') {
    if (managerClubOperationsPaused(save)) return false;
    save.inventory = {
      ...save.inventory,
      scout_full_reveal_token: Math.max(1, save.inventory?.scout_full_reveal_token ?? 0),
      squad_recovery_token: Math.max(1, save.inventory?.squad_recovery_token ?? 0),
    };
    return true;
  }
  if (save.mode !== 'career' || !save.userPlayerId) return false;
  const player = save.players[save.userPlayerId];
  if (!player) return false;
  player.meta.form = Math.max(99, player.meta.form);
  player.meta.confidence = Math.max(99, player.meta.confidence);
  save.wallet = {
    ...save.wallet,
    energy: Math.max(energyCap, save.wallet.energy),
    energyUpdatedAt: Date.now(),
  };
  return true;
}
