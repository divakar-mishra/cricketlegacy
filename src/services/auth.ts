/** Guest, Google OAuth and persisted Supabase-auth state. */

import { create } from 'zustand';
import { getJSON, removeKey, setJSON } from '../storage/storage';
import {
  currentSupabaseSession,
  ensureAnonymousSupabaseUser,
  getSupabaseClient,
  isSupabaseBackendEnabled,
} from './supabaseClient';
import { isOnline } from './connectivity';
import { clearPurchaseIdentity, synchronizePurchaseIdentity } from './purchases';

type AuthSessionModule = typeof import('expo-auth-session');
type QueryParamsModule = typeof import('expo-auth-session/build/QueryParams');
type WebBrowserModule = typeof import('expo-web-browser');

let oauthModules:
  | {
      authSession: AuthSessionModule;
      queryParams: QueryParamsModule;
      webBrowser: WebBrowserModule;
    }
  | null
  | undefined;

/** Keep native OAuth optional for pure engine tests and stripped clients. */
function loadOAuthModules(): NonNullable<typeof oauthModules> | null {
  if (oauthModules !== undefined) return oauthModules;
  try {
    // Literal requires let Metro include these modules while Jest can load
    // pure gameplay services without evaluating Expo's ESM-only entrypoints.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authSession = require('expo-auth-session') as AuthSessionModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const queryParams = require('expo-auth-session/build/QueryParams') as QueryParamsModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webBrowser = require('expo-web-browser') as WebBrowserModule;
    oauthModules = { authSession, queryParams, webBrowser };
  } catch {
    oauthModules = null;
  }
  return oauthModules;
}

export type AuthProvider = 'guest' | 'google' | 'email';

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

function fromSupabaseSession(session: {
  userId: string;
  isAnonymous: boolean;
  provider: string | null;
  displayName?: string;
}): AuthUser {
  return {
    id: session.userId,
    provider: session.isAnonymous ? 'guest' : session.provider === 'email' ? 'email' : 'google',
    displayName: session.displayName,
    remoteId: session.userId,
  };
}

/** Rehydrates the persisted user and mirrors it into the reactive store. */
export async function rehydrateAuth(): Promise<AuthUser | null> {
  try {
    if (isSupabaseBackendEnabled()) {
      const session = await currentSupabaseSession();
      if (session) {
        const user = fromSupabaseSession(session);
        await setJSON(USER_KEY, user);
        setCurrent(user);
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
  await setJSON(USER_KEY, user);
  setCurrent(user);
  return user;
}

export async function signInGuest(): Promise<AuthUser> {
  if (!isSupabaseBackendEnabled()) return signInLocalGuest();

  // Offline play is a core capability. A configured cloud backend must not
  // turn account creation into a launch gate when the device has no network.
  if (!(await isOnline())) return signInLocalGuest();

  try {
    const session = await ensureAnonymousSupabaseUser();
    const user = fromSupabaseSession(session);
    await setJSON(USER_KEY, user);
    setCurrent(user);
    return user;
  } catch {
    // Supabase outages should disable cloud identity, not the local career.
    return signInLocalGuest();
  }
}

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was canceled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  return error instanceof GoogleSignInCancelledError;
}

/** Exact redirect registered in Supabase Auth for the mobile OAuth callback. */
export function googleAuthRedirectUrl(): string {
  const modules = loadOAuthModules();
  if (!modules) throw new Error('Google sign-in is unavailable on this device.');
  return modules.authSession.makeRedirectUri({ scheme: 'coverdrive', path: 'auth/callback' });
}

function callbackError(params: Record<string, string>, errorCode: string | null): string | null {
  return params.error_description ?? params.error ?? errorCode;
}

/**
 * Signs in with Google, or upgrades the current anonymous Supabase user by
 * linking Google to that same user ID. Local saves remain untouched.
 */
export async function signInGoogle(): Promise<AuthUser> {
  if (!isSupabaseBackendEnabled()) {
    throw new Error('Google sign-in is not configured in this build.');
  }
  if (!(await isOnline())) {
    throw new Error('Connect to the internet to sign in with Google.');
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Google sign-in is not configured in this build.');
  const modules = loadOAuthModules();
  if (!modules) throw new Error('Google sign-in is unavailable on this device.');
  modules.webBrowser.maybeCompleteAuthSession();

  const redirectTo = googleAuthRedirectUrl();
  const existing = await currentSupabaseSession();
  const credentials = {
    provider: 'google' as const,
    options: { redirectTo, skipBrowserRedirect: true },
  };
  const oauth = existing?.isAnonymous
    ? await supabase.auth.linkIdentity(credentials)
    : await supabase.auth.signInWithOAuth(credentials);

  if (oauth.error) throw new Error(oauth.error.message);
  if (!oauth.data.url) throw new Error('Google did not return a sign-in URL.');

  const browserResult = await modules.webBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
  if (browserResult.type !== 'success') throw new GoogleSignInCancelledError();

  const { params, errorCode } = modules.queryParams.getQueryParams(browserResult.url);
  const providerError = callbackError(params, errorCode);
  if (providerError) throw new Error(providerError);

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
  } else if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message);
  } else if (existing?.isAnonymous) {
    // Identity linking keeps the existing session. Refresh its JWT so the
    // server-side `is_anonymous` claim reflects the newly linked identity.
    const { error } = await supabase.auth.refreshSession();
    if (error) throw new Error(error.message);
  } else {
    throw new Error('Google sign-in returned no usable session.');
  }

  const session = await currentSupabaseSession();
  if (!session || session.isAnonymous || session.provider !== 'google') {
    throw new Error('Google account verification did not complete.');
  }

  const user = fromSupabaseSession(session);
  await setJSON(USER_KEY, user);
  setCurrent(user);
  // The RevenueCat key was registered at app startup. Re-run identity sync now
  // that a server-validated, recoverable Supabase UUID is available.
  void synchronizePurchaseIdentity();
  return user;
}

