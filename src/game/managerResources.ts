import { ManagerResourceAction, ManagerResourceState, SaveGame } from '../domain/types';
import { addCoins, addGems } from './economy';
import { addEliteStaffCandidates } from './manager';
import { managerControlledTeamId, nextManagerUserFixtureId } from './managerCalendar';
import { buildOppositionReport } from './oppositionAnalysis';
import { clamp } from '../utils/math';

export const MANAGER_MATCH_ANALYSIS_COINS = 650;
export const MANAGER_EMERGENCY_TEAM_TALK_COINS = 8_000;
export const MANAGER_FAST_TRACK_SCOUT_COINS = 6_000;
export const MANAGER_ELITE_STAFF_SEARCH_GEMS = 35;

export interface ManagerResourceOutcome {
  ok: boolean;
  action: ManagerResourceAction;
  currency: 'coins' | 'gems';
  cost: number;
  detail?: string;
  reason?: string;
  candidateIds?: string[];
  affectedPlayerIds?: string[];
}

function ensureState(save: SaveGame): ManagerResourceState {
  return (save.managerResources ??= {
    totalCoinsSpent: 0,
    totalGemsSpent: 0,
    transactions: [],
  });
}

export function nextManagerFixtureId(save: SaveGame): string | undefined {
  const scheduled = nextManagerUserFixtureId(save);
  if (scheduled) return scheduled;
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

function scopeFor(
  save: SaveGame,
  action: ManagerResourceAction,
  targetPlayerId?: string,
): string | undefined {
  if (action === 'MATCH_ANALYSIS' || action === 'EMERGENCY_TEAM_TALK') {
    return nextManagerFixtureId(save);
  }
  if (action === 'FAST_TRACK_SCOUT') {
    return targetPlayerId && save.currentSeasonId
      ? `${save.currentSeasonId}:${targetPlayerId}`
      : undefined;
  }
  return save.currentSeasonId;
}

export function managerResourceUsed(
  save: SaveGame,
  action: ManagerResourceAction,
  targetPlayerId?: string,
): boolean {
  const scopeId = scopeFor(save, action, targetPlayerId);
  if (!scopeId) return false;
  return Boolean(
    save.managerResources?.transactions.some((entry) => entry.id === `${action}:${scopeId}`),
  );
}

/**
 * Atomic Manager wallet sink. Validation happens before mutation and the
 * action+scope transaction id makes rapid taps and retries idempotent.
 */
export function executeManagerResourceAction(
  save: SaveGame,
  action: ManagerResourceAction,
  targetPlayerIdOrNow?: string | number,
  now: number = Date.now(),
): ManagerResourceOutcome {
  const targetPlayerId = typeof targetPlayerIdOrNow === 'string' ? targetPlayerIdOrNow : undefined;
  const createdAt = typeof targetPlayerIdOrNow === 'number' ? targetPlayerIdOrNow : now;
  const currency = action === 'ELITE_STAFF_SEARCH' ? 'gems' : 'coins';
  const cost =
    action === 'MATCH_ANALYSIS'
      ? MANAGER_MATCH_ANALYSIS_COINS
      : action === 'EMERGENCY_TEAM_TALK'
        ? MANAGER_EMERGENCY_TEAM_TALK_COINS
        : action === 'FAST_TRACK_SCOUT'
          ? MANAGER_FAST_TRACK_SCOUT_COINS
          : MANAGER_ELITE_STAFF_SEARCH_GEMS;
  const fail = (reason: string): ManagerResourceOutcome => ({
    ok: false,
    action,
    currency,
    cost,
    reason,
  });
  if (save.mode !== 'manager' || !save.userTeamId) return fail('Available in Manager Career only.');
  const activeTeamId =
    action === 'MATCH_ANALYSIS' || action === 'EMERGENCY_TEAM_TALK'
      ? managerControlledTeamId(save)
      : save.userTeamId;
  const team = activeTeamId ? save.teams[activeTeamId] : undefined;
  if (!team) return fail('The active team could not be found.');
  const scopeId = scopeFor(save, action, targetPlayerId);
  if (!scopeId) {
    return fail(
      action === 'MATCH_ANALYSIS' || action === 'EMERGENCY_TEAM_TALK'
        ? 'No upcoming fixture is available.'
        : action === 'FAST_TRACK_SCOUT'
          ? 'Choose a scouted transfer target first.'
          : 'No active season is available.',
    );
  }
  const state = ensureState(save);
  const transactionId = `${action}:${scopeId}`;
  if (state.transactions.some((entry) => entry.id === transactionId)) {
    return fail(
      action === 'MATCH_ANALYSIS'
        ? 'Analysis is already prepared for this fixture.'
        : action === 'EMERGENCY_TEAM_TALK'
          ? 'The emergency morale session was already used for this fixture.'
          : action === 'FAST_TRACK_SCOUT'
            ? 'That report was already fast-tracked this season.'
            : 'An elite staff search was already completed this season.',
    );
  }
  if (currency === 'coins' && save.wallet.coins < cost) return fail('Not enough coins.');
  if (currency === 'gems' && save.wallet.gems < cost) return fail('Not enough gems.');

  let detail: string;
  let candidateIds: string[] | undefined;
  let affectedPlayerIds: string[] | undefined;
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
    const report = buildOppositionReport(save, scopeId);
    detail = report
      ? `${report.opponentName}: ${report.topBatter.name} is the main batting threat; ${report.topBowler.name} leads the attack. ${report.weakness} Recommended plan: ${report.recommendedTactics.batting} batting, ${report.recommendedTactics.bowling} bowling, ${report.recommendedTactics.field} field. XI preparation: +2 form and +1 morale.`
      : `Opposition analysis prepared for ${selected.length} selected players: +2 form and +1 morale for the upcoming fixture.`;
  } else if (action === 'EMERGENCY_TEAM_TALK') {
    const lowestMorale = team.playerIds
      .map((playerId) => save.players[playerId])
      .filter(Boolean)
      .sort((left, right) => (left.morale ?? 70) - (right.morale ?? 70))
      .slice(0, 3);
    if (!lowestMorale.length) return fail('No squad players are available for the morale session.');
    for (const player of lowestMorale) {
      player.morale = clamp((player.morale ?? 70) + 5, 0, 100);
    }
    affectedPlayerIds = lowestMorale.map((player) => player.id);
    save.wallet = addCoins(save.wallet, -cost);
    state.totalCoinsSpent += cost;
    detail = `Emergency morale session lifted the three lowest-morale players by +5 morale before the upcoming fixture.`;
  } else if (action === 'FAST_TRACK_SCOUT') {
    const player = targetPlayerId ? save.players[targetPlayerId] : undefined;
    const report = targetPlayerId
      ? save.scoutReports?.find((entry) => entry.playerId === targetPlayerId)
      : undefined;
    if (!player || !report) return fail('A normal scout report is required before fast-tracking.');
    if (report.uncertainty <= 0) return fail('This report is already at 100% confidence.');
    report.uncertainty = clamp(report.uncertainty - 0.25, 0, 1);
    const pull = report.uncertainty === 0 ? 1 : 0.5;
    report.knownOverall = clamp(
      Math.round(report.knownOverall * (1 - pull) + player.overall * pull),
      1,
      99,
    );
    if (report.uncertainty < 0.4) {
      report.recommended = player.overall >= 68 && player.meta.form >= 42;
    }
    affectedPlayerIds = [player.id];
    save.wallet = addCoins(save.wallet, -cost);
    state.totalCoinsSpent += cost;
    detail = `Fast-track complete: ${player.name}'s Scout Confidence is now ${Math.round((1 - report.uncertainty) * 100)}%.`;
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
    createdAt,
    detail,
  });
  if (state.transactions.length > 60) state.transactions.splice(0, state.transactions.length - 60);
  return { ok: true, action, currency, cost, detail, candidateIds, affectedPlayerIds };
}
