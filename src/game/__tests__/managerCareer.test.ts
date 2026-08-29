import {
  allowedCompetitionIds,
  checkManagerLevelPromotion,
  iccEventsForYear,
  initialManagerLevel,
  managerReputationBreakdown,
  updateManagerReputation,
} from '../managerCareer';
import { makeManagerSave } from './_depthHelpers';

describe('manager career ladder', () => {
  it('keeps a new Manager at the 66 reputation baseline before results exist', () => {
    const save = makeManagerSave();

    expect(managerReputationBreakdown(save)).toMatchObject({
      merit: 66,
      adBoost: 0,
      premiumBoost: 0,
      total: 66,
    });
  });

  it('starts ordinary new managers at Club and only fast-tracks proven player legends', () => {
    expect(initialManagerLevel({})).toBe('CLUB');
    expect(initialManagerLevel({ isLegendTransition: true, caps: 49, careerRuns: 7_999 })).toBe(
      'CLUB',
    );
    expect(initialManagerLevel({ isLegendTransition: true, caps: 50 })).toBe('STATE');
  });

  it('gates formats by earned level instead of allowing free level selection', () => {
    expect([...allowedCompetitionIds('CLUB')]).toEqual(['t20-league']);
    expect(allowedCompetitionIds('STATE')).toEqual(new Set(['t20-league', 'list-a']));
    expect(allowedCompetitionIds('ELITE')).toEqual(
      new Set(['t20-league', 'list-a', 'first-class']),
    );
    expect(allowedCompetitionIds('NATIONAL')).toEqual(
      new Set(['t20-league', 'list-a', 'first-class']),
    );
  });

  it('shows the World Test Championship in the national manager event cycle', () => {
    expect(iccEventsForYear(2027)).toEqual([
      expect.objectContaining({
        id: 'world-test-championship-2027',
        name: 'World Test Championship Final 2027',
        type: 'WORLD_TEST_CHAMPIONSHIP',
        format: 'TEST',
        teams: 2,
      }),
    ]);
  });

  it('requires results before promotion from Club', () => {
    const save = makeManagerSave();
    expect(checkManagerLevelPromotion(save)).toEqual({ promoted: false });
    for (const fixture of Object.values(save.fixtures)) {
      if (fixture.managerPhase !== 'T20' || fixture.divisionTier !== 3) continue;
      fixture.played = true;
      fixture.winnerTeamId =
        fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId
          ? save.userTeamId
          : fixture.homeTeamId;
      fixture.resultKind = fixture.winnerTeamId === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
    }
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.managerCalendar!.offSeasonPrepared = true;
    expect(checkManagerLevelPromotion(save)).toMatchObject({ promoted: true, to: 'STATE' });
  });

  it('builds free Manager reputation from experience, results and trophies', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'ELITE';
    save.careerSeasons = 25;
    save.careerWins = 300;
    save.careerLosses = 300;
    save.careerDraws = 20;
    save.leagueTitles = 5;
    save.cupWins = 3;
    save.continentalTitles = 2;

    const result = updateManagerReputation(save);

    expect(result.merit).toBeGreaterThanOrEqual(87);
    expect(result.merit).toBeLessThanOrEqual(88);
    expect(result.total).toBe(result.merit);
    expect(save.managerProgression?.reputation).toBe(result.total);
  });

  it('allows sustained ad engagement and multiple premium actions beyond the free ceiling', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'ELITE';
    save.careerSeasons = 25;
    save.careerWins = 300;
    save.careerLosses = 300;
    save.careerDraws = 20;
    save.leagueTitles = 5;
    save.cupWins = 3;
    save.continentalTitles = 2;
    for (let index = 0; index < 45; index += 1) {
      save.flags[`rewardTx:match-double:fixture-${index}`] = true;
    }
    save.managerProgression!.premiumAssistanceHistory = Array.from({ length: 7 }, (_, index) => ({
      id: `premium-${index}`,
      action: 'facility_upgrade_token',
      createdAt: index,
    }));

    const result = managerReputationBreakdown(save);

    expect(result.merit).toBe(88);
    expect(result.adBoost).toBe(3);
    expect(result.premiumBoost).toBe(7);
    expect(result.total).toBe(98);
  });

  it('offers the national job for sustained merit without requiring one specific title', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'ELITE';
    save.userDivision = 1;
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.managerCalendar!.offSeasonPrepared = true;
    save.managerCareerSeasons = 2;
    save.managerTitlesAtLevel = 1;
    save.managerTopFinishes = 1;
    save.managerProgression!.reputation = 73;
    save.managerWonTierOneFirstClass = false;

    expect(checkManagerLevelPromotion(save)).toMatchObject({
      promoted: true,
      to: 'NATIONAL',
    });
  });

  it('recognizes a sustained State trophy record without requiring one top-two T20 season', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'STATE';
    save.userDivision = 2;
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.managerCalendar!.offSeasonPrepared = true;
    save.managerCareerSeasons = 5;
    save.managerProgression!.reputation = 74;
    save.leagueTitles = 2;
    save.cupWins = 1;
    save.continentalTitles = 1;
    save.careerWins = 60;
    save.careerLosses = 50;
    save.careerDraws = 2;

    expect(checkManagerLevelPromotion(save)).toMatchObject({
      promoted: true,
      to: 'ELITE',
      reason: 'A sustained professional trophy record earns an elite appointment.',
    });
  });
});
