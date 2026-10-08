const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { renderLegalSite } = require('./build-core.cjs');
const config = require('./legal.config.json');
const pages = renderLegalSite(config);
test('all five Auction XI routes are scoped to the correct app', () => {
  for (const route of ['', 'privacy/', 'terms/', 'support/', 'delete-data/']) {
    const html = pages[`products/auction-xi/${route}index.html`];
    assert.ok(html.includes('Auction XI'));
    assert.ok(html.includes('/products/auction-xi/privacy/'));
    assert.ok(html.includes('devsunlightpvt@gmail.com'));
    assert.ok(!html.includes('cricket-legacy'));
    assert.ok(!html.includes('href="/terms/"'));
  }
});
test('homepage includes both apps, and existing policies are unchanged by the addition', () => {
  assert.ok(pages['index.html'].includes('<h3>Auction XI</h3>'));
  assert.ok(pages['index.html'].includes('<h3>Cricket: Player and Manager</h3>'));
  const oldConfig = { ...config, products: config.products.filter(p => p.slug !== 'auction-xi') };
  const oldPages = renderLegalSite(oldConfig);
  for (const [route, html] of Object.entries(oldPages)) {
    if (route !== 'index.html') assert.equal(pages[route], html, route);
  }
});
test('Cricket: Player and Manager links to its Google Play listing only on its own pages', () => {
  const url = 'https://play.google.com/store/apps/details?id=com.coverdrive.cricket';
  assert.ok(pages['index.html'].includes(`href="${url}"`));
  assert.ok(pages['products/cricket-player-manager/index.html'].includes(`href="${url}"`));
  assert.ok(!pages['products/auction-xi/index.html'].includes(url));
});
test('all internal links and images resolve in generated pages or static assets', () => {
  for (const [page, html] of Object.entries(pages)) {
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const route = match[1].slice(1);
      assert.ok(pages[route + 'index.html'] || fs.existsSync(`${__dirname}/static/${route}`) || route === 'images/cricket-legacy-icon.png', `${page}: ${route}`);
    }
  }
});
test('privacy/deletion describe actual local-save and purchase behavior', () => {
  assert.ok(pages['products/auction-xi/privacy/index.html'].includes('pseudonymous app-user identifier'));
  assert.ok(pages['products/auction-xi/privacy/index.html'].includes('Advertising is disabled'));
  assert.ok(pages['products/auction-xi/delete-data/index.html'].includes('not other career slots'));
  assert.ok(pages['products/auction-xi/terms/index.html'].includes('does not create a real-money debt'));
});
