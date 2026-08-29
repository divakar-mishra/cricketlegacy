import fs from 'fs';
import path from 'path';

const matchScreen = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

describe('match back navigation guard', () => {
  it('wires Android hardware back to the active-match leave confirmation', () => {
    expect(matchScreen).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(matchScreen).toContain('Leaving restarts or forfeits this match.');
    expect(matchScreen).toContain('Stay in match');
    expect(matchScreen).toContain('Leave match');
    expect(matchScreen).toContain('leaveDialogOpen');
  });
});

describe('match commentary surface', () => {
  it('keeps one compact recent feed and the full archive accessible in the live match view', () => {
    expect(matchScreen).toContain('accessibilityLabel="Recent commentary"');
    expect(matchScreen).toContain('accessibilityLabel="Open ball-by-ball commentary"');
    expect(matchScreen).toContain('display.feed.slice(0, fastMatchUi ? 3 : 4)].reverse()');
    expect(matchScreen).not.toContain('styles.liveCommentaryCard');
    expect(matchScreen).toContain('<CommentaryArchive');
  });
});

describe('match modal pause guards', () => {
  it('pauses delivery progression behind stance, tactics, and DRS decisions', () => {
    expect(matchScreen).toContain('AppState.addEventListener');
    expect(matchScreen).toContain('appPausedRef.current');
    expect(matchScreen).toContain('await waitForAppActive()');
    expect(matchScreen).toContain('stancePauseRef.current && chosen ===');
    expect(matchScreen).toContain('await waitForStanceChoice()');
    expect(matchScreen).toContain('tacticsPauseRef.current && chosen ===');
    expect(matchScreen).toContain('await waitForTacticsClose()');
    expect(matchScreen).toContain('pendingReviewRef.current');
    expect(matchScreen).toContain('reviewResolver.current = resolve');
  });
});
