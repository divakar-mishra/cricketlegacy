import fs from 'fs';
import path from 'path';

const modal = fs.readFileSync(path.join(__dirname, '..', 'NewspaperModal.tsx'), 'utf8');
const store = fs.readFileSync(
  path.join(__dirname, '..', '..', 'state', 'careerStore.ts'),
  'utf8',
);

describe('newspaper sharing flow', () => {
  it('offers an explicit social story action and captures only the clipping surface', () => {
    expect(modal).toContain('Share to WhatsApp / Instagram Story');
    expect(modal).toContain('accessibilityLabel="Share to WhatsApp or Instagram Story"');
    expect(modal).toContain('ref={paperRef} collapsable={false}');
    expect(modal).toContain('captureRef(paperRef.current');
    expect(modal).toContain('EVT.SHARE_NEWSPAPER');
  });

  it('creates a fallback clipping for trophies settled through season simulation', () => {
    expect(store).toContain('buildTrophyNewspaperStory(save');
    expect(store).toContain("story.kind === 'TROPHY'");
    expect(store).toContain('missingTrophies');
  });
});
