import type { SaveGame } from '../domain/types';

/**
 * Split Player Career's domestic and franchise affiliations without rewriting
 * any historical fixture, result, roster or statistic. Existing careers begin
 * with their current club as both affiliations and can separate them through
 * future offers.
 */
export function synchronizeSchema40PlayerAffiliations(save: SaveGame): void {
  if (save.mode !== 'career') return;
  const current = save.userTeamId;
  if (!save.franchiseTeamId || !save.teams?.[save.franchiseTeamId]) {
    save.franchiseTeamId = current;
  }
}
