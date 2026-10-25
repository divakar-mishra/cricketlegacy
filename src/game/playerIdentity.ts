import { normalizeAvatarConfig } from '../avatar';
import type { AvatarSex } from '../avatar';
import { namePoolFor } from '../data/names';
import type { SaveGame } from '../domain/types';
import { makeRng, pick } from '../engine/rng';

/** A cosmetic change after creation must not silently switch the competition. */
export function playerWorldSex(save: SaveGame): AvatarSex {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (user?.sex) return user.sex;
  return save.mode === 'career' ? normalizeAvatarConfig(save.cosmetics?.avatarConfig).sex : 'male';
}

/** Schema45 did not carry the selected female identity into generated rosters. */
export function synchronizePlayerIdentities(save: SaveGame): void {
  const sex = playerWorldSex(save);
  for (const player of Object.values(save.players ?? {})) {
    if (!player || typeof player !== 'object') continue;
    if (player.id === save.userPlayerId || player.isUserPlayer) {
      player.sex ??= sex;
      continue; // Never rename the user's player.
    }
    if (sex === 'female' && player.sex !== 'female') {
      // Stable identity-only repair. Never consume the gameplay RNG, replace a
      // player ID, reset a stat, rewrite a result, or touch any currency/ownership.
      let seed = 2166136261;
      for (const c of `${save.id}:${player.id}:${player.nationality}`) {
        seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
      }
      const rng = makeRng(seed >>> 0);
      const pool = namePoolFor(player.nationality, 'female');
      player.name = `${pick(pool.first, rng)} ${pick(pool.last, rng)}`;
      player.sex = 'female';
    } else player.sex ??= sex;
  }
}
