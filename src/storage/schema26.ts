import { SaveGame } from '../domain/types';
import { activateCareerPathTeam, activateSeniorDomesticContract } from '../game/youthFixtures';

/**
 * v26 separates the active School/U19 XI from the reserved Tier 3 club and
 * removes hidden-potential labels from persisted scout reports.
 */
export function synchronizeSchema26State(save: SaveGame): void {
  for (const report of save.scoutReports ?? []) {
    delete (report as unknown as { potentialBand?: string }).potentialBand;
    const player = save.players[report.playerId];
    if (player && report.uncertainty < 0.4) {
      report.recommended = player.overall >= 68 && player.meta.form >= 42;
    }
  }

  if (save.mode !== 'career' || !save.userPlayerId || !save.userTeamId) return;
  if (save.careerPathLevel === 'SCHOOL' || save.careerPathLevel === 'U19') {
    activateCareerPathTeam(save, save.careerPathLevel);
  } else {
    activateSeniorDomesticContract(save);
  }
}
