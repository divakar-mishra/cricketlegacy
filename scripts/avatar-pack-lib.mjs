import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptsDir, '..');
export const avatarDataRoot = path.join(repoRoot, 'src', 'avatar', 'data');
export const avatarRuntimeRoot = path.join(repoRoot, 'assets', 'avatar', 'runtime');
export const avatarGeneratedRoot = path.join(repoRoot, 'src', 'avatar', 'generated');

const CONFIG_FIELDS = [
  'sex',
  'rigId',
  'baseFaceId',
  'eyeColorId',
  'hairBackId',
  'hairFrontId',
  'beardId',
  'moustacheId',
  'headwearId',
  'outfitId',
];

function fail(message) {
  throw new Error(`[avatar-pack] ${message}`);
}

function readJson(fileName) {
  const filePath = path.join(avatarDataRoot, fileName);
  if (!fs.existsSync(filePath)) fail(`Missing ${path.relative(repoRoot, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function layerForAsset(asset) {
  switch (asset.category) {
    case 'base':
      return 'base';
    case 'eyes':
      return 'eyes';
    case 'beards':
      return 'beard';
    case 'moustaches':
      return 'moustache';
    case 'headwear':
      return 'headwear';
    case 'outfits':
      return 'outfit';
    case 'hair':
      if (asset.id === 'empty_back' || asset.id.endsWith('_back')) return 'hairBack';
      if (asset.id === 'empty_front' || asset.id.endsWith('_front')) return 'hairFront';
      fail(`Cannot infer a hair layer for ${asset.id}`);
      break;
    default:
      fail(`Unknown category ${asset.category} for ${asset.id}`);
  }
}

function runtimeRelativePath(asset) {
  const prefix = 'png_512/';
  if (!asset.png512?.startsWith(prefix)) fail(`${asset.id} has an invalid png512 path`);
  return asset.png512.slice(prefix.length).replaceAll('/', path.sep);
}

function assertUnique(items, getKey, label) {
  const seen = new Set();
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) fail(`Duplicate ${label}: ${key}`);
    seen.add(key);
  }
}

function readPngInfo(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 26 || data.toString('ascii', 1, 4) !== 'PNG') {
    fail(`${path.relative(repoRoot, filePath)} is not a PNG`);
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const colorType = data[25];
  const hasTransparency = colorType === 4 || colorType === 6 || data.includes(Buffer.from('tRNS'));
  return { width, height, hasTransparency };
}

function assertAssetCompatibility(asset, expected) {
  if (!asset) fail(`Preset references missing asset ${expected.id}`);
  if (asset.category !== expected.category) {
    fail(`${asset.id} is ${asset.category}, expected ${expected.category}`);
  }
  if (expected.sex && asset.sex !== expected.sex) {
    fail(`${asset.id} does not match sex ${expected.sex}`);
  }
  if (expected.rig && asset.rig !== expected.rig) {
    fail(`${asset.id} does not match rig ${expected.rig}`);
  }
}

export function validateAvatarPack({ inspectPngs = true } = {}) {
  const manifest = readJson('manifest.json');
  const presets = readJson('presets_300.json');
  const assets = manifest.assets ?? [];

  if (assets.length !== 186) fail(`Expected 186 assets, received ${assets.length}`);
  if (!Array.isArray(presets) || presets.length !== 300) {
    fail(`Expected 300 presets, received ${presets?.length ?? 0}`);
  }
  assertUnique(assets, (asset) => asset.id, 'asset ID');
  assertUnique(presets, (preset) => preset.id, 'preset ID');
  assertUnique(
    presets,
    (preset) => JSON.stringify(Object.fromEntries(CONFIG_FIELDS.map((field) => [field, preset[field]]))),
    'preset configuration',
  );

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const asset of assets) {
    layerForAsset(asset);
    const filePath = path.join(avatarRuntimeRoot, runtimeRelativePath(asset));
    if (!fs.existsSync(filePath)) fail(`Missing runtime image for ${asset.id}`);
    if (inspectPngs) {
      const png = readPngInfo(filePath);
      if (png.width !== 512 || png.height !== 512) {
        fail(`${asset.id} is ${png.width}x${png.height}, expected 512x512`);
      }
      if (!png.hasTransparency) fail(`${asset.id} does not support transparency`);
    }
    if (asset.category === 'base' && (!asset.sex || !asset.rig)) {
      fail(`${asset.id} base is missing sex or rig`);
    }
  }

  for (const asset of assets.filter((item) => item.category === 'hair')) {
    if (asset.id === 'empty_back' || asset.id === 'empty_front') continue;
    const counterpartId = asset.id.endsWith('_front')
      ? asset.id.replace(/_front$/, '_back')
      : asset.id.replace(/_back$/, '_front');
    if (!assetById.has(counterpartId)) fail(`${asset.id} has no matching hair pair`);
  }

  for (const preset of presets) {
    if (!/^preset_\d{3}$/.test(preset.id)) fail(`Invalid preset ID ${preset.id}`);
    if (!['male', 'female'].includes(preset.sex)) fail(`${preset.id} has invalid sex`);
    if (!['narrow', 'medium', 'wide'].includes(preset.rigId)) fail(`${preset.id} has invalid rig`);
    assertAssetCompatibility(assetById.get(preset.baseFaceId), {
      id: preset.baseFaceId,
      category: 'base',
      sex: preset.sex,
      rig: preset.rigId,
    });
    assertAssetCompatibility(assetById.get(preset.eyeColorId), {
      id: preset.eyeColorId,
      category: 'eyes',
      sex: preset.sex,
      rig: preset.rigId,
    });
    for (const id of [preset.hairBackId, preset.hairFrontId]) {
      assertAssetCompatibility(assetById.get(id), {
        id,
        category: 'hair',
        sex: preset.sex,
        rig: preset.rigId,
      });
    }
    if (preset.sex === 'female') {
      if (preset.beardId !== 'beard_none' || preset.moustacheId !== 'moustache_none') {
        fail(`${preset.id} gives facial hair to a female avatar`);
      }
    } else {
      if (preset.beardId !== 'beard_none') {
        assertAssetCompatibility(assetById.get(preset.beardId), {
          id: preset.beardId,
          category: 'beards',
          sex: 'male',
          rig: preset.rigId,
        });
      }
      if (preset.moustacheId !== 'moustache_none') {
        assertAssetCompatibility(assetById.get(preset.moustacheId), {
          id: preset.moustacheId,
          category: 'moustaches',
          sex: 'male',
          rig: preset.rigId,
        });
      }
    }
    if (preset.headwearId !== 'headwear_none') {
      assertAssetCompatibility(assetById.get(preset.headwearId), {
        id: preset.headwearId,
        category: 'headwear',
        rig: preset.rigId,
      });
    }
    assertAssetCompatibility(assetById.get(preset.outfitId), {
      id: preset.outfitId,
      category: 'outfits',
    });
  }

  return { manifest, presets, assets, assetById };
}

export function runtimePathForAsset(asset) {
  return runtimeRelativePath(asset);
}
