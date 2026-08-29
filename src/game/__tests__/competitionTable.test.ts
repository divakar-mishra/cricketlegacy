import { buildUserPlayer, createCareerSave } from '../createGame';
import { activeCompetitionTable } from '../competitionTable';
import { applyResult, nextUserFixtureId, runFixture } from '../season';
import { makeManagerSave } from './_depthHelpers';

const ATTRIBUTES = {
  batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
  bowling: { paceOrSpin: 35, accuracy: 35, movement: 35, variations: 35, stamina: 45 },
  fielding: { catching: 55, throwing: 55, agility: 55, keeping: 40 },
  meta: { fitness: 60, confidence: 60, aggression: 55, discipline: 60 },
};

describe('active competition tables', () => {
  it('registers a Grade A win in its table instead of showing the untouched senior league', () => {
    const player = buildUserPlayer({
      name: 'Youth Batter',
      nationality: 'india',
      role: 'BATTER',
      battingStyle: 'RHB',
      age: 16,
      attrScale: 0.52,
      ...ATTRIBUTES,
    });
    const save = createCareerSave({
      player,
      teamId: 'mumbai_sharks',
      difficulty: 'NORMAL',
      seed: 601,
      format: 'T20',
    });
    const fixtureId = nextUserFixtureId(save)!;
    const match = runFixture(save, fixtureId);
    match.result = { winnerTeamId: save.careerPathTeamId, margin: 'Won by 5 wickets' };

    applyResult(save, match);

    const table = activeCompetitionTable(save);
    const userRow = table.rows.find((row) => row.teamId === save.careerPathTeamId);
    expect(table.title).toBe('Grade A Cricket Table');
    expect(table.highlightTeamId).toBe(save.careerPathTeamId);
    expect(userRow).toMatchObject({ played: 1, won: 1, lost: 0, points: 2 });
  });

  it('shows a manager result in the active T20 phase table', () => {
    const save = makeManagerSave(602);
    const fixtureId = nextUserFixtureId(save)!;
    const fixture = save.fixtures[fixtureId];
    const match = runFixture(save, fixtureId);
    match.result = { winnerTeamId: save.userTeamId, margin: 'Won by 12 runs' };

    applyResult(save, match);

    const table = activeCompetitionTable(save);
    const userRow = table.rows.find((row) => row.teamId === save.userTeamId);
    expect([fixture.homeTeamId, fixture.awayTeamId]).toContain(save.userTeamId);
    expect(table.title).toBe('T20 League Table');
    expect(userRow).toMatchObject({ played: 1, won: 1, lost: 0, points: 2 });
  });
});
