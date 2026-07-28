import fs from 'fs';
import path from 'path';

describe('CareerHub story preview copy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'CareerHubScreen.tsx'), 'utf8');

  it('uses rendered story text instead of raw event placeholders on the home card', () => {
    expect(source).toContain('storyPreview?.title');
    expect(source).toContain('storyPreview?.speaker');
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
    expect(source).toContain('Training cap');
    expect(source).toContain('New competitions: {competitions}');
    expect(source).toContain('label="Wins" value={String(save.careerWins ?? 0)}');
    expect(source).toContain('label="Losses" value={String(save.careerLosses ?? 0)}');
    expect(source).toContain('label="Draws" value={String(save.careerDraws ?? 0)}');
  });

  it('surfaces milestone performances through the persistent newspaper scrapbook', () => {
    expect(source).toContain('mediaScrapbook');
    expect(source).toContain('pendingNewspaperId');
    expect(source).toContain('{latestPress.headline}');
    expect(source).toContain('<NewspaperModal');
    expect(source).toContain('Media Scrapbook');
  });

  it('keeps the profile tab focused on profile-only actions', () => {
    expect(source).not.toContain('Squad & Tactics');
    expect(source).not.toContain('🔔 Inbox');
    expect(source).toContain('View Full Profile');
    expect(source).toContain('Records & Hall of Fame');
  });
});
