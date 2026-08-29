import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'PlayerLifeScreen.tsx'), 'utf8');

describe('Player Life surface', () => {
  it('does not duplicate Training development tools or show the removed captain control centre', () => {
    expect(source).not.toContain("label: 'Development'");
    expect(source).not.toContain('const renderDevelopment');
    expect(source).not.toContain('Captain Control Centre');
    expect(source).not.toContain('prepareCaptainIssue');
  });
});
