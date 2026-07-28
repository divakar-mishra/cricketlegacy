import { TEAM_BLUEPRINTS } from '../../content/teams';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { nextUserFixtureId, nextUserFixturesByCompetition } from '../season';
import { generateYouthFixtures } from '../youthFixtures';

function player(age: number) {
  return buildUserPlayer({
    name: 'Calendar Player',
    age,
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 65, timing: 65, power: 65, footwork: 65, temperament: 65, running: 65 },
    bowling: { paceOrSpin: 65, accuracy: 65, movement: 65, variations: 65, stamina: 65 },
    fielding: { catching: 65, throwing: 65, agility: 65, keeping: 20 },
    meta: { fitness: 65, confidence: 65, aggression: 60, discipline: 65 },
  });
}

describe('player career calendar', () => {
  it('splits U19 fixtures into List A followed by T20 blocks', () => {
    const save = createCareerSave({
      player: player(18),
      teamId: TEAM_BLUEPRINTS[0].id,
      difficulty: 'NORMAL',
      seed: 91,
    });
    const fixtures = generateYouthFixtures(save)
      .map((id) => save.fixtures[id])
      .sort((a, b) => a.round - b.round);

    expect(fixtures).toHaveLength(8);
    expect(fixtures.slice(0, 4).every((fixture) => fixture.format === 'ODI')).toBe(true);
    expect(fixtures.slice(4).every((fixture) => fixture.format === 'T20')).toBe(true);
    expect(fixtures[0].calendarMonth).toBe(9);
    expect(fixtures[4].calendarMonth).toBe(3);
  });

  it('gives senior domestic players List A, First-Class and T20 fixtures', () => {
    const save = createCareerSave({
      player: player(21),
      teamId: TEAM_BLUEPRINTS[0].id,
      difficulty: 'NORMAL',
      seed: 92,
    });
    const options = nextUserFixturesByCompetition(save);
    const season = save.seasons[save.currentSeasonId!];

    expect(options.map((option) => option.competitionId)).toEqual(['list-a']);
    expect(
      season.competitions
        ?.filter((competition) => competition.fixtureIds.length > 0)
        .map((competition) => competition.id),
    ).toEqual(['t20-league', 'list-a', 'first-class']);
    expect(save.fixtures[nextUserFixtureId(save)!].competitionId).toBe('list-a');
    expect(save.fixtures[options[0].fixtureId].calendarMonth).toBe(9);
    expect(
      save.fixtures[
        season.competitions!.find((competition) => competition.id === 'first-class')!.fixtureIds[0]
      ].calendarMonth,
    ).toBe(12);
    expect(
      save.fixtures[
        season.competitions!.find((competition) => competition.id === 't20-league')!.fixtureIds[0]
      ].calendarMonth,
    ).toBe(3);
  });
});
