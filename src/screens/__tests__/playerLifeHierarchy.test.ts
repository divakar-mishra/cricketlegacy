import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'PlayerLifeScreen.tsx'), 'utf8');

describe('Player Life information hierarchy', () => {
  it('shows actionable kit offers before optional media activity', () => {
    expect(source).toContain("{ id: 'media', label: 'Kit & media'");
    expect(source).toContain('Review kit partnership offers');
    expect(source.indexOf("renderSectionTitle('Kit Partnership'")).toBeLessThan(
      source.indexOf("renderSectionTitle('Public profile'"),
    );
  });

  it('uses the main inbox and finance destinations without a duplicate phone menu', () => {
    expect(source).not.toContain('LEGACY PHONE');
    expect(source).not.toContain('Open Full Inbox');
    expect(source).not.toContain('PHONE_APPS');
    expect(source).toContain("{ id: 'finance', label: 'Finances'");
  });

  it('explains optional updates and keeps light-theme tab labels readable', () => {
    expect(source).toContain('Share a short update to grow your following and player brand.');
    expect(source).toContain('tabLabelActive: { color: colors.white }');
  });
});
