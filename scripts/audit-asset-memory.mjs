import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(process.argv[2] ?? 'assets');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const fontExtensions = new Set(['.ttf', '.otf', '.woff', '.woff2']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function bytesLabel(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function pngDecodedBytes(file) {
  if (path.extname(file).toLowerCase() !== '.png') return null;
  try {
    const png = PNG.sync.read(fs.readFileSync(file), { skipRescale: true });
    return { width: png.width, height: png.height, bytes: png.width * png.height * 4 };
  } catch {
    return null;
  }
}

if (!fs.existsSync(root)) {
  console.error(`Asset directory does not exist: ${root}`);
  process.exit(1);
}

const files = walk(root);
const images = files
  .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => ({
    file: path.relative(process.cwd(), file),
    bytes: fs.statSync(file).size,
    decoded: pngDecodedBytes(file),
  }));
const fonts = files
  .filter((file) => fontExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => ({ file: path.relative(process.cwd(), file), bytes: fs.statSync(file).size }));

const totalAssetBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const totalImageBytes = images.reduce((sum, image) => sum + image.bytes, 0);
const decodedPngBytes = images.reduce((sum, image) => sum + (image.decoded?.bytes ?? 0), 0);

console.log(`Assets: ${files.length} files, ${bytesLabel(totalAssetBytes)} on disk`);
console.log(`Images: ${images.length} files, ${bytesLabel(totalImageBytes)} compressed`);
console.log(
  `PNG decoded upper bound: ${bytesLabel(decodedPngBytes)} if every PNG were resident simultaneously`,
);
console.log(
  `Fonts in assets: ${fonts.length} files, ${bytesLabel(fonts.reduce((sum, font) => sum + font.bytes, 0))}`,
);

console.log('\nLargest compressed images:');
for (const image of [...images].sort((a, b) => b.bytes - a.bytes).slice(0, 15)) {
  const dimensions = image.decoded ? ` · ${image.decoded.width}×${image.decoded.height}` : '';
  console.log(`- ${bytesLabel(image.bytes)}${dimensions} · ${image.file}`);
}

console.log('\nLargest decoded PNGs:');
for (const image of images
  .filter((item) => item.decoded)
  .sort((a, b) => b.decoded.bytes - a.decoded.bytes)
  .slice(0, 15)) {
  console.log(
    `- ${bytesLabel(image.decoded.bytes)} · ${image.decoded.width}×${image.decoded.height} · ${image.file}`,
  );
}

if (fonts.length) {
  console.log('\nBundled fonts:');
  for (const font of [...fonts].sort((a, b) => b.bytes - a.bytes)) {
    console.log(`- ${bytesLabel(font.bytes)} · ${font.file}`);
  }
}
