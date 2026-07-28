/**
 * Franchise auction (Player Career): at the start of a season, rival clubs in
 * your division bid for your signature. Bids scale with your rating, form, brand
 * and caps; accepting one moves you to that club (within your division, so the
 * league/fixtures stay coherent) for a signing bonus and a brand bump. Pure /
 * mutating helpers, unit-tested.
 */
import { AuctionOffer, Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { addCoins } from './economy';
import { boardTargetFor, computeValue, MAX_SQUAD, WAGE_RATE } from './finance';
import { rebuildDomesticSeasonForUserTeam } from './season';
import { autoXI } from './squad';

const MIN_AUCTION_DOMESTIC_SEASONS = 2;
const MIN_AUCTION_MATCHES = 10;
const MIN_AUCTION_STAR_VALUE = 145;

/** Composite "star value" driving how much clubs will pay for the user. */
export function starValue(save: SaveGame, user: Player): number {
  const form = user.meta.form ?? 60;
  const brand = save.brand ?? 20;
  const caps = save.userCaps ?? 0;
  return Math.round(user.overall * 1.6 + form * 0.4 + brand * 0.5 + Math.min(caps, 50) * 0.8);
}

export function auctionEligible(save: SaveGame, user: Player): boolean {
  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'SCHOOL' || level === 'U19') return false;
  const domesticSeasons = save.careerSeasons ?? 0;
  const careerMatches = user.careerStats?.matches ?? 0;
  if (domesticSeasons < MIN_AUCTION_DOMESTIC_SEASONS) return false;
  if (careerMatches < MIN_AUCTION_MATCHES) return false;
  return starValue(save, user) >= MIN_AUCTION_STAR_VALUE;
}

/** Team ids in the user's current division (league-1). */
function userDivisionTeamIds(save: SaveGame): string[] {
  if (save.divisions) {
    const tier = save.userDivision ?? 1;
    if (tier === 1) return save.divisions.tier1;
    if (tier === 2) return save.divisions.tier2;
    return save.divisions.tier3 ?? [];
  }
  return save.leagues['league-1']?.teamIds ?? [];
}

/**
 * Generate season-start bids for the user from interested clubs in their
 * division. Stronger, richer clubs bid higher; a weak/out-of-form player may get
 * no bids at all. Deterministic via the injected rng.
 */
export function generateAuctionOffers(save: SaveGame, rng: Rng): AuctionOffer[] {
  if (save.mode !== 'career' || !save.userPlayerId) return [];
  const user = save.players[save.userPlayerId];
  if (!user || user.retired) return [];
  if (!auctionEligible(save, user)) return [];

  const value = starValue(save, user);
  const pool = userDivisionTeamIds(save)
    .filter((id) => id !== save.userTeamId)
    .map((id) => save.teams[id])
    .filter(Boolean);

  const currentWage = user.contract?.wage ?? Math.round(computeValue(user) * WAGE_RATE);

  const offers: AuctionOffer[] = [];
  for (const team of pool) {
    // Interest rises with the user's value and the club's ambition (reputation).
    const interest = value + team.reputation * 1.2 - 90 + (rng() * 2 - 1) * 18;
    if (interest < 0) continue;
    const fee = Math.round(
      computeValue(user) * (0.8 + team.reputation / 120) * (0.9 + rng() * 0.3),
    );
    // A genuine pay rise — richer/higher-rep clubs offer more. Always beats the
    // current wage so the auction is a real financial decision, not cosmetic.
    const wagePromise = Math.round(
      Math.max(
        currentWage * (1.2 + team.reputation / 300),
        computeValue(user) * WAGE_RATE * (1.3 + team.reputation / 200),
      ),
    );
    offers.push({
      teamId: team.id,
      fee,
      signingBonus: Math.round(300 + value * 6 + team.reputation * 8),
      wagePromise,
    });
  }
  // Best two offers keep the choice punchy.
  return offers.sort((a, b) => b.fee - a.fee).slice(0, 2);
}

export interface AcceptResult {
  ok: boolean;
  reason?: string;
  fromTeamId?: string;
  toTeamId?: string;
}

/** Accept a bid: move the user to the club, pay the bonus, refresh XI + board. */
export function acceptAuctionOffer(save: SaveGame, teamId: string): AcceptResult {
  if (!save.userPlayerId) return { ok: false, reason: 'No player.' };
  const user = save.players[save.userPlayerId];
  const offer = (save.auctionOffers ?? []).find((o) => o.teamId === teamId);
  const newTeam = save.teams[teamId];
  if (!user || !offer || !newTeam) return { ok: false, reason: 'Offer no longer available.' };

  const fromTeamId = save.userTeamId;
  if (fromTeamId && save.teams[fromTeamId]) {
    const old = save.teams[fromTeamId];
    old.playerIds = old.playerIds.filter((id) => id !== user.id);
    old.isUserTeam = false;
    if (old.xi) old.xi = old.xi.filter((id) => id !== user.id);
  }

  if (!newTeam.playerIds.includes(user.id)) {
    if (newTeam.playerIds.length >= MAX_SQUAD) {
      const sameRole = newTeam.playerIds
        .map((id) => save.players[id])
        .filter((p): p is Player => Boolean(p) && p.role === user.role)
        .sort((a, b) => a.overall - b.overall);
      const victim =
        sameRole[0] ??
        newTeam.playerIds
          .map((id) => save.players[id])
          .filter(Boolean)
          .sort((a, b) => a.overall - b.overall)[0];
      if (victim) newTeam.playerIds = newTeam.playerIds.filter((id) => id !== victim.id);
    }
    newTeam.playerIds.push(user.id);
  }
  newTeam.isUserTeam = true;
  save.userTeamId = teamId;

  const squad = newTeam.playerIds
    .map((id) => save.players[id])
    .filter((p): p is Player => Boolean(p));
  newTeam.xi = autoXI(squad, user.id).map((p) => p.id);

  save.wallet = addCoins(save.wallet, offer.signingBonus);
  // The promised salary becomes the user's REAL contract wage — a genuine raise,
  // on a fresh multi-year deal. Never a downgrade from their current terms.
  user.contract = {
    wage: Math.max(offer.wagePromise, user.contract?.wage ?? 0),
    yearsLeft: Math.max(3, user.contract?.yearsLeft ?? 0),
    releaseClause: user.contract?.releaseClause,
  };
  save.brand = Math.min(100, (save.brand ?? 20) + 4);
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  save.boardObjective = { year, targetPosition: boardTargetFor(newTeam.reputation) };
  save.auctionOffers = undefined;
  rebuildDomesticSeasonForUserTeam(save);

  return { ok: true, fromTeamId, toTeamId: teamId };
}

export function declineAuction(save: SaveGame): void {
  save.auctionOffers = undefined;
}
