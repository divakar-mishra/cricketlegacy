import fs from 'fs';
import path from 'path';
import { careerTabs } from '../../navigation/careerNavigation';

const source = (name: string) =>
  fs.readFileSync(path.join(__dirname, '..', `${name}Screen.tsx`), 'utf8');

describe('career navigation entry point coverage', () => {
  it('renders pathway and story content from the selectable Progress page, not an orphaned hub tab', () => {
    const hub = source('CareerHub');
    const progress = hub.slice(
      hub.indexOf('const renderProgressTab'),
      hub.indexOf('const renderProfileTab'),
    );
    expect(careerTabs('career', 'CareerHub').map((tab) => tab.key)).toContain('progress');
    expect(progress).toContain('{renderCareerPath()}');
    expect(progress).toContain('{renderCareerStory()}');
    expect(hub).not.toContain("case 'narrative':");
    expect(hub).toContain("navigation.navigate('InternationalCalendar')");
    expect(hub).toContain("navigation.navigate('U19WorldCup')");
    expect(hub).not.toContain('`🧢 Represent ${countryName}`');
  });
  it('targets the correct tab from both achievement buttons and Hall of Fame links', () => {
    const hub = source('CareerHub');
    const progress = hub.slice(
      hub.indexOf('const renderProgressTab'),
      hub.indexOf('const renderProfileTab'),
    );
    expect(progress.match(/navigate\('Records', \{ initialTab: 'achievements' \}\)/g)).toHaveLength(
      2,
    );
    expect(progress).toContain("navigation.navigate('Records', { initialTab: 'hof' })");
    expect(hub).toContain('View profile →');
  });
  it('puts medical, academy and wage links above the large Club Office cards', () => {
    const club = source('ClubOffice');
    const shortcuts = club.indexOf('<View style={styles.quickLinks}>');
    const ground = club.indexOf('<Text style={styles.section}>Home Ground</Text>');
    expect(shortcuts).toBeGreaterThan(-1);
    expect(shortcuts).toBeLessThan(ground);
    expect(club.slice(shortcuts, ground)).toContain('label="Medical Centre"');
    expect(club.slice(shortcuts, ground)).toContain('label="Youth Academy"');
    expect(club.slice(shortcuts, ground)).toContain('label="Wage Ledger"');
    expect(club.indexOf("save.managerCareerLevel === 'NATIONAL'")).toBeLessThan(shortcuts);
  });
  it.each([
    'CareerHub',
    'ManagerHub',
    'Records',
    'PlayerLife',
    'PlayerProfile',
    'Investment',
    'AcademyManagement',
    'ClubOffice',
    'ClubStadium',
    'WageBreakdown',
    'MedicalCentre',
    'Academy',
    'Squad',
    'Transfers',
    'StaffRecruitment',
    'ManagerLeadership',
    'InternationalCalendar',
    'U19WorldCup',
  ])(
    'preserves section navigation on %s rather than stranding the user inside a detail screen',
    (name) => {
      expect(source(name)).toMatch(/<Screen\b[^>]*\bcareerNavigation\b/);
    },
  );
  it('does not add section switching to the active match or payment screens', () => {
    expect(source('Match')).not.toContain('careerNavigation');
    expect(source('Purchase')).not.toContain('careerNavigation');
  });
  it.each(['CareerHub', 'PlayerLife', 'Records'])(
    'resets the %s scroll position when its selected tab changes',
    (name) => {
      expect(source(name)).toContain('scrollResetKey=');
    },
  );
});
