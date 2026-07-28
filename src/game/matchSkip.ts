export type MatchDriveMode = 'WATCH' | 'KEY' | 'INSTANT' | null;

export type CareerSkipAction =
  | { kind: 'SKIP_TO_BATTING'; label: 'Skip to My Batting' }
  | { kind: 'SKIP_REST_OF_INNINGS'; label: 'Skip Rest of Innings' };

export interface CareerSkipState {
  mode?: 'career' | 'manager';
  driveMode: MatchDriveMode;
  hasCrease: boolean;
  userAtCrease: boolean;
  userDismissed: boolean;
  userTeamBatting: boolean;
  skipToBatActive: boolean;
  skipRestActive: boolean;
  /** False when the career player was not selected in the match XI. */
  userSelected?: boolean;
  /** False once a limited-overs match has moved beyond the user's batting innings. */
  userCanStillBat?: boolean;
}

export function careerSkipAction(state: CareerSkipState): CareerSkipAction | null {
  if (state.mode !== 'career') return null;
  if (state.driveMode === 'KEY' || state.driveMode === 'INSTANT') return null;
  if (!state.hasCrease || state.skipToBatActive || state.skipRestActive) return null;
  if (state.userSelected === false || state.userCanStillBat === false) return null;
  if (state.userAtCrease) return null;

  if (state.userDismissed) {
    if (!state.userTeamBatting) return null;
    return { kind: 'SKIP_REST_OF_INNINGS', label: 'Skip Rest of Innings' };
  }

  return { kind: 'SKIP_TO_BATTING', label: 'Skip to My Batting' };
}

/** Keep a single skip request alive when the user's batting innings comes next. */
export function continueSkipAfterInningsBreak(
  isTest: boolean,
  nextBattingTeamId: string,
  userTeamId?: string,
): boolean {
  return isTest || Boolean(userTeamId && nextBattingTeamId === userTeamId);
}
