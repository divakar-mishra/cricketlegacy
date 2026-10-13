const mockStorage = new Map<string, unknown>();
const mockLink = jest.fn();
const mockOAuth = jest.fn();
const mockBrowser = jest.fn();
const mockSetSession = jest.fn();
const mockRefresh = jest.fn();
const mockSyncPurchases = jest.fn(async () => true);
let mockSignedIn = false;
jest.mock('../../storage/storage', () => ({
  getJSON: async (key: string) => mockStorage.get(key) ?? null,
  setJSON: async (key: string, value: unknown) => { mockStorage.set(key, value); },
  removeKey: async (key: string) => { mockStorage.delete(key); },
}));
jest.mock('../connectivity', () => ({ isOnline: async () => true }));
jest.mock('../purchases', () => ({ clearPurchaseIdentity: jest.fn(), synchronizePurchaseIdentity: () => mockSyncPurchases() }));
jest.mock('../supabaseClient', () => ({
  isSupabaseBackendEnabled: () => true,
  currentSupabaseSession: async () => mockSignedIn
    ? { userId: 'existing-google-id', isAnonymous: false, provider: 'google' }
    : { userId: 'new-guest-id', isAnonymous: true, provider: 'anonymous' },
  getSupabaseClient: () => ({ auth: {
    linkIdentity: (...args: unknown[]) => mockLink(...args),
    signInWithOAuth: (...args: unknown[]) => mockOAuth(...args),
    setSession: (...args: unknown[]) => mockSetSession(...args),
    refreshSession: (...args: unknown[]) => mockRefresh(...args),
    signOut: async () => {},
  } }),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'coverdrive://auth/callback' }));
jest.mock('expo-auth-session/build/QueryParams', () => ({ getQueryParams: () => ({
  params: { access_token: 'test-access-token', refresh_token: 'test-refresh-token' }, errorCode: null,
}) }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockBrowser(...args),
}));
import { currentUser, signInGoogle, signOut } from '../auth';
beforeEach(async () => {
  await signOut();
  mockStorage.clear(); mockSignedIn = false;
  jest.clearAllMocks();
  mockLink.mockResolvedValue({ data: { url: 'https://example.test/link' }, error: null });
  mockOAuth.mockResolvedValue({ data: { url: 'https://example.test/login' }, error: null });
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback' });
  mockSetSession.mockImplementation(async () => { mockSignedIn = true; return { error: null }; });
});
it('signs into the existing Google identity rather than linking it to the new reinstall guest', async () => {
  const signedIn = await signInGoogle({ existingAccount: true });
  expect(signedIn.remoteId).toBe('existing-google-id');
  expect(mockOAuth).toHaveBeenCalledTimes(1);
  expect(mockLink).not.toHaveBeenCalled();
  expect(currentUser()?.provider).toBe('google');
  expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
});
it('preserves the existing explicit link-a-guest workflow', async () => {
  await signInGoogle();
  expect(mockLink).toHaveBeenCalledTimes(1);
  expect(mockOAuth).not.toHaveBeenCalled();
});
it('a canceled recovery sign-in does not remove local saves or grant access', async () => {
  mockStorage.set('sg:career:1', { id: 'local-player' });
  mockBrowser.mockResolvedValue({ type: 'cancel' });
  await expect(signInGoogle({ existingAccount: true })).rejects.toThrow('canceled');
  expect(mockStorage.get('sg:career:1')).toEqual({ id: 'local-player' });
  expect(currentUser()).toBeNull();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});
