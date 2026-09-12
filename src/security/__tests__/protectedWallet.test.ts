import { createStore } from 'zustand/vanilla';
import { SaveGame, Wallet } from '../../domain/types';
import { protectWallet, withProtectedWallet } from '../protectedWallet';

const wallet = () => ({ coins: 500, gems: 25 }) as Wallet;
it('masks resting properties while preserving reads, arithmetic and JSON', () => {
  const value = protectWallet(wallet());
  expect(Object.getOwnPropertyDescriptor(value, 'coins')?.value).toBeUndefined();
  value.coins += 3_000_000_000;
  value.gems -= 5;
  expect(JSON.parse(JSON.stringify(value))).toEqual({ coins: 3_000_000_500, gems: 20 });
  expect(protectWallet(value)).toBe(value);
});
it('preserves exact safe integers and fractions instead of overflowing to int32', () => {
  const value = protectWallet(wallet());
  for (const amount of [Number.MAX_SAFE_INTEGER, 0, 0.25, -1]) {
    value.coins = amount;
    expect(value.coins).toBe(amount);
  }
  expect(() => {
    value.coins = NaN;
  }).toThrow();
  expect(value.coins).toBe(-1);
});
it('protects Zustand replacements and gameplay mutations before publication', () => {
  type State = { save: SaveGame | null; replace: () => void };
  const store = createStore<State>(
    withProtectedWallet((set) => ({
      save: null,
      replace: () => set({ save: { wallet: wallet() } as SaveGame }),
    })),
  );
  store.getState().replace();
  expect(
    Object.getOwnPropertyDescriptor(store.getState().save!.wallet, 'coins')?.get,
  ).toBeDefined();
  store.setState({ save: { wallet: wallet() } as SaveGame });
  expect(Object.getOwnPropertyDescriptor(store.getState().save!.wallet, 'gems')?.get).toBeDefined();
});
