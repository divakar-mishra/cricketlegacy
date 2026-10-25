import { useSyncExternalStore } from 'react';
import { ECONOMY } from '../data/gameConfig';
import { energyCapacity } from '../game/economy';
import { useCareer } from '../state/careerStore';
import * as ads from './ads';

let pending = false;
let sequence = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => pending;
export function useRewardedEnergyPending(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Shared by the Store and meter dialog; binds completion to the original save. */
export async function requestRewardedEnergy(saveId: string): Promise<{
  ok: boolean;
  energyAdded?: number;
  reason?: string;
}> {
  if (pending) return { ok: false, reason: 'An energy ad is already in progress.' };
  const career = useCareer.getState();
  if (career.save?.id !== saveId || career.save.mode !== 'career') {
    return { ok: false, reason: 'Open your Player career to recover energy.' };
  }
  career.synchronizeEnergyClock();
  const current = useCareer.getState().save!;
  if (current.wallet.energy >= energyCapacity(current.entitlements)) {
    return { ok: false, reason: 'Energy is already full.' };
  }
  if (!ads.isAdsReady())
    return { ok: false, reason: 'No ad is available right now. Energy still recovers for free.' };
  pending = true;
  listeners.forEach((listener) => listener());
  const transactionId = `energy:${saveId}:${Date.now()}:${++sequence}`;
  try {
    const result = await ads.showRewarded();
    if (!result.completed)
      return {
        ok: false,
        reason: 'The ad did not complete. No ad energy was added; free recovery continues.',
      };
    return useCareer.getState().grantAdEnergy(ECONOMY.rewardedAdEnergy, transactionId, saveId);
  } catch {
    return {
      ok: false,
      reason: 'The ad could not be completed. Please try again later; free recovery continues.',
    };
  } finally {
    pending = false;
    listeners.forEach((listener) => listener());
  }
}
