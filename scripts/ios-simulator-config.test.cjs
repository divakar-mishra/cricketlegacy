/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const configure = require('./ios-simulator.config.cjs');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;

test('simulator config leaves production Android configuration and input untouched', () => {
  const before = JSON.stringify(base);
  const result = configure({ config: base });
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(result.android, base.android);
  assert.equal(result.version, base.version);
  assert.deepEqual(result.platforms, ['ios']);
  assert.equal(result.ios.bundleIdentifier, 'com.coverdrive.cricket.simulator');
});

test('simulator uses a provider-owned iOS test app ID and no invented Firebase credentials', () => {
  const result = configure({ config: base });
  assert.ok(!result.plugins.some(p => (Array.isArray(p) ? p[0] : p).startsWith('@react-native-firebase/')));
  assert.equal(result.ios.googleServicesFile, undefined);
  const ads = result.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(ads[1].iosAppId, 'ca-app-pub-3940256099942544~1458002511');
  const originalAds = base.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(ads[1].androidAppId, originalAds[1].androidAppId);
  assert.equal(originalAds[1].iosAppId, undefined);
});
