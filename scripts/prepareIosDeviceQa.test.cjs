const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLabel, publicEnvironment } = require('./prepareIosDeviceQa.cjs');
const profile = {
  CRICKET_TARGET_PLATFORM: 'ios',
  EXPO_PUBLIC_SUPABASE_ENABLED: 'true',
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_qa',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_qa',
  ADMOB_IOS_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
};
test('labels cannot escape the isolated build folder', () => {
  assert.equal(validateLabel('device-qa-2026-10-24'), 'device-qa-2026-10-24');
  for (const value of ['', '..', '../other', 'a/b', 'a b']) assert.throws(() => validateLabel(value));
});
test('physical QA uses test ad units but real client/backend wiring and no cheats', () => {
  const env = publicEnvironment(profile);
  assert.equal(env.CRICKET_IOS_SIMULATOR, 'false');
  assert.equal(env.EXPO_PUBLIC_QA_TOOLS, 'false');
  assert.equal(env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, 'appl_qa');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_ENABLED, 'true');
  for (const name of ['BANNER', 'REWARDED', 'INTERSTITIAL']) {
    assert.match(env[`EXPO_PUBLIC_ADMOB_IOS_${name}_UNIT`], /^ca-app-pub-3940256099942544\//);
  }
});
test('private/server credentials and unauthenticated backends fail closed', () => {
  assert.throws(() => publicEnvironment({ ...profile, APPLE_PRIVATE_KEY: 'not-public' }));
  assert.throws(() => publicEnvironment({ ...profile, EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'not-public' }));
  assert.throws(() => publicEnvironment({ ...profile, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }));
  assert.throws(() => publicEnvironment({ ...profile, EXPO_PUBLIC_SUPABASE_URL: 'https://user:pass@example.com' }));
  assert.throws(() => publicEnvironment({ ...profile, EXPO_PUBLIC_SUPABASE_ENABLED: 'false' }));
});
