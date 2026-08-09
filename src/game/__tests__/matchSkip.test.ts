import { careerSkipAction, continueSkipAfterInningsBreak } from '../matchSkip';

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
  it('shows Skip to My Batting before the user reaches the crease', () => {
    expect(careerSkipAction(base)).toEqual({
      kind: 'SKIP_TO_BATTING',
      label: 'Skip to My Batting',
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

  it('shows an innings-only skip while the opponent is batting', () => {
    expect(careerSkipAction({ ...base, userDismissed: true, userTeamBatting: false })).toEqual({
      kind: 'SKIP_BOWLING_INNINGS',
      label: 'Skip Bowling Innings',
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
});
