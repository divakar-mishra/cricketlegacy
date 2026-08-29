/**
 * Public API barrel for the platform/business service layer.
 *
 * Each service is re-exported as a namespace so call sites read clearly, e.g.:
 *   import { analytics, purchases, notifications } from '@/services';
 *   analytics.logEvent(analytics.EVT.MATCH_START);
 *   await purchases.purchase('remove_ads');
 *
 * The auth hook is also re-exported directly for ergonomic use in components.
 */

export * as analytics from './analytics';
export * as crash from './crash';
export * as connectivity from './connectivity';
export * as purchases from './purchases';
export * as purchaseLedger from './purchaseLedger';
export * as accountPurchases from './accountPurchases';
export * as accountDeletion from './accountDeletion';
export * as premiumSponsorSave from './premiumSponsorSave';
export * as ads from './ads';
export * as cloud from './cloud';
export * as onlineLeaderboard from './onlineLeaderboard';
export * as antiCheat from './antiCheat';
export * as auth from './auth';
export * as sessionGate from './sessionGate';
export * as notifications from './notifications';

// Reactive hooks — re-exported top-level for direct use in React components.
export { useAuth } from './auth';
