import {
  OFFLINE_AUTH_WINDOW_MS,
  dailySessionStatus,
  localDayKey,
  recordDailyLogin,
} from '../sessionGate';

const mockStorage = new Map<string, string>();
let mockOnline = true;
let mockSavedUser: unknown = null;
let mockSupabaseEnabled = false;
let mockVerification: unknown = null;

jest.mock('../../storage/storage', () => ({
  getJSON: jest.fn(async (key: string) => {
    const raw = mockStorage.get(key);
    return raw ? JSON.parse(raw) : null;
  }),
  setJSON: jest.fn(async (key: string, value: unknown) => {
    mockStorage.set(key, JSON.stringify(value));
  }),
}));

jest.mock('../connectivity', () => ({
  isOnline: jest.fn(async () => mockOnline),
}));

jest.mock('../auth', () => ({
  currentUser: jest.fn(() => mockSavedUser),
  rehydrateAuth: jest.fn(async () => mockSavedUser),
}));

jest.mock('../supabaseClient', () => ({
  isSupabaseBackendEnabled: jest.fn(() => mockSupabaseEnabled),
  verifyDailyAuthorization: jest.fn(async () => {
    if (mockVerification instanceof Error) throw mockVerification;
    return mockVerification;
  }),
}));

describe('daily session gate', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockOnline = true;
    mockSavedUser = null;
    mockSupabaseEnabled = false;
    mockVerification = null;
  });

  it('formats local day keys without UTC drift surprises', () => {
    expect(localDayKey(new Date(2026, 6, 13, 23, 30))).toBe('2026-07-13');
  });

  it('allows a signed-in user inside the 24-hour offline window', async () => {
    mockSavedUser = { id: 'guest_1', provider: 'guest' };
    await recordDailyLogin(new Date(2026, 6, 13, 8));
    mockOnline = false;

    const status = await dailySessionStatus(new Date(2026, 6, 14, 7));

    expect(status.allowed).toBe(true);
    expect(status.validToday).toBe(true);
    expect(status.validUntilMs).toBe(new Date(2026, 6, 13, 8).getTime() + OFFLINE_AUTH_WINDOW_MS);
  });

  it('blocks offline launch after the 24-hour authorization window expires', async () => {
    mockSavedUser = { id: 'guest_1', provider: 'guest' };
    mockOnline = false;
    await recordDailyLogin(new Date(2026, 6, 13, 8));

    const status = await dailySessionStatus(new Date(2026, 6, 14, 9, 1));

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('OFFLINE_LOGIN_REQUIRED');
  });

  it('blocks local authorization after a basic device-clock rollback', async () => {
    mockSavedUser = { id: 'guest_1', provider: 'guest' };
    await recordDailyLogin(new Date(2026, 6, 13, 12));
    await dailySessionStatus(new Date(2026, 6, 13, 13));
    mockOnline = false;

    const status = await dailySessionStatus(new Date(2026, 6, 13, 12, 30));

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('CLOCK_ROLLBACK_DETECTED');
  });

  it('records a Supabase server timestamp for the 24-hour authorization window', async () => {
    mockSavedUser = { id: '00000000-0000-0000-0000-000000000001', provider: 'guest' };
    mockSupabaseEnabled = true;
    mockVerification = {
      userId: '00000000-0000-0000-0000-000000000001',
      serverTimeMs: Date.parse('2026-07-13T08:00:00.000Z'),
      expiresAtMs: Date.parse('2026-07-14T08:00:00.000Z'),
    };

    await recordDailyLogin(new Date('2026-07-13T07:55:00.000Z'));
    mockOnline = false;

    const status = await dailySessionStatus(new Date('2026-07-14T07:54:00.000Z'));

    expect(status.allowed).toBe(true);
    expect(status.validUntilMs).toBe(Date.parse('2026-07-14T08:00:00.000Z'));
  });

  it('does not mint a local verification when Supabase verification fails', async () => {
    mockSavedUser = { id: '00000000-0000-0000-0000-000000000001', provider: 'guest' };
    mockSupabaseEnabled = true;
    mockVerification = new Error('RPC unavailable');

    await expect(recordDailyLogin(new Date('2026-07-13T08:00:00.000Z'))).rejects.toThrow(
      'RPC unavailable',
    );
    expect(mockStorage.has('auth:lastDailyVerification')).toBe(false);
  });
});
