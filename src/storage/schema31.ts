import { SaveGame } from '../domain/types';
import { synchronizeDomesticTeamShortNames } from '../game/domesticBranding';

/** Replace generated tier/slot codes such as BS31 with ordinary club initials. */
export function synchronizeSchema31State(save: SaveGame): void {
  synchronizeDomesticTeamShortNames(save);
}