/** Prevent duplicate password requests from racing the stored account identity. */
let emailSignInPending = false;

/** Existing provisioned accounts only. No signup, local password storage or premium grants. */
export async function signInEmail(email: string, password: string): Promise<AuthUser> {
  if (emailSignInPending) throw new Error('Sign-in is already in progress.');
  if (!email.trim() || !password) throw new Error('Enter your email and password.');
  if (!isSupabaseBackendEnabled()) throw new Error('Email sign-in is not configured in this build.');
  emailSignInPending = true;
  let sessionCreated = false;
  try {
    if (!(await isOnline())) throw new Error('Connect to the internet to sign in.');
    if (current || (await currentSupabaseSession())) {
      throw new Error('Sign out of your current account before using email sign-in.');
    }
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Email sign-in is not configured in this build.');
    clearPurchaseIdentity();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    sessionCreated = Boolean(data.session);
    if (error || !data.session) throw new Error('Unable to sign in. Check your credentials and try again.');
    const verified = await supabase.auth.getUser();
    if (verified.error || !verified.data.user || verified.data.user.is_anonymous ||
        verified.data.user.id !== data.session.user.id) {
      throw new Error('Account verification did not complete. Please try again.');
    }
    const user: AuthUser = {
      id: verified.data.user.id,
      remoteId: verified.data.user.id,
      provider: 'email',
    };
    await setJSON(USER_KEY, user);
    setCurrent(user);
    void synchronizePurchaseIdentity().catch(() => { /* Store remains fail-closed; retry there. */ });
    return user;
  } catch (error) {
    if (sessionCreated) await signOut();
    throw error;
  } finally {
    emailSignInPending = false;
  }
}

/** The currently signed-in user, or `null` if signed out. */
export function currentUser(): AuthUser | null {
  return current;
}

/** Signs out. Keeps the stable guest id so a returning guest reuses their id. */
export async function signOut(): Promise<void> {
  // Close local purchase/restore access before the Auth session changes. The
  // provider SDK may still hold a cache, but no call can use the old identity.
  clearPurchaseIdentity();
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

// App explicitly invokes rehydrateAuth at startup; importing this service alone
// must not initialize a remote session.
