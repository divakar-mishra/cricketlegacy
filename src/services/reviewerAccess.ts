import { getSupabaseClient } from './supabaseClient';

/** No cached privilege, local email allowlist, metadata trust, or QA override. */
export async function authorizeReviewerAccess(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const before = await client.auth.getSession();
    const session = before.data.session;
    if (before.error || !session || session.user.is_anonymous) return false;
    const { data, error } = await client.rpc('authorize_reviewer_access');
    const after = await client.auth.getSession();
    return !error && !after.error && data === session.user.id &&
      after.data.session?.access_token === session.access_token;
  } catch {
    return false;
  }
}
