import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Generate on macOS:
// npm run generate:portraits -- --source-dir /path/to/the/eight/source-sheets
// The one-off JPEG encoding step uses the built-in `sips` command.

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const portraitRoot = path.join(repoRoot, 'assets', 'avatar', 'portraits');
const registryPath = path.join(
  repoRoot,
  'src',
  'avatar',
  'generated',
  'portraitAssets.generated.ts',
);
const manifestPath = path.join(portraitRoot, 'manifest.json');

const GRID_SIZE = 4;
const PORTRAIT_SIZE = 300;
const JPEG_QUALITY = 88;
const EXPECTED_SHEET_SIZE = 1254;
const EXPECTED_ASSET_COUNT = 128;

const sheets = [
  {
    file: 'exec-67afa493-8d51-4b3f-82c6-eb4a9e72b6d7.png',
    sha256: '7f6a7cd83860c6b4153dbf856d12106487e97fd305d4616167a3433816d5a8b6',
  },
  {
    file: 'exec-54432546-bdfc-4cd8-956d-0eeaf43ca759.png',
    sha256: '212aa8060939fcd37525d8e0244750e1b667035da78c383bdbbdb07fa704f294',
  },
  {
    file: 'exec-3f9a2112-61df-4106-a618-cada2ea44872.png',
    sha256: 'a7eabe92da130f9a1a0c6fec377656575503c731e1511efb2205c62ee3627568',
  },
  {
    file: 'exec-81bcfb6e-282d-40e3-8dd2-33dabbdd743a.png',
    sha256: '7ebb46afbc6894a8d2d7a17fec03504ad23f1fcde69a33dcac1ae01257830007',
  },
  {
    file: 'exec-eb9ba728-4782-4f61-ad4a-cca0368b266b.png',
    sha256: '5a8de87620d010c7ccb87cfcb263b767c87a433cb188f80e747091014e4f674e',
  },
  {
    file: 'exec-dcea8e48-8f76-4a0b-8a4e-366c3d1e86b3.png',
    sha256: '70212cba1d558d16b3707fe056da05ec126d5d6faf8fd0b0cc31011fc61bde69',
  },
  {
    file: 'exec-46923294-4a1f-4e39-bde9-6f9b443402c3.png',
    sha256: '8fb181a18a4aad824922175b2d65aa7ba51e044553df6dc9148d06f596e7d026',
  },
  {
    file: 'exec-5e20a032-e57a-4feb-8c3a-1828fbbd06e4.png',
    sha256: '51b67de8b757e8d79f7065bbd41995c8665ef60ff5ec25be326eb8f8bc1d8e6d',
  },
];

function fail(message) {
  throw new Error(`[portrait-assets] ${message}`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const args = { sourceDir: process.env.PORTRAIT_SHEET_DIR, validateOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--validate-only') {
      args.validateOnly = true;
    } else if (value === '--source-dir') {
      args.sourceDir = argv[index + 1];
      index += 1;
    } else {
      fail(`Unknown argument ${value}`);
    }
  }
  return args;
}

function readJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) fail('Generated file is not a JPEG');
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
  fail('Could not read generated JPEG dimensions');
}

function cleanGeneratedPortraits(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory)) {
    if (/^portrait_(?:male|female)_\d{3}\.(?:jpe?g|png)$/i.test(entry)) {
      fs.unlinkSync(path.join(directory, entry));
    }
  }
}

