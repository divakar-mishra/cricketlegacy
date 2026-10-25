/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { validateLabel } = require('./prepareIosDeviceQa.cjs');
const label = validateLabel(process.argv[2]);
const device = process.argv[3];
assert.match(device || '', /^(?:[0-9a-f]{8}-[0-9a-f]{16}|[0-9a-f-]{36}|[0-9a-f]{40})$/i,
  'Supply the exact physical device ID listed by Xcode destinations');
const base = path.resolve(__dirname, '../output/ios-device', label);
const env = JSON.parse(fs.readFileSync(path.join(base, 'workspace/qa-public-env.json'), 'utf8'));
const attempt = process.argv[4] ? validateLabel(process.argv[4]) : null;
const buildEnv = {
  ...process.env, ...env, EXPO_NO_DOTENV: '1', NODE_ENV: 'production',
  NODE_BINARY: process.execPath, EXPO_USE_PRECOMPILED_MODULES: '0',
};
const podsProject = path.join(base, 'workspace/ios/Pods/Pods.xcodeproj/project.pbxproj');
if (fs.readFileSync(podsProject, 'utf8').includes('output/ios-simulator/workspace')) {
  // CocoaPods encodes relative source/support paths. Relocating a workspace is
  // a lockfile path-metadata change, not permission to upgrade dependencies.
  const root = path.resolve(__dirname, '..');
  const tooling = path.join(root, 'output/ios-simulator/tooling');
  const suffix = attempt || 'initial';
  const before = path.join(base, `pod-lock-before-${suffix}.lock`);
  const lock = path.join(base, 'workspace/ios/Podfile.lock');
  fs.copyFileSync(lock, before, fs.constants.COPYFILE_EXCL);
  const podFd = fs.openSync(path.join(base, `pods-relocation-${suffix}.log`), 'wx');
  const pods = cp.spawnSync('/usr/bin/ruby', [path.join(tooling, 'bin/bundle'), 'exec', 'pod', 'install', '--no-repo-update'], {
    cwd: path.join(base, 'workspace/ios'),
    env: {
      ...buildEnv, GEM_HOME: path.join(tooling, 'gems'), GEM_PATH: path.join(tooling, 'gems'),
      BUNDLE_GEMFILE: path.join(tooling, 'Gemfile'), BUNDLE_APP_CONFIG: path.join(tooling, 'bundle-config'),
    },
    stdio: ['ignore', podFd, podFd],
  });
  fs.closeSync(podFd);
  assert.equal(pods.status, 0, 'Isolated CocoaPods relocation failed; see the unique attempt log');
  cp.execFileSync('/usr/bin/ruby', ['-r', 'yaml', '-e',
    'a=YAML.load_file(ARGV[0]);b=YAML.load_file(ARGV[1]);abort("Locked pod versions changed") unless a["PODS"]==b["PODS"];puts "Locked pod versions preserved"',
    before, lock], { stdio: 'inherit' });
  assert(!fs.readFileSync(podsProject, 'utf8').includes('output/ios-simulator/workspace'), 'Stale native paths remain');
}
const log = path.join(base, attempt ? `device-build-${attempt}.log` : 'device-build.log');
const fd = fs.openSync(log, 'wx');
const result = cp.spawnSync('xcodebuild', [
  '-workspace', 'ios/CricketSimulator.xcworkspace', '-scheme', 'CricketSimulator',
  '-configuration', 'Release', '-sdk', 'iphoneos',
  '-destination', `platform=iOS,id=${device}`, '-jobs', '4',
  '-derivedDataPath', '../derived-data', '-allowProvisioningUpdates',
  '-allowProvisioningDeviceRegistration', 'EXPO_USE_PRECOMPILED_MODULES=0', 'build',
], {
  cwd: path.join(base, 'workspace'),
  env: buildEnv,
  stdio: ['ignore', fd, fd],
});
fs.closeSync(fd);
if (result.error) throw result.error;
console.log(JSON.stringify({ exitCode: result.status, log, app: path.join(base, 'derived-data/Build/Products/Release-iphoneos/CricketSimulator.app') }, null, 2));
process.exitCode = result.status ?? 1;
