import { ECONOMY } from '../data/gameConfig';
import { CareerPathLevel, Player, SaveGame } from '../domain/types';
import { auctionEligible } from './auction';
import { nextUserCupTie } from './cup';
import { allowedCompetitionIds } from './managerCareer';
import { nextUserFixtureId } from './season';

export type EarlySessionPhase = 'FIRST_MATCH' | 'SECOND_MATCH' | 'TRUSTED_LOOP';
export type RoadmapFeature =
  | 'SEASON_PASS'
  | 'ADVANCED_LIVEOPS'
  | 'NATIONAL_CUP'
  | 'FRANCHISE_AUCTION'
  | 'MANAGER_MULTI_FORMAT';

export interface FeatureGate {
  unlocked: boolean;
  reason?: string;
}

export interface NextAction {
  id:
    | 'PLAY_NEXT_MATCH'
    | 'PLAY_CUP_TIE'
    | 'CLAIM_REWARD'
    | 'TRAIN_PLAYER'
    | 'OPEN_SELECTION'
    | 'REFILL_ENERGY'
    | 'WAIT_FOR_FIXTURE';
  label: string;
  reason: string;
}

export function earlySessionPhase(playedMatchesAllModes: number): EarlySessionPhase {
  if (playedMatchesAllModes <= 0) return 'FIRST_MATCH';
  if (playedMatchesAllModes === 1) return 'SECOND_MATCH';
  return 'TRUSTED_LOOP';
}

export function shouldShowSeasonPass(playedMatchesAllModes: number): boolean {
  return earlySessionPhase(playedMatchesAllModes) === 'TRUSTED_LOOP';
}

export function shouldShowAdvancedLiveOps(playedMatchesAllModes: number): boolean {
  return earlySessionPhase(playedMatchesAllModes) === 'TRUSTED_LOOP';
}

/**
 * The personal Stock Market (and other senior-pro finance features) is only for
 * adult professionals. It must stay hidden for youth pathways (School/U14 and
 * U19) regardless of which level the career started at. Single source of truth
 * so the hub gate and the "unlocked" popup can never drift apart.
 */
export function stockMarketUnlocked(level: CareerPathLevel | undefined, age: number): boolean {
  return age >= 18 && level !== 'SCHOOL' && level !== 'U19';
}

function userPlayer(save: SaveGame): Player | undefined {
  return save.userPlayerId ? save.players[save.userPlayerId] : undefined;
}

export function seniorProfessionalFeaturesUnlocked(save: SaveGame): boolean {
  const player = userPlayer(save);
  if (save.mode !== 'career' || !player) return false;
  return stockMarketUnlocked(save.careerPathLevel, player.age);
}

export function featureGate(
  save: SaveGame,
  feature: RoadmapFeature,
  playedMatchesAllModes = 0,
): FeatureGate {
  switch (feature) {
    case 'SEASON_PASS':
      return shouldShowSeasonPass(playedMatchesAllModes)
        ? { unlocked: true }
        : { unlocked: false, reason: 'Play 2 matches first so rewards make sense.' };
    case 'ADVANCED_LIVEOPS':
      return shouldShowAdvancedLiveOps(playedMatchesAllModes)
        ? { unlocked: true }
        : { unlocked: false, reason: 'Advanced events unlock after your first 2 matches.' };
    case 'NATIONAL_CUP': {
      if (save.mode === 'manager') {
        const level = save.managerCareerLevel ?? 'CLUB';
        return level === 'CLUB'
          ? { unlocked: false, reason: 'Win promotion to State level to enter the National Cup.' }
          : { unlocked: true };
      }
      const level = save.careerPathLevel ?? 'DOMESTIC';
      return level === 'SCHOOL' || level === 'U19'
        ? { unlocked: false, reason: 'Reach domestic cricket before entering the National Cup.' }
        : { unlocked: true };
    }
    case 'FRANCHISE_AUCTION': {
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
    case 'MANAGER_MULTI_FORMAT': {
      if (save.mode !== 'manager') {
        return { unlocked: false, reason: 'Multi-format selection is a manager career feature.' };
      }
      const level = save.managerCareerLevel ?? 'CLUB';
      return allowedCompetitionIds(level).has('list-a')
        ? { unlocked: true }
        : {
            unlocked: false,
            reason:
              'Win promotion to Professional level to unlock List A. First Class follows at Master level.',
          };
    }
    default:
      return { unlocked: true };
  }
}

export function nextObviousAction(save: SaveGame, playedMatchesAllModes = 0): NextAction {
  const fixtureId = nextUserFixtureId(save);
  const cupTieId = nextUserCupTie(save);
  const phase = earlySessionPhase(playedMatchesAllModes);
  if (save.wallet.energy < ECONOMY.energyPerMatch) {
    return {
      id: 'REFILL_ENERGY',
      label: 'Get match energy',
      reason: 'You need energy before the next match.',
    };
  }
  if (cupTieId && phase === 'TRUSTED_LOOP') {
    return {
      id: 'PLAY_CUP_TIE',
      label: 'Play cup tie',
      reason: 'Knockout cricket is available now.',
    };
  }
  if (fixtureId) {
    return {
      id: 'PLAY_NEXT_MATCH',
      label: phase === 'FIRST_MATCH' ? 'Play your first match' : 'Play next match',
      reason:
        phase === 'FIRST_MATCH'
          ? 'Start with one live match before the wider systems open up.'
          : 'Your next fixture moves the season forward.',
    };
  }
  if (save.mode === 'career') {
    return {
      id: 'TRAIN_PLAYER',
      label: 'Train your player',
      reason: 'No fixture is ready, so improve a skill group.',
    };
  }
  return {
    id: 'OPEN_SELECTION',
    label: 'Review your XI',
    reason: 'No fixture is ready, so tune selection and tactics.',
  };
}
