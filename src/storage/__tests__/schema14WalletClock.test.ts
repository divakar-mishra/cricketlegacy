import type { SaveGame } from '../../domain/types';
import { synchronizeSchema14State } from '../schema14';

function snapshot(mode: 'career' | 'manager' = 'manager'): SaveGame {
  return {
    id: 'wallet-clock', mode, wallet: { coins: 11000, gems: 75, energy: 20, energyUpdatedAt: 10 },
    premiumWallet: { accountCoins: 11000, gems: 75, updatedAt: 100, version: 1 },
    inventory: { squad_recovery_token: 1 }, players: {}, teams: {}, flags: { 'purchaseToken:original': true },
    entitlements: { removeAdsUntil: 1800000000000 }, updatedAt: 200,
  } as unknown as SaveGame;
}

it.each(['career', 'manager'] as const)('keeps an unchanged %s wallet clock stable across normal saves', mode => {
  const save = snapshot(mode);
  const wallet = structuredClone(save.wallet);
  const flags = structuredClone(save.flags);
  const entitlements = structuredClone(save.entitlements);
  for (let index = 1; index <= 10; index++) synchronizeSchema14State(save, 1000 + index);
  expect(save.premiumWallet).toEqual({ accountCoins: 11000, gems: 75, updatedAt: 100, version: 1 });
  expect(save.wallet).toEqual(wallet);
  expect(save.flags).toEqual(flags);
  expect(save.entitlements).toEqual(entitlements);
  expect(save.premiumInventory?.squadRecoveryTokens).toBe(1);
});

it.each([
  ['coins', 10999], ['coins', 11001], ['gems', 74], ['gems', 76],
] as const)('advances the clock for an actual %s balance change to %s', (field, value) => {
  const save = snapshot();
  save.wallet[field] = value;
  synchronizeSchema14State(save, 1000);
  expect(save.premiumWallet).toEqual({ accountCoins: save.wallet.coins, gems: save.wallet.gems, updatedAt: 1000, version: 1 });
  synchronizeSchema14State(save, 2000);
  expect(save.premiumWallet?.updatedAt).toBe(1000);
});

it('updates inventory and focus independently without rewriting the unchanged wallet clock', () => {
  const save = snapshot('career');
  save.wallet.energy = 8;
  save.inventory = { squad_recovery_token: 0 };
  synchronizeSchema14State(save, 1000);
  expect(save.premiumWallet?.updatedAt).toBe(100);
  expect(save.premiumInventory?.squadRecoveryTokens).toBe(0);
  expect(save.playerCareerResources?.trainingFocus).toBe(8);
});

it('initializes a missing legacy wallet using the established compatibility balances', () => {
  const save = snapshot();
  delete save.premiumWallet;
  synchronizeSchema14State(save, 1000);
  expect(save.premiumWallet).toEqual({ accountCoins: 11000, gems: 75, updatedAt: 1000, version: 1 });
});

it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, undefined])('repairs an invalid canonical timestamp: %p', invalid => {
  const save = snapshot();
  save.premiumWallet!.updatedAt = invalid as number;
  synchronizeSchema14State(save, 1000);
  expect(save.premiumWallet?.updatedAt).toBe(1000);
});

it('repairs the canonical version and retains the established count normalization', () => {
  const save = snapshot();
  save.premiumWallet!.version = 0;
  save.wallet.coins = 19.9;
  save.wallet.gems = -2;
  synchronizeSchema14State(save, 1000);
  expect(save.premiumWallet).toEqual({ accountCoins: 19, gems: 0, updatedAt: 1000, version: 1 });
  expect(save.wallet).toMatchObject({ coins: 19.9, gems: -2 });
});

it('does not rewrite an unchanged valid timestamp when the device clock goes backwards', () => {
  const save = snapshot();
  synchronizeSchema14State(save, 50);
  expect(save.premiumWallet?.updatedAt).toBe(100);
});
