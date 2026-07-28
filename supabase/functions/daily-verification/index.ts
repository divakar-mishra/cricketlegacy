import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const body = await req.json().catch(() => ({}));
  const { data, error } = await supabase.rpc('record_daily_verification', {
    p_client_seen_at: typeof body.clientSeenAt === 'string' ? body.clientSeenAt : null,
    p_app_version: typeof body.appVersion === 'string' ? body.appVersion : null,
    p_build_commit: typeof body.buildCommit === 'string' ? body.buildCommit : null,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ verification: Array.isArray(data) ? data[0] : data }), {
    status: 200,
    headers: jsonHeaders,
  });
});
