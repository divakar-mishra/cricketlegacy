import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const portraitRoot = path.join(repoRoot, 'assets', 'avatar', 'portraits');
const manifestPath = path.join(portraitRoot, 'manifest.json');
const PORTRAIT_SIZE = 300;

function fail(message) {
  throw new Error(`[portrait-manifest] ${message}`);
}

function readJpegDimensions(buffer) {
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
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    if (segmentLength < 2) break;
    offset += segmentLength + 2;
  }
  fail('Could not read portrait dimensions');
}

const assets = [];
const hashes = new Set();

for (const sex of ['female', 'male']) {
  for (let index = 1; index <= 64; index += 1) {
    const id = `portrait_${sex}_${String(index).padStart(3, '0')}`;
    const relativePath = `${sex}/${id}.jpg`;
    const absolutePath = path.join(portraitRoot, relativePath);
    if (!fs.existsSync(absolutePath)) fail(`Missing ${relativePath}`);

    const buffer = fs.readFileSync(absolutePath);
    const dimensions = readJpegDimensions(buffer);
    if (dimensions.width !== PORTRAIT_SIZE || dimensions.height !== PORTRAIT_SIZE) {
      fail(`${id} is ${dimensions.width}x${dimensions.height}; expected 300x300`);
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hashes.has(sha256)) fail(`${id} duplicates another portrait`);
    hashes.add(sha256);
    assets.push({
      id,
      sex,
      toneBand: Math.floor((index - 1) / 8) + 1,
      index,
      path: relativePath,
      width: dimensions.width,
      height: dimensions.height,
      bytes: buffer.length,
      sha256,
    });
  }
}

const manifest = {
  version: 2,
  format: 'jpeg',
  jpegQuality: 94,
  crop: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    method: 'individual square portrait with circular-frame safe area',
  },
  generation: {
    style: 'funky 2D mobile-game cartoon with exaggerated facial proportions',
    ageDistribution: {
      youngAdults: 96,
      adults35To39: 32,
      adultPositionsPerToneBand: [7, 8],
    },
    frames: {
      normal: 'bright green circular ring rendered in app',
      championship: 'gold and yellow circular ring rendered in app',
    },
  },
  assets,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[portrait-manifest] refreshed ${assets.length} unique portraits`);
