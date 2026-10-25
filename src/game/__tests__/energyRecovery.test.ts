import { ECONOMY } from '../../data/gameConfig';
import {
  energyCapacity,
  energyRecovery,
  matchEnergyCost,
  refillEnergyWithGems,
  regenEnergy,
  spendEnergy,
} from '../economy';

const minute = 60_000;
const wallet = { coins: 100, gems: 10, energy: 0, energyUpdatedAt: 0 };

describe('approved energy recovery and cap contract', () => {
  it('separates the8point optional ad reward from unchanged match prices', () => {
    expect(ECONOMY.rewardedAdEnergy).toBe(8);
    expect(ECONOMY.energyRegenMinutes).toBe(3);
    expect(matchEnergyCost('T20', 'DOMESTIC')).toBe(4);
    expect(matchEnergyCost('TEST', 'INTERNATIONAL')).toBe(10);
  });
  it.each([false, true])(
    'has accurate next/full countdowns including the partial interval (VIP %s)',
    (vip) => {
      const cap = energyCapacity({ removeAds: vip });
      const result = energyRecovery(wallet, 7 * minute + 25_000, cap);
      expect(result.wallet.energy).toBe(2);
      expect(result.nextPointMs).toBe(95_000);
      expect(result.fullMs).toBe((cap - 2) * 3 * minute - 85_000);
    },
  );
  it('recovers from empty to free36in108minutes or VIP60in180minutes', () => {
    expect(regenEnergy(wallet, 108 * minute).energy).toBe(36);
    expect(regenEnergy(wallet, 180 * minute, 60).energy).toBe(60);
  });
  it('grants a point on the boundary, never early, and never banks time beyond full', () => {
    expect(regenEnergy(wallet, 3 * minute - 1).energy).toBe(0);
    expect(regenEnergy(wallet, 3 * minute).energy).toBe(1);
    const full = regenEnergy(wallet, 24 * 60 * minute);
    expect(full.energyUpdatedAt).toBe(24 * 60 * minute);
    const spent = spendEnergy(full, 4);
    expect(regenEnergy(spent, full.energyUpdatedAt + 3 * minute - 1).energy).toBe(32);
  });
  it('preserves overflow and never produces a negative countdown after a backward clock change', () => {
    const overflow = { ...wallet, energy: 75 };
    expect(energyRecovery(overflow, minute, 60)).toMatchObject({
      wallet: { energy: 75 },
      fullMs: 0,
      nextPointMs: 0,
    });
    expect(energyRecovery({ ...wallet, energyUpdatedAt: 100 * minute }, 0).nextPointMs).toBe(
      3 * minute,
    );
  });
  it('does not grant VIP capacity for a timed Starter ad-free trial', () => {
    expect(energyCapacity({ removeAds: false })).toBe(36);
    expect(energyCapacity({ removeAds: true })).toBe(60);
  });
  it.each([36, 60])(
    'gem refill reaches the real%d cap, respects elapsed recovery and never charges at full',
    (cap) => {
      expect(refillEnergyWithGems(wallet, 0, cap)).toMatchObject({ energy: cap, gems: 0 });
      expect(refillEnergyWithGems(wallet, cap * 3 * minute, cap)).toBeNull();
      expect(refillEnergyWithGems({ ...wallet, energy: cap + 5 }, 0, cap)).toBeNull();
      expect(refillEnergyWithGems({ ...wallet, gems: 9 }, 0, cap)).toBeNull();
    },
  );
});
