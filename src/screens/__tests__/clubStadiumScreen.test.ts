import fs from 'fs';
import path from 'path';

const screensDir = path.join(__dirname, '..');
const stadium = fs.readFileSync(path.join(screensDir, 'ClubStadiumScreen.tsx'), 'utf8');
const clubOffice = fs.readFileSync(path.join(screensDir, 'ClubOfficeScreen.tsx'), 'utf8');
const screenExports = fs.readFileSync(path.join(screensDir, 'index.ts'), 'utf8');
const navigation = fs.readFileSync(path.join(screensDir, '..', 'navigation', 'index.ts'), 'utf8');
const app = fs.readFileSync(path.resolve(screensDir, '..', '..', 'App.tsx'), 'utf8');

describe('Club Stadium UI wiring', () => {
  it('registers a dedicated route and exposes it from Club Office', () => {
    expect(navigation).toContain('ClubStadium: undefined;');
    expect(screenExports).toContain("export { ClubStadiumScreen } from './ClubStadiumScreen';");
    expect(app).toContain('<Stack.Screen name="ClubStadium" component={ClubStadiumScreen} />');
    expect(clubOffice).toContain("navigation.navigate('ClubStadium')");
    expect(clubOffice).toContain('accessibilityLabel="Manage home ground"');
  });

  it('offers all approved presets across short, 50-over and first-class formats', () => {
    expect(stadium).toContain(
      "const TICKET_OPTIONS: TicketPreset[] = ['LOW', 'STANDARD', 'PREMIUM'];",
    );
    expect(stadium).toContain("linked: ['T10', 'T20', 'HUNDRED']");
    expect(stadium).toContain("linked: ['ODI']");
    expect(stadium).toContain("linked: ['TEST']");
    expect(stadium).toContain('setTicketPreset(format, preset)');
  });

  it('shows the next home attendance and gate forecast before the match', () => {
    expect(stadium).toContain('projectFixtureAttendance(save, fixture)');
    expect(stadium).toContain('Next home forecast');
    expect(stadium).toContain('PROJECTED GATE');
    expect(stadium).toContain('label="Attendance"');
    expect(stadium).toContain('label="Occupancy"');
  });

  it('blocks club commerce UI during national duty', () => {
    const nationalGuard = stadium.indexOf("save.managerCareerLevel === 'NATIONAL'");
    const activeClubLookup = stadium.indexOf('const club = activeManagerClub(save);');
    expect(nationalGuard).toBeGreaterThan(-1);
    expect(activeClubLookup).toBeGreaterThan(nationalGuard);
    expect(stadium).toContain('<Text style={styles.emptyTitle}>National duty</Text>');
    expect(stadium).not.toContain('Club stadium operations resume with a domestic job.');
    const officeNationalGuard = clubOffice.indexOf("save.managerCareerLevel === 'NATIONAL'");
    const officeActiveClubLookup = clubOffice.indexOf(
      'const stadiumClub = activeManagerClub(save);',
    );
    expect(officeNationalGuard).toBeGreaterThan(-1);
    expect(officeActiveClubLookup).toBeGreaterThan(officeNationalGuard);
  });

  it('requires confirmation before either club-balance upgrade', () => {
    expect(stadium).toMatch(/Alert\.alert\(\s*'Expand the ground\?'/);
    expect(stadium).toContain('const result = upgradeStadium();');
    expect(stadium).toContain("Alert.alert('Upgrade matchday?'");
    expect(stadium).toContain('const result = upgradeMatchday();');
    expect(stadium).toContain("{ text: 'Cancel', style: 'cancel' }");
  });
});
