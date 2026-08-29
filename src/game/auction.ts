/**
 * Franchise auction (Player Career): at the start of a season, rival clubs in
 * your division bid for your T20 affiliation. The domestic First-Class/List A
 * contract is independent and is handled by the domestic-offer helpers below.
 */
import { AuctionOffer, Player, SaveGame } from '../domain/types';
import { Rng } from '../engine/rng';
import { addCoins } from './economy';
import { boardTargetFor, computeValue, MAX_SQUAD, WAGE_RATE } from './finance';
import { buildPlayerSeasonCalendar } from './playerCalendar';
import { matchImpactScore } from './progression';
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
function divisionTeamIdsFor(save: SaveGame, teamId?: string): string[] {
  if (save.divisions) {
    const tier = save.divisions.tier1.includes(teamId ?? '')
      ? 1
      : save.divisions.tier2.includes(teamId ?? '')
        ? 2
        : save.divisions.tier3?.includes(teamId ?? '')
          ? 3
          : save.userDivision ?? 1;
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
  const currentFranchiseId = save.franchiseTeamId ?? save.userTeamId;
  const pool = divisionTeamIdsFor(save, currentFranchiseId)
    .filter((id) => id !== currentFranchiseId)
    .map((id) => save.teams[id])
    .filter(Boolean);

  const currentWage = save.franchiseContract?.wage ?? 0;

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

/** Domestic-only value: international caps never gate a First-Class career. */
export function domesticClubValue(_save: SaveGame, user: Player): number {
  const listA = user.competitionStats?.LIST_A;
  const firstClass = user.competitionStats?.FIRST_CLASS;
  const appearances = (listA?.matches ?? 0) + (firstClass?.matches ?? 0);
  const domesticPerformance =
    appearances > 0
      ? matchImpactScore(
          {
            runs: ((listA?.runs ?? 0) + (firstClass?.runs ?? 0)) / appearances,
            wickets: ((listA?.wickets ?? 0) + (firstClass?.wickets ?? 0)) / appearances,
          },
          user.role,
        ) * 100
      : user.meta.form ?? 60;
  return Math.round(
    user.overall * 1.6 +
      domesticPerformance * 0.4 +
      Math.min(appearances, 50) * 0.8,
  );
}

/**
 * Two or three First-Class/List A approaches after a completed senior season.
 * Interest and terms use domestic appearances, form and ability—not caps—so an
 * uncapped player can still build a valuable long domestic career.
 */
export function generateDomesticClubOffers(save: SaveGame, rng: Rng): AuctionOffer[] {
  if (save.mode !== 'career' || !save.userPlayerId) return [];
  const level = save.careerPathLevel ?? 'DOMESTIC';
  if (level === 'SCHOOL' || level === 'U19') return [];
  const user = save.players[save.userPlayerId];
  if (!user || user.retired) return [];

  const value = domesticClubValue(save, user);
  const currentWage = user.contract?.wage ?? Math.round(computeValue(user) * WAGE_RATE);
  const appearances =
    (user.competitionStats?.LIST_A?.matches ?? 0) +
    (user.competitionStats?.FIRST_CLASS?.matches ?? 0);
  if (appearances === 0) return [];
  const offerCount = appearances >= MIN_AUCTION_MATCHES ? 3 : 2;

  return divisionTeamIdsFor(save, save.userTeamId)
    .filter((id) => id !== save.userTeamId)
    .map((id) => save.teams[id])
    .filter(Boolean)
    .map((team) => ({
      teamId: team.id,
      fee: Math.round(
        computeValue(user) * (0.8 + team.reputation / 120) * (0.9 + rng() * 0.3),
      ),
      signingBonus: Math.round(300 + value * 6 + team.reputation * 8),
      wagePromise: Math.round(
        Math.max(
          currentWage * (1.2 + team.reputation / 300),
          computeValue(user) * WAGE_RATE * (1.3 + team.reputation / 200),
        ),
      ),
    }))
    .sort((left, right) => right.fee - left.fee)
    .slice(0, offerCount);
}

export interface AcceptResult {
  ok: boolean;
  reason?: string;
  fromTeamId?: string;
  toTeamId?: string;
}

/** Accept a T20 bid without changing the First-Class/List A club. */
export function acceptAuctionOffer(save: SaveGame, teamId: string): AcceptResult {
  if (!save.userPlayerId) return { ok: false, reason: 'No player.' };
  const user = save.players[save.userPlayerId];
  const offer = (save.auctionOffers ?? []).find((o) => o.teamId === teamId);
  const newTeam = save.teams[teamId];
  if (!user || !offer || !newTeam) return { ok: false, reason: 'Offer no longer available.' };

  const fromTeamId = save.franchiseTeamId ?? save.userTeamId;
  save.franchiseTeamId = teamId;

  save.wallet = addCoins(save.wallet, offer.signingBonus);
  // The promised salary becomes the user's REAL contract wage — a genuine raise,
  // on a fresh multi-year deal. Never a downgrade from their current terms.
  save.franchiseContract = {
    wage: Math.max(offer.wagePromise, save.franchiseContract?.wage ?? 0),
    yearsLeft: Math.max(3, save.franchiseContract?.yearsLeft ?? 0),
    releaseClause: save.franchiseContract?.releaseClause,
  };
  save.brand = Math.min(100, (save.brand ?? 20) + 4);
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  save.auctionOffers = undefined;
  (save.timeline ??= []).push({
    year,
    kind: 'TRANSFER',
    text: `Signed a separate T20 deal with ${newTeam.name}.`,
  });
  buildPlayerSeasonCalendar(save);

  return { ok: true, fromTeamId, toTeamId: teamId };
}

export function declineAuction(save: SaveGame): void {
  save.auctionOffers = undefined;
}

function moveDomesticRoster(save: SaveGame, user: Player, teamId: string): string | undefined {
  const fromTeamId = save.userTeamId;
  if (fromTeamId && save.teams[fromTeamId]) {
    const old = save.teams[fromTeamId];
    old.playerIds = old.playerIds.filter((id) => id !== user.id);
    old.isUserTeam = false;
    if (old.xi) old.xi = old.xi.filter((id) => id !== user.id);
  }
  const next = save.teams[teamId];
  if (!next.playerIds.includes(user.id)) {
    if (next.playerIds.length >= MAX_SQUAD) {
      const sameRole = next.playerIds
        .map((id) => save.players[id])
        .filter((player): player is Player => Boolean(player) && player.role === user.role)
        .sort((left, right) => left.overall - right.overall);
      const victim =
        sameRole[0] ??
        next.playerIds
          .map((id) => save.players[id])
          .filter((player): player is Player => Boolean(player))
          .sort((left, right) => left.overall - right.overall)[0];
      if (victim) next.playerIds = next.playerIds.filter((id) => id !== victim.id);
    }
    next.playerIds.push(user.id);
  }
  next.isUserTeam = true;
  next.xi = autoXI(
    next.playerIds.map((id) => save.players[id]).filter((player): player is Player => Boolean(player)),
    user.id,
  ).map((player) => player.id);
  save.userTeamId = teamId;
  return fromTeamId;
}

/** Accept a rival domestic offer without changing the T20 franchise. */
export function acceptDomesticClubOffer(save: SaveGame, teamId: string): AcceptResult {
  if (!save.userPlayerId) return { ok: false, reason: 'No player.' };
  const user = save.players[save.userPlayerId];
  const offer = (save.domesticClubOffers ?? []).find((item) => item.teamId === teamId);
  const newTeam = save.teams[teamId];
  if (!user || !offer || !newTeam) {
    return { ok: false, reason: 'Domestic offer no longer available.' };
  }

  const fromTeamId = moveDomesticRoster(save, user, teamId);
  user.contract = {
    wage: Math.max(offer.wagePromise, user.contract?.wage ?? 0),
    yearsLeft: Math.max(3, user.contract?.yearsLeft ?? 0),
    releaseClause: user.contract?.releaseClause,
  };
  save.wallet = addCoins(save.wallet, offer.signingBonus);
  save.brand = Math.min(100, (save.brand ?? 20) + 4);
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  save.boardObjective = { year, targetPosition: boardTargetFor(newTeam.reputation) };
  save.domesticClubOffers = undefined;
  (save.timeline ??= []).push({
    year,
    kind: 'TRANSFER',
    text: `Joined ${newTeam.name} for First-Class and List A cricket.`,
  });
  buildPlayerSeasonCalendar(save);
  return { ok: true, fromTeamId, toTeamId: teamId };
}

export function declineDomesticClubOffers(save: SaveGame): void {
  save.domesticClubOffers = undefined;
}
