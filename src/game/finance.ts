/**
 * Club finances & transfers: player valuations, signing/releasing free agents,
 * season prize money and board expectations. Money here is the club budget
 * (millions-scale), separate from the IAP coin wallet.
 */
import { BoardObjective, LeagueRow, Player, SaveGame } from '../domain/types';

export const MAX_SQUAD = 18;
export const MANAGER_MAX_SQUAD = 25;
export const MIN_SQUAD = 11;

export function maxSquadSize(save: SaveGame): number {
  return save.managerCalendar ? MANAGER_MAX_SQUAD : MAX_SQUAD;
}

/** Fraction of a player's transfer value paid as wages each season. */
export const WAGE_RATE = 0.03;
/** Seasonal upkeep for one level of one club facility. */
export const FACILITY_LEVEL_UPKEEP = 18_000;

/** Manager club money formatter. This is separate from wallet coins/gems and Google Play prices. */
export function formatClubCurrency(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const sign = rounded < 0 ? '-' : '';
  const n = Math.abs(rounded);
  if (n >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1000) return `${sign}$${Math.round(n / 1000)}k`;
  return `${sign}$${n}`;
}

/** Total seasonal wage bill for a squad. */
export function seasonWageBill(players: Player[]): number {
  return Math.round(players.reduce((sum, p) => sum + computeValue(p) * WAGE_RATE, 0));
}

/** Seasonal broadcast distribution, separate from fixture-based kit sponsorship. */
export function broadcastIncome(reputation: number): number {
  return 80_000 + Math.round(reputation) * 3_000;
}

/** @deprecated Compatibility name for saves/screens written before sponsorship was split. */
export function sponsorIncome(reputation: number): number {
  return broadcastIncome(reputation);
}

export interface ObjectiveOutcome {
  met: boolean;
  position: number;
  sacked: boolean; // missed the target by a wide margin → dismissed by the board
}

/** Judge the finished season against the board's expectation. */
export function evaluateBoardObjective(
  position: number,
  objective?: BoardObjective,
): ObjectiveOutcome {
  if (!objective || position <= 0) return { met: true, position, sacked: false };
  const met = position <= objective.targetPosition;
  const sacked = position > objective.targetPosition + 2;
  return { met, position, sacked };
}

/** Transfer valuation from overall rating and age. */
export function computeValue(p: Player): number {
  const ageFactor = p.age <= 27 ? 1.2 : p.age <= 31 ? 1.0 : 0.6;
  return Math.max(20000, Math.round((p.overall - 40) * 12000 * ageFactor));
}

/** Hard FFP ceiling as a multiple of the sustainable seasonal wage budget. */
export const FFP_CEILING_MULTIPLE = 1.25;

/** A squad player's actual seasonal wage (their contract, or a nominal value). */
export function playerWage(p: Player): number {
  return p.contract?.wage ?? Math.round(computeValue(p) * WAGE_RATE);
}

/** The user's current committed seasonal wage bill. */
export function currentWageBill(save: SaveGame): number {
  if (!save.userTeamId) return 0;
  const team = save.teams[save.userTeamId];
  return team.playerIds.reduce((sum, id) => {
    const p = save.players[id];
    return p ? sum + playerWage(p) : sum;
  }, 0);
}

/**
 * Fixed-cost reserve protected by the board after the club has completed its
 * first fully itemised settlement. Gate receipts and prize money stay upside;
 * only committed wages, staff and known infrastructure upkeep are protected,
 * net of guaranteed broadcast rights.
 */
export function managerOperatingReserve(save: SaveGame): number {
  if (save.mode !== 'manager' || !save.userTeamId || !save.lastSeasonSettlement) return 0;
  const team = save.teams[save.userTeamId];
  if (!team) return 0;
  const squad = team.playerIds
    .map((playerId) => save.players[playerId])
    .filter((player): player is Player => Boolean(player && !player.retired));
  const playerWages = seasonWageBill(squad);
  const staffWages = (save.staff ?? []).reduce((sum, member) => sum + member.wage, 0);
  const facilityLevels = save.facilities
    ? save.facilities.training + save.facilities.medical + save.facilities.academy
    : 0;
  const currentFacilityUpkeep = facilityLevels * FACILITY_LEVEL_UPKEEP;
  // The prior itemised line also contains stadium upkeep, which is otherwise
  // owned by the stadium module. Retain the larger known commitment.
  const infrastructureUpkeep = Math.max(
    currentFacilityUpkeep,
    save.lastSeasonSettlement.facilityUpkeep ?? 0,
  );
  return Math.max(
    0,
    Math.round(
      playerWages + staffWages + infrastructureUpkeep - broadcastIncome(team.reputation),
    ),
  );
}

