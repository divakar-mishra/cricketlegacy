import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { makeRng } from '../../engine/rng';
import { acceptAuctionOffer, generateAuctionOffers, starValue } from '../auction';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { ensureRival, rivalComparison } from '../rivalry';
import { emptyStats } from '../stats';

function makeSave(): SaveGame {
  const player = buildUserPlayer({
    name: 'Star Bat',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 72, timing: 74, power: 70, footwork: 70, temperament: 72, running: 68 },
    bowling: { paceOrSpin: 20, accuracy: 20, movement: 20, variations: 20, stamina: 40 },
    fielding: { catching: 65, throwing: 62, agility: 66, keeping: 30 },
    meta: { fitness: 75, confidence: 70, aggression: 60, discipline: 65 },
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
  save.brand = 60;
  save.players[save.userPlayerId!].careerStats = { ...emptyStats(), matches: 14, runs: 720 };
}

describe('rivalry', () => {
  it('assigns a same-role rival from another club', () => {
    const save = makeSave();
    ensureRival(save);
    expect(save.rivalPlayerId).toBeDefined();
    const rival = save.players[save.rivalPlayerId!];
    expect(rival.role).toBe('BATTER');
    expect(rival.id).not.toBe(save.userPlayerId);
    expect(save.teams[save.userTeamId!].playerIds).not.toContain(rival.id);
  });

  it('computes a head-to-head and knows who leads', () => {
    const save = makeSave();
    ensureRival(save);
    const user = save.players[save.userPlayerId!];
    const rival = save.players[save.rivalPlayerId!];
    user.seasonStats = { ...emptyStats(), runs: 500 };
    rival.seasonStats = { ...emptyStats(), runs: 400 };
    const cmp = rivalComparison(save)!;
    expect(cmp.metric).toBe('runs');
    expect(cmp.userValue).toBe(500);
    expect(cmp.leading).toBe(true);
  });
});

describe('franchise auction', () => {
  it('generates bids for a strong player from other clubs in the division', () => {
    const save = makeSave();
    makeAuctionEligible(save);
    const offers = generateAuctionOffers(save, makeRng(7));
    expect(offers.length).toBeGreaterThan(0);
    const currentDivision =
      save.userDivision === 1
        ? save.divisions?.tier1
        : save.userDivision === 2
          ? save.divisions?.tier2
          : save.divisions?.tier3;
    for (const o of offers) {
      expect(o.teamId).not.toBe(save.userTeamId);
      expect(currentDivision).toContain(o.teamId);
      expect(o.signingBonus).toBeGreaterThan(0);
    }
    expect(starValue(save, save.players[save.userPlayerId!])).toBeGreaterThan(0);
  });

  it('accepting a bid moves the player to the new club and pays a bonus', () => {
    const save = makeSave();
    makeAuctionEligible(save);
    save.auctionOffers = generateAuctionOffers(save, makeRng(7));
    const target = save.auctionOffers[0];
    const oldTeam = save.userTeamId!;
    const coinsBefore = save.wallet.coins;

    const res = acceptAuctionOffer(save, target.teamId);
    expect(res.ok).toBe(true);
    expect(save.userTeamId).toBe(target.teamId);
    expect(save.teams[target.teamId].playerIds).toContain(save.userPlayerId);
    expect(save.teams[oldTeam].playerIds).not.toContain(save.userPlayerId);
    expect(save.teams[target.teamId].xi).toContain(save.userPlayerId);
    expect(save.wallet.coins).toBe(coinsBefore + target.signingBonus);
    expect(save.auctionOffers).toBeUndefined();
  });
});
