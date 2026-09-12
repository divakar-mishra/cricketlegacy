import type { ImageSourcePropType } from 'react-native';
import { layeredHeads, layeredJerseys, kitThumbnails } from './generated/layeredAssets.generated';
import { kitBacks } from './generated/kitBackAssets.generated';

export interface LayeredPortraitArtwork {
  head: ImageSourcePropType;
  jersey: ImageSourcePropType;
}

export function layeredPortraitArtwork(
  portraitId: string,
  kitId?: string,
): LayeredPortraitArtwork | undefined {
  if (!Object.hasOwn(layeredHeads, portraitId) || !kitId || !Object.hasOwn(layeredJerseys, kitId)) return undefined;
  return { head: layeredHeads[portraitId], jersey: layeredJerseys[kitId] };
}

/** The shop shows the same textured jersey used on the player's portrait. */
export function kitThumbnailArtwork(kitId?: string): ImageSourcePropType | undefined {
  return kitId && Object.hasOwn(kitThumbnails, kitId) ? kitThumbnails[kitId] : undefined;
}

export function kitBackArtwork(kitId?: string): ImageSourcePropType | undefined {
  return kitId && Object.hasOwn(kitBacks, kitId) ? kitBacks[kitId] : undefined;
}

/** Registered 3:4 layers, shown in the existing circular portrait viewport. */
export const LAYERED_PORTRAIT_LAYOUT = {
  width: 0.84,
  height: 1.12,
  left: 0.08,
  top: -0.02,
} as const;
