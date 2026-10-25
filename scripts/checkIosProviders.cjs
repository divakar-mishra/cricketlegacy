/* Read-only public Auth settings. Never signs in, writes users or prints keys. */
const PUBLIC_KEY = /^sb_publishable_[A-Za-z0-9_-]+$/;

async function checkIosProviders(env = process.env, request = fetch) {
  const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL || '');
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Set the existing project public HTTPS origin.');
  }
  if (!PUBLIC_KEY.test(key)) throw new Error('Use the existing public publishable key; server keys are never accepted.');
  const response = await request(`${url.origin}/auth/v1/settings`, {
    method: 'GET', headers: { apikey: key }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Public Auth settings returned HTTP ${response.status}.`);
  const data = await response.json();
  const enabled = name => typeof data?.external?.[name] === 'boolean' ? data.external[name] : null;
  return {
    checkedAt: new Date().toISOString(), projectHost: url.host,
    callback: `${url.origin}/auth/v1/callback`,
    appleEnabled: enabled('apple'), googleEnabled: enabled('google'),
    anonymousEnabled: enabled('anonymous_users'),
    limitation: 'Enabled flags do not verify Apple credentials, redirects, account linking, purchases or device QA.',
  };
}

module.exports = { checkIosProviders };
if (require.main === module) {
  checkIosProviders().then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.appleEnabled !== true || report.googleEnabled !== true) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Public iOS provider check failed; inspect public URL/key and network access. No provider settings were changed.\n');
    process.exitCode = 1;
  });
}
