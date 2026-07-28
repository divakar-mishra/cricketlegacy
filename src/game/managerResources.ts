import {
  ManagerResourceAction,
  ManagerResourceState,
  SaveGame,
} from '../domain/types';
import { addCoins, addGems } from './economy';
import { addEliteStaffCandidates } from './manager';
import { clamp } from '../utils/math';

export const MANAGER_MATCH_ANALYSIS_COINS = 650;
export const MANAGER_ELITE_STAFF_SEARCH_GEMS = 35;

export interface ManagerResourceOutcome {
  ok: boolean;
  action: ManagerResourceAction;
  currency: 'coins' | 'gems';
  cost: number;
  detail?: string;
  reason?: string;
  candidateIds?: string[];
}

function ensureState(save: SaveGame): ManagerResourceState {
  return (save.managerResources ??= {
    totalCoinsSpent: 0,
    totalGemsSpent: 0,
    transactions: [],
  });
}

export function nextManagerFixtureId(save: SaveGame): string | undefined {
  if (!save.userTeamId || !save.currentSeasonId) return undefined;
  const season = save.seasons[save.currentSeasonId];
  return season?.fixtureIds
    .map((id) => save.fixtures[id])
    .filter(
      (fixture) =>
        fixture &&
        !fixture.played &&
        (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId),
    )
    .sort((left, right) => left.round - right.round)[0]?.id;
}

function scopeFor(save: SaveGame, action: ManagerResourceAction): string | undefined {
  if (action === 'MATCH_ANALYSIS') return nextManagerFixtureId(save);
  return save.currentSeasonId;
}

export function managerResourceUsed(save: SaveGame, action: ManagerResourceAction): boolean {
  const scopeId = scopeFor(save, action);
  if (!scopeId) return false;
  return Boolean(save.managerResources?.transactions.some((entry) => entry.id === `${action}:${scopeId}`));
}

/**
 * Atomic Manager wallet sink. Validation happens before mutation and the
 * action+scope transaction id makes rapid taps and retries idempotent.
 */
export function executeManagerResourceAction(
  save: SaveGame,
  action: ManagerResourceAction,
  now: number = Date.now(),
): ManagerResourceOutcome {
  const currency = action === 'MATCH_ANALYSIS' ? 'coins' : 'gems';
  const cost =
    action === 'MATCH_ANALYSIS'
      ? MANAGER_MATCH_ANALYSIS_COINS
      : MANAGER_ELITE_STAFF_SEARCH_GEMS;
  const fail = (reason: string): ManagerResourceOutcome => ({
    ok: false,
    action,
    currency,
    cost,
    reason,
  });
  if (save.mode !== 'manager' || !save.userTeamId) return fail('Available in Manager Career only.');
  const team = save.teams[save.userTeamId];
  if (!team) return fail('The active club could not be found.');
  const scopeId = scopeFor(save, action);
  if (!scopeId) {
    return fail(action === 'MATCH_ANALYSIS' ? 'No upcoming fixture is available.' : 'No active season is available.');
  }
  const state = ensureState(save);
  const transactionId = `${action}:${scopeId}`;
  if (state.transactions.some((entry) => entry.id === transactionId)) {
    return fail(action === 'MATCH_ANALYSIS' ? 'Analysis is already prepared for this fixture.' : 'An elite staff search was already completed this season.');
  }
  if (currency === 'coins' && save.wallet.coins < cost) return fail('Not enough coins.');
  if (currency === 'gems' && save.wallet.gems < cost) return fail('Not enough gems.');

  let detail: string;
  let candidateIds: string[] | undefined;
  if (action === 'MATCH_ANALYSIS') {
    const selected = (team.xi?.length ? team.xi : team.playerIds).slice(0, 11);
    for (const playerId of selected) {
      const player = save.players[playerId];
      if (!player) continue;
      player.meta.form = clamp((player.meta.form ?? 50) + 2, 1, 99);
      player.morale = clamp((player.morale ?? 70) + 1, 0, 100);
    }
    save.wallet = addCoins(save.wallet, -cost);
    state.totalCoinsSpent += cost;
    detail = `Opposition analysis prepared for ${selected.length} selected players: +2 form and +1 morale for the upcoming fixture.`;
  } else {
    const candidates = addEliteStaffCandidates(save, scopeId);
    if (!candidates.length) return fail('The recruitment network could not produce a shortlist.');
    save.wallet = addGems(save.wallet, -cost);
    state.totalGemsSpent += cost;
    candidateIds = candidates.map((candidate) => candidate.id);
    detail = `Three stronger staff candidates joined the shortlist. Hiring still uses the club budget and normal wage rules.`;
  }

  state.transactions.push({
    id: transactionId,
    action,
    currency,
    amount: cost,
    scopeId,
    createdAt: now,
    detail,
  });
  if (state.transactions.length > 60) state.transactions.splice(0, state.transactions.length - 60);
  return { ok: true, action, currency, cost, detail, candidateIds };
}
