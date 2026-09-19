import { canSendCrashes, firebaseCrashes } from './telemetry';

/** Never send raw messages or context (they can contain account/save data). */
export function sanitizedException(error: unknown): Error {
  const safe = new Error('Application error');
  safe.name =
    error instanceof TypeError ? 'TypeError' : error instanceof RangeError ? 'RangeError' : 'Error';
  const frames =
    error instanceof Error
      ? (error.stack ?? '').split('\n').flatMap((line) => {
          const match = line.match(/(?:index\.android\.bundle|index\.bundle):(\d+):(\d+)/);
          return match ? [`    at bundle (index.android.bundle:${match[1]}:${match[2]})`] : [];
        })
      : [];
  safe.stack = `${safe.name}: ${safe.message}\n${frames.slice(0, 30).join('\n')}`;
  return safe;
}

const IS_DEV: boolean = ((): boolean => {
  const globalState = globalThis as { __DEV__?: boolean };
  return typeof globalState.__DEV__ === 'boolean' ? globalState.__DEV__ : false;
})();

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsShape {
  getGlobalHandler?: () => GlobalErrorHandler | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (IS_DEV) {
    console.error('[crash] exception', error, context ?? {});
  }
  if (!canSendCrashes()) return;
  try {
    const c = firebaseCrashes();
    c.recordError(c.getCrashlytics(), sanitizedException(error));
  } catch {
    /* Reporting must never cause another failure. */
  }
}

let installed = false;

export function installGlobalHandler(): void {
  if (installed) return;

  try {
    const globalState = globalThis as { ErrorUtils?: ErrorUtilsShape };
    const errorUtils = globalState.ErrorUtils;
    if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') return;

    const previous =
      typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : undefined;

    errorUtils.setGlobalHandler((error, isFatal) => {
      captureException(error, { isFatal: Boolean(isFatal), source: 'global-handler' });
      if (previous) {
        try {
          previous(error, isFatal);
        } catch {
          // Ignore a secondary failure in the platform handler.
        }
      }
    });
    installed = true;
  } catch (error) {
    if (IS_DEV) console.warn('[crash] installGlobalHandler failed', error);
  }
}
