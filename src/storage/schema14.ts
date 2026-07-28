import { ECONOMY } from '../data/gameConfig';
import type { SaveGame, StoredMoney } from '../domain/types';

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function moneyFromMajor(value: unknown): StoredMoney {
  const major = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return { amountMinor: String(Math.round(major * 100)), currencyCode: 'INR' };
}

/**
 * Populate schema-14 canonical views from the established gameplay fields.
 * Compatibility fields remain authoritative until all callers have moved to
 * the canonical structures, so this must run before every persisted write.
 */
export function synchronizeSchema14State(save: SaveGame, now = Date.now()): void {
  const wallet = save.wallet ?? { coins: 0, gems: 0, energy: 0, energyUpdatedAt: now };
  const inventory = save.inventory ?? {};
  const user = save.userPlayerId ? save.players?.[save.userPlayerId] : undefined;

  save.premiumWallet = {
    accountCoins: count(wallet.coins),
    gems: count(wallet.gems),
    updatedAt: now,
    version: 1,
  };
  save.premiumInventory = {
    facilityUpgradeTokens: count(inventory.facility_upgrade_token),
    squadRecoveryTokens: count(inventory.squad_recovery_token),
    scoutFullRevealTokens: count(inventory.scout_full_reveal_token),
    contractBoostTokens: count(inventory.contract_boost_token),
    formRecoveryTokens: count(inventory.form_recovery_token),
    trainingAcceleratorCharges: count(inventory.training_accelerator),
    otherConsumableCharges: { ...(save.premiumInventory?.otherConsumableCharges ?? {}) },
  };

  if (save.mode === 'career') {
    const existing = save.playerCareerResources;
    const birthCountry = existing?.birthCountry ?? user?.nationality ?? '';
    const domesticCountry =
      (save.userTeamId ? save.teams?.[save.userTeamId]?.country : undefined) ??
      existing?.domesticCountry ??
      user?.nationality ??
      '';
    save.playerCareerResources = {
      ...existing,
      trainingFocus: count(wallet.energy),
      trainingFocusCap: save.vipEnergyBonusActive ? ECONOMY.vipEnergyMax : ECONOMY.energyMax,
      playerCondition: count(
        user?.condition ?? existing?.playerCondition ?? user?.meta?.fitness ?? 100,
      ),
      form: count(user?.meta?.form),
      confidence: count(user?.meta?.confidence),
      coachTrust: count(existing?.coachTrust ?? 50),
      adaptability: count(existing?.adaptability ?? 50),
      whiteBallTempo: count(existing?.whiteBallTempo ?? 50),
      redBallMemory: count(existing?.redBallMemory ?? 50),
      specialization: existing?.specialization ?? 'ALL_FORMATS',
      birthCountry,
      domesticCountry,
      cappedCountry: existing?.cappedCountry,
      declaredCountry:
        existing?.cappedCountry ?? existing?.declaredCountry ?? birthCountry,
      eligibleCountries: [
        ...new Set([birthCountry, ...(existing?.eligibleCountries ?? [])].filter(Boolean)),
      ],
      residencySeasons: {
        ...(existing?.residencySeasons ?? { [domesticCountry]: 0 }),
      },
      consecutiveMatches: count(existing?.consecutiveMatches),
      formatAppearances: { ...(existing?.formatAppearances ?? {}) },
    };
  }

  if (save.mode === 'manager') {
    const team = save.userTeamId ? save.teams?.[save.userTeamId] : undefined;
    const transferBudget = save.finances?.transferBudget ?? team?.budget ?? 0;
    const wageBudget = save.finances?.wageBudgetPerSeason ?? 0;
    const committedWages = (team?.playerIds ?? []).reduce(
      (total, playerId) => total + count(save.players?.[playerId]?.contract?.wage),
      0,
    );
    save.clubFinance = {
      clubBalance: moneyFromMajor(team?.budget),
      transferBudget: moneyFromMajor(transferBudget),
      wageBudget: moneyFromMajor(wageBudget),
      committedTransferSpend:
        save.clubFinance?.committedTransferSpend ?? moneyFromMajor(0),
      committedWages: moneyFromMajor(committedWages),
      seasonId: save.currentSeasonId ?? '',
      financialHistory: [...(save.clubFinance?.financialHistory ?? [])],
    };
    save.managerProgression = {
      reputation: count(team?.reputation),
      currentClubId: save.userTeamId ?? '',
      premiumAssistanceHistory: [
        ...(save.managerProgression?.premiumAssistanceHistory ?? []),
      ],
    };
    save.auctionAssistants = { ...(save.auctionAssistants ?? {}) };
  }
}
