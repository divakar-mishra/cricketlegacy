const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getSession: mockGetSession, getUser: mockGetUser } }),
  processLock: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../../config/supabase', () => ({
  SUPABASE_CONFIG: { enabled: true, url: 'https://example.supabase.co', publishableKey: 'public-test-key' },
}));
jest.mock('../../config/buildInfo', () => ({ BUILD_INFO: {} }));
jest.mock('react-native-url-polyfill/auto', () => ({}));

import { currentSupabaseSession, currentVerifiedSupabaseSession } from '../supabaseClient';

beforeEach(() => jest.clearAllMocks());

it('OAuth verification uses the server account and linked identity list, not the cached original provider', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'cached-id' } } }, error: null });
  mockGetUser.mockResolvedValue({ data: { user: {
    id: 'server-id', is_anonymous: false, app_metadata: { provider: 'google' },
    identities: [{ provider: 'google' }, { provider: 'apple' }, { provider: 'apple' }],
  } }, error: null });
  expect(await currentVerifiedSupabaseSession()).toMatchObject({
    userId: 'server-id', provider: 'google', providers: ['google', 'apple'], isAnonymous: false,
  });
  expect(mockGetUser).toHaveBeenCalledTimes(1);
  expect(mockGetSession).not.toHaveBeenCalled();
});

it('server errors or missing users cannot fall back to a cached authenticated identity', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid session') });
  expect(await currentVerifiedSupabaseSession()).toBeNull();
  mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect(await currentVerifiedSupabaseSession()).toBeNull();
  expect(mockGetSession).not.toHaveBeenCalled();
});

it('cached rehydration carries identities but never invents one from an email or display name', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: {
    id: 'server-id', is_anonymous: false, email: 'example@example.test',
    app_metadata: { provider: 'google' }, identities: [{ provider: 'google' }],
  } } }, error: null });
  expect(await currentSupabaseSession()).toMatchObject({ userId: 'server-id', providers: ['google'] });
  expect(mockGetUser).not.toHaveBeenCalled();
});
