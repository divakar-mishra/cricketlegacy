const mockStorage = new Map<string, unknown>();
const mockLink = jest.fn();
const mockOAuth = jest.fn();
const mockBrowser = jest.fn();
const mockSetSession = jest.fn();
const mockRefresh = jest.fn();
const mockExchange = jest.fn();
const mockSyncPurchases = jest.fn(async () => true);
const mockAuthSignOut = jest.fn(async (options?: unknown) => { void options; });
let mockSignedIn = false;
let mockProvider = 'google';
let mockProviders: string[] | null = null;
let mockAccountId = 'existing-google-id';
let mockVerificationFails = false;
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
    ? { userId: mockAccountId, isAnonymous: false, provider: mockProvider, providers: mockProviders ?? [mockProvider] }
    : { userId: 'new-guest-id', isAnonymous: true, provider: 'anonymous' },
  currentVerifiedSupabaseSession: async () => mockVerificationFails || !mockSignedIn ? null
    : { userId: mockAccountId, isAnonymous: false, provider: mockProvider, providers: mockProviders ?? [mockProvider] },
  getSupabaseClient: () => ({ auth: {
    linkIdentity: (...args: unknown[]) => mockLink(...args),
    signInWithOAuth: (...args: unknown[]) => mockOAuth(...args),
    setSession: (...args: unknown[]) => mockSetSession(...args),
    refreshSession: (...args: unknown[]) => mockRefresh(...args),
    exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
    signOut: (options?: unknown) => mockAuthSignOut(options),
  } }),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'coverdrive://auth/callback' }));
