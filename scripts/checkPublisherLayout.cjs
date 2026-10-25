/* Isolated public-page Chromium check. Never attaches to an owner's browser. */
/* global require, process, WebSocket, setTimeout, clearTimeout */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Buffer } = require('node:buffer');

async function main() {
  const origin = new URL(process.argv[2] || 'http://127.0.0.1:8765');
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Supply an HTTP(S) origin only.');
  if (origin.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('Non-HTTPS previews must be localhost.');
  const output = path.resolve(process.argv[3] || 'output/website-layout');
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cricket-website-layout-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Isolated Chrome did not start')), 20000);
      let log = '';
      chrome.on('error', error => { clearTimeout(timeout); reject(error); });
      chrome.stderr.on('data', data => {
        log = (log + data.toString()).slice(-16000);
        const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const waiting = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const entry = waiting.get(message.id);
      if (entry) { clearTimeout(entry.timeout); waiting.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { waiting.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      waiting.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    await call('Page.enable');
    const results = [];
    for (const [name, route, width, height] of [
      ['home-mobile', '/', 390, 1100],
      ['mobile', '/products/cricket-player-manager/', 390, 1100],
      ['age', '/products/cricket-player-manager/#age-suitability', 390, 1100],
      ['privacy-small', '/privacy/', 320, 1000],
      ['delete-mobile', '/delete-account/', 390, 1100],
      ['auction-mobile', '/products/auction-xi/', 390, 1100],
      ['support', '/support/', 1440, 1150],
    ]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      const url = new URL(route, origin).href;
      const navigation = await call('Page.navigate', { url });
      if (navigation.errorText) throw new Error(navigation.errorText);
      for (let attempt = 0; attempt < 40; attempt++) {
        const ready = await call('Runtime.evaluate', { expression: 'document.readyState === "complete" && !!document.querySelector("main")', returnByValue: true });
        if (ready.result?.value) break;
        if (attempt === 39) throw new Error(`Page did not load: ${route}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const metrics = await call('Runtime.evaluate', {
        expression: `(async () => { await document.fonts.ready; document.documentElement.style.scrollBehavior = 'auto'; const id = location.hash.slice(1); if (id) document.getElementById(id)?.scrollIntoView(); else scrollTo(0,0); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); const w = innerWidth; return { title: document.title, viewportWidth: w, scrollWidth: document.documentElement.scrollWidth, hashFound: !id || !!document.getElementById(id), overflow: [...document.querySelectorAll('main *, nav *, footer *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1); }).slice(0,12).map(e => ({tag:e.tagName, class:e.className, text:e.textContent.slice(0,80)})) }; })()`,
        awaitPromise: true, returnByValue: true,
      });
      if (metrics.exceptionDetails) throw new Error(`Layout inspection failed: ${route}`);
      const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(output, `website-${name}.png`), Buffer.from(screenshot.data, 'base64'));
      const value = metrics.result.value;
      results.push({ name, route, width, height, ...value, passed: value.viewportWidth === width && value.scrollWidth <= width + 1 && value.hashFound && value.overflow.length === 0 });
    }
    const report = { checkedAt: new Date().toISOString(), origin: origin.origin, isolatedProfile: profile, passed: results.every(result => result.passed), results };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.passed) process.exitCode = 1;
  } finally {
    socket?.close();
    chrome.kill('SIGTERM');
  }
}
main().catch(error => { process.stderr.write(`Website layout check failed: ${error.message}\n`); process.exitCode = 1; });
