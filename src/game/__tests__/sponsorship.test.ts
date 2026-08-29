import { Fixture, Format, SaveGame } from '../../domain/types';
import {
  acceptSponsorshipOffer,
  activeEarnedSponsorContract,
  ensureSponsorshipState,
  grantPremiumSponsorToCurrentSave,
  managerClubSponsorshipState,
  premiumSponsorStoreUnlocked,
  rolloverSponsorship,
  settleFixtureSponsorship,
  sponsorshipOffers,
} from '../sponsorship';
import { SPONSOR_BRANDS } from '../sponsorBrands';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';
import { applyManagerAppointment } from '../managerJobs';

function withoutLegacySponsors(save: SaveGame): SaveGame {
  save.sponsors = [];
  save.sponsorship = undefined;
  return save;
}

function fixture(id: string, format: Format = 'T20'): Fixture {
  return {
    id,
    seasonId: 'season-test',
    format,
    homeTeamId: 'mumbai_sharks',
    awayTeamId: 'delhi_blaze',
    venue: 'Test Ground',
    round: 1,
    played: true,
    winnerTeamId: 'mumbai_sharks',
    resultKind: 'HOME_WIN',
  };
}

function unlockPlayerSponsor(save: SaveGame): void {
  save.careerPathLevel = 'DOMESTIC';
  settleFixtureSponsorship(save, fixture('domestic-debut'), {
    selected: true,
    userWon: false,
  });
}

