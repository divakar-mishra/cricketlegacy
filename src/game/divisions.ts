/**
 * Two-division pyramid: promotion & relegation between the top flight (tier 1)
 * and the second tier (tier 2). The user's division is always played out in full
 * (league-1); the OTHER division is resolved abstractly at rollover (ranked by
 * club strength + deterministic luck) — cheap and good enough to drive who goes
 * up and who comes down. Pure/mutating helpers, unit-tested.
 */
import { DomesticTier, League, LeagueRow, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import {
  DIV1_LEAGUE_ID,
  DIV2_LEAGUE_ID,
  DIV3_LEAGUE_ID,
} from '../generation/world';
import { domesticLeagueName } from './domesticBranding';

/** How many clubs swap divisions each season. */
export const PROMOTE_RELEGATE_COUNT = 2;

export function hasDivisions(save: SaveGame): boolean {
  return Boolean(save.divisions && save.divisions.tier2.length > 0);
}

export function hasThreeDivisions(save: SaveGame): boolean {
  return Boolean(save.divisions?.tier3?.length);
}

function emptyTable(teamIds: string[]): LeagueRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
  }));
}

/**
 * Abstractly resolve a division's final order (best → worst) when the user isn't
 * in it. Ranks by club reputation plus deterministic seasonal luck.
 */
