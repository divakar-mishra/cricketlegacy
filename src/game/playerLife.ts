import {
  PersonalCoachDiscipline,
  Player,
  PlayerCaptainIssue,
  PlayerLifeMatch,
  PlayerLifeState,
  PlayerPerformanceAnalysis,
  SaveGame,
  Sponsor,
} from '../domain/types';
import { computeOverall } from '../engine/rating';
import { clamp } from '../utils/math';
import { buildOppositionReport } from './oppositionAnalysis';
import { TrainGroup } from './progression';

export interface PlayerLifeAsset {
  id: string;
  name: string;
  description: string;
  cost: number;
  seasonalIncome: number;
}

export interface PlayerEquipment {
  id: string;
  name: string;
  description: string;
  cost: number;
  boosts: { group: 'batting' | 'bowling' | 'fielding' | 'meta'; key: string; amount: number }[];
}

export interface PersonalCoachOffer {
  discipline: PersonalCoachDiscipline;
  name: string;
  specialty: string;
  cost: number;
}

export type SponsorApproach = 'SAFE' | 'BALANCED' | 'BOLD';
export type SocialTone = 'HUMBLE' | 'CONFIDENT' | 'TEAM_FIRST';
export type CaptainResolution = 'SUPPORT' | 'MEDIATE' | 'DISCIPLINE';

export interface PlayerLifeOutcome {
  ok: boolean;
  reason?: string;
  detail?: string;
  coins?: number;
  followers?: number;
}

export interface SponsorNegotiationPreview {
  approach: SponsorApproach;
  brand: string;
  tier: Sponsor['tier'];
  chance: number;
  signingBonus: number;
  perMatchCoins: number;
  seasons: number;
  minForm: number;
}

export const PLAYER_PROPERTIES: readonly PlayerLifeAsset[] = [
  {
    id: 'starter-apartment',
    name: 'City Apartment',
    description: 'A first home with modest seasonal rental income.',
    cost: 12_000,
    seasonalIncome: 450,
  },
  {
    id: 'family-house',
    name: 'Family House',
    description: 'A larger property that steadily builds personal wealth.',
    cost: 45_000,
    seasonalIncome: 1_800,
  },
  {
    id: 'legacy-estate',
    name: 'Legacy Estate',
    description: 'A late-career landmark and the strongest property income.',
    cost: 120_000,
    seasonalIncome: 5_200,
  },
] as const;

export const PLAYER_BUSINESSES: readonly PlayerLifeAsset[] = [
  {
    id: 'bat-workshop',
    name: 'Bat Workshop',
    description: 'A specialist cricket workshop with reliable seasonal profit.',
    cost: 25_000,
    seasonalIncome: 1_500,
  },
  {
    id: 'fitness-studio',
    name: 'Performance Studio',
    description: 'A training business tied to your playing reputation.',
    cost: 60_000,
    seasonalIncome: 4_200,
  },
  {
    id: 'media-company',
    name: 'Sports Media Company',
    description: 'A high-cost venture that turns your profile into long-term income.',
    cost: 150_000,
    seasonalIncome: 11_000,
  },
] as const;

export const PERSONAL_COACHES: readonly PersonalCoachOffer[] = [
  {
    discipline: 'BATTING',
    name: 'Batting Specialist',
    specialty: 'Improves the gains from paid batting sessions for one season.',
    cost: 8_000,
  },
  {
    discipline: 'BOWLING',
    name: 'Bowling Specialist',
    specialty: 'Improves the gains from paid bowling sessions for one season.',
    cost: 8_000,
  },
  {
    discipline: 'MENTAL',
    name: 'Mental Skills Coach',
    specialty: 'Improves fitness and mental-session gains for one season.',
    cost: 7_000,
  },
] as const;

