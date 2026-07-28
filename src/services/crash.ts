/**
 * Crash / error reporting facade — wired to Sentry.
 *
 * Uses a lazy require() so the native Sentry module is only loaded in EAS
 * Dev Builds. Falls back to console-only logging in Expo Go, web, and Jest.
 *
 * ─── Setup (one-time, done in Android Studio / EAS) ──────────────────────────
 *  1. Create a project at https://sentry.io
 *  2. Get your DSN from  Settings → Projects → {your project} → Client Keys
 *  3. Set SENTRY_DSN below (keep it in a .env / EAS secret in production)
 *  4. Set SENTRY_ENABLED = true  below and rebuild.
 *  5. For source maps: add "@sentry/react-native/metro" to metro.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IS_DEV: boolean = ((): boolean => {
  const g = globalThis as { __DEV__?: boolean };
  return typeof g.__DEV__ === 'boolean' ? g.__DEV__ : false;
})();

// ─── Toggle: set true after adding your DSN ───────────────────────────────────
const SENTRY_ENABLED = false;
const SENTRY_DSN = 'YOUR_SENTRY_DSN_HERE'; // Replace with your actual DSN

export type CrashLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface Breadcrumb {
  message: string;
  ts: number;
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsShape {
  getGlobalHandler?: () => GlobalErrorHandler | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
}

const BREADCRUMB_CAPACITY = 50;
const trail: Breadcrumb[] = [];

// ─── Sentry lazy accessor ─────────────────────────────────────────────────────
let sentryInitialized = false;

function getSentry(): typeof import('@sentry/react-native') | null {
  if (!SENTRY_ENABLED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    if (!sentryInitialized) {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: IS_DEV ? 'development' : 'production',
        tracesSampleRate: IS_DEV ? 1.0 : 0.2,
        // Enable performance monitoring for match engine
        enableTracing: true,
        // Don't send events in development — just log them
        enabled: !IS_DEV,
      });
      sentryInitialized = true;
    }
    return Sentry;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function addBreadcrumb(msg: string): void {
  trail.push({ message: msg, ts: Date.now() });
  if (trail.length > BREADCRUMB_CAPACITY) trail.shift();
  getSentry()?.addBreadcrumb({ message: msg });
}

export function captureException(e: unknown, context?: Record<string, unknown>): void {
  if (IS_DEV) {
    console.error('[crash] exception', e, context ?? {});
  }
  const sentry = getSentry();
  if (sentry) {
    sentry.captureException(e, { extra: context });
  }
}

export function captureMessage(msg: string, level: CrashLevel = 'info'): void {
  if (IS_DEV) {
    console.log(`[crash:${level}] ${msg}`);
  }
  getSentry()?.captureMessage(msg, level);
}

/** Sets user context on Sentry (call after login/save load). */
export function setUser(id: string, username?: string): void {
  getSentry()?.setUser({ id, username });
}

/** Clears Sentry user context (call on logout). */
export function clearUser(): void {
  getSentry()?.setUser(null);
}

export function getBreadcrumbs(): readonly Breadcrumb[] {
  return trail.slice();
}

let installed = false;

export function installGlobalHandler(): void {
  if (installed) return;

  // Initialize Sentry early
  getSentry();

  try {
    const g = globalThis as { ErrorUtils?: ErrorUtilsShape };
    const errorUtils = g.ErrorUtils;
    if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') return;

    const previous =
      typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : undefined;

    errorUtils.setGlobalHandler((error, isFatal) => {
      captureException(error, { isFatal: Boolean(isFatal), source: 'global-handler' });
      if (previous) {
        try {
          previous(error, isFatal);
        } catch {
          /* ignore secondary failures */
        }
      }
    });
    installed = true;
  } catch (err) {
    if (IS_DEV) console.warn('[crash] installGlobalHandler failed', err);
  }
}
