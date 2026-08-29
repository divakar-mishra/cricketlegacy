import { normalizeAvatarConfig } from '../avatar';
import type { SaveGame } from '../domain/types';

type LegacyAvatarCosmetics = NonNullable<SaveGame['cosmetics']> & {
  avatarConfig?: unknown;
  avatarCustomization?: Record<string, unknown>;
};

/** Idempotent schema-32 synchronization for the fixed 128-portrait library. */
export function synchronizeSchema32State(save: SaveGame): void {
  if (save.mode !== 'career') return;
  save.cosmetics ??= {
    avatar: 'avatar_custom',
    kit: 'kit_white',
    celebration: 'cel_wave',
  };

  const cosmetics = save.cosmetics as LegacyAvatarCosmetics;
  const legacyConfig = cosmetics.avatarConfig as
    (Record<string, unknown> & { frameId?: string }) | undefined;
  const frameId = cosmetics.profileFrame ?? legacyConfig?.frameId;
  const source = legacyConfig ?? cosmetics.avatarCustomization;

  cosmetics.avatar = 'avatar_custom';
  cosmetics.avatarConfig = normalizeAvatarConfig({
    ...(source ?? {}),
    ...(frameId ? { frameId } : {}),
  });

  // The fixed portrait ID is now canonical. Do not keep writing the retired
  // SVG customization recipe into every subsequent save.
  delete cosmetics.avatarCustomization;
}