describe('earned Player sponsorship', () => {
  it('unlocks only at senior level and presents three guaranteed fixed offers', () => {
    const save = withoutLegacySponsors(makeCareerSave());
    save.careerPathLevel = 'U19';
    expect(sponsorshipOffers(save)).toEqual([]);

    const youthFixture = fixture('u19-appearance');
    youthFixture.competitionId = 'youth-u19';
    settleFixtureSponsorship(save, youthFixture, {
      selected: true,
      userWon: true,
    });
    expect(sponsorshipOffers(save)).toEqual([]);

    save.careerPathLevel = 'DOMESTIC';
    expect(sponsorshipOffers(save)).toEqual([]);
    settleFixtureSponsorship(save, fixture('benched-debut'), {
      selected: false,
      userWon: false,
    });
    expect(sponsorshipOffers(save)).toEqual([]);
    unlockPlayerSponsor(save);
    expect(save.sponsorship?.seniorDomesticDebutFixtureId).toBe('domestic-debut');
    const offers = sponsorshipOffers(save);
    expect(offers).toHaveLength(3);
    expect(offers.map((offer) => offer.scope)).toEqual(['ALL_FORMATS', 'WHITE_BALL', 'RED_BALL']);
    expect(offers.map((offer) => [offer.brandId, offer.brandName])).toEqual([
      [SPONSOR_BRANDS.boundary_works.id, SPONSOR_BRANDS.boundary_works.name],
      [SPONSOR_BRANDS.pulse_xi.id, SPONSOR_BRANDS.pulse_xi.name],
      [SPONSOR_BRANDS.longform.id, SPONSOR_BRANDS.longform.name],
    ]);
    expect(offers.map((offer) => [offer.fixtureQuota, offer.appearancePayout])).toEqual([
      [16, 110],
      [10, 180],
      [6, 300],
    ]);
    expect(offers.every((offer) => offer.signingBonus === 250)).toBe(true);
  });

  it('uses player OVR, never club reputation, for uncapped Franchise stature', () => {
    const domestic = withoutLegacySponsors(makeCareerSave());
    domestic.teams[domestic.userTeamId!].reputation = 99;
    domestic.players[domestic.userPlayerId!].overall = 67;
    unlockPlayerSponsor(domestic);
    expect(sponsorshipOffers(domestic)[0].appearancePayout).toBe(110);

    const franchise = withoutLegacySponsors(makeCareerSave());
    franchise.teams[franchise.userTeamId!].reputation = 1;
    franchise.players[franchise.userPlayerId!].overall = 68;
    unlockPlayerSponsor(franchise);
    expect(sponsorshipOffers(franchise)[0].appearancePayout).toBe(140);
  });

  it('locks the accepted stature rate and permits only one earned slot', () => {
    const save = withoutLegacySponsors(makeCareerSave());
    unlockPlayerSponsor(save);
    save.players[save.userPlayerId!].overall = 70;
    const offer = sponsorshipOffers(save).find((candidate) => candidate.scope === 'ALL_FORMATS')!;
    expect(offer.appearancePayout).toBe(140);
    expect(offer.signingBonus).toBe(310);
    const before = save.wallet.coins;
    expect(acceptSponsorshipOffer(save, offer.id).ok).toBe(true);
    expect(save.wallet.coins).toBe(before + 310);
    expect(sponsorshipOffers(save)).toEqual([]);
    expect(acceptSponsorshipOffer(save, offer.id).ok).toBe(false);

    save.capped = true;
    save.userCaps = 50;
    expect(save.sponsorship?.activeEarned?.appearancePayout).toBe(140);
  });

  it('pays selected official matching appearances once and never pays youth or bench games', () => {
    const save = withoutLegacySponsors(makeCareerSave());
    unlockPlayerSponsor(save);
    const offer = sponsorshipOffers(save).find((candidate) => candidate.scope === 'WHITE_BALL')!;
    acceptSponsorshipOffer(save, offer.id);
    const before = save.wallet.coins;
    const senior = fixture('senior-t20');

    expect(settleFixtureSponsorship(save, senior, { selected: false, userWon: true }).earned).toBe(
      0,
    );
    expect(settleFixtureSponsorship(save, senior, { selected: true, userWon: true }).earned).toBe(
      180,
    );
    expect(settleFixtureSponsorship(save, senior, { selected: true, userWon: true }).earned).toBe(
      0,
    );
    expect(save.wallet.coins).toBe(before + 180);

    const youth = { ...fixture('u19'), competition: 'U19_WORLDCUP' as const };
    expect(settleFixtureSponsorship(save, youth, { selected: true, userWon: true }).earned).toBe(0);
    expect(
      settleFixtureSponsorship(save, fixture('red-ball', 'TEST'), {
        selected: true,
        userWon: true,
      }).earned,
    ).toBe(0);
  });

  it('uses a total contract quota and expires after two rollovers, whichever comes first', () => {
    const quotaSave = withoutLegacySponsors(makeCareerSave());
    unlockPlayerSponsor(quotaSave);
    const red = sponsorshipOffers(quotaSave).find((offer) => offer.scope === 'RED_BALL')!;
    acceptSponsorshipOffer(quotaSave, red.id);
    for (let index = 0; index < 6; index += 1) {
      settleFixtureSponsorship(quotaSave, fixture(`fc-${index}`, 'TEST'), {
        selected: true,
        userWon: index % 2 === 0,
      });
    }
    expect(quotaSave.sponsorship?.activeEarned).toBeUndefined();
    expect(quotaSave.sponsorship?.history.at(-1)?.status).toBe('QUOTA_REACHED');

    const termSave = withoutLegacySponsors(makeCareerSave());
    unlockPlayerSponsor(termSave);
    acceptSponsorshipOffer(termSave, sponsorshipOffers(termSave)[0].id);
    rolloverSponsorship(termSave);
    expect(termSave.sponsorship?.activeEarned?.status).toBe('ACTIVE');
    rolloverSponsorship(termSave);
    expect(termSave.sponsorship?.activeEarned).toBeUndefined();
    expect(termSave.sponsorship?.history.at(-1)?.status).toBe('TERM_ENDED');
  });

  it('keeps every story endorsement off-shirt and leaves the earned kit slot free', () => {
    const save = makeCareerSave();
    save.sponsors = [
      {
        id: 'small',
        brand: 'Small',
        tier: 'LOCAL',
        perMatchCoins: 40,
        signingBonus: 0,
        seasonsLeft: 2,
      },
      {
        id: 'large',
        brand: 'Large',
        tier: 'NATIONAL',
        perMatchCoins: 90,
        signingBonus: 0,
        seasonsLeft: 2,
      },
    ];
    save.sponsorship = undefined;
    const state = ensureSponsorshipState(save);
    expect(state.activeEarned).toBeUndefined();
    expect(state.legacySponsorMigrationComplete).toBe(true);
    expect(save.sponsors).toHaveLength(2);

    const played = fixture('legacy-campaign-match');
    const before = save.wallet.coins;
    const first = settleFixtureSponsorship(save, played, {
      selected: true,
      userWon: true,
    });
    const repeated = settleFixtureSponsorship(save, played, {
      selected: true,
      userWon: true,
    });
    expect(first.endorsements).toBe(130);
    expect(repeated.endorsements).toBe(0);
    expect(save.wallet.coins - before).toBe(130);
    expect(save.sponsors?.every((sponsor) => sponsor.paidFixtureIds?.includes(played.id))).toBe(
      true,
    );
  });

  it('pays a story campaign signed after the canonical kit ledger was initialized', () => {
    const save = withoutLegacySponsors(makeCareerSave());
    const state = ensureSponsorshipState(save);
    expect(state.legacySponsorMigrationComplete).toBe(true);
    save.sponsors = [
      {
        id: 'future-story-deal',
        brand: 'Meridian Sport',
        tier: 'NATIONAL',
        perMatchCoins: 80,
        signingBonus: 500,
        seasonsLeft: 3,
      },
    ];
    const before = save.wallet.coins;

    const result = settleFixtureSponsorship(save, fixture('after-story-signing'), {
      selected: false,
      userWon: false,
    });

    expect(result.endorsements).toBe(80);
    expect(result.earned).toBe(0);
    expect(save.wallet.coins - before).toBe(80);
    expect(save.sponsorship?.activeEarned).toBeUndefined();
  });
});

