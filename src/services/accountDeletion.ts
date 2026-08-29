import {
  getSupabaseClient,
  isSupabaseBackendEnabled,
  currentSupabaseSession,
} from './supabaseClient';

export type AccountDeletionResult =
  | { status: 'DELETED'; requestId: string }
  | { status: 'NOT_CONFIGURED' }
  | { status: 'NO_REMOTE_SESSION' }
  | { status: 'FAILED'; error: string };

interface DeleteAccountResponse {
  status?: unknown;
  requestId?: unknown;
}

export function parseAccountDeletionResponse(data: unknown): AccountDeletionResult {
  if (!data || typeof data !== 'object') {
    return { status: 'FAILED', error: 'The deletion service returned an invalid response.' };
  }
  const response = data as DeleteAccountResponse;
  if (
    response.status === 'deleted' &&
    typeof response.requestId === 'string' &&
    /^[a-f0-9]{64}$/.test(response.requestId)
  ) {
    return { status: 'DELETED', requestId: response.requestId };
  }
  return { status: 'FAILED', error: 'The deletion service did not confirm deletion.' };
}

/**
 * Permanently deletes the currently authenticated Supabase account.
 *
 * The Edge Function receives an empty body and derives the account only from
 * the Supabase bearer session. Local-only deletion remains a separate device
 * operation in LoginScreen.
 */
export async function deleteCurrentRemoteAccount(): Promise<AccountDeletionResult> {
  if (!isSupabaseBackendEnabled()) return { status: 'NOT_CONFIGURED' };
  const client = getSupabaseClient();
  if (!client) return { status: 'NOT_CONFIGURED' };

  const session = await currentSupabaseSession();
  if (!session) return { status: 'NO_REMOTE_SESSION' };

  try {
    const { data, error } = await client.functions.invoke('delete-account', {
      method: 'POST',
      body: {},
    });
    if (error) return { status: 'FAILED', error: 'The deletion service could not be reached.' };
    return parseAccountDeletionResponse(data);
  } catch {
    return { status: 'FAILED', error: 'The deletion service could not be reached.' };
  }
}
