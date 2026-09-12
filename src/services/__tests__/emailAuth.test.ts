import { currentUser, rehydrateAuth, signInEmail, signOut } from '../auth';
import { currentSupabaseSession, getSupabaseClient, isSupabaseBackendEnabled } from '../supabaseClient';
import { isOnline } from '../connectivity';
import { setJSON } from '../../storage/storage';
import { synchronizePurchaseIdentity } from '../purchases';

jest.mock('../../storage/storage', () => ({ getJSON: jest.fn(), setJSON: jest.fn(), removeKey: jest.fn() }));
jest.mock('../supabaseClient', () => ({
  currentSupabaseSession: jest.fn(), ensureAnonymousSupabaseUser: jest.fn(),
  getSupabaseClient: jest.fn(), isSupabaseBackendEnabled: jest.fn(),
}));
jest.mock('../connectivity', () => ({ isOnline: jest.fn() }));
jest.mock('../purchases', () => ({ clearPurchaseIdentity: jest.fn(), synchronizePurchaseIdentity: jest.fn() }));

const passwordLogin = jest.fn();
const getUser = jest.fn();
const remoteSignOut = jest.fn();

beforeEach(async () => {
  jest.mocked(isSupabaseBackendEnabled).mockReturnValue(false);
  await signOut();
  jest.resetAllMocks();
  jest.mocked(isSupabaseBackendEnabled).mockReturnValue(true);
  jest.mocked(isOnline).mockResolvedValue(true);
  jest.mocked(currentSupabaseSession).mockResolvedValue(null);
  jest.mocked(synchronizePurchaseIdentity).mockResolvedValue(true);
  jest.mocked(getSupabaseClient).mockReturnValue({ auth: {
    signInWithPassword: passwordLogin, getUser, signOut: remoteSignOut,
  } } as unknown as NonNullable<ReturnType<typeof getSupabaseClient>>);
  passwordLogin.mockResolvedValue({ data: { session: { user: { id: 'review-id' } } }, error: null });
  getUser.mockResolvedValue({ data: { user: { id: 'review-id', is_anonymous: false } }, error: null });
});

test('authenticates with server and persists identity, never the password', async () => {
  expect(await signInEmail(' reviewer@example.com ', 'test-only-password')).toEqual({
    id: 'review-id', remoteId: 'review-id', provider: 'email',
  });
  expect(passwordLogin).toHaveBeenCalledWith({ email: 'reviewer@example.com', password: 'test-only-password' });
  expect(getUser).toHaveBeenCalled();
  expect(JSON.stringify(jest.mocked(setJSON).mock.calls)).not.toContain('test-only-password');
  expect(synchronizePurchaseIdentity).toHaveBeenCalledTimes(1);
});

test('rejects missing credentials before contacting server', async () => {
  await expect(signInEmail('', '')).rejects.toThrow('Enter your email');
  expect(passwordLogin).not.toHaveBeenCalled();
});

test('fails closed when backend is unavailable', async () => {
  jest.mocked(isSupabaseBackendEnabled).mockReturnValue(false);
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('not configured');
  expect(passwordLogin).not.toHaveBeenCalled();
});

test('offline login does not create a local substitute account', async () => {
  jest.mocked(isOnline).mockResolvedValue(false);
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('internet');
  expect(currentUser()).toBeNull();
  expect(passwordLogin).not.toHaveBeenCalled();
});

test('does not silently switch an existing guest session', async () => {
  jest.mocked(currentSupabaseSession).mockResolvedValue({ userId: 'guest-id', isAnonymous: true, provider: 'anonymous' });
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('Sign out');
  expect(passwordLogin).not.toHaveBeenCalled();
});

test('invalid credentials do not persist identity or leak provider error details', async () => {
  passwordLogin.mockResolvedValue({ data: { session: null }, error: { message: 'private provider details' } });
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('Check your credentials');
  expect(setJSON).not.toHaveBeenCalled();
  expect(synchronizePurchaseIdentity).not.toHaveBeenCalled();
});

test('mismatched server identity is signed out before granting app access', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'wrong-id' } }, error: null });
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('verification');
  expect(remoteSignOut).toHaveBeenCalled();
  expect(currentUser()).toBeNull();
  expect(synchronizePurchaseIdentity).not.toHaveBeenCalled();
});

test('rehydrates email accounts without labeling them Google accounts', async () => {
  jest.mocked(currentSupabaseSession).mockResolvedValue({ userId: 'review-id', isAnonymous: false, provider: 'email' });
  expect((await rehydrateAuth())?.provider).toBe('email');
});

test.each([
  { provider: 'google', isAnonymous: false, expected: 'google' },
  { provider: 'anonymous', isAnonymous: true, expected: 'guest' },
])('preserves existing $expected account rehydration', async ({ provider, isAnonymous, expected }) => {
  jest.mocked(currentSupabaseSession).mockResolvedValue({ userId: 'old-id', provider, isAnonymous });
  expect((await rehydrateAuth())?.provider).toBe(expected);
});

test('storage failure cleans up the newly created remote session', async () => {
  jest.mocked(setJSON).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('Storage unavailable');
  expect(remoteSignOut).toHaveBeenCalled();
  expect(currentUser()).toBeNull();
  expect(synchronizePurchaseIdentity).not.toHaveBeenCalled();
});

test('rejects concurrent password requests', async () => {
  let finish!: (value: unknown) => void;
  passwordLogin.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = signInEmail('reviewer@example.com', 'secret');
  await expect(signInEmail('reviewer@example.com', 'secret')).rejects.toThrow('already in progress');
  await Promise.resolve();
  finish({ data: { session: { user: { id: 'review-id' } } }, error: null });
  await first;
  expect(passwordLogin).toHaveBeenCalledTimes(1);
});
