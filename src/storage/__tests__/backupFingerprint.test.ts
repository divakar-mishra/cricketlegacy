jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, input: string) =>
    jest.requireActual('node:crypto').createHash('sha256').update(input).digest('hex')),
}));
import type { SaveGame } from '../../domain/types';
import { backupContentHash } from '../backupFingerprint';

const snapshot = { id: 'save-a', mode: 'career', updatedAt: 100,
  wallet: { coins: 7, gems: 1 }, flags: { 'iap:receipt': true },
  players: { a: { name: 'Batter 🏏', updatedAt: 12 } },
} as unknown as SaveGame;
afterEach(() => jest.clearAllMocks());

it('ignores only the root bookkeeping timestamp and never mutates the save', async () => {
  const before = structuredClone(snapshot);
  const first = await backupContentHash(snapshot);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(await backupContentHash({ ...snapshot, updatedAt: 999 })).toBe(first);
  expect(snapshot).toEqual(before);
  expect(await backupContentHash({ ...snapshot, players: { a: { name: 'Batter 🏏', updatedAt: 13 } } } as unknown as SaveGame)).not.toBe(first);
});
it.each([
  { wallet: { coins: 6, gems: 1 } }, { flags: { 'iap:receipt': true, 'iap:other': true } },
  { entitlements: { removeAdsUntil: 200 } }, { fixtures: { match: { completed: true } } },
])('fingerprints meaningful state changes, including paid state: %p', async (change) => {
  expect(await backupContentHash({ ...snapshot, ...change } as SaveGame)).not.toBe(await backupContentHash(snapshot));
});
it('fails open to a normal upload when native hashing fails or is malformed', async () => {
  const digest = jest.requireMock('expo-crypto').digestStringAsync;
  digest.mockRejectedValueOnce(new Error('native module unavailable'));
  expect(await backupContentHash(snapshot)).toBeUndefined();
  digest.mockResolvedValueOnce('short-weak-hash');
  expect(await backupContentHash(snapshot)).toBeUndefined();
});
