import type { ImageSourcePropType } from 'react-native';
import { portraitAssetMetadata, portraitAssetSources } from './generated/portraitAssets.generated';
import type { AvatarConfig, AvatarSex, AvatarToneBand, PortraitAssetMetadata } from './types';

const SEXES: readonly AvatarSex[] = ['male', 'female'];
export const AVATAR_TONE_BANDS: readonly AvatarToneBand[] = [1, 2, 3, 4, 5, 6, 7, 8];

const portraits = (portraitAssetMetadata as readonly PortraitAssetMetadata[])
  .slice()
  .sort((left, right) => left.index - right.index);
const portraitById = new Map<string, PortraitAssetMetadata>(
  portraits.map((portrait) => [portrait.id, portrait]),
);

export const DEFAULT_AVATAR_CONFIGS: Readonly<Record<AvatarSex, AvatarConfig>> = {
  male: { sex: 'male', portraitId: 'portrait_male_025' },
  female: { sex: 'female', portraitId: 'portrait_female_025' },
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = { ...DEFAULT_AVATAR_CONFIGS.male };

type UnknownAvatarRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownAvatarRecord {
  return value && typeof value === 'object' ? (value as UnknownAvatarRecord) : {};
}

function isSex(value: unknown): value is AvatarSex {
  return typeof value === 'string' && SEXES.includes(value as AvatarSex);
}

function inferSex(record: UnknownAvatarRecord): AvatarSex {
  const requestedPortrait =
    typeof record.portraitId === 'string' ? portraitById.get(record.portraitId) : undefined;
  if (requestedPortrait) return requestedPortrait.sex;
  if (isSex(record.sex)) return record.sex;
  if (typeof record.portraitId === 'string' && record.portraitId.includes('_female_')) {
    return 'female';
  }
  if (typeof record.baseFaceId === 'string' && record.baseFaceId.includes('_female_')) {
    return 'female';
  }
  return 'male';
}

function frameFrom(record: UnknownAvatarRecord): string | undefined {
  return typeof record.frameId === 'string' && record.frameId.length > 0
    ? record.frameId
    : undefined;
}

function legacyToneBand(record: UnknownAvatarRecord): AvatarToneBand {
  const baseFaceId = typeof record.baseFaceId === 'string' ? record.baseFaceId : '';
  if (baseFaceId.endsWith('_light')) return 2;
  if (baseFaceId.endsWith('_tan')) return 4;
  if (baseFaceId.endsWith('_medium')) return 6;
  if (baseFaceId.endsWith('_deep')) return 8;

  const skinTone = typeof record.skinTone === 'string' ? record.skinTone.toUpperCase() : '';
  if (skinTone === '#F2C7A5' || skinTone === '#F2C6A8') return 2;
  if (skinTone === '#DFA477' || skinTone === '#D99A72') return 4;
  if (skinTone === '#B97850' || skinTone === '#AE694B') return 6;
  if (skinTone === '#8C5439' || skinTone === '#74402E') return 8;
  return 4;
}

/** Stable FNV-1a hash used only to make legacy migration repeatable. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function legacyIdentityKey(record: UnknownAvatarRecord, sex: AvatarSex): string {
  return [
    sex,
    record.baseFaceId,
    record.eyeColorId,
    record.hairBackId,
    record.hairFrontId,
    record.beardId,
    record.moustacheId,
    record.headwearId,
    record.skinTone,
    record.faceShape,
    record.hairStyle,
    record.hairColor,
    record.facialHair,
    record.moustache,
    record.eyeColor,
    record.browStyle,
  ].join('|');
}

export function portraitMetadata(id: string | undefined): PortraitAssetMetadata | undefined {
  return id ? portraitById.get(id) : undefined;
}

export function portraitAssetSource(id: string | undefined): ImageSourcePropType | undefined {
  return id ? portraitAssetSources[id] : undefined;
}

export function portraitsForSex(sex: AvatarSex): readonly PortraitAssetMetadata[] {
  return portraits.filter((portrait) => portrait.sex === sex);
}

export function portraitsForTone(
  sex: AvatarSex,
  toneBand: AvatarToneBand,
): readonly PortraitAssetMetadata[] {
  return portraits.filter((portrait) => portrait.sex === sex && portrait.toneBand === toneBand);
}

function portraitForLegacy(record: UnknownAvatarRecord, sex: AvatarSex): PortraitAssetMetadata {
  const toneBand = legacyToneBand(record);
  const candidates = portraitsForTone(sex, toneBand);
  const fallbackCandidates = portraitsForSex(sex);
  const pool = candidates.length > 0 ? candidates : fallbackCandidates;
  const fallback = portraitById.get(DEFAULT_AVATAR_CONFIGS[sex].portraitId) ?? pool[0];
  if (!fallback || pool.length === 0) {
    throw new Error(`Portrait registry has no ${sex} assets.`);
  }
  return pool[stableHash(legacyIdentityKey(record, sex)) % pool.length] ?? fallback;
}

/**
 * Normalizes current saves and deterministically upgrades the former modular
 * avatar recipe without keeping its component asset IDs alive at runtime.
 */
export function normalizeAvatarConfig(input?: unknown): AvatarConfig {
  const record = asRecord(input);
  const frameId = frameFrom(record);
  const requested =
    typeof record.portraitId === 'string' ? portraitById.get(record.portraitId) : undefined;
  if (requested) {
    return {
      sex: requested.sex,
      portraitId: requested.id,
      ...(frameId ? { frameId } : {}),
    };
  }

  const sex = inferSex(record);
  const hasLegacyIdentity = [
    'baseFaceId',
    'hairFrontId',
    'skinTone',
    'faceShape',
    'hairStyle',
  ].some((key) => record[key] != null);
  const selected = hasLegacyIdentity
    ? portraitForLegacy(record, sex)
    : (portraitById.get(DEFAULT_AVATAR_CONFIGS[sex].portraitId) ?? portraitsForSex(sex)[0]);
  if (!selected) throw new Error(`Portrait registry has no ${sex} default.`);

  return {
    sex: selected.sex,
    portraitId: selected.id,
    ...(frameId ? { frameId } : {}),
  };
}

export function isValidAvatarConfig(input: AvatarConfig): boolean {
  const portrait = portraitMetadata(input.portraitId);
  return Boolean(portrait && portrait.sex === input.sex);
}

export function portraitToneBand(config: AvatarConfig): AvatarToneBand {
  return portraitMetadata(normalizeAvatarConfig(config).portraitId)?.toneBand ?? 4;
}

export function selectPortrait(config: AvatarConfig, portraitId: string): AvatarConfig {
  const portrait = portraitMetadata(portraitId);
  if (!portrait) return normalizeAvatarConfig(config);
  return {
    sex: portrait.sex,
    portraitId: portrait.id,
    ...(config.frameId ? { frameId: config.frameId } : {}),
  };
}

export function switchAvatarSex(config: AvatarConfig, sex: AvatarSex): AvatarConfig {
  const safe = normalizeAvatarConfig(config);
  if (safe.sex === sex) return safe;
  const current = portraitMetadata(safe.portraitId);
  const counterpart = current
    ? portraitsForSex(sex).find((portrait) => portrait.index === current.index)
    : undefined;
  const target = counterpart ?? portraitForLegacy(asRecord(safe), sex);
  return {
    sex,
    portraitId: target.id,
    ...(safe.frameId ? { frameId: safe.frameId } : {}),
  };
}

export function randomAvatarConfig(
  sex: AvatarSex = Math.random() < 0.5 ? 'male' : 'female',
  random: () => number = Math.random,
  frameId?: string,
): AvatarConfig {
  const options = portraitsForSex(sex);
  const bounded = Math.max(0, Math.min(0.999999999, random()));
  const portrait = options[Math.floor(bounded * options.length)] ?? options[0];
  if (!portrait) throw new Error(`Portrait registry has no ${sex} assets.`);
  return {
    sex,
    portraitId: portrait.id,
    ...(frameId ? { frameId } : {}),
  };
}

/** Gives generated/NPC players a repeatable portrait without adding save data. */
export function avatarFromSeed(
  seed: string,
  sex: AvatarSex = 'male',
  frameId?: string,
): AvatarConfig {
  // The final two identities in each tone band are mature manager-age
  // portraits. Generated squad players use the first six so active players
  // are not assigned visibly older faces.
  const options = portraitsForSex(sex).filter((portrait) => (portrait.index - 1) % 8 < 6);
  const portrait = options[stableHash(`${sex}|${seed}`) % options.length] ?? options[0];
  if (!portrait) throw new Error(`Portrait registry has no ${sex} assets.`);
  return {
    sex,
    portraitId: portrait.id,
    ...(frameId ? { frameId } : {}),
  };
}

export function portraitOptionLabel(portrait: PortraitAssetMetadata | string): string {
  const metadata = typeof portrait === 'string' ? portraitMetadata(portrait) : portrait;
  return metadata ? `Portrait ${String(metadata.index).padStart(2, '0')}` : 'Portrait';
}
