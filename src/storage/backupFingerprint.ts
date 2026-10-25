import type { SaveGame } from '../domain/types';

/** Optimization only: never an identity, purchase, or save-integrity authority. */
export async function backupContentHash(save: SaveGame): Promise<string | undefined> {
  try {
    // Local durability still records updatedAt. Ignore ONLY that bookkeeping
    // timestamp when comparing against a successfully acknowledged snapshot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto: typeof import('expo-crypto') = require('expo-crypto');
    const hash = await crypto.digestStringAsync(
      crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify({ ...save, updatedAt: 0 }),
    );
    return /^[a-f0-9]{64}$/.test(hash) ? hash : undefined;
  } catch {
    // An unavailable native hash must cause a normal upload, not a false
    // confirmation or a failure to save/back up the user's progress.
    return undefined;
  }
}
