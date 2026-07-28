/**
 * Public API barrel for the platform/business service layer.
 *
 * Each service is re-exported as a namespace so call sites read clearly, e.g.:
 *   import { analytics, purchases, notifications } from '@/services';
 *   analytics.logEvent(analytics.EVT.MATCH_START);
 *   await purchases.purchase('remove_ads');
 *
 * The zustand hooks are also re-exported directly for ergonomic use in
 * components: `useConnectivity()` / `useAuth()`.
 */

export * as analytics from './analytics';
export * as crash from './crash';
export * as connectivity from './connectivity';
export * as purchases from './purchases';
export * as purchaseLedger from './purchaseLedger';
export * as accountPurchases from './accountPurchases';
export * as ads from './ads';
export * as cloud from './cloud';
export * as auth from './auth';
export * as sessionGate from './sessionGate';
export * as notifications from './notifications';

// Reactive hooks — re-exported top-level for direct use in React components.
export { useConnectivity } from './connectivity';
export { useAuth } from './auth';

// Frequently-referenced constant, handy to import directly.
export { EVT } from './analytics';