export const PLAYER_EQUIPMENT: readonly PlayerEquipment[] = [
  {
    id: 'balanced-bat',
    name: 'Balanced Pro Bat',
    description: 'Permanent +1 technique and +1 timing. One purchase only.',
    cost: 5_000,
    boosts: [
      { group: 'batting', key: 'technique', amount: 1 },
      { group: 'batting', key: 'timing', amount: 1 },
    ],
  },
  {
    id: 'keeper-gloves',
    name: 'Match Gloves',
    description: 'Permanent +2 catching. One purchase only.',
    cost: 6_500,
    boosts: [{ group: 'fielding', key: 'catching', amount: 2 }],
  },
  {
    id: 'performance-shoes',
    name: 'Performance Shoes',
    description: 'Permanent +1 running and +1 agility. One purchase only.',
    cost: 7_500,
    boosts: [
      { group: 'batting', key: 'running', amount: 1 },
      { group: 'fielding', key: 'agility', amount: 1 },
    ],
  },
  {
    id: 'protective-kit',
    name: 'Elite Protective Kit',
    description: 'Permanent +1 temperament and +1 fitness. One purchase only.',
    cost: 9_000,
    boosts: [
      { group: 'batting', key: 'temperament', amount: 1 },
      { group: 'meta', key: 'fitness', amount: 1 },
    ],
  },
] as const;

const PHYSIO_COST = 9_000;
const ANALYST_COST = 12_000;
const MAX_PHYSIO_VISITS = 3;
const MAX_SOCIAL_POSTS = 3;

