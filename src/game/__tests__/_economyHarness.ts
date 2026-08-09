import { ECONOMY } from '../../data/gameConfig';
import { Wallet } from '../../domain/types';
import { regenEnergy, spendEnergy, startingWallet } from '../economy';

interface NoSpendLoopOptions {
  minutes: number;
  matchDurationMinutes?: number;
  startingWallet?: Wallet;
}

interface FirstWeekNoSpendOptions {
  days?: number;
  dailySessionMinutes?: number;
  matchDurationMinutes?: number;
  fixtureCosts?: number[];
  startingWallet?: Wallet;
}

export function simulateNoSpendLoop(options: NoSpendLoopOptions) {
  const matchDuration = Math.max(1, Math.floor(options.matchDurationMinutes ?? 8));
  const totalMinutes = Math.max(0, Math.floor(options.minutes));
  let now = 0;
  let wallet = options.startingWallet ?? startingWallet(0);
  let matchesPlayed = 0;
  let energyBlocks = 0;

  while (now < totalMinutes) {
    wallet = regenEnergy(wallet, now * 60 * 1000);
    if (wallet.energy >= ECONOMY.energyPerMatch) {
      wallet = spendEnergy(wallet, ECONOMY.energyPerMatch);
      matchesPlayed++;
      now += matchDuration;
      continue;
    }

    energyBlocks++;
    const missing = ECONOMY.energyPerMatch - wallet.energy;
    now += Math.max(1, missing * ECONOMY.energyRegenMinutes);
  }

  wallet = regenEnergy(wallet, totalMinutes * 60 * 1000);
  const missing = Math.max(0, ECONOMY.energyPerMatch - wallet.energy);
  return {
    matchesPlayed,
    energyBlocks,
    endingWallet: wallet,
    minutesUntilNextMatch: missing * ECONOMY.energyRegenMinutes,
  };
}

export function simulateFirstWeekNoSpendLoop(options: FirstWeekNoSpendOptions = {}) {
  const days = Math.max(1, Math.floor(options.days ?? 7));
  const sessionMinutes = Math.max(1, Math.floor(options.dailySessionMinutes ?? 45));
  const matchDuration = Math.max(1, Math.floor(options.matchDurationMinutes ?? 8));
  const fixtureCosts =
    options.fixtureCosts && options.fixtureCosts.length > 0
      ? options.fixtureCosts.map((cost) => Math.max(1, Math.floor(cost)))
      : [ECONOMY.energyPerMatch];

  let wallet = options.startingWallet ?? startingWallet(0);
  let totalMatchesPlayed = 0;
  let energyBlocks = 0;
  let blockedDays = 0;
  let nextFixtureIdx = 0;

  for (let day = 0; day < days; day++) {
    const sessionStart = day * 24 * 60;
    const sessionEnd = sessionStart + sessionMinutes;
    let now = sessionStart;
    let blockedToday = false;

    wallet = regenEnergy(wallet, now * 60 * 1000);
    while (now < sessionEnd) {
      const cost = fixtureCosts[nextFixtureIdx % fixtureCosts.length];
      wallet = regenEnergy(wallet, now * 60 * 1000);
      if (wallet.energy >= cost) {
        wallet = spendEnergy(wallet, cost);
        totalMatchesPlayed++;
        nextFixtureIdx++;
        now += matchDuration;
        continue;
      }

      energyBlocks++;
      blockedToday = true;
      now += Math.max(1, (cost - wallet.energy) * ECONOMY.energyRegenMinutes);
    }

    if (blockedToday) blockedDays++;
  }

  wallet = regenEnergy(wallet, days * 24 * 60 * 60 * 1000);
  const nextCost = fixtureCosts[nextFixtureIdx % fixtureCosts.length];
  const missing = Math.max(0, nextCost - wallet.energy);
  return {
    days,
    totalMatchesPlayed,
    energyBlocks,
    blockedDays,
    endingWallet: wallet,
    averageMatchesPerDay: totalMatchesPlayed / days,
    minutesUntilNextMatch: missing * ECONOMY.energyRegenMinutes,
  };
}
