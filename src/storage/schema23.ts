import { SaveGame } from '../domain/types';

/** Initialize deterministic selection and new-manager transition counters. */
export function synchronizeSchema23State(save: SaveGame): void {
  const resources = save.playerCareerResources;
  if (resources) {
    resources.selectionGuaranteeMatches = Math.max(
      0,
      Math.floor(resources.selectionGuaranteeMatches ?? 0),
    );
    resources.selectionBoostMatches = Math.max(0, Math.floor(resources.selectionBoostMatches ?? 0));
    resources.selectionBoostAmount = Math.max(0, resources.selectionBoostAmount ?? 0);
  }
  if (save.mode === 'manager') {
    save.managerGraceMatchesRemaining = Math.max(
      0,
      Math.floor(save.managerGraceMatchesRemaining ?? 0),
    );
    save.managerMatchesAtCurrentClub = Math.max(
      0,
      Math.floor(save.managerMatchesAtCurrentClub ?? 0),
    );
  }
}
