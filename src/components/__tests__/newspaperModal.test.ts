import fs from 'fs';
import path from 'path';

const modal = fs.readFileSync(path.join(__dirname, '..', 'NewspaperModal.tsx'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '..', '..', 'state', 'careerStore.ts'), 'utf8');

describe('newspaper sharing flow', () => {
  it('offers an explicit clipping action and captures only the clipping surface', () => {
    expect(modal).toContain('Share newspaper clipping');
    expect(modal).toContain('accessibilityLabel="Share newspaper clipping"');
    expect(modal).toContain('ref={paperRef} collapsable={false}');
    expect(modal).toContain('captureRef(paperRef.current');
    expect(modal).toContain('EVT.SHARE_NEWSPAPER');
  });

  it('places the existing game identity inside the captured clipping', () => {
    const captureStart = modal.indexOf('ref={paperRef}');
    const logo = modal.indexOf("require('../../assets/icon.png')");
    const visibleLogo = modal.indexOf('source={GAME_LOGO}');
    const gameName = modal.indexOf('CRICKET LEGACY', captureStart);

    expect(logo).toBeGreaterThanOrEqual(0);
    expect(visibleLogo).toBeGreaterThan(captureStart);
    expect(gameName).toBeGreaterThan(captureStart);
    expect(modal).toContain('accessibilityLabel="Cricket Legacy game logo"');
    expect(modal).toContain('compact && styles.headlineCompact');
    expect(modal).toContain('narrow && styles.subheadlineNarrow');
    expect(modal).toContain('style={styles.scroll}');
    expect(modal).toContain('scroll: { flexShrink: 1 }');
  });

  it('renders the verified score panel conditionally and adapts it on compact screens', () => {
    expect(modal).toContain('const scorePanel = newspaperScorePanel(story)');
    expect(modal).toContain('{scorePanel ? (');
    expect(modal).toContain('compact && styles.scorePanelCompact');
    expect(modal).toContain('compact && styles.resultCellCompact');
  });

  it('hides locally on the first close press before save persistence rerenders', () => {
    expect(modal).toContain('const [dismissedStoryId, setDismissedStoryId]');
    expect(modal).toContain('if (!story || dismissedStoryId === story.id) return null;');
    expect(modal).toContain('onPress={close}');
    expect(modal).toContain('setDismissedStoryId(story.id);');
    expect(modal).toContain('if (closingStoryRef.current === story.id) return;');
  });

  it('creates a fallback clipping for trophies settled through season simulation', () => {
    expect(store).toContain('buildTrophyNewspaperStory(save');
    expect(store).toContain("story.kind === 'TROPHY'");
    expect(store).toContain('missingTrophies');
  });
});
