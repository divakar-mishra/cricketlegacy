const mockCache = new Map<string, string>();
const mockInvoke = jest.fn();
const mockPrepare = jest.fn();
const mockToken = jest.fn();
let mockCacheWriteFails = false;
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../../config/qa', () => ({ QA_TOOLS_ENABLED: false }));
jest.mock('../supabaseClient', () => ({
  ensureAnonymousSupabaseUser: async () => ({ userId: 'user-1' }),
  getSupabaseClient: () => ({ functions: { invoke: mockInvoke } }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockCache.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (mockCacheWriteFails) throw new Error('keystore unavailable');
    mockCache.set(key, value);
  },
}));
jest.mock('@expo/app-integrity', () => ({
  prepareIntegrityTokenProviderAsync: (...args: unknown[]) => mockPrepare(...args),
  requestIntegrityCheckAsync: (...args: unknown[]) => mockToken(...args),
}));
import { checkAppIntegrity } from '../appIntegrity';
const hash = 'a'.repeat(64);
const original = {
  enabled: process.env.EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED,
  project: process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER,
};
beforeEach(() => {
  mockCacheWriteFails = false;
  mockCache.clear();
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED = 'true';
  process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER = '123456789';
  mockPrepare.mockResolvedValue(undefined);
  mockToken.mockResolvedValue('opaque-google-token');
  mockInvoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => ({
    data: options.body.action === 'challenge' ? { requestHash: hash } : { status: 'VERIFIED' },
    error: null,
  }));
});
afterAll(() => {
  for (const [key, value] of Object.entries({
    EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED: original.enabled,
    EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER: original.project,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
it('uses a server challenge and sends the opaque native token for server verification', async () => {
  expect(await checkAppIntegrity()).toBe('VERIFIED');
  expect(mockToken).toHaveBeenCalledWith(hash);
  expect(mockInvoke).toHaveBeenLastCalledWith('verify-play-integrity', {
    body: { action: 'verify', token: 'opaque-google-token', requestHash: hash },
  });
});
it('reuses a very recent live verdict for checkout instead of hitting challenge throttling', async () => {
  await checkAppIntegrity();
  expect(await checkAppIntegrity(true)).toBe('VERIFIED');
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});
it('does not enable production enforcement merely by installing the module', async () => {
  process.env.EXPO_PUBLIC_PLAY_INTEGRITY_ENABLED = 'false';
  expect(await checkAppIntegrity()).toBe('SKIPPED');
  expect(mockInvoke).not.toHaveBeenCalled();
});
it('deduplicates concurrent launch/purchase checks', async () => {
  const first = checkAppIntegrity(),
    second = checkAppIntegrity();
  expect(first).toBe(second);
  await first;
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});
it('preserves offline gameplay after a successful installation check', async () => {
  expect(await checkAppIntegrity()).toBe('VERIFIED');
  mockPrepare.mockRejectedValue(new Error('network failure'));
  expect(await checkAppIntegrity()).toBe('OFFLINE');
});
it('does not turn first-launch network failure into a cheating accusation or pass', async () => {
  mockPrepare.mockRejectedValue(new Error('network failure'));
  expect(await checkAppIntegrity()).toBe('UNAVAILABLE');
});
it('keeps a rejection sticky offline, then permits a fresh verified recovery', async () => {
  mockInvoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => ({
    data: options.body.action === 'challenge' ? { requestHash: hash } : { status: 'REJECTED' },
    error: null,
  }));
  expect(await checkAppIntegrity()).toBe('REJECTED');
  mockPrepare.mockRejectedValue(new Error('offline'));
  expect(await checkAppIntegrity()).toBe('REJECTED');
  mockPrepare.mockResolvedValue(undefined);
  mockInvoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => ({
    data: options.body.action === 'challenge' ? { requestHash: hash } : { status: 'VERIFIED' },
    error: null,
  }));
  expect(await checkAppIntegrity()).toBe('VERIFIED');
});
it('fails closed on malformed server output or missing project configuration', async () => {
  mockInvoke.mockResolvedValue({ data: { status: 'anything' }, error: null });
  expect(await checkAppIntegrity()).toBe('UNAVAILABLE');
  process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER = '';
  expect(await checkAppIntegrity()).toBe('UNAVAILABLE');
});
it('never falls back to a cached pass when persisting a fresh rejection fails', async () => {
  expect(await checkAppIntegrity()).toBe('VERIFIED');
  mockCacheWriteFails = true;
  mockInvoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => ({
    data: options.body.action === 'challenge' ? { requestHash: hash } : { status: 'REJECTED' },
    error: null,
  }));
  expect(await checkAppIntegrity()).toBe('REJECTED');
  mockPrepare.mockRejectedValue(new Error('offline'));
  expect(await checkAppIntegrity()).toBe('REJECTED');
});
