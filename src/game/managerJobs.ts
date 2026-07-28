/**
 * Manager headhunting — a successful manager gets approached by bigger, richer
 * clubs offering a better-paid job. Fires at season rollover when your board
 * confidence and reputation are high enough. Accepting moves you to the new club
 * (a fresh, higher-profile challenge); declining is rewarded with loyalty
 * (a board-confidence bump). Pure/mutating helpers, deterministic via rng.
 */

import { ManagerJobOffer, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { clamp } from '../utils/math';
import { boardTargetFor } from './finance';

/** Minimum board confidence + reputation gap needed for a bigger club to circle. */
const MIN_CONFIDENCE = 66;
const MIN_REP_GAP = 4; // the suitor must be clearly bigger than your current club
const OFFER_CHANCE = 0.45; // not every strong season attracts an approach

/** Seasonal salary a club of the given reputation would offer a head coach. */
function salaryFor(reputation: number): number {
  return Math.round(250_000 + reputation * 14_000);
}

/**
 * Possibly generate a headhunt offer for the current season. Returns the offer
 * (also stored on the save) or null if no club comes calling.
 */
export function generateManagerJobOffer(save: SaveGame, rng: Rng): ManagerJobOffer | null {
  if (save.mode !== 'manager' || !save.userTeamId) return null;
  if (save.flags?.sacked) return null; // no headhunting a sacked manager
  const conf = save.boardConfidence ?? 60;
  if (conf < MIN_CONFIDENCE) return null;

  const currentTeam = save.teams[save.userTeamId];
  if (!currentTeam) return null;
  const currentTierIds = save.managerCalendar
    ? save.userDivision === 1
      ? save.divisions?.tier1
      : save.userDivision === 2
        ? save.divisions?.tier2
        : save.divisions?.tier3
    : undefined;

  // Bigger clubs than your current one, ranked by reputation.
  const suitors = Object.values(save.teams)
    .filter(
      (team) =>
        team.id !== save.userTeamId &&
        !team.isUserTeam &&
        (!currentTierIds || currentTierIds.includes(team.id)) &&
        team.reputation >= currentTeam.reputation + MIN_REP_GAP,
    )
    .sort((a, b) => b.reputation - a.reputation);
  if (!suitors.length) return null;

  // The stronger your season (confidence), the more likely a suitor bites.
  const chance = OFFER_CHANCE + (conf - MIN_CONFIDENCE) / 200;
  if (rng() > chance) return null;

  // Pick from the top few suitors (a little variety).
  const shortlist = suitors.slice(0, 3);
  const club = shortlist[Math.floor(rng() * shortlist.length)];

  const offer: ManagerJobOffer = {
    teamId: club.id,
    clubName: club.name,
    reputation: club.reputation,
    salaryPromise: salaryFor(club.reputation),
    reason:
      club.reputation >= 80
        ? 'A giant of the game wants a proven winner at the helm.'
        : 'An ambitious, well-backed club sees you as the manager to take them up.',
  };
  save.managerJobOffer = offer;
  return offer;
}

export interface JobMoveResult {
  ok: boolean;
  reason?: string;
  toTeamId?: string;
}

/**
 * Accept the pending headhunt: take charge of the new (bigger) club. Career
 * level and trophy progress carry over; you arrive to a fresh honeymoon with the
 * board and a new objective befitting the club's stature.
 */
export function acceptManagerJob(save: SaveGame): JobMoveResult {
  const offer = save.managerJobOffer;
  if (!offer) return { ok: false, reason: 'No offer on the table.' };
  const newTeam = save.teams[offer.teamId];
  if (!newTeam) return { ok: false, reason: 'That club is no longer available.' };
  if (save.managerCalendar) {
    const allowed =
      save.userDivision === 1
        ? save.divisions?.tier1
        : save.userDivision === 2
          ? save.divisions?.tier2
          : save.divisions?.tier3;
    if (!allowed?.includes(newTeam.id)) {
      return { ok: false, reason: 'That job is outside your currently unlocked tier.' };
    }
  }

  // Step down at the old club.
  if (save.userTeamId && save.teams[save.userTeamId]) {
    save.teams[save.userTeamId].isUserTeam = false;
  }

  // Take charge of the new club.
  save.userTeamId = offer.teamId;
  newTeam.isUserTeam = true;
  save.flags = { ...(save.flags ?? {}), sacked: false };

  // Fresh board relationship + an objective scaled to the bigger club.
  save.boardConfidence = 65;
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  save.boardObjective = { year, targetPosition: boardTargetFor(newTeam.reputation) };

  save.managerJobOffer = undefined;
  return { ok: true, toTeamId: offer.teamId };
}

/** Decline the headhunt — loyalty is rewarded by the board (confidence + rep). */
export function declineManagerJob(save: SaveGame): void {
  if (!save.managerJobOffer) return;
  save.boardConfidence = clamp((save.boardConfidence ?? 60) + 8, 0, 100);
  if (save.userTeamId && save.teams[save.userTeamId]) {
    const team = save.teams[save.userTeamId];
    team.reputation = clamp(team.reputation + 1, 40, 95);
  }
  save.managerJobOffer = undefined;
}
