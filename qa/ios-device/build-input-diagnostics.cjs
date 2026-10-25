/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const plist = require('plist');
const { nativeSectionHashes } = require('./native-section-hashes.cjs');
const root = path.resolve(__dirname, '../..');
const label = process.argv[2];
assert.match(label || '', /^[a-zA-Z0-9_-]+$/);
const base = path.join(root, 'output/ios-device', label);
const workspace = path.join(base, 'workspace');
const app = path.join(base, 'CricketSimulator.app');
const manifestFile = path.join(base, 'diagnostic-snapshot.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
assert(['temporary input-timing QA, not a fix or distribution release',
  'input-timing QA with yielding save decode candidate; not a distribution release'].includes(manifest.kind));
assert.equal(manifest.nativeExecutableUnchanged, true);
const originalApp = path.join(root, manifest.sourceBase, 'derived-data/Build/Products/Release-iphoneos/CricketSimulator.app');
const env = JSON.parse(fs.readFileSync(path.join(workspace, 'qa-public-env.json'), 'utf8'));
const buildEnv = { ...process.env };
// Do not inherit unrelated public build flags from another task/shell.
for (const key of Object.keys(buildEnv)) if (key.startsWith('EXPO_PUBLIC_')) delete buildEnv[key];
Object.assign(buildEnv, env, { EXPO_NO_DOTENV: '1', NODE_ENV: 'production', CI: '1',
  TMPDIR: fs.mkdtempSync(path.join(os.tmpdir(), 'cricket-input-bundle-')) });
assert.equal(buildEnv.EXPO_PUBLIC_QA_TOOLS, 'false');
const signOnly = process.argv[3] === '--sign-only';
assert(!process.argv[3] || signOnly, 'Only the known sign-only retry is supported');
const log = path.join(base, signOnly ? 'bundle-sign-r2.log' : 'bundle-build.log');
const fd = fs.openSync(log, 'wx');
function run(command, args, options = {}) {
  const result = cp.spawnSync(command, args, { cwd: workspace, env: buildEnv,
    stdio: ['ignore', fd, fd], ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${path.basename(command)} failed; inspect ${log}`);
}
const js = path.join(base, 'main.js');
if (!signOnly) run(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'export:embed',
  '--entry-file', 'index.ts', '--platform', 'ios', '--dev', 'false', '--minify', 'false',
  '--max-workers', '2', '--bundle-output', js, '--assets-dest', app]);
const hermes = path.join(root, 'node_modules/hermes-compiler/hermesc/osx-bin/hermesc');
if (!signOnly) run(hermes, ['-emit-binary', '-max-diagnostic-width=80', '-O', '-out', path.join(app, 'main.jsbundle'), js]);
assert(fs.readFileSync(js, 'utf8').includes(`Input QA ${manifest.build}`), 'Diagnostic bundle source missing');
const originalEntitlements = cp.execFileSync('/usr/bin/codesign', ['-d', '--entitlements', ':-', originalApp],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const entitlementValues = plist.parse(originalEntitlements);
assert.equal(entitlementValues['application-identifier'], '25PTZT5DNC.com.coverdrive.cricket');
assert.equal(entitlementValues['get-task-allow'], true);
const entitlements = path.join(base, 'preserved-entitlements.plist');
fs.writeFileSync(entitlements, originalEntitlements);
const identities = cp.execFileSync('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
const identity = identities.match(/\b([A-F0-9]{40}) "Apple Development: Divakar Mishra /);
assert(identity, 'Existing owner development signing identity unavailable; do not create/revoke one');
run('/usr/bin/codesign', ['--force', '--sign', identity[1], '--entitlements', entitlements,
  '--generate-entitlement-der', '--timestamp=none', app]);
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
fs.closeSync(fd);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.deepEqual(nativeSectionHashes(fs.readFileSync(path.join(app, 'CricketSimulator'))),
  nativeSectionHashes(fs.readFileSync(path.join(originalApp, 'CricketSimulator'))), 'Native code/data sections changed');
const built = fs.readFileSync(path.join(app, 'main.jsbundle'));
assert.equal(built.readUInt32LE(8), fs.readFileSync(path.join(originalApp, 'main.jsbundle')).readUInt32LE(8), 'Hermes bytecode version changed');
manifest.bundleSha256 = sha(path.join(app, 'main.jsbundle'));
manifest.nativeLibraryVersionsChanged = false;
manifest.signatureDeepStrictVerified = true;
manifest.entitlementsPreserved = true;
manifest.hermesBytecodeVersion = built.readUInt32LE(8);
manifest.bundleBuildSucceeded = true;
manifest.nativeExecutableByteIdentityBeforeResigning = manifest.nativeExecutableUnchanged;
delete manifest.nativeExecutableUnchanged;
manifest.nativeCodeAndDataSectionsUnchanged = true;
manifest.nativeSignatureUpdatedForNewResources = true;
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ app, bundleSha256: manifest.bundleSha256,
  hermesBytecodeVersion: manifest.hermesBytecodeVersion, signatureVerified: true,
  nativeCodeAndDataSectionsUnchanged: true, log }, null, 2));
