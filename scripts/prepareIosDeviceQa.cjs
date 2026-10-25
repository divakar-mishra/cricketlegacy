/* global __dirname */
/* Isolated physical-device QA: no private env, production upload or root edits. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const plist = require('plist');
const xcode = require('xcode');

const root = path.resolve(__dirname, '..');
const inputs = [
  'src', 'assets', 'scripts', 'App.tsx', 'index.ts', 'app.json', 'package.json',
  'package-lock.json', 'babel.config.js', 'metro.config.js', 'tsconfig.json',
  'firebase.json', 'jest.config.js',
  'supabase/functions/_shared/playIntegrityVerdict.ts',
];
function validateLabel(label) {
  assert.match(label || '', /^[a-zA-Z0-9_-]+$/, 'Use a unique path-safe QA build label');
  return label;
}
function publicEnvironment(profile) {
  const allowed = new Set([
    'CRICKET_TARGET_PLATFORM', 'CRICKET_IOS_SIMULATOR', 'ADMOB_IOS_APP_ID',
    'EXPO_PUBLIC_SUPABASE_ENABLED', 'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
    'EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT', 'EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT',
    'EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT',
  ]);
  const env = {};
  for (const [name, value] of Object.entries(profile || {})) {
    assert(allowed.has(name), `Not an allowlisted public client field: ${name}`);
    assert.equal(typeof value, 'string');
    env[name] = value;
  }
  assert.equal(env.CRICKET_TARGET_PLATFORM, 'ios');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_ENABLED, 'true');
  const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(url.protocol, 'https:');
  assert(!url.username && !url.password && !url.search && !url.hash);
  assert.match(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '', /^sb_publishable_[A-Za-z0-9_-]+$/);
  assert.match(env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '', /^appl_[A-Za-z0-9]+$/);
  assert.match(env.ADMOB_IOS_APP_ID || '', /^ca-app-pub-\d{16}~\d{10}$/);
  return {
    ...env,
    CRICKET_IOS_SIMULATOR: 'false',
    EXPO_PUBLIC_QA_TOOLS: 'false',
    EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT: 'ca-app-pub-3940256099942544/1712485313',
    EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT: 'ca-app-pub-3940256099942544/4411468910',
    EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT: 'ca-app-pub-3940256099942544/2934735716',
    EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://sunlight-publisher-site.pages.dev/privacy/',
    EXPO_PUBLIC_TERMS_URL: 'https://sunlight-publisher-site.pages.dev/terms/',
    EXPO_PUBLIC_SUPPORT_URL: 'https://sunlight-publisher-site.pages.dev/support/',
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://sunlight-publisher-site.pages.dev/delete-account/',
  };
}
function hashes(base) {
  const result = {};
  function visit(relative) {
    const file = path.join(base, relative);
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), `Unexpected source symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(file).sort()) visit(path.join(relative, child));
    } else if (stat.isFile()) {
      result[relative] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  for (const name of inputs) visit(name);
  return result;
}
function prepare(label) {
  validateLabel(label);
  const base = path.join(root, 'output/ios-device', label);
  const workspace = path.join(base, 'workspace');
  assert(!fs.existsSync(base), 'Refusing to overwrite an existing QA snapshot');
  const nativeBase = path.join(root, 'output/ios-simulator/workspace/ios');
  assert(fs.existsSync(path.join(nativeBase, 'CricketSimulator.xcworkspace')), 'Existing Expo57 native workspace required');
  const env = publicEnvironment(require(path.join(root, 'eas.json')).build['ios-production'].env);
  const before = hashes(root);
  fs.mkdirSync(workspace, { recursive: true });
  for (const name of inputs) {
    if (fs.existsSync(path.join(root, name))) fs.cpSync(path.join(root, name), path.join(workspace, name), { recursive: true });
  }
  assert.deepEqual(hashes(root), before, 'Source changed during snapshot; do not build a mixed checkpoint');
  assert.deepEqual(hashes(workspace), before, 'Copied source differs from checkpoint');
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), 'dir');
  // Copy Pods as well: sharing writable native build phases would affect simulator QA.
  fs.cpSync(nativeBase, path.join(workspace, 'ios'), {
    recursive: true,
    filter: file => !path.basename(file).startsWith('.xcode.env'),
  });
  fs.writeFileSync(path.join(workspace, 'qa-public-env.json'), JSON.stringify(env, null, 2) + '\n');
  fs.writeFileSync(path.join(workspace, 'app.config.js'),
    "module.exports = ({ config }) => ({ ...require('./scripts/ios-app.config.cjs')({ config }, require('./qa-public-env.json')), name: 'Cricket QA' });\n");
  fs.writeFileSync(path.join(workspace, 'ios/.xcode.env'), `export NODE_BINARY=${JSON.stringify(process.execPath)}\n`);
  const projectFile = path.join(workspace, 'ios/CricketSimulator.xcodeproj/project.pbxproj');
  const project = xcode.project(projectFile);
  project.parseSync();
  let changed = 0;
  for (const value of Object.values(project.pbxXCBuildConfigurationSection())) {
    const settings = value && typeof value === 'object' ? value.buildSettings : null;
    if (settings?.PRODUCT_BUNDLE_IDENTIFIER === 'com.coverdrive.cricket.simulator') {
      settings.PRODUCT_BUNDLE_IDENTIFIER = 'com.coverdrive.cricket';
      settings.DEVELOPMENT_TEAM = '25PTZT5DNC';
      settings.CODE_SIGN_STYLE = 'Automatic';
      changed += 1;
    }
  }
  assert.equal(changed, 2, 'Expected only Debug/Release app target settings');
  fs.writeFileSync(projectFile, project.writeSync());
  const infoFile = path.join(workspace, 'ios/CricketSimulator/Info.plist');
  const info = plist.parse(fs.readFileSync(infoFile, 'utf8'));
  info.CFBundleDisplayName = 'Cricket QA';
  info.GADApplicationIdentifier = env.ADMOB_IOS_APP_ID;
  for (const item of info.CFBundleURLTypes || []) {
    item.CFBundleURLSchemes = item.CFBundleURLSchemes.map(value =>
      value === 'com.coverdrive.cricket.simulator' ? 'com.coverdrive.cricket' : value);
  }
  fs.writeFileSync(infoFile, plist.build(info));
  // Remote push is not part of this QA pass. Do not enable a new production
  // capability through automatic provisioning just because the simulator had it.
  const entitlementFile = path.join(workspace, 'ios/CricketSimulator/CricketSimulator.entitlements');
  const entitlements = plist.parse(fs.readFileSync(entitlementFile, 'utf8'));
  delete entitlements['aps-environment'];
  fs.writeFileSync(entitlementFile, plist.build(entitlements));
  fs.writeFileSync(path.join(base, 'source-snapshot.json'), JSON.stringify({
    capturedAtUtc: new Date().toISOString(), sourceHashes: before,
    kind: 'development-signed physical-device QA, not store distribution',
    includesCurrentInProgressSource: true,
    laterEditsRequireRebuild: true,
    displayName: 'Cricket QA', bundleIdentifier: 'com.coverdrive.cricket',
    team: '25PTZT5DNC', backend: 'existing shared project', revenueCat: 'real public iOS SDK key',
    ads: 'Google test ad units', qaTools: false, mockPurchases: false,
    remotePushExcluded: true, privateEnvironmentCopied: false,
  }, null, 2) + '\n');
  return { base, workspace, fileCount: Object.keys(before).length };
}
module.exports = { validateLabel, publicEnvironment, prepare };
if (require.main === module) console.log(JSON.stringify(prepare(process.argv[2]), null, 2));
