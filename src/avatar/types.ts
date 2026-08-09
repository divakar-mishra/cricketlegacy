export type AvatarSex = 'male' | 'female';

export type AvatarRigId = 'narrow' | 'medium' | 'wide';

export type AvatarLayerRole =
  'hairBack' | 'outfit' | 'base' | 'eyes' | 'hairFront' | 'beard' | 'moustache' | 'headwear';

export type AvatarAssetCategory =
  'base' | 'eyes' | 'hair' | 'beards' | 'moustaches' | 'headwear' | 'outfits';

/** Stable IDs only. Image modules and paths are intentionally never persisted. */
export interface AvatarConfig {
  sex: AvatarSex;
  rigId: AvatarRigId;
  baseFaceId: string;
  eyeColorId: string;
  hairBackId: string;
  hairFrontId: string;
  beardId: string;
  moustacheId: string;
  headwearId: string;
  outfitId: string;
  frameId?: string;
}

export interface AvatarPreset extends AvatarConfig {
  id: string;
}

export interface AvatarAssetMetadata {
  id: string;
  category: AvatarAssetCategory;
  layer: AvatarLayerRole;
  sex?: AvatarSex;
  rig?: AvatarRigId;
  hidesHair?: boolean;
}
