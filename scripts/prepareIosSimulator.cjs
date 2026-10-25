/* global __dirname */
/* Explicit source allowlist; never copies private env, Android builds or credentials. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'output/ios-simulator/workspace');
fs.mkdirSync(target, { recursive: true });
for (const name of ['src', 'assets', 'scripts', 'App.tsx', 'index.ts', 'app.json', 'package.json',
  'package-lock.json', 'babel.config.js', 'metro.config.js', 'tsconfig.json', 'firebase.json']) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(target, name), { recursive: true });
}
fs.writeFileSync(path.join(target, 'app.config.js'),
  "module.exports = ({ config }) => require('./scripts/ios-app.config.cjs')({ config }, { ...process.env, CRICKET_IOS_SIMULATOR: 'true' });\n");
// Preserve the owner's earlier muted simulator preference in this build only.
for (const name of ['music.ts', 'sfx.ts']) {
  const file = path.join(target, 'src/audio', name);
  const text = fs.readFileSync(file, 'utf8');
  const muted = name === 'music.ts' ? text.replace('enabled = next;', 'enabled = false; // Muted simulator QA only.\n  void next;')
    : text.replace('return useSettings.getState().sound;', 'return false; // Muted simulator QA only.');
  if (muted === text) throw new Error(`Muted simulator marker changed: ${name}`);
  fs.writeFileSync(file, muted);
}
process.stdout.write(`Prepared iOS simulator workspace: ${target}\n`);
