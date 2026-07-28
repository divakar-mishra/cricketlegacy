import fs from 'fs';
import path from 'path';

describe('MatchScreen batting controls', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

  it('shows career batting controls only when the controlled player is at the crease', () => {
    expect(source).toContain('const controlledPlayerAtCrease =');
    expect(source).toContain(
      "mode === 'career' && role === 'BATTING' && controlledPlayerAtCrease && driveMode !== 'KEY'",
    );
  });

  it('shows the first-match stance guide only after the controlled player reaches the crease', () => {
    expect(source).toContain('controlledPlayerAtCrease &&');
    expect(source).toContain('<FirstMatchGuide');
  });

  it('does not keep the match paused for a stale stance picker when no intent is needed', () => {
    expect(source).toContain('if (!lm.needsIntent()) {');
    expect(source).toContain('closeStancePicker();');
    expect(source).toContain('if (nextBatting && lm.needsIntent()) openStancePicker();');
  });
});
