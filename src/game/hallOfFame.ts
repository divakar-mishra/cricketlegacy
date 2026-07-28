/**
 * Cross-career Hall of Fame — the all-time board that PERSISTS ACROSS SAVES.
 *
 * The per-save `records` (game/records.ts) reset with every new career; this
 * module is the durable legacy layer: it snapshots the peak of each career (a
 * player board and a separate manager board) into a single blob stored under
 * its own key (see storage/hallOfFame.ts), so a player's best-ever scores and a
 * manager's trophies survive starting a brand-new game.
 *
 * This file is intentionally pure (no storage/native imports) so the merge and
 * summarise logic is fully unit-testable.
 */
import { SaveGame } from '../domain/types';
import { emptyStats } from './stats';

export const HOF_VERSION = 1;
export const HOF_LIMIT = 25;
/**
 * The player Hall of Fame is reserved for all-time greats. The bar is elite on
 * purpose: roughly 10,000 international-level runs OR 400 wickets OR an
 * equivalently legendary all-round legacy. A good-but-ordinary career (a few
 * thousand runs / fifty-odd wickets) should never appear here.
 */
export const PLAYER_HOF_MIN_SCORE = 9000;
export const PLAYER_HOF_ELITE_RUNS = 10000;
export const PLAYER_HOF_ELITE_WICKETS = 400;
export const MANAGER_HOF_MIN_SCORE = 100;

/** One player's whole-career legacy (batting/bowling peaks). */
export interface PlayerHofEntry {
  saveId: string;
  name: string;
  team: string;
  nationality: string;
  overall: number;
  runs: number;
  wickets: number;
  hundreds: number;
  fifties: number;
  highScore: number;
  bestBowling: string;
  caps: number;
  titles: number;
  seasons: number;
  retired: boolean;
  updatedAt: number;
}

/** One manager's whole-career legacy (trophies/promotions). */
export interface ManagerHofEntry {
  saveId: string;
  club: string;
  titles: number;
  cupWins: number;
  promotions: number;
  trophies: number;
  bestPosition: number;
  wins?: number;
  losses?: number;
  draws?: number;
  winRate?: number;
  legendsProduced?: number;
  boardConfidence: number;
  seasons: number;
  updatedAt: number;
}

export interface HallOfFame {
  version: number;
  players: PlayerHofEntry[];
  managers: ManagerHofEntry[];
}

export function emptyHallOfFame(): HallOfFame {
  return { version: HOF_VERSION, players: [], managers: [] };
}

/** Composite "greatness" score used to rank and cap the player board. */
export function playerLegacyScore(e: PlayerHofEntry): number {
  return e.runs + e.wickets * 20 + e.highScore * 2 + e.hundreds * 60 + e.caps * 12 + e.titles * 40;
}

export function qualifiesForPlayerHall(e: PlayerHofEntry): boolean {
  // Only all-time greats: ~10k runs, ~400 wickets, or an equivalently elite
  // legacy score built from hundreds, caps and titles. No "small career" floor.
  return (
    e.runs >= PLAYER_HOF_ELITE_RUNS ||
    e.wickets >= PLAYER_HOF_ELITE_WICKETS ||
    playerLegacyScore(e) >= PLAYER_HOF_MIN_SCORE
  );
}

/** Composite score used to rank and cap the manager board. */
export function managerLegacyScore(e: ManagerHofEntry): number {
  return (
    e.titles * 100 +
    e.cupWins * 60 +
    e.promotions * 40 +
    (e.legendsProduced ?? 0) * 35 +
    (e.winRate ?? 0) * 2 +
    e.seasons * 5 +
    Math.max(0, 60 - e.bestPosition * 5)
  );
}

export function qualifiesForManagerHall(e: ManagerHofEntry): boolean {
  return e.trophies > 0 || e.promotions > 0 || managerLegacyScore(e) >= MANAGER_HOF_MIN_SCORE;
}

function seasonsOf(save: SaveGame): number {
  return save.careerSeasons ?? Math.max(0, Object.keys(save.seasons).length - 1);
}

function teamNameOf(save: SaveGame, playerId: string): string {
  for (const t of Object.values(save.teams)) if (t.playerIds.includes(playerId)) return t.shortName;
  return '—';
}

