import type { SaveGame } from '../domain/types';
import { PRESS_APPEARANCE_GAP } from './careerEvents';
import { stockMarketUnlocked } from './readiness';
import {
  PLAYER_BUSINESSES,
  PLAYER_EQUIPMENT,
  PLAYER_PROPERTIES,
  PLAYER_LIFE_COSTS,
  PERSONAL_COACHES,
  equipmentFitsPlayerRole,
} from './playerLife';
import { STOCK_MIN_INVEST } from './stockMarket';

export type PlayerAdviceKind =
  | 'INJURY' | 'ANALYST' | 'COACH' | 'INVEST' | 'VENTURE' | 'EQUIPMENT';

export interface PlayerAdvice {
  kind: PlayerAdviceKind;
  key: string;
  title: string;
  message: string;
  action: string;
}

/** Record the appearance at which an adviser conversation was handled. */
export function advisorVisitKey(save: SaveGame): string {
  const matches = save.userPlayerId ? (save.players[save.userPlayerId]?.careerStats?.matches ?? 0) : 0;
  return `advisor:visit:${save.currentSeasonId ?? 'season'}:${matches}`;
}

/** Pure, ordered recommendations; this never spends coins or changes the save. */
export function nextPlayerAdvice(save: SaveGame, fixtureId?: string): PlayerAdvice | undefined {
  if (save.mode !== 'career' || !save.userPlayerId) return undefined;
  const player = save.players[save.userPlayerId];
  if (!player) return undefined;
  const season = save.currentSeasonId ?? 'season';
  const candidates: PlayerAdvice[] = [];

  if (player.injury) {
    const physioAvailable = (save.playerLife?.physioVisitsThisSeason ?? 0) < PLAYER_LIFE_COSTS.maxPhysioVisits;
    candidates.push({
      kind: 'INJURY',
      key: `advisor:injury:${season}:${player.injury.type}:${player.injury.severity}`,
      title: 'Let’s plan your recovery',
      message: physioAvailable
        ? `You are out with ${player.injury.type}. A personal physio can shorten the injury by one match and restore condition for Wallet Coins. Resting is free. The Injury Report also offers optional gem fast-track recovery.`
        : `You are out with ${player.injury.type}. Your seasonal physio visits are used. Resting is free; the Injury Report also offers optional gem fast-track recovery.`,
      action: physioAvailable ? 'View physio' : 'View recovery',
    });
  }

  if (player.meta.form < 45 && fixtureId &&
      !save.playerLife?.analysedFixtureIds?.includes(fixtureId)) {
    candidates.push({
      kind: 'ANALYST',
      key: `advisor:analyst:${fixtureId}`,
      title: 'Find a way out of this slump',
      message: 'Your form is low. A performance analyst can prepare an opponent report and training focus for the next fixture. You can also train or play on without buying it.',
      action: 'View analyst',
    });
  }

  // An injury is urgent. Other advice follows the existing press-beat spacing,
  // so it cannot appear after every match simply because several topics qualify.
  const appearances = player.careerStats?.matches ?? 0;
  const visitPrefix = `advisor:visit:${season}:`;
  const lastVisit = Math.max(-PRESS_APPEARANCE_GAP, ...Object.keys(save.flags ?? {})
    .filter((key) => key.startsWith(visitPrefix) && save.flags?.[key])
    .map((key) => Number(key.slice(visitPrefix.length)))
    .filter(Number.isFinite));
  const urgentInjury = candidates.some((advice) => advice.kind === 'INJURY' && !save.flags?.[advice.key]);
  if (!urgentInjury && appearances - lastVisit < PRESS_APPEARANCE_GAP) return undefined;

  const roleCoaches = PERSONAL_COACHES.filter((coach) =>
    coach.discipline === 'MENTAL' ||
    coach.discipline === 'BATTING' && player.role !== 'BOWLER' ||
    coach.discipline === 'BOWLING' && (player.role === 'BOWLER' || player.role === 'ALLROUNDER'),
  );
  const roleCoach = roleCoaches.find((coach) =>
    save.wallet.coins >= coach.cost &&
    !(save.playerLife?.personalCoaches?.[coach.discipline]?.seasonsRemaining),
  );
  if (roleCoach) {
    candidates.push({
      kind: 'COACH',
      key: `advisor:coach:${season}`,
      title: 'Make training count',
      message: `You can afford a ${roleCoach.name}. It improves gains from eligible paid sessions this season. Training without a personal coach remains available.`,
      action: 'View coaches',
    });
  }

  if (stockMarketUnlocked(save.careerPathLevel, player.age) &&
      save.wallet.coins >= STOCK_MIN_INVEST) {
    candidates.push({
      kind: 'INVEST',
      key: `advisor:invest:${season}`,
      title: 'Consider your off-field money',
      message: 'You have enough Wallet Coins to explore the Portfolio. Investments can rise or fall, and keeping your coins for training is also a valid choice. I will not invest for you.',
      action: 'Open Portfolio',
    });
  }

  if (stockMarketUnlocked(save.careerPathLevel, player.age)) {
    const affordableVenture = [
      ...PLAYER_PROPERTIES.filter((asset) => !save.playerLife?.propertyIds?.includes(asset.id)),
      ...PLAYER_BUSINESSES.filter((asset) => !save.playerLife?.businessIds?.includes(asset.id)),
    ].find((asset) => asset.cost <= save.wallet.coins);
    if (affordableVenture) candidates.push({
      kind: 'VENTURE',
      key: `advisor:venture:${season}`,
      title: 'Look beyond match fees',
      message: `${affordableVenture.name} is within your Wallet Coin balance. Player Life explains its cost and seasonal income. You can keep the coins for cricket instead.`,
      action: 'View finances',
    });
  }

  const equipment = PLAYER_EQUIPMENT.find((item) =>
    equipmentFitsPlayerRole(item, player.role) &&
    !save.playerLife?.equipmentIds?.includes(item.id) &&
    save.wallet.coins >= item.cost,
  );
  if (equipment) {
    candidates.push({
      kind: 'EQUIPMENT',
      key: `advisor:equipment:${season}`,
      title: 'Check your cricket kit',
      message: `${equipment.name} is available for your role. Equipment gives its listed permanent benefit, but you can keep playing without it.`,
      action: 'View equipment',
    });
  }

  return candidates.find((advice) => !save.flags?.[advice.key]);
}