/** Board guard for optional Club Balance spending and new annual commitments. */
export function optionalClubSpendBlockReason(
  save: SaveGame,
  immediateCost: number,
  additionalAnnualCommitment = 0,
): string | null {
  if (!save.userTeamId) return 'No active club.';
  const team = save.teams[save.userTeamId];
  const cost = Math.max(0, Math.round(immediateCost));
  if (!team || team.budget < cost) return 'Not enough club balance.';
  if (save.mode !== 'manager') return null;
  const protectedReserve = managerOperatingReserve(save) + Math.max(0, additionalAnnualCommitment);
  if (team.budget - cost < protectedReserve) {
    return `Board requires ${formatClubCurrency(protectedReserve)} for committed season costs.`;
  }
  return null;
}

/**
 * FFP check for a prospective signing. Manager mode only — career mode has no
 * wage budget. Returns a human reason if it breaches the hard wage ceiling, else
 * null (allowed).
 */
export function ffpBlockReason(save: SaveGame, incoming: Player): string | null {
  if (!save.finances) return null;
  const ceiling = save.finances.wageBudgetPerSeason * FFP_CEILING_MULTIPLE;
  if (currentWageBill(save) + playerWage(incoming) > ceiling) return 'Over the wage budget (FFP).';
  return null;
}

export interface SignOutcome {
  ok: boolean;
  cost: number;
  reason?: string;
}

export function signFreeAgent(save: SaveGame, playerId: string, feeOverride?: number): SignOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No active team.' };
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p) return { ok: false, cost: 0, reason: 'Player not found.' };
  if (!(save.freeAgents ?? []).includes(playerId))
    return { ok: false, cost: 0, reason: 'Not available.' };
  if (team.playerIds.includes(playerId))
    return { ok: false, cost: 0, reason: 'Player is already in your squad.' };
  const owner = Object.values(save.teams).find(
    (t) => t.id !== save.userTeamId && t.playerIds.includes(playerId),
  );
  if (owner) return { ok: false, cost: 0, reason: 'Player already belongs to another club.' };
  if (team.playerIds.length >= maxSquadSize(save))
    return { ok: false, cost: 0, reason: 'Squad is full.' };
  const baseCost = computeValue(p);
  const cost = feeOverride == null ? baseCost : Math.max(baseCost, Math.round(feeOverride));
  const budgetBlock = optionalClubSpendBlockReason(save, cost, playerWage(p));
  if (budgetBlock) return { ok: false, cost, reason: budgetBlock };
  const ffp = ffpBlockReason(save, p);
  if (ffp) return { ok: false, cost, reason: ffp };

  team.budget -= cost;
  team.playerIds = [...team.playerIds, playerId];
  save.freeAgents = (save.freeAgents ?? []).filter((id) => id !== playerId);
  p.contract = p.contract ?? { wage: Math.round(computeValue(p) * WAGE_RATE), yearsLeft: 3 };
  if (save.finances) save.finances.transferBudget = team.budget;
  return { ok: true, cost };
}

export interface ReleaseOutcome {
  ok: boolean;
  recouped: number;
  reason?: string;
}

export function releasePlayer(save: SaveGame, playerId: string): ReleaseOutcome {
  if (!save.userTeamId) return { ok: false, recouped: 0, reason: 'No active team.' };
  const team = save.teams[save.userTeamId];
  if (playerId === save.userPlayerId)
    return { ok: false, recouped: 0, reason: 'You cannot release yourself.' };
  if (!team.playerIds.includes(playerId))
    return { ok: false, recouped: 0, reason: 'Not in your squad.' };
  if (team.playerIds.length <= MIN_SQUAD)
    return { ok: false, recouped: 0, reason: 'Squad at minimum size.' };

  const recouped = Math.round(computeValue(save.players[playerId]) * 0.5);
  team.budget += recouped;
  team.playerIds = team.playerIds.filter((id) => id !== playerId);
  if (team.xi?.includes(playerId)) team.xi = undefined; // re-auto the XI
  save.freeAgents = [...(save.freeAgents ?? []), playerId];
  save.players[playerId].contract = undefined;
  if (save.finances) save.finances.transferBudget = team.budget;
  return { ok: true, recouped };
}

/** Prize money by final league position. */
export function prizeFor(position: number): number {
  if (position === 1) return 800_000;
  if (position === 2) return 500_000;
  if (position <= 4) return 300_000;
  if (position <= 6) return 150_000;
  return 80_000;
}

/** Board expectation scales with squad reputation. */
export function boardTargetFor(reputation: number): number {
  if (reputation >= 69) return 2;
  if (reputation >= 66) return 4;
  return 6;
}

/** 1-based league position of a team in a sorted standings table (0 if absent). */
export function leaguePosition(standings: LeagueRow[], teamId: string): number {
  return standings.findIndex((r) => r.teamId === teamId) + 1;
}
