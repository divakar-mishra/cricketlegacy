import fs from 'fs';
import path from 'path';

const matchScreen = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

describe('match back navigation guard', () => {
  it('wires Android hardware back to the active-match leave confirmation', () => {
    expect(matchScreen).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(matchScreen).toContain('Leaving now will restart or forfeit the current match. Are you sure you want to leave?');
    expect(matchScreen).toContain('Stay in match');
    expect(matchScreen).toContain('Leave match');
    expect(matchScreen).toContain('leaveDialogOpen');
  });
});

describe('match commentary surface', () => {
  it('keeps latest and recent commentary accessible in the live match view', () => {
    expect(matchScreen).toContain('Latest commentary ${display.feed[0].label}: ${display.feed[0].text}');
    expect(matchScreen).toContain('accessibilityLabel="Recent commentary"');
    expect(matchScreen).toContain('styles.liveCommentaryCard');
    expect(matchScreen).toContain('display.feed.slice(0, 4).map');
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
