import { createClient } from 'npm:@supabase/supabase-js@2.110.1';
import { SignJWT, importPKCS8 } from 'npm:jose@6.1.0';
import { evaluateIntegrity } from '../_shared/playIntegrityVerdict.ts';

const PACKAGE = 'com.coverdrive.cricket';
const respond = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
const required = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error('configuration_missing');
  return value;
};

// Never put this credential in the APK. Tokens stay only in server memory.
let access: { value: string; expires: number } | undefined;
async function googleAccessToken() {
  if (access && access.expires > Date.now()) return access.value;
  const credential = JSON.parse(required('PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON'));
  const key = await importPKCS8(credential.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/playintegrity' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(credential.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error('google_auth_unavailable');
  const result = await response.json();
  if (typeof result.access_token !== 'string') throw new Error('google_auth_unavailable');
  access = { value: result.access_token, expires: Date.now() + 240_000 };
  return access.value;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  try {
    if (Deno.env.get('PLAY_INTEGRITY_ENABLED') !== 'true')
      return respond({ status: 'UNAVAILABLE' }, 503);
    const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return respond({ error: 'authentication_required' }, 401);
    const { data: identity, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !identity.user) return respond({ error: 'authentication_required' }, 401);
    const text = await request.text();
    if (text.length > 32_000) return respond({ error: 'request_too_large' }, 413);
    const body = JSON.parse(text);
    const userId = identity.user.id;
    if (body.action === 'challenge') {
      const input = new TextEncoder().encode(`${PACKAGE}:${userId}:${crypto.randomUUID()}`);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      const { data, error } = await admin.rpc('issue_play_integrity_challenge', {
        p_user_id: userId,
        p_hash: hash,
      });
      if (error) throw new Error('challenge_unavailable');
      if (data !== true) return respond({ status: 'UNAVAILABLE' }, 429);
      return respond({ requestHash: hash });
    }
    if (
      body.action !== 'verify' ||
      typeof body.token !== 'string' ||
      typeof body.requestHash !== 'string'
    )
      return respond({ error: 'invalid_request' }, 400);
    // Claim once atomically BEFORE calling Google. Retries require a new challenge.
    const { data: challenge, error } = await admin
      .from('play_integrity_challenges')
      .update({ consumed: true })
      .eq('user_id', userId)
      .eq('request_hash', body.requestHash)
      .eq('consumed', false)
      .gte('issued_at', new Date(Date.now() - 120_000).toISOString())
      .select('user_id');
    if (error || challenge?.length !== 1) return respond({ status: 'UNAVAILABLE' }, 409);
    const certificates = required('PLAY_INTEGRITY_CERTIFICATES')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const response = await fetch(
      `https://playintegrity.googleapis.com/v1/${PACKAGE}:decodeIntegrityToken`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${await googleAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrity_token: body.token }),
      },
    );
    if (!response.ok) throw new Error('google_verification_unavailable');
    const decoded = await response.json();
    if (!decoded.tokenPayloadExternal) throw new Error('missing_verdict');
    const status = evaluateIntegrity(decoded.tokenPayloadExternal, {
      requestHash: body.requestHash,
      packageName: PACKAGE,
      certificates,
      now: Date.now(),
    });
    return respond({ status });
  } catch {
    // Do not log credentials, raw tokens or save/account data.
    return respond({ status: 'UNAVAILABLE' }, 503);
  }
});
