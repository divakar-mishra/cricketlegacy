import fs from 'fs';
import path from 'path';

describe('shared match presentation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

  it('retains a full multi-innings commentary archive and exposes the ball log', () => {
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
    expect(source).toContain('const liveViewVisible = fastMatchUi || matchView ===');
    expect(source).toContain('fastMatchUi && styles.scoreCardFast');
    expect(source).toContain('fastMatchUi && styles.liveCommentaryCardFast');
    expect(source).toContain("!fastMatchUi && graphics === 'high' && !threeDUnavailable");
    expect(source).toContain('speedMultRef.current === 1 || step.overComplete');
    expect(source).toContain('speedMultRef.current === 1 && ev.outcome');
  });

  it('uses 3D on high graphics with a 2D field fallback', () => {
    expect(source).toContain("!fastMatchUi && graphics === 'high' && !threeDUnavailable");
    expect(source).toContain('<StadiumScene3D');
    expect(source).toContain('<FieldView');
  });

  it('locks skip-to-batting after the first tap and hides irrelevant live missions', () => {
    expect(source).toContain('const [skipBusyLabel, setSkipBusyLabel]');
    expect(source).toContain('if (skipBusyRef.current) return;');
    expect(source).toContain('continueSkipAfterInningsBreak');
    expect(source).toContain('loading');
    expect(source).toContain('if (fastMatchUi) return null;');
    expect(source).toContain('if (!userInBatting && !met) return null;');
  });
});
