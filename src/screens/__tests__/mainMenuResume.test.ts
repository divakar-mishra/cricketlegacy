import fs from 'fs';
import path from 'path';

const mainMenu = fs.readFileSync(path.join(__dirname, '..', 'MainMenuScreen.tsx'), 'utf8');

describe('main menu resume card', () => {
  it('uses a stable centered resume affordance instead of fragile offsets', () => {
    expect(mainMenu).toContain('styles.resumeButton');
    expect(mainMenu).toContain('Resume');
    expect(mainMenu).toContain('flexShrink: 0');
    expect(mainMenu).toContain('flexWrap:');
    expect(mainMenu).toContain('minHeight: 42');
    expect(mainMenu).toContain('continueWrapper: { marginBottom: spacing.lg }');
    expect(mainMenu).toContain('menu: { gap: spacing.sm, marginTop: spacing.md');
  });
});
