import type { SaveGame } from '../domain/types';
import { synchronizeU19WorldCupState } from '../game/u19WorldCup';

/**
 * Initialise the protagonist's single, fixture-backed U19 World Cup journey.
 * Existing U19 path totals become the starting merit snapshot; no senior cap,
 * reputation, wallet, result or ordinary career-path value is changed.
 */
export function synchronizeSchema33State(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  synchronizeU19WorldCupState(save);
}
