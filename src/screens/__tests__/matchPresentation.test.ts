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
    expect(source).toContain('recentFeed.map((f) =>');
    expect(source).toContain('<View key={f.id} style={styles.feedRow}>');
    expect(source).toContain('numberOfLines={2}');
  });

  it('pauses simulation while commentary history is open', () => {
    expect(source).toContain('while (commentaryPauseRef.current && !cancelled.current)');
    expect(source).toContain('await waitForCommentaryClose()');
  });

  it('supports manual pause and keeps high-speed simulation readable', () => {
    expect(source).toContain('while (manualPauseRef.current && !cancelled.current)');
    expect(source).toContain('await waitForManualResume()');
    expect(source).toContain("accessibilityLabel={manualPaused ? 'Resume match' : 'Pause match'}");
    expect(source).toContain(
      "<Text style={styles.pauseControlText}>{manualPaused ? 'Resume' : 'Pause'}</Text>",
    );
    expect(source).toContain('key="live-match-pause"');
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

  it('lets Simulate Match finish immediately even when the live match is paused', () => {
    const simulateHandler = source.slice(
      source.indexOf('const onSimToEnd = () => {'),
      source.indexOf('const retrySettlementSave'),
    );

    expect(simulateHandler).toContain('instant.current = true');
    expect(simulateHandler).toContain('manualPauseRef.current = false');
    expect(simulateHandler).toContain('setManualPaused(false)');
    expect(simulateHandler).toContain('stancePauseRef.current = false');
    expect(simulateHandler).toContain('commentaryPauseRef.current = false');
    expect(simulateHandler).toContain('guidePauseRef.current = false');
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

  it('offers complete batting and bowling scorecards for every innings', () => {
    expect(source).toContain('View Full Scorecard');
    expect(source).toContain('<FullInningsScorecard');
    expect(source).toContain('.map((batter) => {');
    expect(source).toContain('.filter((bowler) => bowler.balls > 0)');
    expect(source).toContain("dismissal.type === 'CAUGHT'");
    expect(source).toContain('Extras');
    expect(source).toContain('Total');
  });

  it('applies the selected Premium Clubhouse Stadium Noir palette to the live field', () => {
    expect(source).toContain('stadiumTheme={save?.seasonPassExperience?.selectedStadiumTheme}');
    expect(fieldSource).toContain('NOIR: {');
    expect(fieldSource).toContain("outfield: '#050806'");
    expect(fieldSource).toContain("pitch: '#233D22'");
    expect(fieldSource).toContain("ring: '#B9F23D'");
    expect(fieldSource).toContain("stadiumTheme === 'stadium_noir'");
  });

  it('keeps the delivery, players and shot on one physical pitch axis', () => {
    expect(fieldSource).toContain('fieldGeometry(size)');
    expect(fieldSource).toContain('deliveryBouncePoint(size, lastShot?.delivery)');
    expect(fieldSource).toContain('fieldShotPath(size, lastShot)');
    expect(fieldSource).toContain('inputRange: [0, 0.3, 0.46, 0.74, 1]');
    expect(fieldSource).toContain('bowler.x - 5');
    expect(fieldSource).toContain('bounce.x - 5');
    expect(fieldSource).toContain('striker.x - 5');
    expect(fieldSource).toContain('shotEnd.x - 5');
    expect(fieldSource).toContain('d={deliveryPath}');
  });

  it('uses live match context for the upgraded stadium presentation', () => {
    expect(source).toContain('delivery: ev.delivery');
    expect(source).toContain('shot: ev.shot');
    expect(source).toContain('dismissalType: ev.dismissal?.type');
    expect(source).toContain('battingPrimaryColor={battingTeam?.primaryColor}');
    expect(source).toContain('fieldingPrimaryColor={bowlingTeam?.primaryColor}');
    expect(source).toContain('fieldSetting={visibleFieldSetting}');
    expect(source).toContain('conditions={liveConditions}');
    expect(fieldSource).toContain("role: 'fielder' | 'keeper' | 'bowler' | 'batter'");
    expect(fieldSource).toContain('const graphics = useSettings((state) => state.graphics)');
  });

  it('adds quality-scaled stadium atmosphere and endpoint feedback without extending a ball', () => {
    expect(fieldSource).toContain('const standAisles = useMemo(');
    expect(fieldSource).toContain('const floodlights = useMemo(');
    expect(fieldSource).toContain("graphics === 'high'");
    expect(fieldSource).toContain("lastShot?.tone === 'wicket'");
    expect(fieldSource).toContain('left: shotEnd.x - impactSize / 2');
    expect(fieldSource).toContain('opacity: impactPulseOpacity');
    expect(fieldSource).toContain('transform: [{ scale: stadiumPulseScale }]');
  });

  it('marks the user batter at the live striker or non-striker end', () => {
    expect(source).toContain('userBatterPosition={');
    expect(source).toContain('c.strikerId === userPlayerId');
    expect(source).toContain("? 'striker'");
    expect(source).toContain('c.nonStrikerId === userPlayerId');
    expect(source).toContain("? 'nonStriker'");
    expect(fieldSource).toContain("'YOU · ON STRIKE'");
    expect(fieldSource).toContain("'YOU · NON-STRIKER'");
    expect(fieldSource).toContain('stroke={colors.accentLight}');
    expect(fieldSource).toContain("'. Your player is on strike'");
    expect(fieldSource).toContain("'. Your player is the non-striker'");
  });

  it('tracks every delivery by its real over and exposes the moving next-ball slot', () => {
    expect(source).toContain('const liveOverRef = useRef<{ overNumber: number; dots: Dot[] }>');
    expect(source).toContain('previousOver.overNumber === ev.over');
    expect(source).toContain("legal: ev.outcome !== 'WD' && ev.outcome !== 'NB'");
    expect(source).toContain('Ball ${legalOverDots.length + 1} of ${ballsPerOver}');
    expect(source).toContain('next && styles.dotNext');
    expect(source).toContain('entering={dot ? FadeInDown.duration(180) : undefined}');
  });

  it('locks skip-to-batting after the first tap and hides irrelevant live missions', () => {
    expect(source).toContain('const [skipBusyLabel, setSkipBusyLabel]');
    expect(source).toContain(
      'setup?.controlledTeamId ?? lmRef.current?.controlledTeamId ?? save?.userTeamId',
    );
    expect(source).toContain("save.teams[userTeamId ?? '']?.xi");
    expect(source).not.toContain("save.teams[save.userTeamId ?? '']?.xi");
    expect(source).toContain('if (skipBusyRef.current) return;');
    expect(source).toContain('continueSkipAfterInningsBreak');
    expect(source).toContain('loading');
    expect(source).not.toContain('Your Mission');
    expect(source).not.toContain('missionCard');
  });

  it('requires manager preparation with concise analysis copy before play modes unlock', () => {
    expect(source).toContain('const [managerPreparationConfirmed, setManagerPreparationConfirmed]');
    expect(source).toContain("mode !== 'manager' || managerPreparationConfirmed");
    expect(source).not.toContain('Ratings /100 · green manageable · amber strong · red elite');
    expect(source).toContain('<PreparationRating label="Batting"');
    expect(source).toContain(
      "managerPreparationOpen ? 'Hide preparation details' : 'Review preparation'",
    );
    expect(source).not.toContain('Review the opponent, choose a plan and confirm preparation');
    expect(source).not.toContain('Opposition unit ratings are out of 100');
    expect(source).toContain('Apply Recommended Plan');
    expect(source).toContain('tacticSelectionSummary(managerReport.recommendedTactics)');
    expect(source).toContain('style={styles.fieldRestrictionCallout}');
    expect(source).toContain('{fieldRestriction(setup.format, 0).label}');
    expect(source).toContain('isFieldSettingLegal(o.value, setup.format, 0)');
    expect(source).not.toContain('fieldUnlockHint');
    expect(source).toContain('Unlock Full Analysis');
    expect(source).toContain('applyManagerPreparationToLiveMatch(activeSave, live.id, live)');
    expect(source).toContain('setSaveTactics(next, lmRef.current?.id)');
    expect(source).toContain('onPress={confirmManagerPreparation}');
    expect(source).not.toContain('onPress={() => setManagerPreparationConfirmed(true)}');
  });

  it('explains missing toss and preparation requirements beside a visibly disabled action', () => {
    expect(source).toContain('Choose Heads or Tails above to continue');
    expect(source).toContain('Confirm the match plan above to continue');
    expect(source).toContain('<Button label="Continue to Match" variant="secondary" disabled />');
    expect(source).toContain('styles.requirementText');
  });

  it('keeps concise disclosures for benched-player progression', () => {
    expect(source).toContain('Not selected · no personal objective.');
    expect(source).toContain('Not selected; train to regain form.');
    expect(source).not.toContain("line.includes('outside the XI')");
  });

  it('resets the result viewport so instant sim opens on the result card', () => {
    expect(source).toContain('scrollResetKey={`match-result:${result.fixtureId}`}');
    expect(source.indexOf('scrollResetKey={`match-result:${result.fixtureId}`}')).toBeLessThan(
      source.indexOf('<Card style={styles.resultCard}>'),
    );
  });

  it('uses the dismissible first-match guide without a live coach-card overlay', () => {
    expect(source).toContain('<FirstMatchGuide');
    expect(source).not.toContain('<CoachTip');
    expect(source).not.toContain('tipShownThisMatchRef');
  });
});
