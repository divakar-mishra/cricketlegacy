import { SaveGame } from '../domain/types';
import { synchronizeManagerClubState } from '../game/managerClubState';

/** Move Manager infrastructure into per-club records without changing balances. */
export function synchronizeSchema35State(save: SaveGame): void {
  synchronizeManagerClubState(save);
}
