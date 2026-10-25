/* Distribution configuration gate. It never creates provider accounts or sends data. */
const { Buffer } = require('node:buffer');
const checks = [
  ['ADMOB_IOS_APP_ID', /^ca-app-pub-\d{16}~\d{10}$/],
  ['EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT', /^ca-app-pub-\d{16}\/\d{10}$/],
  ['EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT', /^ca-app-pub-\d{16}\/\d{10}$/],
  ['EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT', /^ca-app-pub-\d{16}\/\d{10}$/],
  ['EXPO_PUBLIC_REVENUECAT_IOS_KEY', /^appl_[A-Za-z0-9]+$/],
];
const missing = checks.filter(([name, pattern]) => {
  const value = process.env[name] || '';
  return !pattern.test(value) || value.includes('REPLACE') || value.includes('3940256099942544');
}).map(([name]) => name);
if (process.env.EXPO_PUBLIC_SUPABASE_ENABLED !== 'true') missing.push('EXPO_PUBLIC_SUPABASE_ENABLED must be true for account recovery');
try {
  const url = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('invalid');
} catch {
  missing.push('EXPO_PUBLIC_SUPABASE_URL must be a public HTTPS origin');
}
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
let validPublicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey);
if (!validPublicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publicKey)) {
  try { validPublicKey = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* Invalid client key. */ }
}
if (!validPublicKey) missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a public publishable/anon key, never a server key');
if (process.env.CRICKET_IOS_SIMULATOR === 'true') missing.push('CRICKET_IOS_SIMULATOR must be false for distribution');
if (process.env.EXPO_PUBLIC_QA_TOOLS === 'true') missing.push('EXPO_PUBLIC_QA_TOOLS must be false for distribution');
if (missing.length) {
  process.stderr.write(`iOS distribution setup incomplete:\n${missing.map(name => `- ${name}`).join('\n')}\nSee .env.ios.example and docs/IOS_PORT_2026-10-21.txt.\n`);
  process.exitCode = 1;
} else process.stdout.write('iOS client configuration format checks passed; store/Apple-provider/device verification remains separate.\n');
