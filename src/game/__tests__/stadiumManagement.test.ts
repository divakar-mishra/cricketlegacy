import { Fixture, SaveGame } from '../../domain/types';
import { activeManagerClub } from '../managerClubState';
import { ensureManagerKnockouts } from '../managerCalendar';
import { applyResult, runFixture, startNewSeason, venueForFixture } from '../season';
import {
  acceptSponsorshipOffer,
  settleFixtureSponsorship,
  sponsorshipOffers,
} from '../sponsorship';
import {
  projectFixtureAttendance,
  REGULAR_OCCUPANCY_RANGE,
  setClubTicketPreset,
  settleFixtureGate,
  stadiumCapacity,
  STADIUM_CAPACITY,
  STADIUM_CAPACITY_UPGRADE_COST,
  TICKET_PRICE,
  upgradeMatchdayExperience,
  upgradeStadiumCapacity,
} from '../stadiumManagement';
import { makeManagerSave } from './_depthHelpers';

function homeFixture(save: SaveGame): Fixture {
  return Object.values(save.fixtures).find(
    (fixture) => fixture.homeTeamId === save.userTeamId && !fixture.played,
  )!;
}

function opposingTeamId(save: SaveGame): string {
  return Object.keys(save.teams).find(
    (teamId) => teamId !== save.userTeamId && !save.teams[teamId].isNationalTeam,
  )!;
}

