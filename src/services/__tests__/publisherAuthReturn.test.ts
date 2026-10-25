import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const siteRoot = path.join(__dirname, '../../../legal-site');
const script = fs.readFileSync(path.join(siteRoot, 'static/auth-return.js'), 'utf8');
const headers = fs.readFileSync(path.join(siteRoot, 'static/_headers'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderLegalSite } = require(path.join(siteRoot, 'build-core.cjs'));
const config = JSON.parse(fs.readFileSync(path.join(siteRoot, 'legal.config.json'), 'utf8'));

function run(hash: string, pathname = '/', historyThrows = false) {
  const elements = Object.fromEntries([
    'google-sign-in-retry', 'publisher-content', 'google-sign-in-retry-title',
    'google-sign-in-retry-message', 'google-sign-in-return',
  ].map(id => [id, { hidden: id === 'google-sign-in-retry', textContent: '', href: '', focus: jest.fn() }]));
  const replaceState = jest.fn(() => { if (historyThrows) throw new Error('History unavailable'); });
  const document = { getElementById: (id: string) => elements[id], title: 'Sunlight' };
  const location = { hash, pathname };
  vm.runInNewContext(script, { window: { location, history: { replaceState } }, document, URLSearchParams });
  return { elements, document, location, replaceState };
}

describe('publisher OAuth error-only return page', () => {
  it.each(['', '#products', '#access_token=secret&refresh_token=secret', '#error_code=unknown', '#error_description=expired'])('leaves ordinary visits and unrelated callbacks unchanged: %s', hash => {
    const { elements, replaceState } = run(hash);
    expect(elements['google-sign-in-retry'].hidden).toBe(true);
    expect(elements['publisher-content'].hidden).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it.each(['bad_oauth_state&error_description=OAuth%20state%20has%20expired', 'flow_state_expired', 'oauth_client_state_expired'])('offers a fixed game return link for expired state: %s', code => {
    const { elements, replaceState, document } = run('#error_code=' + code);
    expect(elements['google-sign-in-retry'].hidden).toBe(false);
    expect(elements['publisher-content'].hidden).toBe(true);
    expect(elements['google-sign-in-retry-title'].textContent).toBe('Sign-in expired');
    expect(document.title).toBe('Sign-in expired · Sunlight');
    expect(elements['google-sign-in-return'].href).toBe('coverdrive://auth/callback?error=access_denied&error_code=bad_oauth_state&error_description=Sign-in%20expired.');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(elements['google-sign-in-retry-title'].focus).toHaveBeenCalledTimes(1);
  });

  it('does not invent an expiry for an invalid state', () => {
    const { elements } = run('#error_code=bad_oauth_state&error_description=Invalid%20state');
    expect(elements['google-sign-in-retry-title'].textContent).toBe('Sign-in not completed');
    expect(elements['google-sign-in-return'].href).toContain('did%20not%20complete');
  });

  it('never forwards tokens, user input, external redirects or HTML from the URL', () => {
    const { elements, location } = run('#error_code=bad_oauth_state&error_description=%3Cscript%3Eexpired%3C/script%3E&access_token=private-access&refresh_token=private-refresh&code=private-code&state=private-state&next=https://evil.test');
    const rendered = JSON.stringify(elements);
    for (const secret of ['private-access', 'private-refresh', 'private-code', 'private-state', 'evil.test', '<script>']) expect(rendered).not.toContain(secret);
    expect(location).not.toHaveProperty('href'); // No automatic app open / navigation loop.
  });

  it('keeps guidance available if history cleanup is unavailable', () => {
    expect(run('#error_code=flow_state_expired', '/', true).elements['google-sign-in-retry'].hidden).toBe(false);
  });

  it('uses provider-neutral copy for Apple and ignores untrusted provider hints', () => {
    const { elements } = run('#error_code=flow_state_expired&provider=Apple%3Cscript%3E&redirect_to=https://evil.test');
    expect(elements['google-sign-in-retry-title'].textContent).toBe('Sign-in expired');
    expect(JSON.stringify(elements)).not.toMatch(/Google|Apple|evil\.test|<script>/);
    const home = renderLegalSite(config)['index.html'];
    expect(home).toContain('Apple button where available');
  });

  it('does not affect another product route', () => {
    expect(run('#error_code=flow_state_expired', '/products/auction-xi/').elements['google-sign-in-retry'].hidden).toBe(true);
  });

  it('loads only a same-origin external script on the publisher homepage', () => {
    const pages = renderLegalSite(config);
    expect(pages['index.html']).toContain('<script src="/auth-return.js" defer></script>');
    expect(pages['index.html']).toContain('Do not uninstall the game to retry.');
    for (const [name, html] of Object.entries(pages)) if (name !== 'index.html') expect(html).not.toContain('auth-return.js');
    expect(headers).toContain("default-src 'none'; script-src 'self'");
    expect(headers).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(script).not.toMatch(/innerHTML|localStorage|sessionStorage|fetch\(|console\./);
  });
});