describe('earned Manager sponsorship', () => {
  it.each([
    ['CLUB', [22_000, 32_000, 14_000], [0, 0, 18_000], [14, 10, 14]],
    ['STATE', [24_000, 32_000, 18_000], [0, 0, 16_000], [18, 14, 18]],
    ['ELITE', [28_000, 46_000, 20_000], [0, 0, 17_000], [20, 12, 20]],
  ] as const)('uses the audited %s offer values', (level, fees, wins, quotas) => {
    const save = withoutLegacySponsors(makeManagerSave());
    save.managerCareerLevel = level;
    const offers = sponsorshipOffers(save);
    expect(offers.map((offer) => offer.appearancePayout)).toEqual([...fees]);
    expect(offers.map((offer) => offer.winBonus)).toEqual([...wins]);
    expect(offers.map((offer) => offer.fixtureQuota)).toEqual([...quotas]);
    expect(offers.every((offer) => offer.signingBonus === 0)).toBe(true);
  });

  it('credits the managed club balance, not Wallet Coins, and is idempotent', () => {
    const save = withoutLegacySponsors(makeManagerSave());
    save.managerCareerLevel = 'CLUB';
    const results = sponsorshipOffers(save).find((offer) => offer.scope === 'RESULTS')!;
    acceptSponsorshipOffer(save, results.id);
    const team = save.teams[save.userTeamId!];
    const budget = team.budget;
    const coins = save.wallet.coins;
    const result = settleFixtureSponsorship(save, fixture('managed'), {
      selected: true,
      userWon: true,
      managedTeamId: save.userTeamId,
    });
    expect(result.earned).toBe(32_000);
    expect(team.budget).toBe(budget + 32_000);
    expect(save.wallet.coins).toBe(coins);
    expect(
      settleFixtureSponsorship(save, fixture('managed'), {
        selected: true,
        userWon: true,
        managedTeamId: save.userTeamId,
      }).earned,
    ).toBe(0);
  });

  it('leaves the earned deal with the old club and gives the new club independent offers', () => {
    const save = withoutLegacySponsors(makeManagerSave());
    const originalTeamId = save.userTeamId!;
    const offer = sponsorshipOffers(save)[0];
    acceptSponsorshipOffer(save, offer.id);
    const nextTeamId = save.divisions!.tier1.find((teamId) => teamId !== originalTeamId)!;
    expect(applyManagerAppointment(save, nextTeamId).ok).toBe(true);

    expect(sponsorshipOffers(save)).toHaveLength(3);
    expect(managerClubSponsorshipState(save, originalTeamId)?.activeEarned).toMatchObject({
      boundTeamId: originalTeamId,
      status: 'ACTIVE',
    });
    expect(managerClubSponsorshipState(save, nextTeamId)?.activeEarned).toBeUndefined();

    const opponentId = save.divisions!.tier1.find(
      (teamId) => teamId !== originalTeamId && teamId !== nextTeamId,
    )!;
    const oldClubFixture: Fixture = {
      ...fixture('old-club-background'),
      homeTeamId: originalTeamId,
      awayTeamId: opponentId,
      winnerTeamId: originalTeamId,
    };
    const oldBudget = save.teams[originalTeamId].budget;
    expect(
      settleFixtureSponsorship(save, oldClubFixture, {
        selected: true,
        userWon: false,
      }).earned,
    ).toBe(0);
    expect(save.teams[originalTeamId].budget).toBe(oldBudget + offer.appearancePayout);
    expect(managerClubSponsorshipState(save, originalTeamId)?.activeEarned?.paidFixtures).toBe(1);

    const newOffer = sponsorshipOffers(save)[0];
    expect(acceptSponsorshipOffer(save, newOffer.id).ok).toBe(true);
    expect(managerClubSponsorshipState(save, nextTeamId)?.activeEarned?.boundTeamId).toBe(
      nextTeamId,
    );

    expect(applyManagerAppointment(save, originalTeamId).ok).toBe(true);
    expect(activeEarnedSponsorContract(save)).toMatchObject({
      boundTeamId: originalTeamId,
      paidFixtures: 1,
    });
    expect(applyManagerAppointment(save, nextTeamId).ok).toBe(true);
    expect(activeEarnedSponsorContract(save)?.boundTeamId).toBe(nextTeamId);
  });
});