export function playerLifeYear(save: SaveGame): number {
  return save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function ensurePlayerLifeState(save: SaveGame): PlayerLifeState {
  if (!save.playerLife) {
    const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
    save.playerLife = {
      followers: Math.max(
        250,
        Math.round(
          (save.brand ?? 20) * 45 + (save.userCaps ?? 0) * 180 + (user?.overall ?? 30) * 8,
        ),
      ),
      bankCoins: 0,
      propertyIds: [],
      businessIds: [],
      legacyTokenUnits: 0,
      legacyTokenCostBasis: 0,
      personalCoaches: {},
      equipmentIds: [],
      physioVisitsThisSeason: 0,
      analysedFixtureIds: [],
      recentMatches: [],
      socialFeed: [],
      mediaPostsThisSeason: 0,
    };
  }
  const state = save.playerLife;
  state.followers = Math.max(0, Math.round(state.followers ?? 0));
  state.bankCoins = Math.max(0, Math.round(state.bankCoins ?? 0));
  state.propertyIds ??= [];
  state.businessIds ??= [];
  state.legacyTokenUnits = Math.max(0, Math.round(state.legacyTokenUnits ?? 0));
  state.legacyTokenCostBasis = Math.max(0, Math.round(state.legacyTokenCostBasis ?? 0));
  state.personalCoaches ??= {};
  state.equipmentIds ??= [];
  state.physioVisitsThisSeason = Math.max(0, Math.round(state.physioVisitsThisSeason ?? 0));
  state.analysedFixtureIds ??= [];
  state.recentMatches ??= [];
  state.socialFeed ??= [];
  state.mediaPostsThisSeason = Math.max(0, Math.round(state.mediaPostsThisSeason ?? 0));
  return state;
}

function userPlayer(save: SaveGame): Player | undefined {
  return save.userPlayerId ? save.players[save.userPlayerId] : undefined;
}

function spendWallet(save: SaveGame, cost: number): boolean {
  if (cost < 0 || save.wallet.coins < cost) return false;
  save.wallet.coins -= cost;
  return true;
}

function addWallet(save: SaveGame, amount: number): void {
  save.wallet.coins = Math.max(0, Math.round(save.wallet.coins + amount));
}

function financialFeaturesUnlocked(save: SaveGame): boolean {
  const player = userPlayer(save);
  return Boolean(
    player &&
    player.age >= 18 &&
    (save.careerPathLevel === 'DOMESTIC' || save.careerPathLevel === 'INTERNATIONAL'),
  );
}

export function transferPlayerBank(
  save: SaveGame,
  direction: 'DEPOSIT' | 'WITHDRAW',
  amount: number,
): PlayerLifeOutcome {
  if (!financialFeaturesUnlocked(save)) {
    return { ok: false, reason: 'Personal banking unlocks at age 18 in senior domestic cricket.' };
  }
  const coins = Math.max(0, Math.floor(amount));
  if (coins < 100) return { ok: false, reason: 'Enter at least 100 coins.' };
  const life = ensurePlayerLifeState(save);
  if (direction === 'DEPOSIT') {
    if (!spendWallet(save, coins)) return { ok: false, reason: 'Not enough Wallet Coins.' };
    life.bankCoins += coins;
    return { ok: true, coins, detail: `${coins.toLocaleString()} coins moved into your bank.` };
  }
  if (life.bankCoins < coins) return { ok: false, reason: 'Your bank balance is too low.' };
  life.bankCoins -= coins;
  addWallet(save, coins);
  return { ok: true, coins, detail: `${coins.toLocaleString()} coins moved to your wallet.` };
}

export function buyPlayerAsset(
  save: SaveGame,
  kind: 'PROPERTY' | 'BUSINESS',
  assetId: string,
): PlayerLifeOutcome {
  if (!financialFeaturesUnlocked(save)) {
    return { ok: false, reason: 'Assets unlock at age 18 in senior domestic cricket.' };
  }
  const life = ensurePlayerLifeState(save);
  const catalog = kind === 'PROPERTY' ? PLAYER_PROPERTIES : PLAYER_BUSINESSES;
  const owned = kind === 'PROPERTY' ? life.propertyIds : life.businessIds;
  const asset = catalog.find((item) => item.id === assetId);
  if (!asset) return { ok: false, reason: 'That asset is not available.' };
  if (owned.includes(asset.id)) return { ok: false, reason: 'You already own this asset.' };
  if (!spendWallet(save, asset.cost)) return { ok: false, reason: 'Not enough Wallet Coins.' };
  owned.push(asset.id);
  return {
    ok: true,
    coins: asset.cost,
    detail: `${asset.name} purchased. It will pay ${asset.seasonalIncome.toLocaleString()} coins into your bank each season.`,
  };
}

export function legacyTokenPrice(save: SaveGame): number {
  const year = playerLifeYear(save);
  const seed = stableHash(`${save.id}:${year}:legacy-exchange`);
  return 280 + ((seed % 11) - 5) * 16;
}

export function tradeLegacyToken(
  save: SaveGame,
  direction: 'BUY' | 'SELL',
  units: number,
): PlayerLifeOutcome {
  if (!financialFeaturesUnlocked(save)) {
    return { ok: false, reason: 'The Legacy Exchange unlocks at age 18 in senior cricket.' };
  }
  const quantity = Math.max(0, Math.floor(units));
  if (quantity < 1) return { ok: false, reason: 'Choose at least one token.' };
  const life = ensurePlayerLifeState(save);
  const price = legacyTokenPrice(save);
  const total = price * quantity;
  if (direction === 'BUY') {
    if (!spendWallet(save, total)) return { ok: false, reason: 'Not enough Wallet Coins.' };
    life.legacyTokenUnits += quantity;
    life.legacyTokenCostBasis += total;
    return {
      ok: true,
      coins: total,
      detail: `Bought ${quantity} fictional Legacy Token${quantity === 1 ? '' : 's'} for ${total.toLocaleString()} coins.`,
    };
  }
  if (life.legacyTokenUnits < quantity) {
    return { ok: false, reason: 'You do not own that many Legacy Tokens.' };
  }
  const previousUnits = life.legacyTokenUnits;
  life.legacyTokenUnits -= quantity;
  life.legacyTokenCostBasis =
    life.legacyTokenUnits === 0
      ? 0
      : Math.round(life.legacyTokenCostBasis * (life.legacyTokenUnits / previousUnits));
  addWallet(save, total);
  return {
    ok: true,
    coins: total,
    detail: `Sold ${quantity} fictional Legacy Token${quantity === 1 ? '' : 's'} for ${total.toLocaleString()} coins.`,
  };
}

export function hirePersonalCoach(
  save: SaveGame,
  discipline: PersonalCoachDiscipline,
): PlayerLifeOutcome {
  const offer = PERSONAL_COACHES.find((item) => item.discipline === discipline);
  if (!offer) return { ok: false, reason: 'That coach is not available.' };
  const life = ensurePlayerLifeState(save);
  const active = life.personalCoaches[discipline];
  if (active && active.seasonsRemaining > 0) {
    return { ok: false, reason: `${offer.name} is already contracted this season.` };
  }
  if (!spendWallet(save, offer.cost)) return { ok: false, reason: 'Not enough Wallet Coins.' };
  life.personalCoaches[discipline] = {
    discipline,
    hiredYear: playerLifeYear(save),
    seasonsRemaining: 1,
  };
  return { ok: true, coins: offer.cost, detail: `${offer.name} hired for the current season.` };
}

export function personalCoachTrainingMultiplier(save: SaveGame, group: TrainGroup): number {
  const coaches = ensurePlayerLifeState(save).personalCoaches;
  if (group === 'batting' && (coaches.BATTING?.seasonsRemaining ?? 0) > 0) return 1.5;
  if (group === 'bowling' && (coaches.BOWLING?.seasonsRemaining ?? 0) > 0) return 1.5;
  if ((group === 'mental' || group === 'fitness') && (coaches.MENTAL?.seasonsRemaining ?? 0) > 0) {
    return 1.5;
  }
  return 1;
}

export function buyPlayerEquipment(save: SaveGame, equipmentId: string): PlayerLifeOutcome {
  const life = ensurePlayerLifeState(save);
  const equipment = PLAYER_EQUIPMENT.find((item) => item.id === equipmentId);
  const player = userPlayer(save);
  if (!equipment || !player) return { ok: false, reason: 'That equipment is not available.' };
  if (life.equipmentIds.includes(equipment.id)) {
    return { ok: false, reason: 'This equipment is already owned and applied.' };
  }
  if (!spendWallet(save, equipment.cost)) return { ok: false, reason: 'Not enough Wallet Coins.' };
  for (const boost of equipment.boosts) {
    const group = player[boost.group] as unknown as Record<string, number>;
    group[boost.key] = clamp((group[boost.key] ?? 1) + boost.amount, 1, 99);
  }
  player.overall = computeOverall(player);
  life.equipmentIds.push(equipment.id);
  return {
    ok: true,
    coins: equipment.cost,
    detail: `${equipment.name} equipped. Its listed permanent boosts have been applied once.`,
  };
}

export function bookPersonalPhysio(save: SaveGame): PlayerLifeOutcome {
  const life = ensurePlayerLifeState(save);
  const player = userPlayer(save);
  if (!player) return { ok: false, reason: 'No player is available.' };
  if (life.physioVisitsThisSeason >= MAX_PHYSIO_VISITS) {
    return { ok: false, reason: 'The three-visit seasonal physio allowance is used.' };
  }
  const resources = save.playerCareerResources;
  const condition = resources?.playerCondition ?? player.condition ?? 100;
  if (!player.injury && condition >= 95) {
    return { ok: false, reason: 'You are already fully match-ready.' };
  }
  if (!spendWallet(save, PHYSIO_COST)) return { ok: false, reason: 'Not enough Wallet Coins.' };
  if (resources) resources.playerCondition = Math.min(100, condition + 25);
  player.condition = Math.min(100, (player.condition ?? condition) + 25);
  player.morale = Math.min(100, (player.morale ?? 70) + 4);
  if (player.injury) {
    player.injury.matchesOut = Math.max(0, player.injury.matchesOut - 1);
    if (player.injury.matchesOut === 0) player.injury = undefined;
  }
  life.physioVisitsThisSeason += 1;
  return {
    ok: true,
    coins: PHYSIO_COST,
    detail: 'Condition restored by 25 and an active injury shortened by one match.',
  };
}

function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

function weakestAttribute(attributes: readonly { label: string; value: number }[]): {
  label: string;
  value: number;
} {
  return (
    [...attributes].sort((left, right) => left.value - right.value)[0] ?? {
      label: 'match skill',
      value: 0,
    }
  );
}

function playerTrainingRecommendation(player: Player): {
  group: PlayerPerformanceAnalysis['recommendedTrainingGroup'];
  reason: string;
} {
  const batting = [
    { label: 'Technique', value: player.batting.technique },
    { label: 'Timing', value: player.batting.timing },
    { label: 'Power', value: player.batting.power },
    { label: 'Footwork', value: player.batting.footwork },
    { label: 'Temperament', value: player.batting.temperament },
    { label: 'Running', value: player.batting.running },
  ];
  const bowling = [
    { label: 'Pace/Spin', value: player.bowling.paceOrSpin },
    { label: 'Accuracy', value: player.bowling.accuracy },
    { label: 'Movement', value: player.bowling.movement },
    { label: 'Variations', value: player.bowling.variations },
    { label: 'Stamina', value: player.bowling.stamina },
  ];

  if (player.meta.fitness < 48) {
    return {
      group: 'fitness',
      reason: `Fitness is only ${player.meta.fitness}. A fitness session is the safest preparation before adding technical load.`,
    };
  }
  if (
    player.role === 'WK_BATTER' &&
    player.fielding.keeping + 6 < average(batting.map((item) => item.value))
  ) {
    return {
      group: 'wicketkeeping',
      reason: `Keeping (${player.fielding.keeping}) trails your batting base. Wicketkeeping training directly targets that gap.`,
    };
  }

  const useBowling =
    player.role === 'BOWLER' ||
    (player.role === 'ALLROUNDER' &&
      average(bowling.map((item) => item.value)) < average(batting.map((item) => item.value)));
  const group = useBowling ? 'bowling' : 'batting';
  const ranked = [...(useBowling ? bowling : batting)].sort(
    (left, right) => left.value - right.value,
  );
  const weakest = ranked.slice(0, 2);
  return {
    group,
    reason: `${group === 'bowling' ? 'Bowling' : 'Batting'} training targets your weakest eligible skills first: ${weakest
      .map((item) => `${item.label} ${item.value}`)
      .join(' and ')}.`,
  };
}

function buildPlayerPerformanceAnalysis(
  save: SaveGame,
  fixtureId: string,
): PlayerPerformanceAnalysis | undefined {
  const player = userPlayer(save);
  const fixture = save.fixtures[fixtureId];
  const opposition = buildOppositionReport(save, fixtureId);
  if (!player || !fixture || !opposition) return undefined;

  const training = playerTrainingRecommendation(player);
  const topBatter = save.players[opposition.topBatter.playerId];
  const topBowler = save.players[opposition.topBowler.playerId];
  const isBattingRole = player.role === 'BATTER' || player.role === 'WK_BATTER';
  const isBowlingRole = player.role === 'BOWLER';

  let threatName: string;
  let threatDetail: string;
  let weakness: string;
  let matchAdvice: string;

  if (isBattingRole && topBowler) {
    const weakest = weakestAttribute([
      { label: 'accuracy', value: topBowler.bowling.accuracy },
      { label: 'movement', value: topBowler.bowling.movement },
      { label: 'variations', value: topBowler.bowling.variations },
      { label: 'stamina', value: topBowler.bowling.stamina },
    ]);
    threatName = opposition.topBowler.name;
    threatDetail = `${topBowler.bowlingStyle?.replaceAll('_', ' ') ?? 'Bowler'} | accuracy ${topBowler.bowling.accuracy}, movement ${topBowler.bowling.movement}, variations ${topBowler.bowling.variations}.`;
    weakness = `${threatName}'s lowest measured bowling skill is ${weakest.label} (${weakest.value}).`;
    matchAdvice =
      weakest.label === 'stamina'
        ? `Protect your wicket during ${threatName}'s first spell, then raise intent when fatigue reduces control.`
        : weakest.label === 'accuracy'
          ? `Stay balanced and make ${threatName} bowl to you; the loose-ball rate is the clearest scoring opportunity.`
          : `Begin on balanced intent, play straight against ${threatName}, and attack the support bowlers rather than forcing early shots.`;
  } else if (isBowlingRole && topBatter) {
    const weakest = weakestAttribute([
      { label: 'technique', value: topBatter.batting.technique },
      { label: 'timing', value: topBatter.batting.timing },
      { label: 'power', value: topBatter.batting.power },
      { label: 'footwork', value: topBatter.batting.footwork },
      { label: 'temperament', value: topBatter.batting.temperament },
    ]);
    threatName = opposition.topBatter.name;
    threatDetail = `Technique ${topBatter.batting.technique}, timing ${topBatter.batting.timing}, power ${topBatter.batting.power}, temperament ${topBatter.batting.temperament}.`;
    weakness = `${threatName}'s lowest measured batting skill is ${weakest.label} (${weakest.value}).`;
    matchAdvice =
      weakest.label === 'footwork'
        ? `Vary pace and length to force ${threatName} to move at the crease; keep a catcher through the opening spell.`
        : weakest.label === 'temperament'
          ? `Attack ${threatName} early before the innings settles. A wicket-seeking line is worth the extra boundary risk.`
          : `Build dot-ball pressure against ${threatName}, then use your variation once the required rate or scoring pressure rises.`;
  } else {
    threatName = `${opposition.topBatter.name} / ${opposition.topBowler.name}`;
    threatDetail = `Batting threat: ${opposition.topBatter.detail} Bowling threat: ${opposition.topBowler.detail}`;
    weakness = opposition.weakness;
    matchAdvice = `With the ball, follow the identified team weakness. With the bat, begin balanced against ${opposition.topBowler.name} and target the support attack.`;
  }

  return {
    fixtureId,
    year: playerLifeYear(save),
    opponentTeamId: opposition.opponentTeamId,
    opponentName: opposition.opponentName,
    format: fixture.format,
    threatName,
    threatDetail,
    weakness,
    matchAdvice,
    recommendedTrainingGroup: training.group,
    trainingReason: training.reason,
  };
}

export function buyPerformanceAnalysis(
  save: SaveGame,
  fixtureId: string | undefined,
): PlayerLifeOutcome {
  if (!fixtureId) return { ok: false, reason: 'There is no upcoming fixture to analyse.' };
  const life = ensurePlayerLifeState(save);
  if (life.analysedFixtureIds.includes(fixtureId)) {
    return { ok: false, reason: 'That fixture has already been analysed.' };
  }
  const analysis = buildPlayerPerformanceAnalysis(save, fixtureId);
  const player = userPlayer(save);
  if (!analysis || !player) {
    return { ok: false, reason: 'The opponent XI is not available for a useful report yet.' };
  }
  if (!spendWallet(save, ANALYST_COST)) return { ok: false, reason: 'Not enough Wallet Coins.' };
  life.analysedFixtureIds.push(fixtureId);
  life.lastAnalysisReport = analysis;
  player.meta.confidence = clamp(player.meta.confidence + 3, 1, 99);
  if (save.playerCareerResources) {
    save.playerCareerResources.confidence = player.meta.confidence;
    save.playerCareerResources.coachTrust = Math.min(
      100,
      save.playerCareerResources.coachTrust + 2,
    );
  }
  return {
    ok: true,
    coins: ANALYST_COST,
    detail: `${analysis.opponentName} report ready. ${analysis.matchAdvice} Actual preparation gains: +3 confidence and +2 coach trust.`,
  };
}

function sponsorOffer(save: SaveGame): Sponsor {
  const year = playerLifeYear(save);
  const brand = save.brand ?? 20;
  const tier: Sponsor['tier'] = brand >= 70 ? 'GLOBAL' : brand >= 42 ? 'NATIONAL' : 'LOCAL';
  const multiplier = tier === 'GLOBAL' ? 3 : tier === 'NATIONAL' ? 2 : 1;
  return {
    id: `negotiated-${year}-${tier.toLowerCase()}`,
    brand:
      tier === 'GLOBAL' ? 'Apex Global' : tier === 'NATIONAL' ? 'Summit Sports' : 'Boundary Local',
    tier,
    perMatchCoins: 90 * multiplier,
    signingBonus: 800 * multiplier,
    seasonsLeft: 2,
    minForm: tier === 'GLOBAL' ? 55 : tier === 'NATIONAL' ? 45 : 35,
    requiresIntegrity: tier !== 'LOCAL',
  };
}

export function sponsorNegotiationChance(save: SaveGame, approach: SponsorApproach): number {
  if (approach === 'SAFE') return 100;
  const base = Math.round(((save.brand ?? 20) + (save.integrity ?? 80)) / 2);
  return clamp(base + (approach === 'BALANCED' ? 10 : -10), 25, 90);
}

export function sponsorNegotiationPreview(
  save: SaveGame,
  approach: SponsorApproach,
): SponsorNegotiationPreview {
  const offer = sponsorOffer(save);
  const approachMultiplier = approach === 'BOLD' ? 1.35 : approach === 'BALANCED' ? 1.15 : 0.85;
  return {
    approach,
    brand: offer.brand,
    tier: offer.tier,
    chance: sponsorNegotiationChance(save, approach),
    signingBonus: Math.round(offer.signingBonus * approachMultiplier),
    perMatchCoins: Math.round(offer.perMatchCoins * approachMultiplier),
    seasons: offer.seasonsLeft,
    minForm: offer.minForm ?? 0,
  };
}

export function negotiatePlayerSponsor(
  save: SaveGame,
  approach: SponsorApproach,
): PlayerLifeOutcome {
  const life = ensurePlayerLifeState(save);
  const year = playerLifeYear(save);
  if (life.sponsorNegotiatedYear === year) {
    return { ok: false, reason: 'You have already completed a sponsor negotiation this season.' };
  }
  const existing = save.sponsors ?? [];
  if (existing.length >= 2) {
    return { ok: false, reason: 'Two active sponsor slots are already occupied.' };
  }
  const preview = sponsorNegotiationPreview(save, approach);
  const chance = preview.chance;
  const roll = stableHash(`${save.id}:${year}:${approach}:sponsor`) % 100;
  const success = approach === 'SAFE' || roll < chance;
  life.sponsorNegotiatedYear = year;
  if (!success) {
    return {
      ok: false,
      reason: `The ambitious demand was rejected (${chance}% success chance). Try again next season.`,
    };
  }
  const offer = sponsorOffer(save);
  offer.perMatchCoins = preview.perMatchCoins;
  offer.signingBonus = preview.signingBonus;
  save.sponsors = [...existing, offer];
  addWallet(save, offer.signingBonus);
  return {
    ok: true,
    coins: offer.signingBonus,
    detail: `${offer.brand} signed: ${offer.signingBonus.toLocaleString()} now and ${offer.perMatchCoins} per match for two seasons.`,
  };
}

export function publishPlayerSocialPost(save: SaveGame, tone: SocialTone): PlayerLifeOutcome {
  const life = ensurePlayerLifeState(save);
  if (life.mediaPostsThisSeason >= MAX_SOCIAL_POSTS) {
    return { ok: false, reason: 'You have used all three meaningful media posts this season.' };
  }
  const latest = life.recentMatches[0];
  const base = 80 + Math.round((save.brand ?? 20) * 3);
  const performance = latest ? latest.runs + latest.wickets * 18 + latest.rating * 12 : 40;
  const multiplier = tone === 'CONFIDENT' ? 1.25 : tone === 'TEAM_FIRST' ? 1.05 : 0.9;
  const delta = Math.max(50, Math.round((base + performance) * multiplier));
  const headline =
    tone === 'CONFIDENT'
      ? 'Ready for the next challenge'
      : tone === 'TEAM_FIRST'
        ? 'The team comes first'
        : 'Grateful for the support';
  const body = latest
    ? `${latest.runs} runs and ${latest.wickets} wickets against ${latest.opponent}. ${headline}.`
    : `${headline}. Work continues before the next match.`;
  life.followers += delta;
  life.mediaPostsThisSeason += 1;
  life.socialFeed.unshift({
    id: `social-${playerLifeYear(save)}-${life.mediaPostsThisSeason}`,
    year: playerLifeYear(save),
    headline,
    body,
    reactions: Math.round(delta * 2.4),
    comments: ['Brilliant mindset.', 'Keep pushing.', 'The next match will be huge.'],
    followersDelta: delta,
  });
  life.socialFeed = life.socialFeed.slice(0, 24);
  save.brand = Math.min(100, (save.brand ?? 20) + (tone === 'CONFIDENT' ? 2 : 1));
  return {
    ok: true,
    followers: delta,
    detail: `Post published. +${delta.toLocaleString()} followers.`,
  };
}

export function recordPlayerLifeMatch(save: SaveGame, match: PlayerLifeMatch): void {
  if (save.mode !== 'career') return;
  const life = ensurePlayerLifeState(save);
  life.recentMatches = [match, ...life.recentMatches.filter((item) => item.id !== match.id)].slice(
    0,
    10,
  );
  const milestone = match.runs >= 100 || match.wickets >= 5 || match.rating >= 8.5;
  const followerGain = Math.max(
    8,
    Math.round(
      match.runs * 0.8 +
        match.wickets * 24 +
        match.rating * 5 +
        (match.international ? 120 : 0) +
        (match.result === 'W' ? 25 : 0),
    ),
  );
  life.followers += followerGain;
  if (milestone) {
    const headline =
      match.runs >= 100
        ? `${match.runs} lights up ${match.competition}`
        : match.wickets >= 5
          ? `${match.wickets}-wicket spell turns the match`
          : `Player of the match against ${match.opponent}`;
    life.socialFeed.unshift({
      id: `match-post-${match.id}`,
      year: match.year,
      headline,
      body: `${match.result === 'W' ? 'A winning performance' : 'A standout performance'} against ${match.opponent}: ${match.runs} runs, ${match.wickets} wickets, ${match.rating.toFixed(1)} rating.`,
      reactions: Math.round(followerGain * 3.2),
      comments: ['What a performance.', 'That was special.', 'Selection statement made.'],
      followersDelta: followerGain,
    });
    life.socialFeed = life.socialFeed.slice(0, 24);
  }
}

export function ensureCaptainIssue(save: SaveGame): PlayerCaptainIssue | undefined {
  const life = ensurePlayerLifeState(save);
  if (!save.captainClub && !save.captainCountry) return undefined;
  if (life.captainIssue) return life.captainIssue.resolved ? undefined : life.captainIssue;
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const affected = (team?.playerIds ?? [])
    .filter((id) => id !== save.userPlayerId)
    .sort((a, b) => (save.players[a]?.morale ?? 70) - (save.players[b]?.morale ?? 70))
    .slice(0, 2);
  if (!affected.length) return undefined;
  life.captainIssue = {
    id: `captain-${playerLifeYear(save)}-${affected.join('-')}`,
    title: 'Selection tension in the dressing room',
    detail:
      'Two squad members are unhappy with roles and playing time. Your response affects morale.',
    affectedPlayerIds: affected,
  };
  return life.captainIssue;
}

export function resolveCaptainIssue(
  save: SaveGame,
  resolution: CaptainResolution,
): PlayerLifeOutcome {
  const issue = ensureCaptainIssue(save);
  if (!issue || issue.resolved) return { ok: false, reason: 'There is no open captaincy issue.' };
  const moraleDelta = resolution === 'SUPPORT' ? 8 : resolution === 'MEDIATE' ? 5 : 1;
  for (const id of issue.affectedPlayerIds) {
    const player = save.players[id];
    if (player) player.morale = Math.min(100, (player.morale ?? 70) + moraleDelta);
  }
  const user = userPlayer(save);
  if (resolution === 'DISCIPLINE' && user) {
    user.meta.discipline = Math.min(99, user.meta.discipline + 1);
  }
  if (resolution === 'MEDIATE' && save.playerCareerResources) {
    save.playerCareerResources.coachTrust = Math.min(
      100,
      save.playerCareerResources.coachTrust + 2,
    );
  }
  issue.resolved = true;
  issue.outcome =
    resolution === 'SUPPORT'
      ? 'You backed the players publicly. Morale rose sharply.'
      : resolution === 'MEDIATE'
        ? 'You reset roles privately. Morale and coach trust improved.'
        : 'You set a firm standard. Morale barely moved, but discipline improved.';
  return { ok: true, detail: issue.outcome };
}

export function processPlayerLifeSeason(save: SaveGame, finishedYear: number): number {
  if (save.mode !== 'career') return 0;
  const life = ensurePlayerLifeState(save);
  const bankInterest = Math.floor(life.bankCoins * 0.02);
  const propertyIncome = PLAYER_PROPERTIES.filter((asset) =>
    life.propertyIds.includes(asset.id),
  ).reduce((sum, asset) => sum + asset.seasonalIncome, 0);
  const businessIncome = PLAYER_BUSINESSES.filter((asset) =>
    life.businessIds.includes(asset.id),
  ).reduce((sum, asset) => sum + asset.seasonalIncome, 0);
  const total = bankInterest + propertyIncome + businessIncome;
  life.bankCoins += total;
  life.lastSeasonIncome = {
    year: finishedYear,
    bankInterest,
    propertyIncome,
    businessIncome,
    total,
  };
  for (const discipline of Object.keys(life.personalCoaches) as PersonalCoachDiscipline[]) {
    const coach = life.personalCoaches[discipline];
    if (!coach) continue;
    coach.seasonsRemaining -= 1;
    if (coach.seasonsRemaining <= 0) delete life.personalCoaches[discipline];
  }
  life.physioVisitsThisSeason = 0;
  life.analysedFixtureIds = [];
  life.mediaPostsThisSeason = 0;
  life.captainIssue = undefined;
  if (total > 0) {
    life.socialFeed.unshift({
      id: `wealth-${finishedYear}`,
      year: finishedYear,
      headline: 'Off-field portfolio closes the season',
      body: `${total.toLocaleString()} coins were paid into your bank from interest and owned assets.`,
      reactions: Math.max(20, Math.round(total / 20)),
      comments: ['Smart planning.', 'Building for life after cricket.'],
      followersDelta: 0,
    });
    life.socialFeed = life.socialFeed.slice(0, 24);
  }
  return total;
}

export const PLAYER_LIFE_COSTS = {
  physio: PHYSIO_COST,
  analyst: ANALYST_COST,
  maxPhysioVisits: MAX_PHYSIO_VISITS,
  maxSocialPosts: MAX_SOCIAL_POSTS,
} as const;