function encodeJpeg(png, destination, temporaryDirectory) {
  const temporaryPng = path.join(temporaryDirectory, `${path.basename(destination, '.jpg')}.png`);
  fs.writeFileSync(
    temporaryPng,
    PNG.sync.write(png, { colorType: 6, inputColorType: 6, inputHasAlpha: true, deflateLevel: 9 }),
  );
  const result = spawnSync(
    'sips',
    [
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      String(JPEG_QUALITY),
      temporaryPng,
      '--out',
      destination,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    fail(
      `JPEG encoding requires macOS sips (${result.error?.message ?? result.stderr.trim() ?? 'failed'})`,
    );
  }
}

function registrySourceFor(metadata) {
  const sourceLines = metadata.map(
    ({ id, sex }) =>
      `  ${JSON.stringify(id)}: require(${JSON.stringify(`../../../assets/avatar/portraits/${sex}/${id}.jpg`)}),`,
  );
  const publicMetadata = metadata.map(({ id, sex, toneBand, index }) => ({
    id,
    sex,
    toneBand,
    index,
  }));
  return `// Generated by scripts/build-portrait-assets.mjs. Do not edit by hand.
import type { ImageSourcePropType } from 'react-native';

export interface PortraitAssetMetadata {
  readonly id: string;
  readonly sex: 'male' | 'female';
  readonly toneBand: number;
  readonly index: number;
}

export const portraitAssetSources: Readonly<Record<string, ImageSourcePropType>> = {
${sourceLines.join('\n')}
};

export const portraitAssetMetadata = ${JSON.stringify(publicMetadata, null, 2)} as const satisfies readonly PortraitAssetMetadata[];

export const PORTRAIT_ASSET_COUNT = portraitAssetMetadata.length;
`;
}

function build(sourceDir) {
  if (!sourceDir) {
    fail(
      'Pass --source-dir /path/to/sheets or set PORTRAIT_SHEET_DIR. See the filenames in this script.',
    );
  }

  const resolvedSourceDir = path.resolve(sourceDir);
  const maleDirectory = path.join(portraitRoot, 'male');
  const femaleDirectory = path.join(portraitRoot, 'female');
  fs.mkdirSync(maleDirectory, { recursive: true });
  fs.mkdirSync(femaleDirectory, { recursive: true });
  cleanGeneratedPortraits(maleDirectory);
  cleanGeneratedPortraits(femaleDirectory);

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cricketlegacy-portraits-'));
  const metadata = [];
  const sexIndexes = { male: 0, female: 0 };

  try {
    sheets.forEach((sheet, sheetIndex) => {
      const sourcePath = path.join(resolvedSourceDir, sheet.file);
      if (!fs.existsSync(sourcePath)) fail(`Missing source sheet ${sourcePath}`);
      const sourceBuffer = fs.readFileSync(sourcePath);
      const actualSourceHash = sha256(sourceBuffer);
      if (actualSourceHash !== sheet.sha256) {
        fail(
          `Source sheet ${sheet.file} has SHA-256 ${actualSourceHash}; expected ${sheet.sha256}`,
        );
      }
      const source = PNG.sync.read(sourceBuffer);
      if (source.width !== EXPECTED_SHEET_SIZE || source.height !== EXPECTED_SHEET_SIZE) {
        fail(
          `${sheet.file} is ${source.width}x${source.height}; expected ${EXPECTED_SHEET_SIZE}x${EXPECTED_SHEET_SIZE}`,
        );
      }

      for (let row = 0; row < GRID_SIZE; row += 1) {
        const sex = row < 2 ? 'male' : 'female';
        for (let column = 0; column < GRID_SIZE; column += 1) {
          sexIndexes[sex] += 1;
          const index = sexIndexes[sex];
          const id = `portrait_${sex}_${String(index).padStart(3, '0')}`;
          const crop = new PNG({ width: PORTRAIT_SIZE, height: PORTRAIT_SIZE });
          const x = Math.round(((column + 0.5) * source.width) / GRID_SIZE - PORTRAIT_SIZE / 2);
          const y = Math.round(((row + 0.5) * source.height) / GRID_SIZE - PORTRAIT_SIZE / 2);
          PNG.bitblt(source, crop, x, y, PORTRAIT_SIZE, PORTRAIT_SIZE, 0, 0);

          const directory = sex === 'male' ? maleDirectory : femaleDirectory;
          const destination = path.join(directory, `${id}.jpg`);
          encodeJpeg(crop, destination, temporaryDirectory);
          const outputBuffer = fs.readFileSync(destination);
          const dimensions = readJpegDimensions(outputBuffer);
          metadata.push({
            id,
            sex,
            toneBand: sheetIndex + 1,
            index,
            path: path.relative(portraitRoot, destination).split(path.sep).join('/'),
            width: dimensions.width,
            height: dimensions.height,
            bytes: outputBuffer.length,
            sha256: sha256(outputBuffer),
          });
        }
      }
    });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  metadata.sort((left, right) =>
    left.sex === right.sex ? left.index - right.index : left.sex.localeCompare(right.sex),
  );
  const manifest = {
    version: 1,
    format: 'jpeg',
    jpegQuality: JPEG_QUALITY,
    crop: {
      width: PORTRAIT_SIZE,
      height: PORTRAIT_SIZE,
      method: 'centered 4x4 cell crop with seven-pixel border exclusion',
    },
    sourceSheets: sheets.map((sheet, index) => ({
      toneBand: index + 1,
      file: sheet.file,
      sha256: sheet.sha256,
    })),
    assets: metadata,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, registrySourceFor(metadata));
}

function validate() {
  if (!fs.existsSync(manifestPath)) fail('Missing assets/avatar/portraits/manifest.json');
  if (!fs.existsSync(registryPath)) {
    fail('Missing src/avatar/generated/portraitAssets.generated.ts');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const assets = manifest.assets ?? [];
  if (assets.length !== EXPECTED_ASSET_COUNT) {
    fail(`Expected ${EXPECTED_ASSET_COUNT} assets, received ${assets.length}`);
  }

  const ids = new Set();
  const paths = new Set();
  const hashes = new Set();
  const counts = { male: 0, female: 0 };
  const toneCounts = new Map();
  let totalBytes = 0;
  for (const asset of assets) {
    if (ids.has(asset.id)) fail(`Duplicate asset ID ${asset.id}`);
    if (paths.has(asset.path)) fail(`Duplicate asset path ${asset.path}`);
    ids.add(asset.id);
    paths.add(asset.path);
    if (!['male', 'female'].includes(asset.sex)) fail(`${asset.id} has invalid sex ${asset.sex}`);
    counts[asset.sex] += 1;
    if (asset.index < 1 || asset.index > 64) fail(`${asset.id} has invalid index ${asset.index}`);
    if (asset.toneBand < 1 || asset.toneBand > 8) {
      fail(`${asset.id} has invalid toneBand ${asset.toneBand}`);
    }
    const expectedId = `portrait_${asset.sex}_${String(asset.index).padStart(3, '0')}`;
    if (asset.id !== expectedId) fail(`${asset.id} should be named ${expectedId}`);
    const toneKey = `${asset.sex}:${asset.toneBand}`;
    toneCounts.set(toneKey, (toneCounts.get(toneKey) ?? 0) + 1);

    const assetPath = path.join(portraitRoot, asset.path);
    if (!fs.existsSync(assetPath)) fail(`Missing ${asset.path}`);
    const buffer = fs.readFileSync(assetPath);
    const dimensions = readJpegDimensions(buffer);
    if (dimensions.width !== PORTRAIT_SIZE || dimensions.height !== PORTRAIT_SIZE) {
      fail(
        `${asset.id} is ${dimensions.width}x${dimensions.height}; expected ${PORTRAIT_SIZE}x${PORTRAIT_SIZE}`,
      );
    }
    const actualHash = sha256(buffer);
    if (actualHash !== asset.sha256) fail(`${asset.id} does not match its manifest SHA-256`);
    if (hashes.has(actualHash)) fail(`${asset.id} duplicates another portrait file`);
    hashes.add(actualHash);
    totalBytes += buffer.length;
  }

  if (counts.male !== 64 || counts.female !== 64) {
    fail(`Expected 64 portraits per sex; received ${counts.male} male and ${counts.female} female`);
  }
  for (const sex of ['male', 'female']) {
    for (let toneBand = 1; toneBand <= 8; toneBand += 1) {
      if (toneCounts.get(`${sex}:${toneBand}`) !== 8) {
        fail(`${sex} tone band ${toneBand} does not contain exactly eight portraits`);
      }
    }
  }

  const actualFiles = ['male', 'female'].flatMap((sex) => {
    const directory = path.join(portraitRoot, sex);
    return fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((file) => /^portrait_(?:male|female)_\d{3}\.(?:jpe?g|png)$/i.test(file))
          .map((file) => `${sex}/${file}`)
      : [];
  });
  if (actualFiles.length !== EXPECTED_ASSET_COUNT) {
    fail(`Found ${actualFiles.length} generated portrait files; expected ${EXPECTED_ASSET_COUNT}`);
  }
  for (const file of actualFiles) {
    if (!paths.has(file)) fail(`Untracked generated portrait ${file}`);
  }

  const registry = fs.readFileSync(registryPath, 'utf8');
  const literalRequires =
    registry.match(/require\("\.\.\/\.\.\/\.\.\/assets\/avatar\/portraits\//g) ?? [];
  if (literalRequires.length !== EXPECTED_ASSET_COUNT) {
    fail(
      `Registry contains ${literalRequires.length} literal requires; expected ${EXPECTED_ASSET_COUNT}`,
    );
  }
  for (const asset of assets) {
    if (!registry.includes(`${JSON.stringify(asset.id)}: require(`)) {
      fail(`Registry is missing ${asset.id}`);
    }
  }

  console.log(
    `[portrait-assets] valid: ${assets.length} unique ${PORTRAIT_SIZE}x${PORTRAIT_SIZE} JPEGs (${(
      totalBytes /
      1024 /
      1024
    ).toFixed(2)} MiB)`,
  );
}

const args = parseArgs(process.argv.slice(2));
if (!args.validateOnly) build(args.sourceDir);
validate();
