import { careerTrophyParticipationRate } from '../season';
import { emptyStats } from '../stats';
import { makeCareerSave } from './_depthHelpers';

describe('career trophy participation', () => {
  it('requires at least 40 percent of club matches', () => {
    const save = makeCareerSave();
    const clubFixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId,
    );
    clubFixtures.forEach((fixture) => {
      fixture.played = true;
    });
    const user = save.players[save.userPlayerId!];
    user.seasonStats = emptyStats();

    user.seasonStats!.matches = Math.ceil(clubFixtures.length * 0.4) - 1;
    expect(careerTrophyParticipationRate(save)).toBeLessThan(0.4);

    user.seasonStats!.matches = Math.ceil(clubFixtures.length * 0.4);
    expect(careerTrophyParticipationRate(save)).toBeGreaterThanOrEqual(0.4);
  });
});
