import fs from 'fs';
import path from 'path';

const readComponent = (name: string) =>
  fs.readFileSync(path.join(__dirname, '..', `${name}.tsx`), 'utf8');

describe('popup contrast', () => {
  const starterPack = readComponent('StarterPackModal');
  const contextualOffer = readComponent('ContextualOffer');
  const onboarding = readComponent('Onboarding');
  const firstMatchGuide = readComponent('FirstMatchGuide');

  it('uses primary actions instead of gold-filled buttons inside popups', () => {
    for (const source of [starterPack, contextualOffer, onboarding]) {
      expect(source).not.toContain('variant="gold"');
      expect(source).toContain('variant="primary"');
    }
  });

  it('keeps the starter offer on a dark surface with an outlined gold badge', () => {
    expect(starterPack).toContain("backgroundColor: '#0F241A'");
    expect(starterPack).toContain("backgroundColor: '#17211B'");
    expect(starterPack).toContain("color: '#D5B56D'");
    expect(starterPack).not.toContain("backgroundColor: '#D5B56D'");
    expect(starterPack).toContain('{ color: colors.textMuted }');
    expect(starterPack).not.toContain('{ color: colors.textFaint }');
  });

  it('keeps the first-match guide dark and uses green for its active action', () => {
    expect(firstMatchGuide).toContain('backgroundColor: colors.bgElevated');
    expect(firstMatchGuide).toContain('backgroundColor: colors.primary');
    expect(firstMatchGuide).not.toContain('backgroundColor: colors.accent');
    expect(firstMatchGuide).not.toContain('intensity={0.95} highlighted');
  });
});
