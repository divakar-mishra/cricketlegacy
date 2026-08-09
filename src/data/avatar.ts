import type { AvatarCustomization } from '../domain/types';

/**
 * Schema-17 rollback source only. New UI and saves use AvatarConfig asset IDs.
 * Keep this shape until support for pre-schema-30 saves is intentionally retired.
 */
export const DEFAULT_AVATAR_CUSTOMIZATION: AvatarCustomization = {
  skinTone: '#B97850',
  faceShape: 'oval',
  hairStyle: 'short',
  hairColor: '#17130F',
  facialHair: 'none',
  moustache: 'none',
  eyeColor: '#2A1B12',
  browStyle: 'straight',
};
