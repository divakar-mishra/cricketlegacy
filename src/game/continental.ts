/**
 * Continental Cup — an end-of-season knockout for the best sides, resolved
 * deterministically from squad strength + a little variance. Adds a second piece
 * of silverware to chase (beyond the league + domestic cup) and feeds the
 * manager Hall of Fame. Pure/mutating, unit-tested.
 */
import { Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';

/** Average overall of a team's best XI — its continental pedigree. */
export function teamStrength(save: SaveGame, teamId: string): number {
  const team = save.teams[teamId];
  if (!team) return 0;
  const squad = team.playerIds
    .map((id) => save.players[id])
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 11);
  if (!squad.length) return 0;
  return squad.reduce((s, p) => s + p.overall, 0) / squad.length;
}

function winner(save: SaveGame, a: string, b: string, rng: Rng): string {
  // Strength decides, but an upset is always possible (the rng roll).
  const sa = teamStrength(save, a) * (0.8 + rng() * 0.4);
  const sb = teamStrength(save, b) * (0.8 + rng() * 0.4);
  return sa >= sb ? a : b;
}

export interface ContinentalResult {
  championId?: string;
  userWon: boolean;
}

/**
 * Resolve the Continental Cup from a set of qualifiers (best 4 recommended).
 * Records the champion on the save; the caller awards prize money / trophies.
 */
export function resolveContinental(save: SaveGame, qualifiers: string[], rng: Rng): ContinentalResult {
  const teams = qualifiers.filter((id) => save.teams[id]);
  if (teams.length < 2) return { championId: undefined, userWon: false };

  let championId: string;
  if (teams.length >= 4) {
    const sf1 = winner(save, teams[0], teams[3], rng);
    const sf2 = winner(save, teams[1], teams[2], rng);
    championId = winner(save, sf1, sf2, rng);
  } else {
    championId = winner(save, teams[0], teams[1], rng);
  }

  save.continentalChampion = championId;
  const userWon = championId === save.userTeamId;
  if (userWon) save.continentalTitles = (save.continentalTitles ?? 0) + 1;
  return { championId, userWon };
}

export const CONTINENTAL_PRIZE = 600_000;
