/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = path.join(root, 'output/ios-simulator');
const app = path.join(base, 'derived-data/Build/Products/Release-iphonesimulator/CricketSimulator.app');
const zip = path.join(base, 'cricket-player-manager-1.0.12-ios-simulator.zip');
const plist = key => cp.execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(app, 'Info.plist')], { encoding: 'utf8' }).trim();
assert.equal(plist('CFBundleIdentifier'), 'com.coverdrive.cricket.simulator');
assert.equal(plist('CFBundleShortVersionString'), '1.0.12');
assert.equal(plist('GADApplicationIdentifier'), 'ca-app-pub-3940256099942544~1458002511');
assert.equal(plist('GADDelayAppMeasurementInit'), 'true');
cp.execFileSync('codesign', ['--verify', '--deep', '--strict', app]);
cp.execFileSync('unzip', ['-tq', zip]);
const text = fs.readFileSync(path.join(base, 'evidence/ios-port-bytecode-2026-10-21.txt'), 'utf8');
const functions = text.split(/\n(?=(?:NC)?Function<)/);
for (const [name, marker, slot] of [
  ['QA_TOOLS_ENABLED', 'QA_WHALE_COINS', 0],
  ['MOCK_MODE', 'Function<configurePurchases>', 3],
  ['MOCK_MODE', 'Function<configureAds>', 6],
]) {
  const matches = functions.filter(f => f.startsWith('Function<>(') && f.includes(`"${name}"`) && f.includes(marker));
  assert.equal(matches.length, 1, `Expected one ${marker} module`);
  assert(new RegExp(`LoadConstFalse\\s+(r\\d+)\\s*\\n\\s*StoreNPToEnvironment\\s+r\\d+, ${slot}, \\1`).test(matches[0]), `${marker} must be compiled false`);
}
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { version: plist('CFBundleShortVersionString'), bundleId: plist('CFBundleIdentifier'),
  minimumOS: plist('MinimumOSVersion'), app: path.relative(root, app), zip: path.relative(root, zip),
  bytes: fs.statSync(zip).size, sha256: sha(zip), bundleSha256: sha(path.join(app, 'main.jsbundle')),
  codeSignatureVerified: true, zipIntegrityVerified: true, embeddedHermes: true,
  qaToolsCompiledFalse: true, purchaseMockCompiledFalse: true, adSimulationCompiledFalse: true,
  providerTestAppId: true, storeDistributionArtifact: false };
fs.writeFileSync(path.join(base, 'evidence/ios-port-artifact-2026-10-21.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
