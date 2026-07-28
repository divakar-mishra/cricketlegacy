/**
 * U19 World Cup — a 6-team knockout tournament that fires once every 2 seasons
 * when save.careerPathLevel === 'U19'. The top 6 nations by U19 player count
 * are seeded. The user must qualify (3+ U19 matches with avg rating ≥ 6.5).
 * Winning the cup triggers immediate U19→DOMESTIC promotion + Gold achievement.
 *
 * Pure/mutating helpers, unit-tested.
 */

import { Format, SaveGame } from '../domain/types';
import { makeRng, Rng } from '../engine/rng';
import { clamp } from '../utils/math';

export const U19_WC_COMPETITION = 'U19_WORLDCUP' as const;
const U19_WC_FORMAT: Format = 'ODI';
const U19_TEAMS = 6;
const U19_QUALIFY_MATCHES = 3;
const U19_QUALIFY_RATING = 6.5;

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Top-6 nations by number of players in the world pool. */
function topU19Nations(save: SaveGame): string[] {
  const counts: Record<string, number> = {};
  for (const p of Object.values(save.players)) {
    if (!p.retired) counts[p.nationality] = (counts[p.nationality] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, U19_TEAMS)
    .map(([c]) => c);
}

/** Whether the user has earned their U19 World Cup squad place this season. */
export function u19Qualifies(save: SaveGame): boolean {
  if (save.careerPathLevel !== 'U19' || !save.userPlayerId) return false;
  const matches = save.careerPathMatches ?? 0;
  if (matches < U19_QUALIFY_MATCHES) return false;
  // We use the stored nationalRep as a proxy for average rating progress.
  const avgRating = clamp(5 + (save.nationalRep ?? 0) / 50, 1, 10);
  return avgRating >= U19_QUALIFY_RATING;
}

/** True if a U19 World Cup should fire this season. */
export function shouldRunU19WorldCup(save: SaveGame): boolean {
  if (save.careerPathLevel !== 'U19') return false;
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  // Fires in even years (every 2 seasons).
  return year % 2 === 0;
}

export interface U19WCMatch {
  fixtureId: string;
  homeCountry: string;
  awayCountry: string;
  round: 'QF' | 'SF' | 'F';
}

export interface U19WorldCup {
  teams: string[]; // 6 country codes (seeded)
  userCountry: string;
  fixtures: U19WCMatch[];
  results: Record<string, string | undefined>; // fixtureId → winner country
  champion?: string;
}

/**
 * Generate a U19 World Cup for the current season.
 * Adds fixture stubs to save.fixtures; returns the bracket state.
 */
export function generateU19WorldCup(save: SaveGame, _rng: Rng): U19WorldCup | null {
  if (!save.userPlayerId) return null;
  const nations = topU19Nations(save);
  if (nations.length < U19_TEAMS) return null;

  const userCountry = save.players[save.userPlayerId]?.nationality ?? '';
  const teams = [...nations];
  // Ensure user's country is always in the field.
  if (!teams.includes(userCountry)) {
    teams[teams.length - 1] = userCountry;
  }

  const seasonId = save.currentSeasonId ?? 'season-u19';
  const fixtures: U19WCMatch[] = [];
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;

  // 6-team format: 3 quarter-final type matches (top 2 get byes), then semis, then final.
  // Simplified to: 3 QF matches pairing teams 3v6, 4v5 + user's seeded slot, then SF, F.
  const seeded = [teams[0], teams[1], teams[2], teams[3], teams[4], teams[5]];
  const qfPairs: [string, string][] = [
    [seeded[2], seeded[5]],
    [seeded[3], seeded[4]],
  ];

  let fxN = 0;
  const addFx = (home: string, away: string, round: 'QF' | 'SF' | 'F'): U19WCMatch => {
    const id = `u19wc-${year}-${++fxN}`;
    save.fixtures[id] = {
      id,
      seasonId,
      format: U19_WC_FORMAT,
      homeTeamId: home,
      awayTeamId: away,
      venue: `U19 World Cup ${round}`,
      round: fxN,
      played: false,
      competition: U19_WC_COMPETITION,
    };
    return { fixtureId: id, homeCountry: home, awayCountry: away, round };
  };

  for (const [h, a] of qfPairs) fixtures.push(addFx(h, a, 'QF'));

  // SF1: seed1 vs QF1 winner (placeholder — resolved after QF)
  fixtures.push(addFx(seeded[0], `TBD_QF1`, 'SF'));
  // SF2: seed2 vs QF2 winner
  fixtures.push(addFx(seeded[1], `TBD_QF2`, 'SF'));
  // Final
  fixtures.push(addFx('TBD_SF1', 'TBD_SF2', 'F'));

  return {
    teams: seeded,
    userCountry,
    fixtures,
    results: {},
  };
}

/** Simulate a U19 World Cup bracket (auto-resolves all fixtures). */
export function simulateU19WorldCup(
  save: SaveGame,
  wc: U19WorldCup,
): { champion: string; userReached: 'QF' | 'SF' | 'F' | 'WINNER' | 'OUT' } {
  // QF: simulate both matches.
  const qfFixtures = wc.fixtures.filter((f) => f.round === 'QF');
  const qfWinners: string[] = [];

  for (const qfm of qfFixtures) {
    const fx = save.fixtures[qfm.fixtureId];
    if (!fx) continue;
    const seed = hashSeed(`u19:${qfm.fixtureId}`);
    const rng = makeRng(seed);

    // Simple coin-flip weighted by a "team strength" (just a random proxy here).
    const homeWins = rng() > 0.45;
    fx.played = true;
    fx.winnerTeamId = homeWins ? fx.homeTeamId : fx.awayTeamId;
    qfWinners.push(fx.winnerTeamId);
    wc.results[qfm.fixtureId] = fx.winnerTeamId;
  }

  // SF
  const sfFixtures = wc.fixtures.filter((f) => f.round === 'SF');
  const sfWinners: string[] = [];
  const sfSeeds = [wc.teams[0], wc.teams[1]];

  for (let i = 0; i < sfFixtures.length; i++) {
    const sfm = sfFixtures[i];
    const fx = save.fixtures[sfm.fixtureId];
    if (!fx) continue;
    const home = sfSeeds[i];
    const away = qfWinners[i] ?? wc.teams[5 - i];
    fx.homeTeamId = home;
    fx.awayTeamId = away;
    const seed = hashSeed(`u19:sf:${sfm.fixtureId}`);
    const rng = makeRng(seed);
    const homeWins = rng() > 0.42; // slight home advantage for higher seed
    fx.played = true;
    fx.winnerTeamId = homeWins ? home : away;
    sfWinners.push(fx.winnerTeamId);
    wc.results[sfm.fixtureId] = fx.winnerTeamId;
  }

  // Final
  const finalFx = wc.fixtures.find((f) => f.round === 'F');
  let champion = wc.teams[0];
  if (finalFx) {
    const fx = save.fixtures[finalFx.fixtureId];
    if (fx) {
      fx.homeTeamId = sfWinners[0] ?? wc.teams[0];
      fx.awayTeamId = sfWinners[1] ?? wc.teams[1];
      const seed = hashSeed(`u19:final:${finalFx.fixtureId}`);
      const rng = makeRng(seed);
      const homeWins = rng() > 0.5;
      fx.played = true;
      fx.winnerTeamId = homeWins ? fx.homeTeamId : fx.awayTeamId;
      champion = fx.winnerTeamId;
      wc.results[finalFx.fixtureId] = champion;
    }
  }
  wc.champion = champion;

  // Determine user's result.
  const userCountry = wc.userCountry;
  let userReached: 'QF' | 'SF' | 'F' | 'WINNER' | 'OUT' = 'OUT';
  if (champion === userCountry) {
    userReached = 'WINNER';
  } else if (sfWinners.includes(userCountry)) {
    userReached = 'F';
  } else if (qfWinners.includes(userCountry) || wc.teams.slice(0, 2).includes(userCountry)) {
    userReached = 'SF';
  } else if (
    qfFixtures.some((f) => f.homeCountry === userCountry || f.awayCountry === userCountry)
  ) {
    userReached = 'QF';
  }

  return { champion, userReached };
}

/**
 * Apply U19 World Cup results to the save game (promotions, achievements, timeline).
 * Call after simulateU19WorldCup.
 */
export function applyU19WorldCupResult(
  save: SaveGame,
  result: ReturnType<typeof simulateU19WorldCup>,
): { promoted: boolean; achievement: boolean } {
  if (result.userReached !== 'WINNER') return { promoted: false, achievement: false };

  // Win the cup → immediate U19 → DOMESTIC promotion.
  save.careerPathLevel = 'DOMESTIC';
  save.careerPathMatches = 0;

  // Gold achievement.
  if (!save.achievements) save.achievements = [];
  const ACH_ID = 'u19_world_cup_winner';
  if (!save.achievements.includes(ACH_ID)) save.achievements.push(ACH_ID);

  // Timeline entry.
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  if (!save.timeline) save.timeline = [];
  save.timeline.push({
    year,
    kind: 'MILESTONE',
    text: 'Lifted the U19 World Cup — a new chapter begins as a domestic professional.',
  });

  return { promoted: true, achievement: true };
}