jest.mock('expo-auth-session/build/QueryParams', () => ({ getQueryParams: (url: string) => {
  const parsed = new URL(url);
  const params = Object.fromEntries([...parsed.searchParams, ...new URLSearchParams(parsed.hash.slice(1))]);
  return { params, errorCode: params.error_code ?? null };
} }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockBrowser(...args),
}));
import {
  currentUser, GoogleSignInCancelledError, GoogleSignInRetryError,
  googleSignInRetryMessage, signInGoogle, signInApple, signOut, rehydrateAuth,
} from '../auth';
const successfulCallback = 'coverdrive://auth/callback#access_token=test-access-token&refresh_token=test-refresh-token';
beforeEach(async () => {
  await signOut();
  mockStorage.clear(); mockSignedIn = false; mockProvider = 'google';
  mockProviders = null; mockAccountId = 'existing-google-id'; mockVerificationFails = false;
  jest.clearAllMocks();
  mockLink.mockImplementation(async () => {
    mockAccountId = 'new-guest-id';
    return { data: { url: 'https://example.test/link' }, error: null };
  });
  mockOAuth.mockResolvedValue({ data: { url: 'https://example.test/login' }, error: null });
  mockBrowser.mockResolvedValue({ type: 'success', url: successfulCallback });
  mockSetSession.mockImplementation(async () => { mockSignedIn = true; return { error: null }; });
  mockRefresh.mockImplementation(async () => { mockSignedIn = true; return { error: null }; });
  mockExchange.mockImplementation(async () => { mockSignedIn = true; return { error: null }; });
});
it('Apple sign-in verifies its own provider and rehydrates without relabeling as Google', async () => {
  mockProvider = 'apple';
  const user = await signInApple();
  expect(mockOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'apple' }));
  expect(mockLink).not.toHaveBeenCalled();
  expect(user.provider).toBe('apple');
  expect((await rehydrateAuth())?.provider).toBe('apple');
});
it('Apple cancellation preserves saved identity and does not synchronize purchases', async () => {
  mockStorage.set('auth:user', { id: 'local-guest', provider: 'guest' });
  mockBrowser.mockResolvedValueOnce({ type: 'cancel' });
  await expect(signInApple()).rejects.toThrow('Apple sign-in was canceled');
  expect(mockStorage.get('auth:user')).toEqual({ id: 'local-guest', provider: 'guest' });
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});
it('Apple rejects foreign callbacks before processing credentials', async () => {
  mockBrowser.mockResolvedValueOnce({ type: 'success', url: successfulCallback.replace('/callback', '/callback-other') });
  await expect(signInApple()).rejects.toThrow('Apple sign-in did not finish');
  expect(mockSetSession).not.toHaveBeenCalled();
});
it('Apple does not accept a Google session as proof of Apple authentication', async () => {
  await expect(signInApple()).rejects.toThrow('Apple account verification did not complete');
  expect(mockStorage.has('auth:user')).toBe(false);
  expect(mockSyncPurchases).not.toHaveBeenCalled();
  expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('accepts server-verified Apple identity on the same original Google account, including rehydration', async () => {
  mockProviders = ['google', 'apple'];
  const user = await signInApple();
  expect(user).toMatchObject({ id: 'existing-google-id', provider: 'apple', remoteId: 'existing-google-id' });
  expect((await rehydrateAuth())?.provider).toBe('apple');
  expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
});
it('Google can use an account originally created with Apple when that Google identity is verified', async () => {
  mockProvider = 'apple'; mockProviders = ['apple', 'google'];
  expect((await signInGoogle({ existingAccount: true })).provider).toBe('google');
  expect((await rehydrateAuth())?.provider).toBe('google');
});
it('does not accept a cached OAuth session when server verification fails', async () => {
  mockProvider = 'apple'; mockVerificationFails = true;
  await expect(signInApple()).rejects.toThrow('Apple account verification did not complete');
  expect(mockStorage.has('auth:user')).toBe(false);
  expect(mockSyncPurchases).not.toHaveBeenCalled();
  expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('a guest-link callback cannot change the owning UUID or move local saves', async () => {
  mockStorage.set('sg:career:1', { coins: 700, id: 'guest-career' });
  mockLink.mockImplementationOnce(async () => ({ data: { url: 'https://example.test/link' }, error: null }));
  await expect(signInGoogle()).rejects.toThrow('different account');
  expect(mockStorage.get('sg:career:1')).toEqual({ coins: 700, id: 'guest-career' });
  expect(mockStorage.has('auth:user')).toBe(false);
  expect(mockSyncPurchases).not.toHaveBeenCalled();
  expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('a remembered Apple label cannot cross UUIDs on rehydration', async () => {
  mockStorage.set('auth:user', { id: 'different-user', provider: 'apple' });
  mockSignedIn = true; mockProviders = ['google', 'apple'];
  expect(await rehydrateAuth()).toMatchObject({ id: 'existing-google-id', provider: 'google' });
});
it('signs into the existing Google identity rather than linking it to the new reinstall guest', async () => {
  const signedIn = await signInGoogle({ existingAccount: true });
  expect(signedIn.remoteId).toBe('existing-google-id');
  expect(mockOAuth).toHaveBeenCalledTimes(1);
  expect(mockLink).not.toHaveBeenCalled();
  expect(currentUser()?.provider).toBe('google');
  expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
  expect(mockOAuth).toHaveBeenCalledWith({ provider: 'google', options: {
    redirectTo: 'coverdrive://auth/callback', skipBrowserRedirect: true,
  } });
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

it.each(['cancel', 'dismiss', 'locked'])('a %s browser result offers a non-destructive retry', async type => {
  mockStorage.set('sg:manager:1', { id: 'local-manager', tokens: 1, coins: 11000 });
  const before = [...mockStorage];
  mockBrowser.mockResolvedValue({ type });
  const error = await signInGoogle({ existingAccount: true }).catch(e => e);
  expect(error).toBeInstanceOf(GoogleSignInCancelledError);
  expect(googleSignInRetryMessage(error)).toContain('Close the Google or Sunlight tab');
  expect([...mockStorage]).toEqual(before);
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});

it.each([
  '#error=access_denied&error_code=bad_oauth_state&error_description=OAuth%20state%20has%20expired',
  '?error=access_denied&error_code=bad_oauth_state&error_description=Google%20sign-in%20expired.',
  '#error_code=flow_state_expired',
  '#error_code=oauth_client_state_expired',
])('classifies an expired callback without deleting or granting anything: %s', async suffix => {
  mockStorage.set('sg:career:1', { id: 'starter', coins: 4000, gems: 50, firstPurchaseDone: true });
  const before = [...mockStorage];
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback' + suffix });
  const error = await signInGoogle({ existingAccount: true }).catch(e => e);
  expect(error).toBeInstanceOf(GoogleSignInRetryError);
  expect(error.reason).toBe('expired');
  expect(googleSignInRetryMessage(error)).toContain('open a fresh sign-in page');
  expect([...mockStorage]).toEqual(before);
  expect(currentUser()).toBeNull();
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockExchange).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});

it('does not call invalid state expired without an expiry signal', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback#error_code=bad_oauth_state&error_description=Invalid%20state' });
  const error = await signInGoogle().catch(e => e);
  expect(error.reason).toBe('incomplete');
  expect(googleSignInRetryMessage(error)).toContain('did not finish');
});

it('a failed callback takes precedence over tokens and cannot grant a session', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: successfulCallback + '&error_code=flow_state_expired' });
  await expect(signInGoogle()).rejects.toBeInstanceOf(GoogleSignInRetryError);
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});

it.each([
  'https://sunlight-publisher-site.pages.dev/#access_token=bad&refresh_token=bad',
  'coverdrive://auth/callback-other#access_token=bad&refresh_token=bad',
  'coverdrive://auth/callback/extra#access_token=bad&refresh_token=bad',
  'coverdrive://auth.evil/callback#access_token=bad&refresh_token=bad',
])('rejects a browser URL outside the exact callback: %s', async url => {
  mockBrowser.mockResolvedValue({ type: 'success', url });
  await expect(signInGoogle()).rejects.toBeInstanceOf(GoogleSignInRetryError);
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockSyncPurchases).not.toHaveBeenCalled();
});

it('an empty existing-account callback offers retry without falling back to guest linking', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback' });
  await expect(signInGoogle({ existingAccount: true })).rejects.toBeInstanceOf(GoogleSignInRetryError);
  expect(mockLink).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it('preserves explicit guest identity linking without tokens', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback' });
  await signInGoogle();
  expect(mockLink).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(currentUser()?.provider).toBe('google');
});

it('keeps authorization-code callbacks working', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback?code=test-only-code' });
  await signInGoogle({ existingAccount: true });
  expect(mockExchange).toHaveBeenCalledWith('test-only-code');
  expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
});

it('requests a fresh OAuth URL after an expired attempt, without replaying its callback', async () => {
  mockOAuth.mockResolvedValueOnce({ data: { url: 'https://example.test/expired' }, error: null })
    .mockResolvedValueOnce({ data: { url: 'https://example.test/fresh' }, error: null });
  mockBrowser.mockResolvedValueOnce({ type: 'success', url: 'coverdrive://auth/callback#error_code=flow_state_expired' });
  await expect(signInGoogle({ existingAccount: true })).rejects.toBeInstanceOf(GoogleSignInRetryError);
  await signInGoogle({ existingAccount: true });
  expect(mockBrowser.mock.calls.map(c => c[0])).toEqual(['https://example.test/expired', 'https://example.test/fresh']);
  expect(mockSetSession).toHaveBeenCalledTimes(1);
  expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
});

it('rejects a second request while the first is still pending, then unlocks after failure', async () => {
  let finish!: (value: unknown) => void;
  mockBrowser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = signInGoogle({ existingAccount: true });
  await expect(signInGoogle()).rejects.toThrow('already in progress');
  expect(mockLink).not.toHaveBeenCalled();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  finish({ type: 'dismiss' });
  await expect(first).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  await signInGoogle({ existingAccount: true });
  expect(mockSetSession).toHaveBeenCalledTimes(1);
});

it('unlocks retry after a provider request throws', async () => {
  mockOAuth.mockRejectedValueOnce(new Error('Network request failed'));
  await expect(signInGoogle({ existingAccount: true })).rejects.toThrow('Network request failed');
  await signInGoogle({ existingAccount: true });
  expect(currentUser()?.provider).toBe('google');
});

it('does not reclassify ordinary provider failures as successful or expired', async () => {
  mockBrowser.mockResolvedValue({ type: 'success', url: 'coverdrive://auth/callback#error=access_denied&error_description=Consent%20denied' });
  const error = await signInGoogle().catch(e => e);
  expect(error.message).toBe('Consent denied');
  expect(googleSignInRetryMessage(error)).toBeNull();
  expect(mockSetSession).not.toHaveBeenCalled();
});
