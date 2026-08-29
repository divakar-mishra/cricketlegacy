import type { SaveGame } from '../domain/types';
import {
  defaultShirtName,
  defaultShirtNumber,
  normalizeShirtName,
  normalizeShirtNumber,
} from '../game/kitIdentity';

/** Add a persistent, user-editable back name and number to Player Career kits. */
export function synchronizeSchema39KitIdentity(save: SaveGame): void {
  if (save.mode !== 'career') return;
  save.cosmetics ??= {
    avatar: 'avatar_custom',
    kit: 'kit_white',
    celebration: 'cel_wave',
  };
  const player = save.userPlayerId ? save.players?.[save.userPlayerId] : undefined;
  save.cosmetics.shirtName = normalizeShirtName(
    save.cosmetics.shirtName ?? defaultShirtName(player?.name),
    player?.name,
  );
  save.cosmetics.shirtNumber = normalizeShirtNumber(
    save.cosmetics.shirtNumber ?? defaultShirtNumber(player?.id),
    player?.id,
  );
}
