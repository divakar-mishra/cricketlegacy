import type { ImageSourcePropType } from 'react-native';
import type { AvatarCustomization } from '../domain/types';
import { avatarAssetMetadata, avatarAssetSources } from './generated/avatarAssets.generated';
import { avatarPresets } from './generated/avatarPresets.generated';
import type {
  AvatarAssetCategory,
  AvatarAssetMetadata,
  AvatarConfig,
  AvatarLayerRole,
  AvatarPreset,
  AvatarRigId,
  AvatarSex,
} from './types';

const SEXES: readonly AvatarSex[] = ['male', 'female'];
const RIGS: readonly AvatarRigId[] = ['narrow', 'medium', 'wide'];

const catalogAssets = avatarAssetMetadata as readonly AvatarAssetMetadata[];
const assetById = new Map<string, AvatarAssetMetadata>(
  catalogAssets.map((asset) => [asset.id, asset]),
);

export const DEFAULT_AVATAR_CONFIGS: Readonly<Record<AvatarSex, AvatarConfig>> = {
  male: {
    sex: 'male',
    rigId: 'medium',
    baseFaceId: 'base_male_medium_tan',
    eyeColorId: 'eyes_male_medium_brown',
    hairBackId: 'hair_male_medium_short_fade_back',
    hairFrontId: 'hair_male_medium_short_fade_front',
    beardId: 'beard_none',
    moustacheId: 'moustache_none',
    headwearId: 'headwear_none',
    outfitId: 'outfit_white',
  },
  female: {
    sex: 'female',
    rigId: 'medium',
    baseFaceId: 'base_female_medium_tan',
    eyeColorId: 'eyes_female_medium_brown',
    hairBackId: 'hair_female_medium_bob_cut_back',
    hairFrontId: 'hair_female_medium_bob_cut_front',
    beardId: 'beard_none',
    moustacheId: 'moustache_none',
    headwearId: 'headwear_none',
    outfitId: 'outfit_white',
  },
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = { ...DEFAULT_AVATAR_CONFIGS.male };

function isSex(value: unknown): value is AvatarSex {
  return typeof value === 'string' && SEXES.includes(value as AvatarSex);
}

function isRig(value: unknown): value is AvatarRigId {
  return typeof value === 'string' && RIGS.includes(value as AvatarRigId);
}

function semanticPart(id: string | undefined, layer: AvatarLayerRole): string | undefined {
  if (!id) return undefined;
  if (id === 'empty_back' || id === 'empty_front') return 'none';
  if (id === 'beard_none' || id === 'moustache_none' || id === 'headwear_none') return 'none';
  switch (layer) {
    case 'base':
      return id.match(/^base_(?:male|female)_(?:narrow|medium|wide)_(.+)$/)?.[1];
    case 'eyes':
      return id.match(/^eyes_(?:male|female)_(?:narrow|medium|wide)_(.+)$/)?.[1];
    case 'hairBack':
      return id.match(/^hair_(?:male|female)_(?:narrow|medium|wide)_(.+)_back$/)?.[1];
    case 'hairFront':
      return id.match(/^hair_(?:male|female)_(?:narrow|medium|wide)_(.+)_front$/)?.[1];
    case 'beard':
      return id.match(/^beard_(?:narrow|medium|wide)_(.+)$/)?.[1];
    case 'moustache':
      return id.match(/^moustache_(?:narrow|medium|wide)_(.+)$/)?.[1];
    case 'headwear':
      return id.match(/^headwear_(?:narrow|medium|wide)_(.+)$/)?.[1];
    case 'outfit':
      return id.match(/^outfit_(.+)$/)?.[1];
  }
}

function compatibleAssets(
  layer: AvatarLayerRole,
  sex: AvatarSex,
  rig: AvatarRigId,
): AvatarAssetMetadata[] {
  return catalogAssets.filter((asset) => {
    if (asset.layer !== layer) return false;
    if (asset.sex && asset.sex !== sex) return false;
    if (asset.rig && asset.rig !== rig) return false;
    return true;
  });
}

function resolveAssetId(
  requestedId: string | undefined,
  layer: AvatarLayerRole,
  sex: AvatarSex,
  rig: AvatarRigId,
  fallbackId: string,
): string {
  const candidates = compatibleAssets(layer, sex, rig);
  if (requestedId && candidates.some((asset) => asset.id === requestedId)) return requestedId;

  const semantic = semanticPart(requestedId, layer);
  const equivalent = semantic
    ? candidates.find((asset) => semanticPart(asset.id, layer) === semantic)
    : undefined;
  if (equivalent) return equivalent.id;
  if (candidates.some((asset) => asset.id === fallbackId)) return fallbackId;
  return candidates[0]?.id ?? fallbackId;
}

export function avatarAsset(id: string | undefined): AvatarAssetMetadata | undefined {
  return id ? assetById.get(id) : undefined;
}

export function avatarAssetSource(id: string | undefined): ImageSourcePropType | undefined {
  return id ? avatarAssetSources[id] : undefined;
}

export function avatarPresetsForSex(sex: AvatarSex): readonly AvatarPreset[] {
  return avatarPresets.filter((preset) => preset.sex === sex);
}

export function avatarOptions(
  layer: AvatarLayerRole,
  sex: AvatarSex,
  rig: AvatarRigId,
): readonly AvatarAssetMetadata[] {
  const options = compatibleAssets(layer, sex, rig);
  if (layer === 'hairBack' || layer === 'hairFront') {
    return options.filter((asset) => asset.id !== 'empty_back' && asset.id !== 'empty_front');
  }
  return options;
}

export function avatarOptionLabel(id: string): string {
  if (id === 'beard_none' || id === 'moustache_none' || id === 'headwear_none') return 'None';
  const asset = avatarAsset(id);
  const semantic = asset ? semanticPart(id, asset.layer) : undefined;
  return (semantic ?? id)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeAvatarConfig(input?: Partial<AvatarConfig> | null): AvatarConfig {
  const sex = isSex(input?.sex) ? input.sex : 'male';
  const rigId = isRig(input?.rigId) ? input.rigId : 'medium';
  const fallback = DEFAULT_AVATAR_CONFIGS[sex];
  const hairFrontId = resolveAssetId(
    input?.hairFrontId ?? input?.hairBackId,
    'hairFront',
    sex,
    rigId,
    fallback.hairFrontId,
  );
  const hairBackId = resolveAssetId(
    input?.hairBackId ?? hairFrontId,
    'hairBack',
    sex,
    rigId,
    fallback.hairBackId,
  );

  return {
    sex,
    rigId,
    baseFaceId: resolveAssetId(input?.baseFaceId, 'base', sex, rigId, fallback.baseFaceId),
    eyeColorId: resolveAssetId(input?.eyeColorId, 'eyes', sex, rigId, fallback.eyeColorId),
    hairBackId,
    hairFrontId,
    beardId:
      sex === 'female'
        ? 'beard_none'
        : resolveAssetId(input?.beardId, 'beard', sex, rigId, fallback.beardId),
    moustacheId:
      sex === 'female'
        ? 'moustache_none'
        : resolveAssetId(input?.moustacheId, 'moustache', sex, rigId, fallback.moustacheId),
    headwearId: resolveAssetId(
      input?.headwearId,
      'headwear',
      sex,
      rigId,
      fallback.headwearId,
    ),
    outfitId: resolveAssetId(input?.outfitId, 'outfit', sex, rigId, fallback.outfitId),
    ...(input?.frameId ? { frameId: input.frameId } : {}),
  };
}

export function isValidAvatarConfig(input: AvatarConfig): boolean {
  const normalized = normalizeAvatarConfig(input);
  return (
    input.sex === normalized.sex &&
    input.rigId === normalized.rigId &&
    input.baseFaceId === normalized.baseFaceId &&
    input.eyeColorId === normalized.eyeColorId &&
    input.hairBackId === normalized.hairBackId &&
    input.hairFrontId === normalized.hairFrontId &&
    input.beardId === normalized.beardId &&
    input.moustacheId === normalized.moustacheId &&
    input.headwearId === normalized.headwearId &&
    input.outfitId === normalized.outfitId
  );
}

export function avatarFromPreset(preset: AvatarPreset, frameId?: string): AvatarConfig {
  return normalizeAvatarConfig({ ...preset, ...(frameId ? { frameId } : {}) });
}

export function switchAvatarRig(config: AvatarConfig, rigId: AvatarRigId): AvatarConfig {
  return normalizeAvatarConfig({ ...config, rigId });
}

export function switchAvatarSex(config: AvatarConfig, sex: AvatarSex): AvatarConfig {
  if (config.sex === sex) return normalizeAvatarConfig(config);
  const target = DEFAULT_AVATAR_CONFIGS[sex];
  return normalizeAvatarConfig({
    ...config,
    sex,
    baseFaceId: resolveAssetId(config.baseFaceId, 'base', sex, config.rigId, target.baseFaceId),
    eyeColorId: resolveAssetId(config.eyeColorId, 'eyes', sex, config.rigId, target.eyeColorId),
    hairBackId: target.hairBackId,
    hairFrontId: target.hairFrontId,
    beardId: 'beard_none',
    moustacheId: 'moustache_none',
  });
}

export function selectAvatarAsset(config: AvatarConfig, id: string): AvatarConfig {
  const asset = avatarAsset(id);
  if (!asset) return normalizeAvatarConfig(config);
  if (asset.layer === 'base') return normalizeAvatarConfig({ ...config, baseFaceId: id });
  if (asset.layer === 'eyes') return normalizeAvatarConfig({ ...config, eyeColorId: id });
  if (asset.layer === 'hairBack' || asset.layer === 'hairFront') {
    const style = semanticPart(id, asset.layer);
    const back = compatibleAssets('hairBack', config.sex, config.rigId).find(
      (candidate) => semanticPart(candidate.id, 'hairBack') === style,
    );
    const front = compatibleAssets('hairFront', config.sex, config.rigId).find(
      (candidate) => semanticPart(candidate.id, 'hairFront') === style,
    );
    return normalizeAvatarConfig({
      ...config,
      hairBackId: back?.id ?? config.hairBackId,
      hairFrontId: front?.id ?? config.hairFrontId,
    });
  }
  if (asset.layer === 'beard') return normalizeAvatarConfig({ ...config, beardId: id });
  if (asset.layer === 'moustache') return normalizeAvatarConfig({ ...config, moustacheId: id });
  if (asset.layer === 'headwear') return normalizeAvatarConfig({ ...config, headwearId: id });
  return normalizeAvatarConfig({ ...config, outfitId: id });
}

export function randomAvatarConfig(
  sex: AvatarSex = Math.random() < 0.5 ? 'male' : 'female',
  random: () => number = Math.random,
  frameId?: string,
): AvatarConfig {
  const presets = avatarPresetsForSex(sex);
  const index = Math.min(presets.length - 1, Math.floor(Math.max(0, random()) * presets.length));
  return avatarFromPreset(presets[Math.max(0, index)], frameId);
}

export interface ResolvedAvatarLayers {
  hairBack?: string;
  outfit: string;
  base: string;
  eyes: string;
  hairFront?: string;
  beard?: string;
  moustache?: string;
  headwear?: string;
}

export function resolveAvatarLayers(config: AvatarConfig): ResolvedAvatarLayers {
  const safe = normalizeAvatarConfig(config);
  const headwear = avatarAsset(safe.headwearId);
  const hideHair = Boolean(headwear?.hidesHair && safe.headwearId !== 'headwear_none');
  return {
    ...(hideHair ? {} : { hairBack: safe.hairBackId, hairFront: safe.hairFrontId }),
    outfit: safe.outfitId,
    base: safe.baseFaceId,
    eyes: safe.eyeColorId,
    ...(safe.beardId === 'beard_none' ? {} : { beard: safe.beardId }),
    ...(safe.moustacheId === 'moustache_none' ? {} : { moustache: safe.moustacheId }),
    ...(safe.headwearId === 'headwear_none' ? {} : { headwear: safe.headwearId }),
  };
}

export function outfitForKitId(kitId?: string): string {
  if (!kitId) return 'outfit_white';
  if (kitId.includes('red')) return 'outfit_red';
  if (kitId.includes('green')) return 'outfit_green';
  if (kitId.includes('gold') || kitId.includes('yellow') || kitId.includes('orange')) {
    return 'outfit_yellow';
  }
  if (kitId.includes('black') || kitId.includes('noir')) return 'outfit_default_black';
  if (kitId.includes('white')) return 'outfit_white';
  return 'outfit_blue';
}

function legacySkinTone(color: string | undefined): string {
  const normalized = color?.toUpperCase();
  if (normalized === '#F2C7A5') return 'light';
  if (normalized === '#DFA477') return 'tan';
  if (normalized === '#B97850') return 'medium';
  return 'deep';
}

function legacyEyeColor(color: string | undefined): string {
  const normalized = color?.toUpperCase();
  if (normalized === '#3E5638') return 'green';
  if (normalized === '#314E63') return 'blue';
  if (normalized === '#5A3825') return 'brown';
  return 'dark_brown';
}

/** Converts the former SVG controls without mutating or discarding the old fields. */
export function avatarFromLegacy(
  legacy?: Partial<AvatarCustomization> | null,
  kitId?: string,
  frameId?: string,
): AvatarConfig {
  const rigId: AvatarRigId =
    legacy?.faceShape === 'round' ? 'wide' : legacy?.faceShape === 'angular' ? 'narrow' : 'medium';
  const hairStyle =
    legacy?.hairStyle === 'crop'
      ? 'textured_crop'
      : legacy?.hairStyle === 'swept'
        ? 'swept_medium'
        : legacy?.hairStyle === 'curly'
          ? 'pompadour'
          : legacy?.hairStyle === 'bald'
            ? 'none'
            : 'short_fade';
  const hairBackId =
    hairStyle === 'none' ? 'empty_back' : `hair_male_${rigId}_${hairStyle}_back`;
  const hairFrontId =
    hairStyle === 'none' ? 'empty_front' : `hair_male_${rigId}_${hairStyle}_front`;
  const beardStyle =
    legacy?.facialHair === 'full_beard'
      ? 'full_beard'
      : legacy?.facialHair === 'short_beard'
        ? 'short_boxed'
        : legacy?.facialHair === 'stubble'
          ? 'stubble'
          : 'none';
  const moustacheStyle =
    legacy?.moustache === 'handlebar'
      ? 'handlebar'
      : legacy?.moustache === 'classic'
        ? 'chevron'
        : 'none';

  return normalizeAvatarConfig({
    sex: 'male',
    rigId,
    baseFaceId: `base_male_${rigId}_${legacySkinTone(legacy?.skinTone)}`,
    eyeColorId: `eyes_male_${rigId}_${legacyEyeColor(legacy?.eyeColor)}`,
    hairBackId,
    hairFrontId,
    beardId: beardStyle === 'none' ? 'beard_none' : `beard_${rigId}_${beardStyle}`,
    moustacheId:
      moustacheStyle === 'none' ? 'moustache_none' : `moustache_${rigId}_${moustacheStyle}`,
    headwearId: 'headwear_none',
    outfitId: outfitForKitId(kitId),
    ...(frameId ? { frameId } : {}),
  });
}

export function avatarCategoryForLayer(layer: AvatarLayerRole): AvatarAssetCategory {
  if (layer === 'hairBack' || layer === 'hairFront') return 'hair';
  if (layer === 'beard') return 'beards';
  if (layer === 'moustache') return 'moustaches';
  if (layer === 'outfit') return 'outfits';
  return layer;
}