export function simulateDivisionOrder(teamIds: string[], save: SaveGame, rng: Rng): string[] {
  return teamIds
    .map((id) => ({ id, score: (save.teams[id]?.reputation ?? 60) + (rng() * 2 - 1) * 11 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

export interface PromotionResult {
  promoted: string[];
  relegated: string[];
  userMoved?: 'PROMOTED' | 'RELEGATED';
}

export type DivisionOrders = Record<DomesticTier, string[]>;

/** Apply exact two-up/two-down movement across a completed three-tier pyramid. */
export function applyThreeTierPromotionRelegation(
  save: SaveGame,
  orders: DivisionOrders,
): PromotionResult {
  if (!save.divisions?.tier3 || !save.userTeamId) {
    return { promoted: [], relegated: [] };
  }
  const order1 = orders[1];
  const order2 = orders[2];
  const order3 = orders[3];
  if (order1.length < 4 || order2.length < 4 || order3.length < 4) {
    return { promoted: [], relegated: [] };
  }

  const oldTier = save.userDivision ?? 3;
  const downFrom1 = order1.slice(-PROMOTE_RELEGATE_COUNT);
  const upFrom2 = order2.slice(0, PROMOTE_RELEGATE_COUNT);
  const downFrom2 = order2.slice(-PROMOTE_RELEGATE_COUNT);
  const upFrom3 = order3.slice(0, PROMOTE_RELEGATE_COUNT);
  save.divisions = {
    tier1: [...order1.filter((id) => !downFrom1.includes(id)), ...upFrom2],
    tier2: [
      ...order2.filter((id) => !upFrom2.includes(id) && !downFrom2.includes(id)),
      ...downFrom1,
      ...upFrom3,
    ],
    tier3: [...order3.filter((id) => !upFrom3.includes(id)), ...downFrom2],
  };

  const newTier: DomesticTier = save.divisions.tier1.includes(save.userTeamId)
    ? 1
    : save.divisions.tier2.includes(save.userTeamId)
      ? 2
      : 3;
  save.userDivision = newTier;
  return {
    promoted: [...upFrom2, ...upFrom3],
    relegated: [...downFrom1, ...downFrom2],
    userMoved: newTier < oldTier ? 'PROMOTED' : newTier > oldTier ? 'RELEGATED' : undefined,
  };
}

/**
 * Apply promotion/relegation given the user division's final order (best → worst).
 * Mutates `save.divisions` + `save.userDivision`. Returns a report for the UI.
 */
export function applyPromotionRelegation(
  save: SaveGame,
  userDivisionOrder: string[],
  rng: Rng,
): PromotionResult {
  if (!hasDivisions(save) || !save.divisions) return { promoted: [], relegated: [] };
  const userDiv = save.userDivision ?? 1;
  const { tier1, tier2 } = save.divisions;

  const order1 = userDiv === 1 ? userDivisionOrder : simulateDivisionOrder(tier1, save, rng);
  const order2 = userDiv === 2 ? userDivisionOrder : simulateDivisionOrder(tier2, save, rng);
  const n = Math.min(PROMOTE_RELEGATE_COUNT, order1.length - 1, order2.length);
  if (n <= 0) return { promoted: [], relegated: [] };

  const relegated = order1.slice(order1.length - n); // bottom of the top flight
  const promoted = order2.slice(0, n); // top of the second tier

  const newTier1 = [...order1.filter((id) => !relegated.includes(id)), ...promoted];
  const newTier2 = [...order2.filter((id) => !promoted.includes(id)), ...relegated];
  save.divisions = { tier1: newTier1, tier2: newTier2 };

  let userMoved: PromotionResult['userMoved'];
  if (save.userTeamId) {
    const nowIn: 1 | 2 = newTier1.includes(save.userTeamId) ? 1 : 2;
    if (nowIn !== userDiv) {
      userMoved = nowIn === 1 ? 'PROMOTED' : 'RELEGATED';
      save.userDivision = nowIn;
    }
  }
  return { promoted, relegated, userMoved };
}

/** Team ids of the user's current division (what league-1 should contain). */
export function userDivisionTeamIds(save: SaveGame): string[] {
  if (!save.divisions) return save.leagues[DIV1_LEAGUE_ID]?.teamIds ?? [];
  return (save.userDivision ?? 1) === 1 ? save.divisions.tier1 : save.divisions.tier2;
}

/** Team ids of the other (background) division. */
export function otherDivisionTeamIds(save: SaveGame): string[] {
  if (!save.divisions) return [];
  return (save.userDivision ?? 1) === 1 ? save.divisions.tier2 : save.divisions.tier1;
}

/**
 * Re-point league-1 (user's division) and league-2 (other) at the current
 * division membership and reset their tables. Names reflect the tier so a
 * promoted user sees "Premier League" and a relegated one sees "Championship".
 */
export function syncLeaguesToDivisions(save: SaveGame): void {
  if (!hasDivisions(save)) return;
  const fmtLabel = save.leagues[DIV1_LEAGUE_ID]?.format ?? 'T20';
  const userDiv = save.userDivision ?? 1;
  const userTeams = userDivisionTeamIds(save);
  const otherTeams = otherDivisionTeamIds(save);

  const premierName = `Premier ${fmtLabel} League`;
  const champName = `${fmtLabel} Championship`;

  const l1: League = save.leagues[DIV1_LEAGUE_ID];
  const l2: League = save.leagues[DIV2_LEAGUE_ID];
  if (l1) {
    l1.teamIds = userTeams;
    l1.table = emptyTable(userTeams);
    l1.name = userDiv === 1 ? premierName : champName;
  }
  if (l2) {
    l2.teamIds = otherTeams;
    l2.table = emptyTable(otherTeams);
    l2.name = userDiv === 1 ? champName : premierName;
  }
}

/** Keep league-1 on the user's current tier while retaining all three tables. */
export function syncThreeTierLeagues(save: SaveGame): void {
  if (!save.divisions?.tier3 || !save.userTeamId) return;
  const countryId = save.teams[save.userTeamId]?.country ?? '';
  const userTier = save.userDivision ?? 3;
  const tiers = [1, 2, 3] as DomesticTier[];
  const tierOrder = [userTier, ...tiers.filter((tier) => tier !== userTier)];
  const leagueIds = [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID, DIV3_LEAGUE_ID];
  const teamsByTier: Record<DomesticTier, string[]> = {
    1: save.divisions.tier1,
    2: save.divisions.tier2,
    3: save.divisions.tier3,
  };

  tierOrder.forEach((tier, index) => {
    const leagueId = leagueIds[index];
    const teamIds = teamsByTier[tier];
    const league = save.leagues[leagueId];
    if (!league) return;
    league.teamIds = [...teamIds];
    league.table = emptyTable(teamIds);
    league.divisionTier = tier;
    league.name = domesticLeagueName(countryId, tier, league.format);
  });
}
