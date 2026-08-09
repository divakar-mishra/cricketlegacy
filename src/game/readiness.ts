import { CareerPathLevel, Player, SaveGame } from '../domain/types';
import { auctionEligible } from './auction';

interface FeatureGate {
  unlocked: boolean;
  reason?: string;
}

export function stockMarketUnlocked(level: CareerPathLevel | undefined, age: number): boolean {
  return age >= 18 && level !== 'SCHOOL' && level !== 'U19';
}

function userPlayer(save: SaveGame): Player | undefined {
  return save.userPlayerId ? save.players[save.userPlayerId] : undefined;
}

export function seniorProfessionalFeaturesUnlocked(save: SaveGame): boolean {
  const player = userPlayer(save);
  return Boolean(
    save.mode === 'career' && player && stockMarketUnlocked(save.careerPathLevel, player.age),
  );
}

export function franchiseAuctionGate(save: SaveGame): FeatureGate {
  const player = userPlayer(save);
  if (save.mode !== 'career' || !player) {
    return {
      unlocked: false,
      reason: 'Franchise auctions are available in player career mode.',
    };
  }
  if (auctionEligible(save, player)) return { unlocked: true };

  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'SCHOOL' || level === 'U19') {
    return {
      unlocked: false,
      reason: 'Reach domestic cricket before franchise auctions open.',
    };
  }
  if ((save.careerSeasons ?? 0) < 2) {
    return {
      unlocked: false,
      reason: 'Complete 2 domestic seasons before auction interest builds.',
    };
  }
  if ((player.careerStats?.matches ?? 0) < 10) {
    return {
      unlocked: false,
      reason: 'Play 10 career matches before clubs can judge your value.',
    };
  }
  return {
    unlocked: false,
    reason: 'Raise your form, brand, and overall to attract franchise bids.',
  };
}
