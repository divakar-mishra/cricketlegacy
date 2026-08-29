import { SaveGame } from '../domain/types';
import { synchronizeManagerClubSponsorshipOwnership } from '../game/sponsorship';

/** Move Manager earned sponsorship from the save/manager onto its signing club. */
export function synchronizeSchema36State(save: SaveGame): void {
  synchronizeManagerClubSponsorshipOwnership(save);
}
