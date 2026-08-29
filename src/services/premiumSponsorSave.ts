import { SaveGame } from '../domain/types';
import {
  currentRecoverableSupabaseUserId,
  getSupabaseClient,
  isSupabaseBackendEnabled,
} from './supabaseClient';

export type PremiumSponsorSaveDeletionResult =
  | { status: 'NO_PREMIUM' | 'LOCAL_ONLY' | 'DELETED' }
  | { status: 'NOT_CONFIGURED' | 'SIGN_IN_REQUIRED' | 'FAILED'; error: string };

interface DeleteResponse {
  ok?: unknown;
  status?: unknown;
  productId?: unknown;
  saveId?: unknown;
  deletedBindings?: unknown;
}

export function parsePremiumSponsorSaveDeletionResponse(
  data: unknown,
  save: SaveGame,
): PremiumSponsorSaveDeletionResult {
  const premium = save.sponsorship?.premium;
  if (!premium || !data || typeof data !== 'object') {
    return { status: 'FAILED', error: 'The deletion service returned an invalid response.' };
  }
  const response = data as DeleteResponse;
  if (
    response.ok === true &&
    response.status === 'deleted' &&
    response.productId === premium.productId &&
    response.saveId === save.id &&
    Number.isInteger(response.deletedBindings) &&
    Number(response.deletedBindings) >= 0
  ) {
    return { status: 'DELETED' };
  }
  return { status: 'FAILED', error: 'The server did not confirm permanent save deletion.' };
}

/**
 * Permanently destroys the exact-save premium sponsor binding before local
 * storage is removed. Development mock grants never have a server binding.
 */
export async function deletePremiumSponsorExactSave(
  save: SaveGame,
): Promise<PremiumSponsorSaveDeletionResult> {
  const premium = save.sponsorship?.premium;
  if (!premium) return { status: 'NO_PREMIUM' };
  if (premium.boundSaveId !== save.id) {
    return { status: 'FAILED', error: 'The sponsor is not bound to this exact save.' };
  }
  if (premium.purchaseToken.startsWith('mock:')) return { status: 'LOCAL_ONLY' };
  if (!isSupabaseBackendEnabled()) {
    return {
      status: 'NOT_CONFIGURED',
      error: 'Secure save deletion is not configured in this build.',
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'NOT_CONFIGURED',
      error: 'Secure save deletion is not configured in this build.',
    };
  }
  if (!(await currentRecoverableSupabaseUserId())) {
    return {
      status: 'SIGN_IN_REQUIRED',
      error: 'Sign in to the account that purchased this sponsor before deleting the save.',
    };
  }
  try {
    const { data, error } = await client.functions.invoke('premium-sponsor-reconcile', {
      method: 'POST',
      body: {
        action: 'delete',
        productId: premium.productId,
        mode: save.mode,
        saveId: save.id,
      },
    });
    if (error) {
      return {
        status: 'FAILED',
        error: 'The secure deletion service could not be reached. Nothing was deleted.',
      };
    }
    return parsePremiumSponsorSaveDeletionResponse(data, save);
  } catch {
    return {
      status: 'FAILED',
      error: 'The secure deletion service could not be reached. Nothing was deleted.',
    };
  }
}
