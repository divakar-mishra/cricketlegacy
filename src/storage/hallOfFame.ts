/**
 * Persistence for the cross-career Hall of Fame. Stored under its OWN key,
 * OUTSIDE the `sg:` save slots, so it survives deleting a save or starting a new
 * career — that is what makes all-time high scores durable across careers.
 */
import { SaveGame } from '../domain/types';
import { coerceHallOfFame, HallOfFame, mergeSaveIntoHallOfFame } from '../game/hallOfFame';
import { getJSON, setJSON } from './storage';

export const HOF_KEY = 'hof:v1';

export async function loadHallOfFame(): Promise<HallOfFame> {
  return coerceHallOfFame(await getJSON<unknown>(HOF_KEY));
}

export async function saveHallOfFame(hof: HallOfFame): Promise<void> {
  await setJSON(HOF_KEY, hof);
}

/** Merge the current standing of a save into the all-time board and persist it. */
export async function ingestSaveIntoHallOfFame(save: SaveGame): Promise<HallOfFame> {
  const hof = mergeSaveIntoHallOfFame(await loadHallOfFame(), save);
  await saveHallOfFame(hof);
  return hof;
}