/** Build a player Hall-of-Fame entry from a career save (null in manager mode). */
export function summarizePlayer(save: SaveGame): PlayerHofEntry | null {
  if (save.mode !== 'career' || !save.userPlayerId) return null;
  const p = save.players[save.userPlayerId];
  if (!p) return null;
  const cs = p.careerStats ?? emptyStats();
  return {
    saveId: save.id,
    name: p.name,
    team: teamNameOf(save, p.id),
    nationality: p.nationality,
    overall: p.overall,
    runs: cs.runs,
    wickets: cs.wickets,
    hundreds: cs.hundreds,
    fifties: cs.fifties,
    highScore: cs.highScore,
    bestBowling: cs.bestBowling || '—',
    caps: save.userCaps ?? 0,
    titles: save.leagueTitles ?? 0,
    seasons: seasonsOf(save),
    retired: Boolean(p.retired),
    updatedAt: Date.now(),
  };
}

/** Build a manager Hall-of-Fame entry from a manager save (null in career mode). */
export function summarizeManager(save: SaveGame): ManagerHofEntry | null {
  if (save.mode !== 'manager' || !save.userTeamId) return null;
  const club = save.teams[save.userTeamId]?.name ?? 'Club';
  const team = save.teams[save.userTeamId];
  const titles = save.leagueTitles ?? 0;
  const cupWins = (save.cupWins ?? 0) + (save.continentalTitles ?? 0);
  const promotions = save.promotions ?? 0;
  const completedFixtures = Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.played &&
      (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId),
  );
  const fixtureWins = completedFixtures.filter(
    (fixture) => fixture.winnerTeamId === save.userTeamId,
  ).length;
  const fixtureLosses = completedFixtures.filter(
    (fixture) => fixture.winnerTeamId && fixture.winnerTeamId !== save.userTeamId,
  ).length;
  const fixtureDraws = completedFixtures.length - fixtureWins - fixtureLosses;
  const wins = save.careerWins ?? fixtureWins;
  const losses = save.careerLosses ?? fixtureLosses;
  const draws = save.careerDraws ?? fixtureDraws;
  const played = wins + losses + draws;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const legendsProduced =
    team?.playerIds.filter((id) => {
      const player = save.players[id];
      const matches = player?.careerStats?.matches ?? 0;
      return Boolean(player && (player.legendary || (matches >= 50 && player.overall >= 88)));
    }).length ?? 0;
  return {
    saveId: save.id,
    club,
    titles,
    cupWins,
    promotions,
    trophies: titles + cupWins,
    bestPosition: save.bestLeaguePos ?? 0,
    wins,
    losses,
    draws,
    winRate,
    legendsProduced,
    boardConfidence: save.boardConfidence ?? 50,
    seasons: seasonsOf(save),
    updatedAt: Date.now(),
  };
}

/** Upsert a player entry (one per save id), keeping the top HOF_LIMIT by legacy. */
export function upsertPlayer(hof: HallOfFame, entry: PlayerHofEntry): HallOfFame {
  const players = [...hof.players.filter((e) => e.saveId !== entry.saveId), entry]
    .sort((a, b) => playerLegacyScore(b) - playerLegacyScore(a))
    .slice(0, HOF_LIMIT);
  return { ...hof, players };
}

/** Upsert a manager entry (one per save id), keeping the top HOF_LIMIT by legacy. */
export function upsertManager(hof: HallOfFame, entry: ManagerHofEntry): HallOfFame {
  const managers = [...hof.managers.filter((e) => e.saveId !== entry.saveId), entry]
    .sort((a, b) => managerLegacyScore(b) - managerLegacyScore(a))
    .slice(0, HOF_LIMIT);
  return { ...hof, managers };
}

/** Merge a save's current standing into the Hall of Fame (pure). */
export function mergeSaveIntoHallOfFame(hof: HallOfFame, save: SaveGame): HallOfFame {
  let next = hof;
  const p = summarizePlayer(save);
  if (p && qualifiesForPlayerHall(p)) next = upsertPlayer(next, p);
  const m = summarizeManager(save);
  if (m && qualifiesForManagerHall(m)) next = upsertManager(next, m);
  return next;
}

/** Normalise an arbitrary loaded blob into a valid HallOfFame. */
export function coerceHallOfFame(raw: unknown): HallOfFame {
  if (!raw || typeof raw !== 'object') return emptyHallOfFame();
  const r = raw as Partial<HallOfFame>;
  return {
    version: HOF_VERSION,
    players: Array.isArray(r.players) ? r.players : [],
    managers: Array.isArray(r.managers) ? r.managers : [],
  };
}
