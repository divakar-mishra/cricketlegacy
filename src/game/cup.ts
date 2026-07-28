/**
 * Domestic knockout Cup — a single-elimination competition that runs ALONGSIDE
 * the league in the same season. Cup fixtures live in `save.fixtures` tagged
 * `competition: 'CUP'` and are deliberately excluded from every league loop
 * (table, catch-up, playoffs) — this module owns them end to end.
 *
 * The user plays their own ties live; other ties auto-sim as the bracket
 * advances (mirrors the league playoff staging).
 */
import { Fixture, MatchState, SaveGame } from '../domain/types';
import { applyResult, runFixture } from './season';

export const CUP_NAME = 'National Knockout Cup';

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function cupFixtures(save: SaveGame): Fixture[] {
  return Object.values(save.fixtures).filter((f) => f.competition === 'CUP');
}

function cupAvailable(save: SaveGame): boolean {
  if (save.mode === 'manager') return (save.managerCareerLevel ?? 'CLUB') !== 'CLUB';
  const level = save.mode === 'career' ? (save.careerPathLevel ?? 'DOMESTIC') : 'DOMESTIC';
  return level !== 'SCHOOL' && level !== 'U19';
}

/** Seed rank by reputation (0 = strongest) so the bracket is stable & sensible. */
function seedOrder(save: SaveGame): string[] {
  const league = Object.values(save.leagues)[0];
  const ids = league ? league.teamIds : Object.keys(save.teams);
  return [...ids].sort(
    (a, b) => (save.teams[b]?.reputation ?? 0) - (save.teams[a]?.reputation ?? 0),
  );
}

function roundLabelFor(tiesInRound: number): string {
  if (tiesInRound <= 1) return 'Final';
  if (tiesInRound === 2) return 'Semi-Final';
  if (tiesInRound <= 4) return 'Quarter-Final';
  return 'Round';
}

/** Build the opening round (top 8 seeded 1v8, 2v7, …) if the cup isn't set up yet. */
export function ensureCup(save: SaveGame): void {
  if (!cupAvailable(save)) {
    resetCup(save);
    return;
  }
  if (cupFixtures(save).length > 0) return;
  const seeds = seedOrder(save).slice(0, 8);
  if (seeds.length < 2) return;
  const year = currentYear(save);
  const seasonId = save.currentSeasonId ?? '';
  const fmt = Object.values(save.leagues)[0]?.format ?? 'T20';
  const n = seeds.length;
  const label = roundLabelFor(n / 2);
  for (let i = 0; i < n / 2; i++) {
    const home = seeds[i];
    const away = seeds[n - 1 - i];
    const id = `cup-${year}-r1-${i + 1}`;
    save.fixtures[id] = {
      id,
      seasonId,
      format: fmt,
      homeTeamId: home,
      awayTeamId: away,
      venue: `${CUP_NAME} — ${label}`,
      round: 1,
      played: false,
      competition: 'CUP',
      cupRound: label,
    };
  }
}

/** The winner of a cup tie (higher seed advances on a tie/no-result). */
function winnerOf(fx: Fixture, seedRank: Record<string, number>): string {
  if (fx.winnerTeamId) return fx.winnerTeamId;
  return (seedRank[fx.homeTeamId] ?? 99) <= (seedRank[fx.awayTeamId] ?? 99)
    ? fx.homeTeamId
    : fx.awayTeamId;
}

/** Once a round is fully played, materialise the next round from the winners. */
function buildNextRound(save: SaveGame): boolean {
  const ties = cupFixtures(save);
  if (!ties.length) return false;
  const maxRound = Math.max(...ties.map((f) => f.round));
  const current = ties.filter((f) => f.round === maxRound);
  if (current.some((f) => !f.played)) return false; // round still in progress
  if (current.length <= 1) return false; // that was the Final

  const seedRank: Record<string, number> = {};
  seedOrder(save).forEach((id, i) => (seedRank[id] = i));
  const winners = current
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => winnerOf(f, seedRank));

  const nextRound = maxRound + 1;
  const label = roundLabelFor(winners.length / 2);
  const year = currentYear(save);
  const seasonId = save.currentSeasonId ?? '';
  const fmt = Object.values(save.leagues)[0]?.format ?? 'T20';
  for (let i = 0; i < winners.length / 2; i++) {
    const id = `cup-${year}-r${nextRound}-${i + 1}`;
    if (save.fixtures[id]) continue;
    save.fixtures[id] = {
      id,
      seasonId,
      format: fmt,
      homeTeamId: winners[i * 2],
      awayTeamId: winners[i * 2 + 1],
      venue: `${CUP_NAME} — ${label}`,
      round: nextRound,
      played: false,
      competition: 'CUP',
      cupRound: label,
    };
  }
  return true;
}

