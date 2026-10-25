const assert = require('node:assert/strict');
const test = require('node:test');
const { checkIosProviders } = require('./checkIosProviders.cjs');
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_test' };

test('only GETs the public settings endpoint and reports no key or user data', async () => {
  const calls = [];
  const report = await checkIosProviders(env, async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ external: { apple: false, google: true, anonymous_users: true }, privateData: 'not-output' }) };
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://example.supabase.co/auth/v1/settings');
  assert.equal(calls[0][1].method, 'GET');
  assert.deepEqual(calls[0][1].headers, { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  assert.equal(report.appleEnabled, false);
  assert.equal(report.googleEnabled, true);
  assert.equal(report.callback, 'https://example.supabase.co/auth/v1/callback');
  assert.ok(!JSON.stringify(report).includes('sb_publishable_'));
  assert.ok(!JSON.stringify(report).includes('not-output'));
});
test('unknown enabled flags stay unknown, not assumed configured', async () => {
  const report = await checkIosProviders(env, async () => ({ ok: true, json: async () => ({ external: { apple: 'true' } }) }));
  assert.equal(report.appleEnabled, null);
  assert.equal(report.googleEnabled, null);
});
test('refuses server keys and non-origin URLs before making any network request', async () => {
  const request = () => { throw new Error('Network must not be called'); };
  for (const config of [
    { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_ship' },
    { EXPO_PUBLIC_SUPABASE_URL: 'http://example.test' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://example.test/auth/callback' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://user:password@example.test/' },
  ]) await assert.rejects(() => checkIosProviders({ ...env, ...config }, request), /public|server|HTTPS/);
});
test('fails on provider/network errors without treating them as enabled flags', async () => {
  await assert.rejects(() => checkIosProviders(env, async () => ({ ok: false, status: 401 })), /HTTP 401/);
  await assert.rejects(() => checkIosProviders(env, async () => { throw new Error('offline'); }), /offline/);
});
