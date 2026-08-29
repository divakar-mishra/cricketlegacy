import { SaveGame } from '../../domain/types';
import { buildManagerSeasonCalendar } from '../managerCalendar';
import { advanceManagerCalendarPhase, finishSeason } from '../season';
import {
  acceptSponsorshipOffer,
  grantPremiumSponsorToCurrentSave,
  managerClubSponsorshipState,
  rolloverSponsorship,
  settleFixtureSponsorship,
  sponsorshipOffers,
} from '../sponsorship';
import { makeManagerSave } from './_depthHelpers';
import { applyManagerAppointment } from '../managerJobs';

function makeLockedCalendarSave(seed: number): SaveGame {
  const save = makeManagerSave(seed);
  save.sponsors = [];
  save.sponsorship = undefined;
  save.managerCareerLevel = 'CLUB';
  buildManagerSeasonCalendar(save, 2026, 'LIST_A');
  return save;
}

function playedManagedFixtures(save: SaveGame, phase: 'LIST_A' | 'FIRST_CLASS') {
  return Object.values(save.fixtures).filter(
    (fixture) =>
      fixture.managerPhase === phase &&
      fixture.played &&
      (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId),
  );
}

describe('manager sponsorship in locked calendar blocks', () => {
  it('settles a former club through legacy applyResult auto-sims without managerCalendar', () => {
    const save = makeLockedCalendarSave(8_199);
    const oldClubId = save.userTeamId!;
    const offer = sponsorshipOffers(save).find((candidate) => candidate.scope === 'ALL_FORMATS')!;
    expect(acceptSponsorshipOffer(save, offer.id).ok).toBe(true);
    const newClubId = save.divisions!.tier1.find((id) => id !== oldClubId)!;
    expect(applyManagerAppointment(save, newClubId).ok).toBe(true);
    delete save.managerCalendar;

    const oldBudget = save.teams[oldClubId].budget;
    finishSeason(save);
    const oldState = managerClubSponsorshipState(save, oldClubId)!;
    const contract = oldState.activeEarned ?? oldState.history.at(-1);

    expect(contract?.paidFixtures).toBeGreaterThan(0);
    expect(new Set(contract?.paidFixtureIds).size).toBe(contract?.paidFixtures);
    expect(save.teams[oldClubId].budget).toBe(oldBudget + (contract?.totalPaid ?? 0));
    expect(managerClubSponsorshipState(save, newClubId)?.earnedThisSeason).toBe(0);
  }, 30_000);

  it('continues settling a former club contract from simulated fixtures after a job move', () => {
    const save = makeLockedCalendarSave(8_200);
    const oldClubId = save.userTeamId!;
    const allFormats = sponsorshipOffers(save).find(
      (offer) => offer.scope === 'ALL_FORMATS',
    )!;
    expect(acceptSponsorshipOffer(save, allFormats.id).ok).toBe(true);
    const newClubId = save.divisions!.tier1.find((id) => id !== oldClubId)!;
    expect(applyManagerAppointment(save, newClubId).ok).toBe(true);
    expect(sponsorshipOffers(save)).toHaveLength(3);

    const oldBudget = save.teams[oldClubId].budget;
    expect(advanceManagerCalendarPhase(save).kind).toBe('PHASE_ADVANCED');
    const oldFixtures = Object.values(save.fixtures).filter(
      (fixture) =>
        fixture.managerPhase === 'LIST_A' &&
        fixture.played &&
        (fixture.homeTeamId === oldClubId || fixture.awayTeamId === oldClubId),
    );
    const oldState = managerClubSponsorshipState(save, oldClubId)!;

    expect(oldFixtures.length).toBeGreaterThan(0);
    expect(oldState.activeEarned?.paidFixtures).toBe(oldFixtures.length);
    expect(oldState.activeEarned?.paidFixtureIds.slice().sort()).toEqual(
      oldFixtures.map((fixture) => fixture.id).sort(),
    );
    expect(save.teams[oldClubId].budget).toBe(
      oldBudget + oldFixtures.length * allFormats.appearancePayout,
    );
    expect(managerClubSponsorshipState(save, newClubId)?.activeEarned).toBeUndefined();
  }, 30_000);

  it('settles earned and premium sponsor income once from actual background results', () => {
    const save = makeLockedCalendarSave(8_201);
    const resultsOffer = sponsorshipOffers(save).find((offer) => offer.scope === 'RESULTS')!;
    expect(acceptSponsorshipOffer(save, resultsOffer.id).ok).toBe(true);
    expect(
      grantPremiumSponsorToCurrentSave(
        save,
        'manager_save_sponsor',
        'background-premium',
        Date.now() - 1,
      ).ok,
    ).toBe(true);

    expect(advanceManagerCalendarPhase(save).kind).toBe('PHASE_ADVANCED');

    const managedFixtures = playedManagedFixtures(save, 'LIST_A');
    const wins = managedFixtures.filter(
      (fixture) => fixture.winnerTeamId === save.userTeamId,
    ).length;
    const expectedEarned = managedFixtures.length * 14_000 + wins * 18_000;
    const state = managerClubSponsorshipState(save, save.userTeamId!)!;
    const contract = state.activeEarned!;

    expect(managedFixtures.length).toBeGreaterThan(0);
    expect(contract.paidFixtures).toBe(managedFixtures.length);
    expect([...contract.paidFixtureIds].sort()).toEqual(
      managedFixtures.map((fixture) => fixture.id).sort(),
    );
    expect(contract.totalPaid).toBe(expectedEarned);
    expect(state.earnedThisSeason).toBe(expectedEarned);
    expect(state.premiumThisSeason).toBe(30_000);
    expect(save.sponsorship?.premium?.paidFixtureIds).toHaveLength(1);
    expect(save.sponsorship?.premium?.paidUtcWeekIds).toHaveLength(1);

    const budgetAfterBackgroundBlock = save.teams[save.userTeamId!].budget;
    for (const fixture of managedFixtures) {
      expect(
        settleFixtureSponsorship(save, fixture, {
          selected: true,
          userWon: fixture.winnerTeamId === save.userTeamId,
          managedTeamId: save.userTeamId,
        }),
      ).toMatchObject({ earned: 0, premium: 0 });
    }
    expect(save.teams[save.userTeamId!].budget).toBe(budgetAfterBackgroundBlock);
  }, 30_000);

  it('completes the total quota across locked phases and reconciles it once at rollover', () => {
    const save = makeLockedCalendarSave(8_202);
    const allFormats = sponsorshipOffers(save).find(
      (offer) => offer.scope === 'ALL_FORMATS',
    )!;
    expect(acceptSponsorshipOffer(save, allFormats.id).ok).toBe(true);

    expect(advanceManagerCalendarPhase(save).kind).toBe('PHASE_ADVANCED');
    expect(save.managerCalendar?.phase).toBe('FIRST_CLASS');
    expect(advanceManagerCalendarPhase(save).kind).toBe('PHASE_ADVANCED');

    const state = managerClubSponsorshipState(save, save.userTeamId!)!;
    expect(state.activeEarned).toBeUndefined();
    const completed = state.history.at(-1);
    expect(completed).toMatchObject({
      status: 'QUOTA_REACHED',
      paidFixtures: 14,
      totalPaid: 14 * 22_000,
    });
    expect(new Set(completed?.paidFixtureIds).size).toBe(14);
    expect(state.earnedThisSeason).toBe(14 * 22_000);

    const completedSeasonId = save.currentSeasonId;
    rolloverSponsorship(save);
    expect(state.lastKitSponsorIncome).toBe(14 * 22_000);
    expect(state.lastKitSponsorSeasonId).toBe(completedSeasonId);
    expect(state.earnedThisSeason).toBe(0);
    expect(state.premiumThisSeason).toBe(0);
  }, 30_000);
});
