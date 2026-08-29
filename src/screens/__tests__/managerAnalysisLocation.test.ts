import fs from 'fs';
import path from 'path';

const screensDir = path.join(__dirname, '..');
const matchScreen = fs.readFileSync(path.join(screensDir, 'MatchScreen.tsx'), 'utf8');
const clubOffice = fs.readFileSync(path.join(screensDir, 'ClubOfficeScreen.tsx'), 'utf8');
const managerHub = fs.readFileSync(path.join(screensDir, 'ManagerHubScreen.tsx'), 'utf8');

describe('manager match analysis location', () => {
  it('offers the paid fixture analysis from Matchday', () => {
    expect(matchScreen).toContain("runManagerResource('MATCH_ANALYSIS', lmRef.current?.id)");
    expect(matchScreen).toContain('Unlock Full Analysis');
    expect(matchScreen).toContain('MANAGER_MATCH_ANALYSIS_COINS');
    expect(matchScreen).not.toContain('Unlock named threats, a recommended plan');
  });

  it('keeps the fixture-scoped Emergency Team Talk on Matchday', () => {
    expect(matchScreen).toContain("runManagerResource('EMERGENCY_TEAM_TALK', lmRef.current?.id)");
    expect(matchScreen).toContain('MANAGER_EMERGENCY_TEAM_TALK_COINS');
    expect(matchScreen).not.toContain('Lift the three lowest-morale players.');
    expect(matchScreen).toContain('managerTeamTalkUsed');
  });

  it('does not expose the manager match-analysis action on any other screen', () => {
    const otherScreenFiles = fs
      .readdirSync(screensDir)
      .filter((file) => file.endsWith('Screen.tsx') && file !== 'MatchScreen.tsx');

    for (const file of otherScreenFiles) {
      const source = fs.readFileSync(path.join(screensDir, file), 'utf8');
      expect(source).not.toMatch(/\bMATCH_ANALYSIS\b/);
      expect(source).not.toContain('MANAGER_MATCH_ANALYSIS_COINS');
    }

    expect(managerHub).not.toMatch(/opposition analysis/i);
  });

  it('keeps the other Club Office resource action intact', () => {
    expect(clubOffice).not.toContain('Opposition Analysis');
    expect(clubOffice).toContain("runManagerResource('ELITE_STAFF_SEARCH')");
    expect(clubOffice).toContain('Elite Staff Search');
  });
});
