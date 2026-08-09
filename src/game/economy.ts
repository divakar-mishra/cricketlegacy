import { ECONOMY } from '../data/gameConfig';
import { Entitlements, Fixture, Format, Wallet } from '../domain/types';

const REGEN_MS = ECONOMY.energyRegenMinutes * 60 * 1000;

export function startingWallet(now = Date.now()): Wallet {
  return {
    coins: ECONOMY.startingCoins,
    gems: ECONOMY.startingGems,
    energy: ECONOMY.energyMax,
    energyUpdatedAt: now,
  };
}

/** Regenerate energy based on elapsed real time (capped at the max). */
export function regenEnergy(
  wallet: Wallet,
  now = Date.now(),
  maxEnergy: number = ECONOMY.energyMax,
): Wallet {
  if (wallet.energy >= maxEnergy) return { ...wallet, energyUpdatedAt: now };
  const gained = Math.floor((now - wallet.energyUpdatedAt) / REGEN_MS);
  if (gained <= 0) return wallet;
  const energy = Math.min(maxEnergy, wallet.energy + gained);
  return { ...wallet, energy, energyUpdatedAt: wallet.energyUpdatedAt + gained * REGEN_MS };
}

export function spendEnergy(wallet: Wallet, amount: number): Wallet {
  const cost = Math.max(0, Math.floor(amount));
  return { ...wallet, energy: Math.max(0, wallet.energy - cost) };
}

export type MatchEnergyLevel = 'YOUTH' | 'DOMESTIC' | 'INTERNATIONAL';

export function matchEnergyCost(format: Format, level: MatchEnergyLevel = 'DOMESTIC'): number {
  const formatBase: Record<Format, number> = {
    T10: 3,
    T20: ECONOMY.energyPerMatch,
    HUNDRED: ECONOMY.energyPerMatch,
    ODI: ECONOMY.energyPerMatch + 2,
    TEST: ECONOMY.energyPerMatch + 4,
  };
  const levelDelta: Record<MatchEnergyLevel, number> = {
    YOUTH: -1,
    DOMESTIC: 0,
    INTERNATIONAL: 2,
  };
  return Math.max(2, formatBase[format] + levelDelta[level]);
}

export function fixtureEnergyCost(
  fixture: Pick<Fixture, 'format' | 'competition' | 'competitionId'>,
): number {
  const isYouth = fixture.competitionId?.startsWith('youth-') ?? false;
  const isInternational =
    fixture.competition === 'BILATERAL_SERIES' ||
    fixture.competition === 'INTL_TOURNAMENT' ||
    fixture.competition === 'U19_WORLDCUP';
  return matchEnergyCost(
    fixture.format,
    isYouth ? 'YOUTH' : isInternational ? 'INTERNATIONAL' : 'DOMESTIC',
  );
}

export function addCoins(wallet: Wallet, amount: number): Wallet {
  return { ...wallet, coins: Math.max(0, wallet.coins + amount) };
}

export function addGems(wallet: Wallet, amount: number): Wallet {
  return { ...wallet, gems: Math.max(0, wallet.gems + amount) };
}

/** Refill energy to full (a gems sink). Returns null if unaffordable/at max. */
export const ENERGY_REFILL_GEMS = 10;
export function refillEnergyWithGems(wallet: Wallet, now = Date.now()): Wallet | null {
  if (wallet.energy >= ECONOMY.energyMax) return null;
  if (wallet.gems < ENERGY_REFILL_GEMS) return null;
  return {
    ...wallet,
    gems: wallet.gems - ENERGY_REFILL_GEMS,
    energy: ECONOMY.energyMax,
    energyUpdatedAt: now,
  };
}

export interface MatchPerformance {
  runs?: number;
  wickets?: number;
}

export function matchReward(won: boolean, tie: boolean, performance?: MatchPerformance): number {
  let base: number;
  if (won) base = ECONOMY.matchCoins.win;
  else if (tie) base = ECONOMY.matchCoins.tie;
  else base = ECONOMY.matchCoins.loss;
  return base + performanceBonus(performance);
}

/** Bonus coins for exceptional individual performance. */
export function performanceBonus(performance?: MatchPerformance): number {
  if (!performance) return 0;
  let bonus = 0;
  if (performance.runs != null) {
    if (performance.runs >= 100) bonus += 100;
    else if (performance.runs >= 50) bonus += 50;
  }
  if (performance.wickets != null) {
    if (performance.wickets >= 5) bonus += 100;
    else if (performance.wickets >= 3) bonus += 50;
  }
  return bonus;
}

/**
 * True when interstitial/banner ads should be suppressed for this player —
 * either the permanent `removeAds` entitlement OR an unexpired *timed* grant
 * (e.g. the Starter Pack's 7-day ad-free trial via `removeAdsUntil`).
 */
export function areAdsRemoved(
  ent: Pick<Entitlements, 'removeAds' | 'removeAdsUntil' | 'seasonPass'> | undefined,
  now: number = Date.now(),
): boolean {
  if (!ent) return false;
  return (
    ent.removeAds === true ||
    (ent.removeAdsUntil ?? 0) > now ||
    Boolean(ent.seasonPass?.premium && ent.seasonPass.expiresAt > now)
  );
}

/** VIP = permanent `removeAds` holder. Timed trials do NOT count as VIP. */
export function isVip(ent: Pick<Entitlements, 'removeAds'> | undefined): boolean {
  return ent?.removeAds === true;
}

/**
 * Match-coin multiplier for VIP holders — implements the advertised
 * "+20% coins every match" perk. Returns 1 for non-VIP players.
 */
export function vipCoinMultiplier(ent: Pick<Entitlements, 'removeAds'> | undefined): number {
  return isVip(ent) ? ECONOMY.vipCoinMultiplier : 1;
}
