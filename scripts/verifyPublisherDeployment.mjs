// Read-only comparison of a built static site against its public deployment.
// Usage: node scripts/verifyPublisherDeployment.mjs https://HOST
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const origin = new URL(process.argv[2] ?? 'https://sunlight-publisher-site.pages.dev');
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Supply an HTTPS origin, without credentials, path or query');
}
const directory = path.resolve('legal-site/dist');
const hash = data => createHash('sha256').update(data).digest('hex');
const files = fs.readdirSync(directory, { recursive: true }).filter(name =>
  fs.statSync(path.join(directory, name)).isFile() && !['_headers', '_redirects'].includes(name));
const results = [];
// Small batches avoid a request burst against the publisher origin.
for (let offset = 0; offset < files.length; offset += 4) {
  results.push(...await Promise.all(files.slice(offset, offset + 4).map(async name => {
    const route = name === 'index.html' ? '/' : '/' + name.replace(/\/index\.html$/, '/');
    const local = fs.readFileSync(path.join(directory, name));
    const url = new URL(route, origin);
    url.searchParams.set('deployment_check', hash(local).slice(0, 16));
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
      const remote = Buffer.from(await response.arrayBuffer());
      const matched = response.status === 200 && hash(remote) === hash(local);
      return { route, status: response.status, matched, localSha256: hash(local), remoteSha256: hash(remote), contentType: response.headers.get('content-type'), nosniff: response.headers.get('x-content-type-options') };
    } catch (error) {
      return { route, matched: false, error: error.message };
    }
  })));
}
const legacy = await fetch(new URL('/products/cricket-legacy/', origin), { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
const location = legacy.headers.get('location');
const legacyMatched = [301, 302, 307, 308].includes(legacy.status) &&
  location && new URL(location, origin).pathname === '/products/cricket-player-manager/';
const seller = results.find(result => result.route === '/app-ads.txt');
const securityMatched = results.every(result => result.nosniff === 'nosniff') && seller?.contentType?.startsWith('text/plain');
console.log(JSON.stringify({ origin: origin.origin, checkedAt: new Date().toISOString(), matched: results.every(result => result.matched) && Boolean(legacyMatched) && Boolean(securityMatched), files: results, legacyRedirect: { status: legacy.status, location, matched: Boolean(legacyMatched) }, securityMatched: Boolean(securityMatched) }, null, 2));
if (results.some(result => !result.matched) || !legacyMatched || !securityMatched) process.exitCode = 1;
