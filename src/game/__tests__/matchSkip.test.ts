import { careerSkipAction, continueSkipAfterInningsBreak } from '../matchSkip';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { createLiveMatch, nextUserFixtureId } from '../season';

const base = {
  mode: 'career' as const,
  driveMode: 'WATCH' as const,
  hasCrease: true,
  userAtCrease: false,
  userDismissed: false,
  userTeamBatting: true,
  skipToBatActive: false,
  skipRestActive: false,
};

describe('career match skip actions', () => {
  it('shows Skip to my batting before the user reaches the crease', () => {
    expect(careerSkipAction(base)).toEqual({
      kind: 'SKIP_TO_BATTING',
      label: 'Skip to my batting',
    });
  });

  it('hides skip while the user is batting', () => {
    expect(careerSkipAction({ ...base, userAtCrease: true })).toBeNull();
  });

  it('shows Skip Rest of Innings after the user is dismissed in their team innings', () => {
    expect(careerSkipAction({ ...base, userDismissed: true })).toEqual({
      kind: 'SKIP_REST_OF_INNINGS',
      label: 'Skip Rest of Innings',
    });
  });

  it('keeps skip-to-batting active while the opponent is batting first', () => {
    expect(careerSkipAction({ ...base, userDismissed: true, userTeamBatting: false })).toEqual({
      kind: 'SKIP_TO_BATTING',
      label: 'Skip to my batting',
    });
  });

  it('hides skip actions in key-moment or manager modes', () => {
    expect(careerSkipAction({ ...base, driveMode: 'KEY' })).toBeNull();
    expect(careerSkipAction({ ...base, mode: 'manager' })).toBeNull();
  });

  it('hides batting skip when the player was not selected or their innings has passed', () => {
    expect(careerSkipAction({ ...base, userSelected: false })).toBeNull();
    expect(careerSkipAction({ ...base, userCanStillBat: false })).toBeNull();
  });

  it('keeps one skip request active when the user batting innings starts next', () => {
    expect(continueSkipAfterInningsBreak(false, 'user-team', 'user-team')).toBe(true);
    expect(continueSkipAfterInningsBreak(false, 'opponent', 'user-team')).toBe(false);
    expect(continueSkipAfterInningsBreak(true, 'opponent', 'user-team')).toBe(true);
  });

  it('offers the batting skip for a pure batter in a School pathway XI', () => {
    const player = buildUserPlayer({
      name: 'School Batter',
      nationality: 'india',
      age: 15,
      role: 'BATTER',
      battingStyle: 'RHB',
      bowlingStyle: 'PACE',
      batting: {
        technique: 70,
        timing: 70,
        power: 65,
        footwork: 68,
        temperament: 65,
        running: 65,
      },
      bowling: { paceOrSpin: 25, accuracy: 25, movement: 25, variations: 25, stamina: 40 },
      fielding: { catching: 55, throwing: 50, agility: 55, keeping: 20 },
      meta: { fitness: 60, confidence: 60, aggression: 55, discipline: 65 },
    });
    const save = createCareerSave({
      player,
      teamId: 'mumbai_sharks',
      difficulty: 'NORMAL',
      seed: 17,
      format: 'T20',
    });
    const fixtureId = nextUserFixtureId(save);
    expect(fixtureId).toBeDefined();
    const live = createLiveMatch(save, fixtureId!, player.id);

    expect(live.controlledTeamId).toBe(save.careerPathTeamId);
    expect(live.controlledTeamId).not.toBe(save.userTeamId);
    expect(save.teams[live.controlledTeamId!].xi).toContain(player.id);
    expect(
      careerSkipAction({
        ...base,
        userTeamBatting: false,
        userSelected: save.teams[live.controlledTeamId!].xi?.includes(player.id),
      }),
    ).toEqual({ kind: 'SKIP_TO_BATTING', label: 'Skip to my batting' });
  });
});