describe('one-save premium sponsor', () => {
  const MONDAY = Date.UTC(2026, 7, 10, 0, 0, 0);

  it('appears only after sponsorship unlocks in the relevant career', () => {
    const player = withoutLegacySponsors(makeCareerSave());
    expect(premiumSponsorStoreUnlocked(player)).toBe(false);
    unlockPlayerSponsor(player);
    expect(premiumSponsorStoreUnlocked(player)).toBe(true);

    const manager = withoutLegacySponsors(makeManagerSave());
    manager.managerCareerLevel = 'CLUB';
    expect(premiumSponsorStoreUnlocked(manager)).toBe(true);
    manager.managerCareerLevel = 'NATIONAL';
    expect(premiumSponsorStoreUnlocked(manager)).toBe(false);
  });

  it('binds permanently to the exact Player save and pays once per UTC Monday week', () => {
    const save = withoutLegacySponsors(makeCareerSave());
    unlockPlayerSponsor(save);
    expect(
      grantPremiumSponsorToCurrentSave(save, 'player_save_sponsor', 'verified-1', MONDAY).ok,
    ).toBe(true);
    expect(save.sponsorship?.premium?.boundSaveId).toBe(save.id);
    expect(save.sponsorship?.premium).toMatchObject({
      brandId: 'legacy_crown',
      brandName: 'Legacy Crown',
    });
    expect(grantPremiumSponsorToCurrentSave(save, 'player_save_sponsor', 'again', MONDAY).ok).toBe(
      false,
    );

    expect(
      settleFixtureSponsorship(save, fixture('monday'), {
        selected: true,
        userWon: false,
        now: MONDAY + 1,
      }).premium,
    ).toBe(250);
    expect(
      settleFixtureSponsorship(save, fixture('friday'), {
        selected: true,
        userWon: true,
        now: MONDAY + 4 * 86_400_000,
      }).premium,
    ).toBe(0);
    expect(
      settleFixtureSponsorship(save, fixture('next-week'), {
        selected: true,
        userWon: true,
        now: MONDAY + 7 * 86_400_000,
      }).premium,
    ).toBe(250);
  });

  it('never catches up missed weeks and pauses the Manager grant on national duty', () => {
    const save = withoutLegacySponsors(makeManagerSave());
    save.managerCareerLevel = 'CLUB';
    grantPremiumSponsorToCurrentSave(save, 'manager_save_sponsor', 'verified-manager', MONDAY);
    const threeWeeksLater = MONDAY + 21 * 86_400_000;
    expect(
      settleFixtureSponsorship(save, fixture('one-after-gap'), {
        selected: true,
        userWon: true,
        managedTeamId: save.userTeamId,
        now: threeWeeksLater,
      }).premium,
    ).toBe(30_000);
    expect(save.sponsorship?.premium?.paidUtcWeekIds).toHaveLength(1);
    expect(save.sponsorship?.premiumThisSeason).toBe(30_000);

    save.managerCareerLevel = 'NATIONAL';
    expect(
      settleFixtureSponsorship(save, fixture('national'), {
        selected: true,
        userWon: true,
        managedTeamId: save.userTeamId,
        now: threeWeeksLater + 7 * 86_400_000,
      }).premium,
    ).toBe(0);
  });

  it('moves the save-owned Manager premium stipend to the current domestic club only', () => {
    const save = withoutLegacySponsors(makeManagerSave(2_551));
    save.managerCareerLevel = 'CLUB';
    const oldClubId = save.userTeamId!;
    const newClubId = Object.keys(save.managerClubs!).find((id) => id !== oldClubId)!;
    expect(
      grantPremiumSponsorToCurrentSave(
        save,
        'manager_save_sponsor',
        'verified-follow-manager',
        MONDAY,
      ).ok,
    ).toBe(true);
    expect(applyManagerAppointment(save, newClubId).ok).toBe(true);

    const opponentId = Object.keys(save.managerClubs!).find(
      (id) => id !== oldClubId && id !== newClubId,
    )!;
    const currentFixture: Fixture = {
      ...fixture('premium-new-club'),
      homeTeamId: newClubId,
      awayTeamId: opponentId,
      winnerTeamId: newClubId,
    };
    const oldBudget = save.teams[oldClubId].budget;
    const newBudget = save.teams[newClubId].budget;
    expect(
      settleFixtureSponsorship(save, currentFixture, {
        selected: true,
        userWon: true,
        managedTeamId: newClubId,
        now: MONDAY + 1,
      }).premium,
    ).toBe(30_000);
    expect(save.teams[newClubId].budget).toBe(newBudget + 30_000);
    expect(save.teams[oldClubId].budget).toBe(oldBudget);
    expect(managerClubSponsorshipState(save, newClubId)?.premiumThisSeason).toBe(30_000);

    const oldFixture: Fixture = {
      ...fixture('premium-old-club-next-week'),
      homeTeamId: oldClubId,
      awayTeamId: opponentId,
      winnerTeamId: oldClubId,
    };
    expect(
      settleFixtureSponsorship(save, oldFixture, {
        selected: true,
        userWon: false,
        now: MONDAY + 7 * 86_400_000,
      }).premium,
    ).toBe(0);
    expect(save.teams[oldClubId].budget).toBe(oldBudget);
  });

  it('snapshots all fixture-paid kit income before resetting the season counters', () => {
    const save = withoutLegacySponsors(makeManagerSave());
    save.managerCareerLevel = 'CLUB';
    const offer = sponsorshipOffers(save)[0];
    acceptSponsorshipOffer(save, offer.id);
    grantPremiumSponsorToCurrentSave(save, 'manager_save_sponsor', 'verified-snapshot', MONDAY);
    settleFixtureSponsorship(save, fixture('snapshot-fixture'), {
      selected: true,
      userWon: true,
      managedTeamId: save.userTeamId,
      now: MONDAY + 1,
    });

    rolloverSponsorship(save);

    expect(save.sponsorship?.lastKitSponsorIncome).toBe(52_000);
    expect(save.sponsorship?.lastKitSponsorSeasonId).toBe(save.currentSeasonId);
    expect(save.sponsorship?.earnedThisSeason).toBe(0);
    expect(save.sponsorship?.premiumThisSeason).toBe(0);
  });

  it('rejects a premium product for the wrong mode', () => {
    const manager = withoutLegacySponsors(makeManagerSave());
    expect(grantPremiumSponsorToCurrentSave(manager, 'player_save_sponsor', 'wrong').ok).toBe(
      false,
    );
  });
});
