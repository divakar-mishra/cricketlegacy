import fs from 'fs';
import path from 'path';

describe('CareerHub story preview copy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'CareerHubScreen.tsx'), 'utf8');

  it('keeps optional first-career help below the resolver-owned fixture action', () => {
    const home = source.slice(source.indexOf('const renderHomeTab'), source.indexOf('const renderStatsTab'));
    expect(home.indexOf('<GuideReplayButton chapter="player.home"')).toBeGreaterThan(home.indexOf('label={primaryActionLabel}'));
  });
  it('uses a scene-focused coach, not a background hub modal over results', () => {
    const guide = fs.readFileSync(path.join(__dirname, '../../components/CareerGuide.tsx'), 'utf8');
    expect(guide).toContain('const focused = useIsFocused()');
    expect(source).toContain("guide={{ chapter: 'player.home'");
    expect(source).not.toContain('<ModeGuideModal');
  });

  it('uses rendered story text instead of raw event placeholders on the home card', () => {
    expect(source).toContain('storyPreview?.title');
    expect(source).not.toContain('storyPreview?.speaker');
    expect(source).not.toContain('{storyPreview.event.title}');
    expect(source).not.toContain('{storyPreview.event.speaker}');
  });

  it('shows itemized reward and promotion details', () => {
    expect(source).toContain('Daily reward claimed');
    expect(source).toContain(
      'Coins: ${reward.previousCoins.toLocaleString()} -> ${reward.newCoins.toLocaleString()}',
    );
    expect(source).toContain('<RewardModal data={rewardModal}');
    expect(source).toContain('PROMOTED TO');
    expect(source).toContain('Next · {nextObjective}');
    expect(source).not.toContain('Training cap');
    expect(source).not.toContain('New competitions: {competitions}');
    expect(source).toContain('label="Wins" value={String(save.careerWins ?? 0)}');
    expect(source).toContain('label="Losses" value={String(save.careerLosses ?? 0)}');
    expect(source).toContain('label="Draws" value={String(save.careerDraws ?? 0)}');
  });

  it('surfaces milestone performances through the persistent newspaper scrapbook', () => {
    expect(source).toContain('mediaScrapbook');
    expect(source).toContain('pendingNewspaperId');
    expect(source).toContain('label={`Media Scrapbook · ${pressArchive.length}`}');
    expect(source).toContain("navigation.navigate('PlayerLife', { initialTab: 'media' })");
    expect(source).toContain('<NewspaperModal');
  });

  it('keeps the More menu focused on profile and personal actions', () => {
    expect(source).not.toContain('Squad & Tactics');
    expect(source).not.toContain('🔔 Inbox');
    expect(source).toContain('View Full Profile');
    expect(source).toContain('label="Records"');
    expect(source).toContain('label="Hall of Fame"');
  });

  it('keeps the spotlight, wallet and first content card visually separated', () => {
    expect(source).toContain('<View style={styles.walletSection}>');
    expect(source).toContain('<View style={styles.pageContent}>{renderPageContent()}</View>');
    expect(source).toContain('walletSection: { marginTop: spacing.md }');
    expect(source).toContain('pageContent: { marginTop: spacing.md }');
  });

  it('shows separate pathway, domestic and international competition records', () => {
    expect(source).toContain('Career by Competition');
    expect(source).toContain('CAREER_STAT_GROUPS.map');
    expect(source).toContain('CAREER_COMPETITION_STAT_LABELS[scope]');
    expect(source).toContain('user.competitionStats?.[scope]');
    expect(source).not.toContain('Competition totals are exact from the records update onward');
  });
});
