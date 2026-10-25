/* First-party error-only fallback. Never forward credentials or trust a return URL from the page. */
(function () {
  'use strict';
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const code = params.get('error_code');
  if (code !== 'bad_oauth_state' && code !== 'flow_state_expired' && code !== 'oauth_client_state_expired') return;
  const panel = document.getElementById('google-sign-in-retry');
  const content = document.getElementById('publisher-content');
  const title = document.getElementById('google-sign-in-retry-title');
  const message = document.getElementById('google-sign-in-retry-message');
  const link = document.getElementById('google-sign-in-return');
  if (!panel || !content || !title || !message || !link) return;
  const expired = code !== 'bad_oauth_state' || /\bexpired\b/i.test(params.get('error_description') || '');
  title.textContent = expired ? 'Sign-in expired' : 'Sign-in not completed';
  message.textContent = expired
    ? 'This sign-in page expired before it finished. Return to the game to start a fresh sign-in.'
    : 'This sign-in could not be completed. Return to the game and try again.';
  // Only a fixed, error-only deep link. No tokens, code, state, email or next/redirect parameter.
  link.href = 'coverdrive://auth/callback?error=access_denied&error_code=bad_oauth_state&error_description=' +
    (expired ? 'Sign-in%20expired.' : 'Sign-in%20did%20not%20complete.');
  try { window.history.replaceState(null, '', window.location.pathname); } catch (_) { /* Guidance still works if history is unavailable. */ }
  panel.hidden = false;
  content.hidden = true;
  document.title = title.textContent + ' · Sunlight';
  title.focus();
})();
