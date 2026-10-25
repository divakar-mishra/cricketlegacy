/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const configure = require('./ios-app.config.cjs');
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
test('simulator uses an isolated identity and Google test app, preserves Android config', () => {
  const before = JSON.stringify(base);
  const result = configure({ config: base }, { CRICKET_IOS_SIMULATOR: 'true' });
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(result.android, base.android);
  assert.equal(result.ios.bundleIdentifier, 'com.coverdrive.cricket.simulator');
  assert.equal(result.ios.appleTeamId, base.ios.appleTeamId);
  const ads = result.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(ads[1].iosAppId, 'ca-app-pub-3940256099942544~1458002511');
  assert.ok(!result.plugins.some(p => (Array.isArray(p) ? p[0] : p).startsWith('@react-native-firebase/')));
});
test('distribution fails on absent, placeholder or Google test app identity', () => {
  for (const id of ['', 'REPLACE_WITH_IOS_ADMOB_APP_ID', 'ca-app-pub-3940256099942544~1458002511']) {
    assert.throws(() => configure({ config: base }, { ADMOB_IOS_APP_ID: id }), /ADMOB_IOS_APP_ID/);
  }
});
test('distribution preserves production bundle identity with owner app configuration', () => {
  const result = configure({ config: base }, { ADMOB_IOS_APP_ID: 'ca-app-pub-1234567890123456~1234567890' });
  assert.equal(result.ios.bundleIdentifier, 'com.coverdrive.cricket');
  assert.equal(result.ios.appleTeamId, '25PTZT5DNC');
  assert.equal(result.ios.infoPlist.GADDelayAppMeasurementInit, true);
});
test('iOS submit profile targets the existing owner-created record without changing Android submission', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  assert.deepEqual(eas.submit['ios-production'].ios, { ascAppId: '6825412889', appleTeamId: '25PTZT5DNC' });
  assert.deepEqual(eas.submit.production, {});
  assert.equal(eas.submit['open-testing'].android.track, 'beta');
});
test('iOS production uses the owner-supplied AdMob IDs in the matching formats', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const env = eas.build['ios-production'].env;
  const expected = {
    ADMOB_IOS_APP_ID: 'ca-app-pub-4249020515368291~7521033766',
    EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT: 'ca-app-pub-4249020515368291/8543305543',
    EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT: 'ca-app-pub-4249020515368291/7613367251',
    EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT: 'ca-app-pub-4249020515368291/3900693812',
  };
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.ios.example'), 'utf8');
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(env[key], value);
    assert.ok(example.split('\n').includes(`${key}=${value}`));
    assert.equal(eas.build.production.env[key], undefined);
  }
  const result = configure({ config: base }, env);
  const ads = result.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(ads[1].iosAppId, expected.ADMOB_IOS_APP_ID);
  const originalAds = base.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(ads[1].androidAppId, originalAds[1].androidAppId);
  assert.equal(result.ios.bundleIdentifier, 'com.coverdrive.cricket');
  for (const key of Object.keys(expected).filter(key => key.startsWith('EXPO_PUBLIC_'))) {
    assert.ok(eas.build['ios-simulator'].env[key].startsWith('ca-app-pub-3940256099942544/'));
  }
});
test('supplied iOS ad IDs do not bypass the missing Apple RevenueCat SDK key', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'checkIosRelease.cjs')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...eas.build.production.env,
      ...eas.build['ios-production'].env,
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
    },
  });
  assert.equal(result.status, 1);
  assert.deepEqual(result.stderr.split('\n').filter(line => line.startsWith('- ')), [
    '- EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  ]);
});
test('owner public Apple SDK key is iOS-only and all five client values pass the format gate', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const key = 'appl_WfoEkqFPQtxLbHszsLTpoQQCWuY';
  assert.equal(eas.build['ios-production'].env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, key);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, undefined);
  assert.equal(eas.build['ios-simulator'].env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, undefined);
  assert.equal(eas.build['ios-simulator'].env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED, 'true');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED, undefined);
  assert.equal(eas.build['ios-production'].env.EXPO_PUBLIC_REVENUECAT_IOS_DISABLED, undefined);
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.ios.example'), 'utf8');
  assert.ok(example.split('\n').includes(`EXPO_PUBLIC_REVENUECAT_IOS_KEY=${key}`));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'checkIosRelease.cjs')], {
    encoding: 'utf8',
    env: { ...process.env, ...eas.build.production.env, ...eas.build['ios-production'].env },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /iOS client configuration format checks passed/);
  assert.match(result.stdout, /store\/Apple-provider\/device verification remains separate/);
});
test('every EAS profile env value is a non-empty string accepted by the CLI', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  for (const [profile, config] of Object.entries(eas.build)) {
    for (const [key, value] of Object.entries(config.env ?? {})) {
      assert.ok(typeof value === 'string' && value.length > 0, `${profile}.${key} must not be empty`);
    }
  }
});
test('iOS release uses the existing shared Cricket backend without changing Android/simulator', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const env = eas.build['ios-production'].env;
  assert.equal(env.EXPO_PUBLIC_SUPABASE_ENABLED, 'true');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://jtyuuwzhrufavbcxrhqp.supabase.co');
  assert.match(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_SUPABASE_URL, undefined);
  assert.equal(eas.build['ios-simulator'].env.EXPO_PUBLIC_SUPABASE_ENABLED, 'false');
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.ios.example'), 'utf8');
  for (const key of ['EXPO_PUBLIC_SUPABASE_ENABLED', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    assert.ok(example.split('\n').includes(`${key}=${env[key]}`));
  }
});
test('distribution cannot pass with missing/disabled backend or a server-only key', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  const run = overrides => spawnSync(process.execPath, [path.join(__dirname, 'checkIosRelease.cjs')], {
    encoding: 'utf8', env: { ...process.env, ...eas.build.production.env, ...eas.build['ios-production'].env, ...overrides },
  });
  for (const override of [
    { EXPO_PUBLIC_SUPABASE_ENABLED: 'false' },
    { EXPO_PUBLIC_SUPABASE_URL: '' },
    { EXPO_PUBLIC_SUPABASE_URL: 'http://example.test' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://example.test/auth/v1/callback' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://user:password@example.test/' },
    { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_ship_this' },
    { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `e30.${Buffer.from('{"role":"service_role"}').toString('base64url')}.signature` },
  ]) {
    const result = run(override);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SUPABASE/);
    assert.ok(!result.stderr.includes('sb_secret_never_ship_this'));
  }
  const legacy = `e30.${Buffer.from('{"role":"anon"}').toString('base64url')}.signature`;
  assert.equal(run({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacy }).status, 0);
});
