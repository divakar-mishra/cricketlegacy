import { SaveGame } from '../domain/types';

function defaultManagerSalary(save: SaveGame): number {
  const clubId = save.managerProgression?.currentClubId || save.userTeamId;
  const reputation = clubId ? save.teams[clubId]?.reputation : undefined;
  return Math.round(250_000 + Math.max(0, reputation ?? 40) * 14_000);
}

/** Initialize year-round international state and durable manager contract pay. */
export function synchronizeSchema24State(save: SaveGame): void {
  save.wtcCycles ??= {};

  if (save.playerCareerResources) {
    save.playerCareerResources.internationalSelections ??= {};
  }

  if (save.mode !== 'manager' || !save.managerProgression) return;
  const progression = save.managerProgression;
  if (!Number.isFinite(progression.contractSalary) || (progression.contractSalary ?? 0) <= 0) {
    progression.contractSalary = defaultManagerSalary(save);
  } else {
    progression.contractSalary = Math.round(progression.contractSalary!);
  }
  if (progression.lastSalaryPaidYear !== undefined) {
    progression.lastSalaryPaidYear = Math.floor(progression.lastSalaryPaidYear);
  }
  if (progression.lastSalaryCoinPayout !== undefined) {
    progression.lastSalaryCoinPayout = Math.max(
      0,
      Math.floor(progression.lastSalaryCoinPayout),
    );
  }
}
