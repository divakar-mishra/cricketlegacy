/** Guest account and optional Supabase anonymous-auth state. */

import { create } from 'zustand';
import { getJSON, removeKey, setJSON } from '../storage/storage';
import {
  currentSupabaseSession,
  ensureAnonymousSupabaseUser,
  getSupabaseClient,
  isSupabaseBackendEnabled,
} from './supabaseClient';
import { isOnline } from './connectivity';
import { clearPurchaseIdentity } from './purchases';

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
    const user: AuthUser = { id: session.userId, provider: 'guest', remoteId: session.userId };
    await setJSON(USER_KEY, user);
    setCurrent(user);
    return user;
  } catch {
    // Supabase outages should disable cloud identity, not the local career.
    return signInLocalGuest();
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

// Rehydrate the last signed-in user on load (guarded, never throws).
void (async () => {
  await rehydrateAuth();
})();
