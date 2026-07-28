/**
 * Connectivity service — thin, dependency-optional wrapper around
 * `@react-native-community/netinfo`.
 *
 * The native module is loaded lazily via `require()` inside a try/catch so the
 * JS bundle keeps running even when NetInfo is not present at runtime (e.g. a
 * stripped Expo Go client, web, or jest). When the module is missing every
 * method degrades gracefully:
 *   - `isOnline()` resolves to `true` (assume connected)
 *   - `subscribe()` returns a no-op unsubscribe
 *   - the `useConnectivity` store stays at its optimistic `online: true` default
 */

import { create } from 'zustand';

/** Minimal shape of the NetInfo state we rely on. */
interface NetInfoState {
  isConnected: boolean | null;
}

/** Minimal shape of the NetInfo module we rely on. */
interface NetInfoModule {
  fetch: () => Promise<NetInfoState>;
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
}

/** Normalises `module` / `module.default` interop without using `any`. */
function pickModule(required: unknown): Record<string, unknown> | null {
  if (required && typeof required === 'object') {
    const asDefault = (required as { default?: unknown }).default;
    if (asDefault && typeof asDefault === 'object') return asDefault as Record<string, unknown>;
    return required as Record<string, unknown>;
  }
  return null;
}

/** Lazily resolves NetInfo, returning `null` if unavailable. Never throws. */
function loadNetInfo(): NetInfoModule | null {
  try {
    // Literal string is required so Metro can statically resolve the module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = pickModule(require('@react-native-community/netinfo'));
    if (
      mod &&
      typeof (mod as { fetch?: unknown }).fetch === 'function' &&
      typeof (mod as { addEventListener?: unknown }).addEventListener === 'function'
    ) {
      return mod as unknown as NetInfoModule;
    }
    return null;
  } catch {
    return null;
  }
}

/** Treats `null`/`undefined` connectivity as online (optimistic default). */
function toOnline(state: NetInfoState | null | undefined): boolean {
  return state?.isConnected !== false;
}

/** Resolves the current connectivity. Defaults to `true` if NetInfo is absent. */
export async function isOnline(): Promise<boolean> {
  const netInfo = loadNetInfo();
  if (!netInfo) return true;
  try {
    return toOnline(await netInfo.fetch());
  } catch {
    return true;
  }
}

/**
 * Subscribes to connectivity changes. Returns an unsubscribe function; if
 * NetInfo is unavailable the returned function is a safe no-op.
 */
export function subscribe(cb: (online: boolean) => void): () => void {
  const netInfo = loadNetInfo();
  if (!netInfo) return () => undefined;
  try {
    const unsubscribe = netInfo.addEventListener((state) => cb(toOnline(state)));
    return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
  } catch {
    return () => undefined;
  }
}

interface ConnectivityState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

/** Lightweight reactive connectivity store. Optimistically starts online. */
export const useConnectivity = create<ConnectivityState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

let watching = false;

/**
 * Starts a NetInfo listener that keeps {@link useConnectivity} in sync. Safe to
 * call multiple times (idempotent) and a no-op when NetInfo is unavailable.
 * Returns an unsubscribe function.
 */
export function startConnectivityWatch(): () => void {
  if (watching) return () => undefined;
  watching = true;
  const apply = (online: boolean): void => useConnectivity.getState().setOnline(online);
  // Seed the store with the current value, then keep it live.
  void isOnline().then(apply);
  const unsubscribe = subscribe(apply);
  return () => {
    watching = false;
    unsubscribe();
  };
}

// Auto-start the watcher on import. Fully guarded internally, so this is a
// no-op when NetInfo is missing and never throws at module-load time.
startConnectivityWatch();
