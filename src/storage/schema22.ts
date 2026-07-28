import { SaveGame } from '../domain/types';

/** Initialize the lifetime-cap baseline used for season-delta retirement checks. */
export function synchronizeSchema22State(save: SaveGame): void {
  if (save.mode !== 'career') return;
  save.userCapsAtSeasonStart ??= save.userCaps ?? 0;
}

