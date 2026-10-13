import type { GameMode } from '../domain/types';
import type { PurchaseRecoverySnapshot, PurchaseResult } from './purchases';

export interface PendingCheckout {
  version: 1;
  saveId: string;
  mode: GameMode;
  slot: number;
  productId: string;
  clubId?: string;
  seasonId?: string;
  accountId: string;
  startedAt: number;
  previousTransactions: string[];
  result?: PurchaseResult;
}

export type PurchaseRecoveryOutcome =
  | { status: 'NONE' | 'PENDING' | 'NOT_PURCHASED' }
  | { status: 'DELIVERED'; mode: GameMode; saveId: string; productId: string };

/** Only a provider-proven guest-to-account link may cross the checkout ID.
 * Ordinary account switches, sign-out, and missing receipt evidence stay closed.
 */
export function isCheckoutAccountVerified(intent: PendingCheckout, snapshot: PurchaseRecoverySnapshot): boolean {
  if (snapshot.accountId === intent.accountId) return true;
  if (!intent.accountId.startsWith('$RCAnonymousID:') ||
      snapshot.accountId.startsWith('$RCAnonymousID:') ||
      snapshot.originalAccountId !== intent.accountId) return false;
  return snapshot.transactions.some(transaction =>
    transaction.productId === intent.productId &&
    !intent.previousTransactions.includes(transaction.token) &&
    transaction.purchasedAt >= intent.startedAt &&
    (!intent.result || transaction.token === intent.result.purchaseToken));
}

// A single outstanding checkout prevents an ambiguous receipt being assigned
// to two careers. SecureStore keeps the receipt separate from a failed career
// write and protects it from plaintext grant forgery. Never erase on sign-out.
const KEY = 'cricket.pending.checkout.v1';

async function storage(): Promise<typeof import('expo-secure-store')> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-secure-store');
}

export async function readPendingCheckout(): Promise<PendingCheckout | null> {
  const raw = await (await storage()).getItemAsync(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingCheckout;
  if (value.version !== 1 || !value.saveId || !value.productId || !value.accountId ||
      !['career', 'manager'].includes(value.mode) || !Number.isInteger(value.slot) ||
      !Array.isArray(value.previousTransactions)) {
    throw new Error('Purchase recovery record unavailable. Contact support; do not clear app data.');
  }
  return value;
}

export async function writePendingCheckout(value: PendingCheckout): Promise<void> {
  const store = await storage();
  await store.setItemAsync(KEY, JSON.stringify(value), {
    keychainAccessible: store.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearPendingCheckout(): Promise<void> {
  await (await storage()).deleteItemAsync(KEY);
}

export class PendingPurchaseSaveError extends Error {
  constructor() {
    super('This career has an unfinished purchase. Use Check pending purchase in the Store or contact support before deleting it.');
    this.name = 'PendingPurchaseSaveError';
  }
}

/** Retain the delivery destination until its paid transaction is resolved. */
export async function assertNoPendingPurchaseForSlot(mode: GameMode, slot: number): Promise<void> {
  // An unreadable journal also fails closed: do not destroy possible evidence.
  const pending = await readPendingCheckout();
  if (pending?.mode === mode && pending.slot === slot) throw new PendingPurchaseSaveError();
}
