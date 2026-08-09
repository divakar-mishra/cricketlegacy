import { avatarFromLegacy, normalizeAvatarConfig } from '../avatar';
import type { SaveGame } from '../domain/types';

/** Idempotent schema-30 synchronization for supplied modular player portraits. */
export function synchronizeSchema30State(save: SaveGame): void {
  if (save.mode !== 'career') return;
  save.cosmetics ??= {
    avatar: 'avatar_custom',
    kit: 'kit_white',
    celebration: 'cel_wave',
  };

  const frameId = save.cosmetics.profileFrame;
  save.cosmetics.avatarConfig = save.cosmetics.avatarConfig
    ? normalizeAvatarConfig({
        ...save.cosmetics.avatarConfig,
        ...(frameId ? { frameId } : {}),
      })
    : avatarFromLegacy(save.cosmetics.avatarCustomization, save.cosmetics.kit, frameId);
}
