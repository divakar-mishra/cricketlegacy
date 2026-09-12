import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { renderLegalSite } = require('./build-core.cjs');

const siteRoot = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.join(siteRoot, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(siteRoot, 'legal.config.json'), 'utf8'));

let pages;
try {
  pages = renderLegalSite(config);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

fs.rmSync(outputRoot, { recursive: true, force: true });
for (const [relativePath, html] of Object.entries(pages)) {
  const destination = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');
}
fs.cpSync(path.join(siteRoot, 'static'), outputRoot, { recursive: true });
// Use the app's canonical icon rather than maintaining a second website logo.
fs.mkdirSync(path.join(outputRoot, 'images'), { recursive: true });
fs.copyFileSync(
  path.join(siteRoot, '..', 'assets', 'icon.png'),
  path.join(outputRoot, 'images', 'cricket-legacy-icon.png'),
);
console.log(`Built ${Object.keys(pages).length} legal/support pages in legal-site/dist.`);
