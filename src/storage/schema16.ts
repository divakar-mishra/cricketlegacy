import { SaveGame } from '../domain/types';
import { ensureArchetypeJourney } from '../game/careerArchetypes';
import { synchronizeSeasonPassBranding } from '../game/domesticBranding';
import { ensureManagerDepth } from '../game/manager';

/** Idempotent schema-16 defaults for career depth, branding and manager staff. */
export function synchronizeSchema16State(save: SaveGame): void {
  if (save.mode === 'career') ensureArchetypeJourney(save);
  if (save.mode === 'manager') ensureManagerDepth(save);
  synchronizeSeasonPassBranding(save);
}
