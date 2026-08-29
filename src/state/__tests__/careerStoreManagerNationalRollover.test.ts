import type { SaveGame } from '../../domain/types';

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { makeManagerSave } = jest.requireActual<typeof import('../../game/__tests__/_depthHelpers')>(
  '../../game/__tests__/_depthHelpers',
);
const { buildManagerSeasonCalendar, nextManagerUserFixtureId } = jest.requireActual<
  typeof import('../../game/managerCalendar')
>('../../game/managerCalendar');
const { isInternationalFixture } =
  jest.requireActual<typeof import('../../game/intlCalendar')>('../../game/intlCalendar');
const { ensureSponsorshipState } =
  jest.requireActual<typeof import('../../game/sponsorship')>('../../game/sponsorship');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

function markCalendarComplete(save: SaveGame): void {
  for (const fixture of Object.values(save.fixtures)) {
    fixture.played = true;
    fixture.winnerTeamId = fixture.homeTeamId;
    fixture.resultKind = 'HOME_WIN';
  }
  save.managerCalendar!.phase = 'OFF_SEASON';
  save.managerCalendar!.phaseStartedAtMonth = 6;
  save.managerCalendar!.offSeasonPrepared = true;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Manager National season rollover isolation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCareer.setState({
      save: null,
      ref: null,
      pendingAchievementIds: [],
      lastPromotion: null,
      persistenceError: null,
      persist: originalPersist,
      persistCritical: originalPersistCritical,
    });
  });

  it('settles the final ELITE club season exactly once before building the National calendar', () => {
    const save = makeManagerSave(9_101);
    const clubId = save.userTeamId!;
    const club = save.teams[clubId];
    save.managerCareerLevel = 'ELITE';
    save.userDivision = 1;
    buildManagerSeasonCalendar(save, 2026, 'OFF_SEASON');
    markCalendarComplete(save);
    save.managerWonTierOneFirstClass = true;
    save.academy!.nextIntakeYear = 2027;
    const contractPlayerId = club.playerIds[0];
    save.players[contractPlayerId].contract = { wage: 100_000, yearsLeft: 3 };
    useCareer.getState().setActive(save, 'manager', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    useCareer.getState().newSeason();

    const rolled = useCareer.getState().save!;
    expect(rolled.managerCareerLevel).toBe('NATIONAL');
    expect(rolled.managerCareerSeasons).toBe(0);
    expect(rolled.managerCalendar?.year).toBe(2027);
    expect(
      rolled.seasons[rolled.currentSeasonId!].competitions?.some((competition) =>
        competition.id.includes('2027'),
      ),
    ).toBe(true);
    expect(rolled.lastSeasonSettlement?.year).toBe(2026);
    expect(rolled.lastSeasonSettlement?.staffWages).toBeGreaterThan(0);
    expect(rolled.lastSeasonSettlement?.facilityUpkeep).toBeGreaterThan(0);
    const settlement = rolled.lastSeasonSettlement!;
    expect(rolled.teams[clubId].budget).toBe(
      settlement.previousBudget +
        settlement.gateReceipts +
        (settlement.kitSponsorIncome ?? 0) +
        settlement.leaguePrize +
        settlement.continentalPrize +
        (settlement.broadcastIncome ?? settlement.sponsorIncome) -
        settlement.playerWages -
        settlement.staffWages -
        settlement.facilityUpkeep,
    );
    expect(rolled.players[contractPlayerId].contract?.yearsLeft).toBe(2);
  });

  it('advances a full National year without mutating or re-reporting the retained club', () => {
    const save = makeManagerSave(9_102);
    const clubId = save.userTeamId!;
    const club = save.teams[clubId];
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2027, 'OFF_SEASON');
    markCalendarComplete(save);
    save.lastSeasonSettlement = {
      year: 2026,
      leaguePosition: 2,
      leaguePrize: 100_000,
      continentalPrize: 0,
      sponsorIncome: 210_000,
      broadcastIncome: 210_000,
      kitSponsorIncome: 80_000,
      playerWages: 120_000,
      gateReceipts: 50_000,
      staffWages: 40_000,
      facilityUpkeep: 30_000,
      previousBudget: club.budget - 250_000,
      newBudget: club.budget,
    };
    save.boardConfidence = 88;
    save.boardObjective = { year: 2027, targetPosition: 2, met: true };
    save.flags.sacked = true;
    save.managerJobOffer = {
      teamId: 'retained-offer',
      clubName: 'Retained Offer',
      reputation: 91,
      salaryPromise: 1_200_000,
      reason: 'Existing offer must not be replaced during National duty.',
    };
    save.leagueTitles = 4;
    save.continentalTitles = 2;
    save.bestLeaguePos = 1;
    save.leagues[Object.keys(save.leagues)[0]].table[0].played = 17;
    save.leagues[Object.keys(save.leagues)[0]].table[0].points = 29;
    const sponsor = ensureSponsorshipState(save);
    sponsor.earnedThisSeason = 73_000;
    sponsor.premiumThisSeason = 55_000;
    sponsor.earnedSeasonId = save.currentSeasonId;
    sponsor.activeEarned = {
      id: 'retained-club-deal',
      mode: 'manager',
      label: 'All formats',
      scope: 'ALL_FORMATS',
      fixtureQuota: 20,
      appearancePayout: 28_000,
      winBonus: 0,
      signingBonus: 0,
      termSeasonRollovers: 2,
      paymentDestination: 'CLUB_BALANCE',
      signedStature: 'ELITE',
      acceptedSeasonId: 'season-2026',
      acceptedAt: 1,
      paidFixtureIds: ['old-fixture'],
      paidFixtures: 1,
      paidWins: 0,
      seasonRollovers: 0,
      totalPaid: 28_000,
      status: 'ACTIVE',
      boundTeamId: clubId,
    };
    useCareer.getState().setActive(save, 'manager', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    const active = useCareer.getState().save!;
    const activeClub = active.teams[clubId];
    const clubPlayerIds = [...activeClub.playerIds];
    const clubBefore = clone(activeClub);
    const playersBefore = Object.fromEntries(
      clubPlayerIds.map((playerId) => [playerId, clone(active.players[playerId])]),
    );
    const managerClubBefore = clone(active.managerClubs![clubId]);
    const compatibilityClubStateBefore = clone({
      staff: active.staff,
      staffCandidates: active.staffCandidates,
      facilities: active.facilities,
      academy: active.academy,
      scoutReports: active.scoutReports,
      trainingFocus: active.trainingFocus,
    });
    const financesBefore = clone(active.finances);
    const settlementBefore = clone(active.lastSeasonSettlement);
    const sponsorBefore = clone(active.sponsorship);
    const divisionsBefore = clone(active.divisions);
    const leaguesBefore = clone(active.leagues);
    const boardBefore = clone(active.boardObjective);
    const managerStoryBefore = clone(active.managerStory);
    const managerJobOfferBefore = clone(active.managerJobOffer);
    const clubTitlesBefore = {
      league: active.leagueTitles,
      continental: active.continentalTitles,
      bestPosition: active.bestLeaguePos,
    };
    const careerSeasonsBefore = active.careerSeasons ?? 0;
    const levelSeasonsBefore = active.managerCareerSeasons ?? 0;

    useCareer.getState().newSeason();

    const rolled = useCareer.getState().save!;
    expect(rolled.managerCareerLevel).toBe('NATIONAL');
    expect(rolled.managerCalendar?.year).toBe(2028);
    expect(rolled.currentSeasonId).toBe('season-2028');
    expect(
      rolled.seasons[rolled.currentSeasonId!].competitions?.some((competition) =>
        competition.id.includes('2028'),
      ),
    ).toBe(true);
    const nextNationalFixtureId = nextManagerUserFixtureId(rolled);
    expect(nextNationalFixtureId).toBeDefined();
    expect(isInternationalFixture(rolled.fixtures[nextNationalFixtureId!])).toBe(true);
    expect(rolled.careerSeasons).toBe(careerSeasonsBefore + 1);
    expect(rolled.managerCareerSeasons).toBe(levelSeasonsBefore + 1);

    expect(rolled.teams[clubId]).toEqual(clubBefore);
    expect(
      Object.fromEntries(clubPlayerIds.map((playerId) => [playerId, rolled.players[playerId]])),
    ).toEqual(playersBefore);
    expect(rolled.managerClubs![clubId]).toEqual(managerClubBefore);
    expect({
      staff: rolled.staff,
      staffCandidates: rolled.staffCandidates,
      facilities: rolled.facilities,
      academy: rolled.academy,
      scoutReports: rolled.scoutReports,
      trainingFocus: rolled.trainingFocus,
    }).toEqual(compatibilityClubStateBefore);
    expect(rolled.finances).toEqual(financesBefore);
    expect(rolled.lastSeasonSettlement).toEqual(settlementBefore);
    expect(rolled.sponsorship).toEqual(sponsorBefore);
    expect(rolled.divisions).toEqual(divisionsBefore);
    expect(rolled.leagues).toEqual(leaguesBefore);
    expect(rolled.boardObjective).toEqual(boardBefore);
    expect(rolled.boardConfidence).toBe(88);
    expect(rolled.flags.sacked).toBe(true);
    expect(rolled.managerJobOffer).toEqual(managerJobOfferBefore);
    expect({
      league: rolled.leagueTitles,
      continental: rolled.continentalTitles,
      bestPosition: rolled.bestLeaguePos,
    }).toEqual(clubTitlesBefore);
    expect(rolled.managerStory).toEqual(managerStoryBefore);
  });
});
