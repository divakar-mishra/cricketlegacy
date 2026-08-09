import fs from 'fs';
import path from 'path';

describe('shared match presentation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');
  const fieldSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components', 'FieldView.tsx'),
    'utf8',
  );

  it('retains one recent feed plus a full multi-innings commentary archive', () => {
    expect(source).toContain('const commentaryArchiveRef = useRef<FeedItem[]>([])');
    expect(source).toContain('commentaryArchiveRef.current.push(item)');
    expect(source).toContain('commentaryArchiveRef.current.length > 2400');
    expect(source).toContain('feed: [item, ...prev.feed].slice(0, 12)');
    expect(source).toContain('entries={commentaryEntries}');
    expect(source).toContain('accessibilityLabel="Open ball-by-ball commentary"');
    expect(source).toContain('<CommentaryArchive');
  });

  it('pauses simulation while commentary history is open', () => {
    expect(source).toContain('while (commentaryPauseRef.current && !cancelled.current)');
    expect(source).toContain('await waitForCommentaryClose()');
  });

  it('supports manual pause and keeps high-speed simulation readable', () => {
    expect(source).toContain('while (manualPauseRef.current && !cancelled.current)');
    expect(source).toContain('await waitForManualResume()');
    expect(source).toContain("label={manualPaused ? 'Resume' : 'Pause'}");
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('manualPaused && styles.pauseActive');
    expect(source).toContain('const showCinematic = speedMultRef.current === 1');
    expect(source).toContain('if (showCinematic) fireCelebration');
    expect(source).toContain('const fastMatchUi = speedMult > 1');
    expect(source).toContain('fastMatchUi && styles.scoreCardFast');
    expect(source).toContain('fastMatchUi && styles.midRowFast');
    expect(source).toContain('fastMatchUi && styles.feedFast');
    expect(source).toContain('renderCurrentStepRef.current');
    expect(source).toContain('speedMultRef.current === 1 || step.overComplete');
    expect(source).toContain('renderCurrentStepRef.current &&');
    expect(source).toContain('animate={!fastMatchUi}');
  });

  it('uses a stable 2D live field and keeps detailed views post-match', () => {
    expect(source).toContain('<FieldView');
    expect(source).not.toContain('<StadiumScene3D');
    expect(source).not.toContain('matchViewTabs');
    expect(source).toContain('<WagonWheel');
    expect(source).toContain('topBatters(inn)');
    expect(source).toContain('topBowlers(inn)');
    expect(source).toContain('manhattanData(match.innings[0])');
  });

  it('applies the selected Premium Clubhouse Stadium Noir palette to the live field', () => {
    expect(source).toContain('stadiumTheme={save?.seasonPassExperience?.selectedStadiumTheme}');
    expect(fieldSource).toContain(
      "NOIR: { outfield: '#050806', pitch: '#233D22', ring: '#B9F23D' }",
    );
    expect(fieldSource).toContain("stadiumTheme === 'stadium_noir'");
  });

  it('locks skip-to-batting after the first tap and hides irrelevant live missions', () => {
    expect(source).toContain('const [skipBusyLabel, setSkipBusyLabel]');
    expect(source).toContain('if (skipBusyRef.current) return;');
    expect(source).toContain('continueSkipAfterInningsBreak');
    expect(source).toContain('loading');
    expect(source).not.toContain('Your Mission');
    expect(source).not.toContain('missionCard');
  });

  it('requires manager preparation and explains opposition analysis before play modes unlock', () => {
    expect(source).toContain('Review the opponent, choose a plan and confirm preparation');
    expect(source).toContain('const [managerPreparationConfirmed, setManagerPreparationConfirmed]');
    expect(source).toContain("mode !== 'manager' || managerPreparationConfirmed");
    expect(source).toContain('Opposition unit ratings are out of 100');
    expect(source).toContain('Apply Recommended Plan');
    expect(source).toContain('Unlock Full Analysis');
  });

  it('uses the dismissible first-match guide without a live coach-card overlay', () => {
    expect(source).toContain('<FirstMatchGuide');
    expect(source).not.toContain('<CoachTip');
    expect(source).not.toContain('tipShownThisMatchRef');
  });
});