/** The user's next unplayed cup tie, if any. */
export function nextUserCupTie(save: SaveGame): string | undefined {
  if (!cupAvailable(save)) return undefined;
  const t = save.userTeamId;
  if (!t) return undefined;
  return cupFixtures(save).find((f) => !f.played && (f.homeTeamId === t || f.awayTeamId === t))?.id;
}

/**
 * Advance the bracket: auto-sim ties that don't involve the user and build new
 * rounds, stopping as soon as the user has a tie to play (or the cup is done).
 */
export function advanceCup(save: SaveGame): void {
  if (!cupAvailable(save)) return;
  ensureCup(save);
  const t = save.userTeamId;
  let guard = 0;
  while (guard++ < 60) {
    if (t && nextUserCupTie(save)) return; // the user must play their tie
    const tie = cupFixtures(save).find(
      (f) => !f.played && f.homeTeamId !== t && f.awayTeamId !== t,
    );
    if (tie) {
      applyResult(save, runFixture(save, tie.id));
      continue;
    }
    // No playable AI tie left in the current round → try to build the next one.
    if (!buildNextRound(save)) return;
  }
}

/** Auto-sim the entire remaining cup to a champion (used on sim-season / rollover). */
export function finishCup(save: SaveGame): void {
  if (!cupAvailable(save)) return;
  ensureCup(save);
  let guard = 0;
  while (guard++ < 60) {
    const tie = cupFixtures(save).find((f) => !f.played);
    if (tie) {
      applyResult(save, runFixture(save, tie.id));
      continue;
    }
    if (!buildNextRound(save)) return;
  }
}

export function cupChampionId(save: SaveGame): string | undefined {
  const ties = cupFixtures(save);
  if (!ties.length) return undefined;
  const maxRound = Math.max(...ties.map((f) => f.round));
  const finalTies = ties.filter((f) => f.round === maxRound);
  if (finalTies.length !== 1 || !finalTies[0].played) return undefined;
  const seedRank: Record<string, number> = {};
  seedOrder(save).forEach((id, i) => (seedRank[id] = i));
  return winnerOf(finalTies[0], seedRank);
}

export type CupStatus = 'NONE' | 'PLAYING' | 'ELIMINATED' | 'WON';

export function userCupStatus(save: SaveGame): CupStatus {
  if (!cupAvailable(save)) return 'NONE';
  const t = save.userTeamId;
  if (!t || cupFixtures(save).length === 0) return 'NONE';
  if (nextUserCupTie(save)) return 'PLAYING';
  const champ = cupChampionId(save);
  if (champ) return champ === t ? 'WON' : 'ELIMINATED';
  return 'ELIMINATED';
}

/** Human label for where the cup currently stands for the user. */
export function cupRoundLabel(save: SaveGame): string {
  const nextId = nextUserCupTie(save);
  if (nextId) return save.fixtures[nextId].cupRound ?? 'Cup';
  const ties = cupFixtures(save);
  if (!ties.length) return 'Cup';
  const maxRound = Math.max(...ties.map((f) => f.round));
  return ties.find((f) => f.round === maxRound)?.cupRound ?? 'Cup';
}

/** The user's next cup opponent + round, for the hub card. */
export function userCupTieInfo(
  save: SaveGame,
): { opponentId: string; round: string; fixtureId: string } | null {
  const id = nextUserCupTie(save);
  if (!id) return null;
  const fx = save.fixtures[id];
  const opponentId = fx.homeTeamId === save.userTeamId ? fx.awayTeamId : fx.homeTeamId;
  return { opponentId, round: fx.cupRound ?? 'Cup', fixtureId: id };
}

/** Reset the cup at a new season (drops last season's ties). */
export function resetCup(save: SaveGame): void {
  for (const f of cupFixtures(save)) delete save.fixtures[f.id];
}

export type { MatchState };
