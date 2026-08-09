import { SaveGame } from '../domain/types';
import { ensurePlayerLifeState } from '../game/playerLife';

/** Initialize the consolidated Player Life simulation without changing money. */
export function synchronizeSchema28State(save: SaveGame): void {
  if (save.mode === 'career') ensurePlayerLifeState(save);
}
