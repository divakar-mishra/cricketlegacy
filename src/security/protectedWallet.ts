import type { StateCreator } from 'zustand';
import type { SaveGame, Wallet } from '../domain/types';

/** A deterrent to plain numeric RAM searches, NOT a trusted economy authority.
 * Values are decoded temporarily for arithmetic/rendering/serialization. A
 * patched JS runtime can still invoke setters or intercept these reads.
 */
export function protectWallet(wallet: Wallet): Wallet {
  for (const field of ['coins', 'gems'] as const) {
    if (Object.getOwnPropertyDescriptor(wallet, field)?.get) continue;
    const bytes = new DataView(new ArrayBuffer(8));
    let low = 0,
      high = 0,
      maskLow = 0,
      maskHigh = 0,
      checkLow = 0,
      checkHigh = 0;
    const write = (value: number) => {
      if (!Number.isFinite(value)) throw new Error('Invalid wallet value.');
      // Float64 avoids int32 overflow and preserves existing fractional balances.
      bytes.setFloat64(0, value);
      maskLow = (Math.random() * 0x100000000) >>> 0;
      maskHigh = (Math.random() * 0x100000000) >>> 0;
      low = bytes.getUint32(0) ^ maskLow;
      high = bytes.getUint32(4) ^ maskHigh;
      checkLow = ~low;
      checkHigh = ~high;
      bytes.setFloat64(0, 0);
    };
    write(wallet[field]);
    Object.defineProperty(wallet, field, {
      enumerable: true,
      configurable: false,
      get() {
        if (checkLow !== ~low || checkHigh !== ~high)
          throw new Error('Wallet integrity check failed.');
        bytes.setUint32(0, low ^ maskLow);
        bytes.setUint32(4, high ^ maskHigh);
        const value = bytes.getFloat64(0);
        bytes.setFloat64(0, 0);
        return value;
      },
      set: write,
    });
  }
  return wallet;
}

/** Protect every published active wallet, including replacements after rewards. */
export function withProtectedWallet<T extends { save: SaveGame | null }>(
  initializer: StateCreator<T>,
): StateCreator<T> {
  return (set, get, api) => {
    const protect = (state: T | Partial<T>) => {
      if (state.save?.wallet) protectWallet(state.save.wallet);
      return state;
    };
    const protectedSet: typeof set = (partial, replace?) => {
      const next = typeof partial === 'function' ? partial(get()) : partial;
      if (replace) set(protect(next) as T, true);
      else set(protect(next));
    };
    api.setState = protectedSet;
    return protect(initializer(protectedSet, get, api)) as T;
  };
}
