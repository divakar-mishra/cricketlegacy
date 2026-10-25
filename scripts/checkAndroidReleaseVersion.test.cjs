/* global require, process */
const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { loadInputs, validateReleaseVersion, validateManifestVersion, shouldCheckEas } = require('./checkAndroidReleaseVersion.cjs');
const inputs = () => structuredClone(loadInputs());

test('actual Android/Expo/package/lock configuration matches owner release target', () => {
  assert.equal(validateReleaseVersion(inputs()).version, '1.0.13');
});
test('reproduces the original error: incremented code with old displayed version is rejected', () => {
  const data = inputs();
  data.expo.version = '1.0.12';
  data.expo.android.versionCode = 999;
  assert.throws(() => validateReleaseVersion(data), /app.json does not match/);
});
test('each native and package version is independently checked', () => {
  const mutations = [
    data => { data.pkg.version = '1.0.12'; },
    data => { data.lock.version = '1.0.12'; },
    data => { data.lock.packages[''].version = '1.0.12'; },
    data => { data.gradle = data.gradle.replace('versionName "1.0.13"', 'versionName "1.0.12"'); },
  ];
  for (const mutate of mutations) {
    const data = inputs(); mutate(data);
    assert.throws(() => validateReleaseVersion(data), /does not match/);
  }
});
test('a public update must advance its version even when all sources agree', () => {
  const data = inputs(); data.target.previousProductionVersion = data.target.version;
  assert.throws(() => validateReleaseVersion(data), /Public update must advance/);
  data.target.previousProductionVersion = '2.0.0';
  assert.throws(() => validateReleaseVersion(data), /Public update must advance/);
});
test('owner target, release tag and internal release title cannot disguise another version', () => {
  assert.throws(() => validateReleaseVersion(inputs(), { expectedVersion: '1.0.14' }), /Owner-requested/);
  assert.throws(() => validateReleaseVersion(inputs(), { releaseTag: 'v1.0.12' }), /Release tag/);
  const data = inputs(); data.target.releaseName = '1.0.12 – Old';
  assert.throws(() => validateReleaseVersion(data), /Release name/);
});
test('remote code, bundle type and disabled QA safety settings remain required', () => {
  for (const mutate of [
    data => { data.eas.cli.appVersionSource = 'local'; },
    data => { data.eas.build.production.autoIncrement = false; },
    data => { data.eas.build.production.android.buildType = 'apk'; },
    data => { data.eas.build.production.env.EXPO_PUBLIC_QA_TOOLS = 'true'; },
  ]) { const data = inputs(); mutate(data); assert.throws(() => validateReleaseVersion(data)); }
});
test('actual manifest verification rejects wrong public version, package and stale code', () => {
  const target = inputs().target;
  const xml = '<manifest package="com.coverdrive.cricket" android:versionName="1.0.13" android:versionCode="23">';
  assert.equal(validateManifestVersion(xml, target).versionCode, 23);
  assert.throws(() => validateManifestVersion(xml.replace('1.0.13', '1.0.12'), target), /public version/);
  assert.throws(() => validateManifestVersion(xml.replace('="23"', '="22"'), target), /versionCode/);
  assert.throws(() => validateManifestVersion(xml.replace('com.coverdrive.cricket', 'wrong.package'), target), /package/);
});
test('EAS gate applies only to Android production and leaves iOS/QA unchanged', () => {
  assert.equal(shouldCheckEas({ EAS_BUILD_PLATFORM: 'android', EAS_BUILD_PROFILE: 'production' }), true);
  for (const [platform, profile] of [['ios', 'ios-production'], ['android', 'preview'], ['ios', 'production']]) {
    assert.equal(shouldCheckEas({ EAS_BUILD_PLATFORM: platform, EAS_BUILD_PROFILE: profile }), false);
  }
});
test('CLI runs without installed packages and previews skip safely', () => {
  const result = spawnSync(process.execPath, ['scripts/checkAndroidReleaseVersion.cjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Android release version PASS/);
  const skip = spawnSync(process.execPath, ['scripts/checkAndroidReleaseVersion.cjs', '--eas-hook'], {
    encoding: 'utf8', env: { ...process.env, EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-production' },
  });
  assert.equal(skip.status, 0, skip.stderr);
  assert.match(skip.stdout, /skipped/);
});
