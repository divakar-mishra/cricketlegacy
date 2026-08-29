import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { acceptAuctionOffer, generateAuctionOffers } from '../auction';
import { makeRng } from '../../engine/rng';
import { emptyStats } from '../stats';
import { nextUserFixtureId } from '../season';
import { currentPlayerCalendarEvent } from '../playerCalendar';

function makeCareer(overall = 75): SaveGame {
  const v = overall;
  const player = buildUserPlayer({
    name: 'Star Bat',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: v, timing: v, power: v, footwork: v, temperament: v, running: v },
    bowling: { paceOrSpin: 20, accuracy: 20, movement: 20, variations: 20, stamina: 20 },
    fielding: { catching: v, throwing: v, agility: v, keeping: 20 },
    meta: { fitness: v, confidence: v, aggression: 55, discipline: v },
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 4242,
  });
}

function makeAuctionEligible(save: SaveGame): void {
  save.careerPathLevel = 'DOMESTIC';
  save.careerSeasons = 2;
  save.players.user.careerStats = { ...emptyStats(), matches: 12, runs: 650 };
}

describe('franchise auction — real wages', () => {
  it('does not offer bids before a player has earned domestic attention', () => {
    const save = makeCareer(75);
    save.brand = 60;
    save.players.user.contract = { wage: 40_000, yearsLeft: 1 };
    expect(generateAuctionOffers(save, makeRng(7))).toHaveLength(0);
  });

  it('offers a genuine pay rise over the current wage', () => {
    const save = makeCareer(75);
    makeAuctionEligible(save);
    save.brand = 60;
    save.userCaps = 20;
    save.franchiseContract = { wage: 40_000, yearsLeft: 1 };
    const offers = generateAuctionOffers(save, makeRng(7));
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.wagePromise).toBeGreaterThan(save.franchiseContract.wage);
    }
  });

  it('accepting creates a separate multi-year T20 contract without moving the domestic club', () => {
    const save = makeCareer(75);
    const fromTeam = save.userTeamId!;
    const otherId = Object.keys(save.teams).find((id) => id !== fromTeam)!;
    save.players.user.contract = { wage: 30_000, yearsLeft: 1 };
    save.franchiseContract = { wage: 30_000, yearsLeft: 1 };
    save.auctionOffers = [
      { teamId: otherId, fee: 500_000, signingBonus: 1_000, wagePromise: 80_000 },
    ];
    for (const fx of Object.values(save.fixtures)) fx.played = true;

    const res = acceptAuctionOffer(save, otherId);
    expect(res.ok).toBe(true);
    expect(save.userTeamId).toBe(fromTeam);
    expect(save.franchiseTeamId).toBe(otherId);
    expect(save.players.user.contract!.wage).toBe(30_000);
    expect(save.franchiseContract!.wage).toBe(80_000);
    expect(save.franchiseContract!.yearsLeft).toBeGreaterThanOrEqual(3);
    expect(save.auctionOffers).toBeUndefined();
    expect(nextUserFixtureId(save)).toBeUndefined();
    expect(currentPlayerCalendarEvent(save)?.kind).toBe('TRAINING');
  });

  it('never downgrades a player already on a bigger wage', () => {
    const save = makeCareer(75);
    const otherId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    save.franchiseContract = { wage: 120_000, yearsLeft: 2 };
    save.auctionOffers = [
      { teamId: otherId, fee: 500_000, signingBonus: 1_000, wagePromise: 80_000 },
    ];
    acceptAuctionOffer(save, otherId);
    expect(save.franchiseContract!.wage).toBe(120_000);
  });
});