describe('manager stadium commerce', () => {
  it('uses the approved capacity and format ticket ladders', () => {
    const save = makeManagerSave();
    const club = activeManagerClub(save)!;

    expect(STADIUM_CAPACITY).toMatchObject({
      1: 8_000,
      2: 12_000,
      3: 18_000,
      4: 28_000,
      5: 42_000,
    });
    expect(TICKET_PRICE.T20).toEqual({ LOW: 14, STANDARD: 20, PREMIUM: 28 });
    expect(TICKET_PRICE.ODI).toEqual({ LOW: 11, STANDARD: 16, PREMIUM: 22 });
    expect(TICKET_PRICE.TEST).toEqual({ LOW: 8, STANDARD: 12, PREMIUM: 17 });
    expect(stadiumCapacity(club.stadium)).toBe(STADIUM_CAPACITY[club.stadium.capacityLevel]);
  });

  it('settles a completed home fixture once and keeps an exact ledger', () => {
    const save = makeManagerSave(91);
    const fixture = homeFixture(save);
    fixture.played = true;
    fixture.resultKind = 'HOME_WIN';
    fixture.winnerTeamId = save.userTeamId;
    const budgetBefore = save.teams[save.userTeamId!].budget;

    const first = settleFixtureGate(save, fixture);
    const budgetAfterFirst = save.teams[save.userTeamId!].budget;
    const second = settleFixtureGate(save, fixture);
    const stadium = activeManagerClub(save)!.stadium;

    expect(first).toBeDefined();
    expect(first!.netReceipts).toBeGreaterThan(0);
    expect(budgetAfterFirst).toBe(budgetBefore + first!.netReceipts);
    expect(second).toBeUndefined();
    expect(save.teams[save.userTeamId!].budget).toBe(budgetAfterFirst);
    expect(
      stadium.attendanceHistory.filter((entry) => entry.fixtureId === fixture.id),
    ).toHaveLength(1);
    expect(stadium.settledFixtureIds.filter((id) => id === fixture.id)).toHaveLength(1);
  });

  it('keeps regular crowds below sell-outs and makes higher prices reduce attendance', () => {
    const save = makeManagerSave(911);
    const fixture = homeFixture(save);
    const club = activeManagerClub(save)!;
    const capacity = stadiumCapacity(club.stadium);
    club.stadium.fanBase = capacity * 3;

    const low = projectFixtureAttendance(save, fixture, 'LOW')!;
    const standard = projectFixtureAttendance(save, fixture, 'STANDARD')!;
    const premium = projectFixtureAttendance(save, fixture, 'PREMIUM')!;

    expect(standard.occupancy).toBeGreaterThanOrEqual(
      REGULAR_OCCUPANCY_RANGE.STANDARD.minimum,
    );
    expect(standard.occupancy).toBeLessThanOrEqual(
      REGULAR_OCCUPANCY_RANGE.STANDARD.maximum,
    );
    expect(low.attendance).toBeGreaterThan(standard.attendance);
    expect(premium.attendance).toBeLessThan(standard.attendance);
  });

  it('credits canonical instant/live result settlement without a synthetic season gate', () => {
    const save = makeManagerSave(92);
    const fixture = homeFixture(save);
    const before = save.teams[save.userTeamId!].budget;

    applyResult(save, runFixture(save, fixture.id));

    const entry = activeManagerClub(save)!.stadium.attendanceHistory.find(
      (item) => item.fixtureId === fixture.id,
    );
    expect(entry).toBeDefined();
    expect(save.teams[save.userTeamId!].budget).toBe(before + entry!.netReceipts);
  });

  it('presents the persistent club ground for a Manager home fixture', () => {
    const save = makeManagerSave(922);
    const fixture = homeFixture(save);
    const club = activeManagerClub(save)!;

    const venue = venueForFixture(save, fixture, 922);

    expect(venue.stadium.name).toBe(club.stadium.name);
    expect(venue.stadium.capacity).toBe(stadiumCapacity(club.stadium));
    expect(venue.stadium.id).toBe(`club-ground:${save.userTeamId}`);
  });

  it('reports the exact fixture ledger in season settlement', () => {
    const save = makeManagerSave(921);
    const fixture = homeFixture(save);
    applyResult(save, runFixture(save, fixture.id));
    const entry = activeManagerClub(save)!.stadium.attendanceHistory.find(
      (item) => item.fixtureId === fixture.id,
    )!;

    startNewSeason(save);

    expect(save.lastSeasonSettlement?.gateReceipts).toBe(entry.netReceipts);
    expect(save.finances?.lastGateReceipts).toBe(entry.netReceipts);
  });

  it('reconciles fixture gates and kit sponsorship without crediting either twice', () => {
    const save = makeManagerSave(923);
    save.sponsors = [];
    save.sponsorship = undefined;
    const fixture = homeFixture(save);
    const offer = sponsorshipOffers(save)[0];
    acceptSponsorshipOffer(save, offer.id);
    const budgetBeforeFixture = save.teams[save.userTeamId!].budget;
    const match = runFixture(save, fixture.id);
    applyResult(save, match);
    const userWon = match.result?.winnerTeamId === save.userTeamId;
    const expectedEarned = offer.appearancePayout + (userWon ? offer.winBonus : 0);
    const sponsor = settleFixtureSponsorship(save, fixture, {
      selected: true,
      userWon,
      managedTeamId: save.userTeamId,
    });
    expect(sponsor.earned).toBe(0);

    startNewSeason(save);

    const settlement = save.lastSeasonSettlement!;
    expect(settlement.previousBudget).toBe(budgetBeforeFixture);
    expect(settlement.kitSponsorIncome).toBe(expectedEarned);
    expect(settlement.broadcastIncome).toBe(settlement.sponsorIncome);
    expect(settlement.newBudget - settlement.previousBudget).toBe(
      settlement.leaguePrize +
        settlement.continentalPrize +
        settlement.broadcastIncome! +
        settlement.kitSponsorIncome! +
        settlement.gateReceipts -
        settlement.playerWages,
    );
  });

  it('never credits away fixtures or national duty', () => {
    const save = makeManagerSave(93);
    const opponent = opposingTeamId(save);
    const away: Fixture = {
      ...homeFixture(save),
      id: 'stadium-away-fixture',
      homeTeamId: opponent,
      awayTeamId: save.userTeamId!,
      played: true,
      resultKind: 'AWAY_WIN',
      winnerTeamId: save.userTeamId,
    };
    const budgetBefore = save.teams[save.userTeamId!].budget;

    expect(settleFixtureGate(save, away)).toBeUndefined();
    save.managerCareerLevel = 'NATIONAL';
    const nationalHome = {
      ...away,
      id: 'national-home-fixture',
      homeTeamId: save.userTeamId!,
      awayTeamId: opponent,
    };
    expect(settleFixtureGate(save, nationalHome)).toBeUndefined();
    expect(save.teams[save.userTeamId!].budget).toBe(budgetBefore);
  });

  it('treats a semifinal as a boosted home gate, never as a neutral final', () => {
    const save = makeManagerSave(94);
    const club = activeManagerClub(save)!;
    const opponent = opposingTeamId(save);
    const semifinal: Fixture = {
      ...homeFixture(save),
      id: 'mgr-2026-t20-league-t3-po-semi-final',
      homeTeamId: save.userTeamId!,
      awayTeamId: opponent,
      cupRound: 'T20 Semi-Final',
      playoff: true,
      stadiumId: 'mcg',
    };

    const projection = projectFixtureAttendance(save, semifinal, 'STANDARD')!;

    expect(projection.isNeutralFinal).toBe(false);
    expect(projection.capacity).toBe(stadiumCapacity(club.stadium));
    expect(projection.attendance).toBeGreaterThanOrEqual(Math.round(projection.capacity * 0.9));
    expect(projection.netReceipts).toBe(Math.round(projection.grossReceipts * 0.78));
  });

  it('retains semifinal identity after a real Manager knockout is generated', () => {
    const save = makeManagerSave(941);
    save.managerCalendar!.phase = 'LIST_A';
    for (const fixture of Object.values(save.fixtures)) {
      if (fixture.managerPhase !== 'LIST_A' || fixture.playoff) continue;
      fixture.played = true;
      fixture.winnerTeamId =
        fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId
          ? save.userTeamId
          : fixture.homeTeamId;
      fixture.resultKind = fixture.winnerTeamId === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
    }

    ensureManagerKnockouts(save);
    const semifinal = Object.values(save.fixtures).find(
      (fixture) =>
        fixture.playoff &&
        fixture.managerPhase === 'LIST_A' &&
        fixture.homeTeamId === save.userTeamId,
    )!;
    expect(semifinal.cupRound).toMatch(/Semi-Final/);

    const projection = projectFixtureAttendance(save, semifinal, 'STANDARD')!;
    const venue = venueForFixture(save, semifinal, 941);
    expect(projection.isNeutralFinal).toBe(false);
    expect(projection.attendance).toBeGreaterThanOrEqual(Math.round(projection.capacity * 0.9));
    expect(venue.stadium.name).toBe(activeManagerClub(save)!.stadium.name);
  });

  it('uses a neutral sell-out model and a 25% finalist share for the final', () => {
    const save = makeManagerSave(95);
    const opponent = opposingTeamId(save);
    const final: Fixture = {
      ...homeFixture(save),
      id: 'mgr-2026-t20-league-t3-po-final',
      homeTeamId: opponent,
      awayTeamId: save.userTeamId!,
      cupRound: 'T20 Final',
      playoff: true,
      stadiumId: undefined,
    };

    const projection = projectFixtureAttendance(save, final)!;

    expect(projection.isNeutralFinal).toBe(true);
    expect(projection.ticketPreset).toBe('STANDARD');
    expect(projection.attendance).toBe(Math.round(projection.capacity * 0.92));
    expect(projection.netReceipts).toBe(
      Math.round(Math.round(projection.grossReceipts * 0.78) * 0.25),
    );
  });

  it('spends club balance on upgrades and keeps tickets with the club', () => {
    const save = makeManagerSave(96);
    const club = activeManagerClub(save)!;
    const team = save.teams[save.userTeamId!];
    club.stadium.capacityLevel = 1;
    club.stadium.experienceLevel = 1;
    team.budget = 2_000_000;
    save.finances!.transferBudget = team.budget;
    const before = team.budget;

    const capacity = upgradeStadiumCapacity(save);
    const experience = upgradeMatchdayExperience(save);
    const tickets = setClubTicketPreset(save, 'T20', 'PREMIUM');

    expect(capacity).toMatchObject({ ok: true, cost: STADIUM_CAPACITY_UPGRADE_COST[2], level: 2 });
    expect(experience).toMatchObject({ ok: true, cost: 250_000, level: 2 });
    expect(team.budget).toBe(before - STADIUM_CAPACITY_UPGRADE_COST[2] - 250_000);
    expect(tickets).toBe(true);
    expect(activeManagerClub(save)!.stadium.ticketPresets.T20).toBe('PREMIUM');
    expect(save.finances!.transferBudget).toBe(team.budget);
  });
});
