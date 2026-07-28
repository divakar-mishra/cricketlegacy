import {
  allowedCompetitionIds,
  checkManagerLevelPromotion,
  iccEventsForYear,
  initialManagerLevel,
} from '../managerCareer';
import { makeManagerSave } from './_depthHelpers';

describe('manager career ladder', () => {
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
        name: 'World Test Championship 2027',
        type: 'WORLD_TEST_CHAMPIONSHIP',
        format: 'TEST',
        teams: 8,
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
});
