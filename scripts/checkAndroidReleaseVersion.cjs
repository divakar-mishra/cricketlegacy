/* global __dirname, require, module, process, console */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadInputs(root = path.resolve(__dirname, '..')) {
  const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return {
    target: json('android-release.json'),
    expo: json('app.json').expo,
    pkg: json('package.json'),
    lock: json('package-lock.json'),
    eas: json('eas.json'),
    gradle: fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'),
  };
}

function validateReleaseVersion(input, options = {}) {
  const { target, expo, pkg, lock, eas, gradle } = input;
  const parse = value => {
    assert(/^\d+\.\d+\.\d+$/.test(value), 'Release versions must use major.minor.patch');
    return value.split('.').map(Number);
  };
  const current = parse(target.version), previous = parse(target.previousProductionVersion);
  const difference = current.map((part, index) => part - previous[index]).find(part => part !== 0);
  assert(difference > 0, 'Public update must advance beyond previousProductionVersion; build code alone is not enough');
  assert(Number.isInteger(target.minimumVersionCode) && target.minimumVersionCode > 0, 'Invalid minimumVersionCode');
  if (options.expectedVersion) assert.equal(target.version, options.expectedVersion, 'Owner-requested version mismatch');
  if (options.releaseTag) assert.equal(options.releaseTag.replace(/^v/, ''), target.version, 'Release tag version mismatch');
  for (const [name, version] of [
    ['app.json', expo.version], ['package.json', pkg.version],
    ['package-lock.json', lock.version], ['package-lock root', lock.packages?.['']?.version],
    ['Android versionName', gradle.match(/^\s*versionName\s+["']([^"']+)["']/m)?.[1]],
  ]) assert.equal(version, target.version, name + ' does not match android-release.json');
  assert.equal(expo.android.package, target.package, 'Expo package mismatch');
  assert.equal(gradle.match(/^\s*applicationId\s+["']([^"']+)["']/m)?.[1], target.package, 'Android package mismatch');
  assert.equal(eas.cli.appVersionSource, 'remote', 'Keep established EAS remote version-code authority');
  assert.equal(eas.build.production.autoIncrement, true, 'Production build code must auto-increment');
  assert.equal(eas.build.production.android.buildType, 'app-bundle', 'Production must produce AAB');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_QA_TOOLS, 'false', 'Production QA tools must be disabled');
  assert(target.releaseName.startsWith(target.version + ' '), 'Release name must identify the intended public version');
  return { version: target.version, previousProductionVersion: target.previousProductionVersion,
    minimumVersionCode: target.minimumVersionCode, package: target.package };
}

function validateManifestVersion(manifest, target) {
  const attribute = name => manifest.match(new RegExp('\\b' + name + '="([^"]+)"'))?.[1];
  assert.equal(attribute('android:versionName'), target.version, 'Built AAB public version mismatch');
  assert.equal(attribute('package'), target.package, 'Built AAB package mismatch');
  const code = Number(attribute('android:versionCode'));
  assert(Number.isInteger(code) && code >= target.minimumVersionCode, 'Built AAB versionCode below approved minimum');
  return { version: target.version, versionCode: code, package: target.package };
}

function shouldCheckEas(env) {
  return env.EAS_BUILD_PLATFORM === 'android' && env.EAS_BUILD_PROFILE === 'production';
}

module.exports = { loadInputs, validateReleaseVersion, validateManifestVersion, shouldCheckEas };
if (require.main === module) {
  try {
    if (process.argv.includes('--eas-hook') && !shouldCheckEas(process.env)) {
      console.log('Android public-version gate skipped for non-production/non-Android build.');
    } else {
      const releaseTag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
      const input = loadInputs();
      const result = validateReleaseVersion(input, { releaseTag });
      const at = process.argv.indexOf('--manifest');
      const artifact = at >= 0 ? validateManifestVersion(fs.readFileSync(process.argv[at + 1], 'utf8'), input.target) : undefined;
      console.log('Android release version PASS: ' + JSON.stringify({ ...result, artifact }));
    }
  } catch (error) {
    console.error('Android release version FAILED: ' + error.message);
    process.exitCode = 1;
  }
}
