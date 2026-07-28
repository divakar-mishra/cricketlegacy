import type { PurchaseResult } from './purchases';

export type PurchaseState = 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'REFUNDED' | 'REVOKED';
export type VerificationState = 'VERIFIED' | 'UNVERIFIED' | 'LOCAL_MOCK';
export type GrantState = 'NOT_GRANTED' | 'GRANTED' | 'BLOCKED' | 'DUPLICATE';

export interface PurchaseLedgerEntry {
  purchaseToken: string;
  storeTransactionId?: string;
  productId: string;
  userId: string;
  purchaseState: PurchaseState;
  verificationState: VerificationState;
  grantState: GrantState;
  grantVersion: number;
  grantedContents: string[];
  consumedAt?: number;
  acknowledgedAt?: number;
  restoredAt?: number;
  refundedAt?: number;
  revokedAt?: number;
  promotionId?: string;
  promotionApplied: boolean;
  createdAt: number;
  updatedAt: number;
}

export const PURCHASE_GRANT_VERSION = 1;

export function ledgerFlagKey(purchaseToken: string): string {
  return `purchaseToken:${purchaseToken}`;
}

export function createLedgerEntry(params: {
  result: PurchaseResult & { purchaseToken: string };
  userId: string;
  now?: number;
  grantedContents?: string[];
  promotionId?: string;
  promotionApplied?: boolean;
}): PurchaseLedgerEntry {
  const now = params.now ?? Date.now();
  return {
    purchaseToken: params.result.purchaseToken,
    storeTransactionId: params.result.purchaseToken,
    productId: params.result.productId,
    userId: params.userId,
    purchaseState: params.result.purchaseState ?? 'PURCHASED',
    verificationState: params.result.verificationState ?? 'UNVERIFIED',
    grantState: 'NOT_GRANTED',
    grantVersion: PURCHASE_GRANT_VERSION,
    grantedContents: params.grantedContents ?? [],
    promotionId: params.promotionId,
    promotionApplied: params.promotionApplied ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function canGrantLedgerEntry(entry: PurchaseLedgerEntry): boolean {
  if (entry.purchaseState !== 'PURCHASED') return false;
  return entry.verificationState === 'VERIFIED' || entry.verificationState === 'LOCAL_MOCK';
}
