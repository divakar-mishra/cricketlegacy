#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const portraitRoot = path.join(repoRoot, 'assets', 'avatar', 'portraits');
const manifestPath = path.join(portraitRoot, 'manifest.json');
const swiftSource = path.join(scriptsDir, 'normalize-portrait-clothing.swift');
const expectedCount = 128;
const expectedSize = 300;

function fail(message) {
  throw new Error(`[portrait-clothing] ${message}`);
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) fail('Portrait is not a JPEG');
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (segmentLength < 2) break;
    offset += segmentLength + 2;
  }
  fail('Could not read JPEG dimensions');
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) fail(`Missing ${path.relative(repoRoot, manifestPath)}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== expectedCount) {
    fail(`Expected ${expectedCount} manifest assets`);
  }
  return manifest;
}

function validate(manifest, requireNormalization) {
  const hashes = new Set();
  for (const asset of manifest.assets) {
    const assetPath = path.join(portraitRoot, asset.path);
    if (!fs.existsSync(assetPath)) fail(`Missing ${asset.path}`);
    const buffer = fs.readFileSync(assetPath);
    const dimensions = parseJpegDimensions(buffer);
    if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) {
      fail(`${asset.id} is ${dimensions.width}x${dimensions.height}; expected 300x300`);
    }
    if (buffer.length !== asset.bytes) fail(`${asset.id} byte count does not match manifest`);
    const digest = hash(buffer);
    if (digest !== asset.sha256) fail(`${asset.id} hash does not match manifest`);
    if (hashes.has(digest)) fail(`${asset.id} duplicates another portrait`);
    hashes.add(digest);
  }
  if (requireNormalization) {
    const normalization = manifest.clothingNormalization;
    if (
      normalization?.version !== 1 ||
      normalization?.style !== 'unbranded charcoal cricket polo with shared gold piping' ||
      normalization?.tool !== 'scripts/normalize-portrait-clothing.mjs'
    ) {
      fail('Manifest does not record the charcoal clothing normalization');
    }
  }
  console.log(`[portrait-clothing] valid: ${manifest.assets.length} unique 300x300 JPEGs`);
}

function parseArgs(argv) {
  const result = {
    mode: 'check',
    previewDir: undefined,
    debugMaskDir: undefined,
    force: false,
    ids: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') result.mode = 'check';
    else if (value === '--write') result.mode = 'write';
    else if (value === '--force') result.force = true;
    else if (value === '--preview-dir') {
      result.mode = 'preview';
      result.previewDir = path.resolve(argv[++index] ?? fail('--preview-dir needs a path'));
    } else if (value === '--debug-mask-dir') {
      result.debugMaskDir = path.resolve(argv[++index] ?? fail('--debug-mask-dir needs a path'));
    } else if (value === '--ids') {
      result.ids = new Set(
        (argv[++index] ?? fail('--ids needs a comma-separated list')).split(','),
      );
    } else fail(`Unknown argument ${value}`);
  }
  return result;
}

function runNormalizer(manifest, args) {
  if (process.platform !== 'darwin') fail('The garment mask requires macOS Vision');
  if (args.mode === 'write' && manifest.clothingNormalization && !args.force) {
    fail(
      'Portraits are already normalized; use --check instead (or --force after restoring originals)',
    );
  }
  if (args.mode === 'write' && args.ids) fail('--ids is only allowed with --preview-dir');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cricketlegacy-clothing-'));
  const moduleCache = path.join(temporaryRoot, 'swift-module-cache');
  const executable = path.join(temporaryRoot, 'normalize-portrait-clothing');
  fs.mkdirSync(moduleCache, { recursive: true });
  const compile = spawnSync(
    'xcrun',
    ['swiftc', '-O', '-module-cache-path', moduleCache, swiftSource, '-o', executable],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (compile.status !== 0) fail(`Swift compile failed:\n${compile.stderr || compile.stdout}`);

  const outputRoot = args.mode === 'preview' ? args.previewDir : path.join(temporaryRoot, 'output');
  fs.mkdirSync(outputRoot, { recursive: true });
  const selectedAssets = args.ids
    ? manifest.assets.filter((asset) => args.ids.has(asset.id))
    : manifest.assets;
  if (args.ids && selectedAssets.length !== args.ids.size) fail('One or more --ids were not found');
  const items = selectedAssets.map((asset) => ({
    id: asset.id,
    source: path.join(portraitRoot, asset.path),
    destination: path.join(outputRoot, asset.path),
    debugMask: args.debugMaskDir
      ? path.join(args.debugMaskDir, asset.path.replace(/\.jpg$/i, '.png'))
      : undefined,
  }));
  const workListPath = path.join(temporaryRoot, 'worklist.json');
  fs.writeFileSync(workListPath, `${JSON.stringify({ items }, null, 2)}\n`);
  const run = spawnSync(executable, [workListPath], { cwd: repoRoot, encoding: 'utf8' });
  process.stdout.write(run.stdout);
  if (run.status !== 0) fail(`Normalizer failed:\n${run.stderr}`);

  if (args.mode === 'preview') {
    console.log(`[portrait-clothing] preview written to ${outputRoot}`);
    return;
  }
  for (const asset of manifest.assets) {
    const stagedPath = path.join(outputRoot, asset.path);
    const buffer = fs.readFileSync(stagedPath);
    const dimensions = parseJpegDimensions(buffer);
    if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) {
      fail(`${asset.id} staging output has wrong dimensions`);
    }
    fs.copyFileSync(stagedPath, path.join(portraitRoot, asset.path));
    asset.bytes = buffer.length;
    asset.sha256 = hash(buffer);
  }
  manifest.clothingNormalization = {
    version: 1,
    style: 'unbranded charcoal cricket polo with shared gold piping',
    tool: 'scripts/normalize-portrait-clothing.mjs',
    mask: 'macOS Vision person segmentation with face, skin, hair and piping protection',
    targetHueDegrees: 220,
    targetSaturation: 0.08,
  };
  manifest.jpegQuality = 94;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  validate(manifest, true);
}

const args = parseArgs(process.argv.slice(2));
const manifest = loadManifest();
if (args.mode === 'check') validate(manifest, true);
else runNormalizer(manifest, args);
