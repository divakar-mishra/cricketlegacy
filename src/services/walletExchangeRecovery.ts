/* eslint-disable @typescript-eslint/no-require-imports -- lazy native persistence boundary */
import { PLAYER_GEM_CONVERSION_PRESETS } from '../game/economy';

export interface PendingExchange {
  version: 1;
  saveId: string;
  slot: number;
  token: string;
  gems: number;
}
const KEY = 'cricket.pending.exchange.v1';
export async function readPendingExchange(): Promise<PendingExchange | null> {
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  const raw = await store.getItemAsync(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingExchange;
  if (value.version !== 1 || !value.saveId || !value.token || !Number.isInteger(value.slot) ||
      !(PLAYER_GEM_CONVERSION_PRESETS as readonly number[]).includes(value.gems)) throw new Error('Invalid pending gem exchange.');
  return value;
}
export async function writePendingExchange(value: PendingExchange): Promise<void> {
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  await store.setItemAsync(KEY, JSON.stringify(value), {
    keychainAccessible: store.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
export async function clearPendingExchange(): Promise<void> {
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  await store.deleteItemAsync(KEY);
}
