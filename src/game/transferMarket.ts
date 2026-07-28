/**
 * A living transfer market. Previously signings were fixed-price and first-come
 * from a static pool; now:
 *  - AI clubs actively sign free agents and sell their fringe players back to the
 *    market each window (so the pool churns and a target you dither over can be
 *    gone — real competition), and
 *  - the user's club is held to a soft wage ceiling (FFP): you cannot blow past a
 *    hard multiple of your sustainable wage budget.
 *
 * Pure/mutating helpers, deterministic via the injected rng, unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { MANAGER_ROSTER_SIZE, ROSTER_SIZE } from '../generation/players';
import { computeValue, WAGE_RATE } from './finance';

export const TRANSFER_WINDOW_MONTHS = [1, 6, 7, 12];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function currentMonthName(save: SaveGame): string {
  const month = save.currentMonth ?? 1;
  return MONTH_LABELS[Math.max(0, Math.min(11, month - 1))] ?? `month ${month}`;
}

export function isTransferWindowOpen(save: SaveGame): boolean {
  if (save.managerCalendar) return save.managerCalendar.phase === 'OFF_SEASON';
  const month = save.currentMonth ?? 1;
  return TRANSFER_WINDOW_MONTHS.includes(month);
}

function managerLeagueMatchesPlayed(save: SaveGame): number {
  if (!save.userTeamId) return 0;
  return Object.values(save.fixtures ?? {}).filter(
    (fx) =>
      fx.played &&
      !fx.playoff &&
      (fx.competitionId == null || fx.competitionId === 't20-league') &&
      (fx.homeTeamId === save.userTeamId || fx.awayTeamId === save.userTeamId),
  ).length;
}

export function isDeadlineDay(save: SaveGame): boolean {
  if (save.mode !== 'manager') return false;
  if (save.managerCalendar) {
    return save.managerCalendar.phase === 'OFF_SEASON' && (save.currentMonth ?? 6) === 8;
  }
  const month = save.currentMonth ?? 1;
  if (!isTransferWindowOpen(save)) return false;
  if (month === 12) return true;
  if (month === 7) return managerLeagueMatchesPlayed(save) > 0;
  return false;
}

export function transferWindowLabel(save: SaveGame): string {
  const month = currentMonthName(save);
  if (save.managerCalendar) {
    return save.managerCalendar.phase === 'OFF_SEASON'
      ? `Transfer window open in ${month}. Contracts, releases, scouting and training are available.`
      : `Transfer window closed during the ${save.managerCalendar.phase.replace('_', ' ').toLowerCase()} block. It opens from June through August.`;
  }
  if (isTransferWindowOpen(save)) {
    return `Transfer window open in ${month}. Signings, loans and scouting are available.`;
  }
  return `Transfer window closed in ${month}. Opens in January, June, July and December.`;
}

export function transferWindowClosedReason(save: SaveGame): string | null {
  if (save.mode !== 'manager') return null;
  return isTransferWindowOpen(save) ? null : transferWindowLabel(save);
}

/** How many rival clubs would want this player (drives on-screen competition). */
export function rivalInterestCount(save: SaveGame, playerId: string): number {
  const p = save.players[playerId];
  if (!p) return 0;
  let n = 0;
  for (const team of Object.values(save.teams)) {
    if (team.isNationalTeam) continue;
    if (team.id === save.userTeamId) continue;
    const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean) as Player[];
    const weakest = squad.reduce((m, x) => Math.min(m, x.overall), 99);
    // A club is "interested" if the player would upgrade them and they can afford him.
    if (p.overall > weakest + 1 && team.budget >= computeValue(p)) n++;
  }
  return n;
}

export interface AiTransferReport {
  signings: number;
  releases: number;
}

/**
 * Run one AI transfer window: rival clubs upgrade from free agency and sell
 * fringe players back to the market. Deterministic + bounded (≤2 moves/club).
 */
export function runAiTransferWindow(save: SaveGame, rng: Rng): AiTransferReport {
  let signings = 0;
  let releases = 0;
  const faIds = [...(save.freeAgents ?? [])];
  const currentYear = save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
    : 2026;

  for (const team of Object.values(save.teams)) {
    if (team.id === save.userTeamId) continue;
    let moves = 0;
    while (moves < 2) {
      const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean) as Player[];
      if (!squad.length) break;
      const weakest = squad.reduce((m, x) => (x.overall < m.overall ? x : m), squad[0]);
      const target = faIds
        .map((id) => save.players[id])
        .filter((p): p is Player => Boolean(p))
        .filter((p) => p.age < 37 && team.budget >= computeValue(p))
        .sort((a, b) => b.overall - a.overall)
        .find((p) => p.overall > weakest.overall + 2);
      if (!target) break;

      team.budget -= computeValue(target);
      team.playerIds.push(target.id);
      target.contract = {
        wage: Math.round(computeValue(target) * WAGE_RATE),
        yearsLeft: 2 + Math.floor(rng() * 3),
      };
      const idx = faIds.indexOf(target.id);
      if (idx >= 0) faIds.splice(idx, 1);
      signings++;

      // Sell the fringe player back to the market to make room (an AI→market trade).
      const rosterLimit = save.managerCalendar ? MANAGER_ROSTER_SIZE : ROSTER_SIZE;
      if (team.playerIds.length > rosterLimit) {
        team.budget += Math.round(computeValue(weakest) * 0.5);
        team.playerIds = team.playerIds.filter((id) => id !== weakest.id);
        weakest.contract = undefined;
        if (team.xi?.includes(weakest.id)) team.xi = undefined;
        faIds.push(weakest.id);
        releases++;
      }

      moves++;
      if (rng() < 0.5) break; // not every club is active every window
    }
    void currentYear;
  }

  save.freeAgents = faIds;
  return { signings, releases };
}
