/** Local crash facade used by the app shell and React error boundary. */

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
