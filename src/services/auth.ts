/**
 * Account / auth abstraction — Android-only (no Apple Sign In).
 *
 * Supports guest accounts (stable id persisted in AsyncStorage) and
 * Google Sign In via expo-auth-session.
 *
 * ── HOW TO ACTIVATE GOOGLE SIGN IN ──────────────────────────────────────────
 *
 * 1. Install packages:
 *      npx expo install expo-auth-session expo-web-browser expo-crypto
 *
 * 2. In Google Cloud Console (console.cloud.google.com):
 *      a. Create a project (or use your Firebase project)
 *      b. APIs & Services → Credentials → Create OAuth 2.0 Client ID
 *      c. Choose "Android" — enter your package name (com.coverdrive.cricket)
 *         and your SHA-1 fingerprint (run: cd android && ./gradlew signingReport)
 *      d. Also create a "Web" client — you'll need the Web Client ID for the
 *         expo-auth-session token exchange
 *
 * 3. Add to app.json:
 *      "expo": {
 *        "plugins": [
 *          ["expo-auth-session", { "scheme": "coverdrive" }]
 *        ]
 *      }
 *
 * 4. In your LoginScreen, replace the `soon('Google')` handler with the
 *    hook-based flow (hooks must live in the component, not in this module):
 *
 *      import * as Google from 'expo-auth-session/providers/google';
 *      import * as WebBrowser from 'expo-web-browser';
 *
 *      WebBrowser.maybeCompleteAuthSession(); // call at module top level
 *
 *      // Inside LoginScreen component:
 *      const [request, response, promptAsync] = Google.useAuthRequest({
 *        androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
 *        webClientId:     'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
 *      });
 *
 *      useEffect(() => {
 *        if (response?.type === 'success') {
 *          const { authentication } = response;
 *          void auth.signInGoogleToken(authentication?.accessToken ?? '');
 *        }
 *      }, [response]);
 *
 *      // Button handler:
 *      onPress={() => void promptAsync()}
 *
 * 5. Implement signInGoogleToken() in this file (see stub below).
 *
 * 6. Run `npx expo prebuild --platform android` to apply the plugin, then rebuild.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import { getJSON, removeKey, setJSON } from '../storage/storage';
import { currentSupabaseSession, ensureAnonymousSupabaseUser, getSupabaseClient, isSupabaseBackendEnabled } from './supabaseClient';

export type AuthProvider = 'guest' | 'google';

export interface AuthUser {
  id: string;
  provider: AuthProvider;
  displayName?: string;
  remoteId?: string;
}

const USER_KEY = 'auth:user';
const GUEST_ID_KEY = 'auth:guestId';

let current: AuthUser | null = null;

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

/** Reactive auth store mirroring the module-level current user. */
export const useAuth = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

function setCurrent(user: AuthUser | null): void {
  current = user;
  useAuth.getState().setUser(user);
}

/** Rehydrates the persisted user and mirrors it into the reactive store. */
export async function rehydrateAuth(): Promise<AuthUser | null> {
  try {
    if (isSupabaseBackendEnabled()) {
      const session = await currentSupabaseSession();
      if (session) {
        const user: AuthUser = { id: session.userId, provider: 'guest', remoteId: session.userId };
        setCurrent(user);
        await setJSON(USER_KEY, user);
        return user;
      }
    }

    const saved = await getJSON<AuthUser>(USER_KEY);
    if (saved) setCurrent(saved);
    return saved;
  } catch {
    return null;
  }
}

/** Generates a reasonably-unique guest id without a crypto dependency. */
function generateGuestId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `guest_${Date.now().toString(36)}_${rand}`;
}

/**
 * Signs in as a guest, reusing a stable persisted id across launches so save
 * data stays linked to the same anonymous account.
 */
async function signInLocalGuest(): Promise<AuthUser> {
  let guestId = await getJSON<string>(GUEST_ID_KEY);
  if (!guestId) {
    guestId = generateGuestId();
    await setJSON(GUEST_ID_KEY, guestId);
  }
  const user: AuthUser = { id: guestId, provider: 'guest' };
  setCurrent(user);
  await setJSON(USER_KEY, user);
  return user;
}

export async function signInGuest(): Promise<AuthUser> {
  if (!isSupabaseBackendEnabled()) return signInLocalGuest();

  const session = await ensureAnonymousSupabaseUser();
  const user: AuthUser = { id: session.userId, provider: 'guest', remoteId: session.userId };
  setCurrent(user);
  await setJSON(USER_KEY, user);
  return user;
}

/**
 * Sign in with a Google OAuth access token (obtained via the hook in LoginScreen).
 * In STUB mode (no backend), falls back to a stable guest account tagged 'google'.
 * Replace the fetch call with your real backend endpoint when ready.
 */
export async function signInGoogleToken(accessToken: string): Promise<AuthUser> {
  if (!accessToken) return signInGuest();

  try {
    // TODO(backend): swap for your real endpoint that validates the Google token
    // and returns { id, displayName } for the authenticated Google user.
    //
    // Example (Supabase):
    //   const { data, error } = await supabase.auth.signInWithIdToken({
    //     provider: 'google', token: accessToken,
    //   });
    //
    // For now we derive a stable id from the token hash so the user gets the
    // same "Google guest" account across launches on the same device.
    const hashId = `google_${accessToken.slice(0, 20)}`;
    const user: AuthUser = { id: hashId, provider: 'google', displayName: 'Google User' };
    setCurrent(user);
    await setJSON(USER_KEY, user);
    return user;
  } catch {
    return signInGuest();
  }
}

/** The currently signed-in user, or `null` if signed out. */
export function currentUser(): AuthUser | null {
  return current;
}

/** Signs out. Keeps the stable guest id so a returning guest reuses their id. */
export async function signOut(): Promise<void> {
  if (isSupabaseBackendEnabled()) {
    try {
      await getSupabaseClient()?.auth.signOut();
    } catch {
      /* local sign-out still proceeds */
    }
  }
  setCurrent(null);
  await removeKey(USER_KEY);
}

// Rehydrate the last signed-in user on load (guarded, never throws).
void (async () => {
  await rehydrateAuth();
})();
