import fs from 'fs';
import path from 'path';

const calendarScreen = fs.readFileSync(
  path.join(__dirname, '..', 'InternationalCalendarScreen.tsx'),
  'utf8',
);
const managerHub = fs.readFileSync(path.join(__dirname, '..', 'ManagerHubScreen.tsx'), 'utf8');

describe('international rankings presentation', () => {
  it('shows separate team tables for national managers', () => {
    expect(calendarScreen).toContain('World Team Rankings');
    expect(calendarScreen).toContain('internationalTeamRankings');
    expect(calendarScreen).toContain('>TEAM<');
    expect(calendarScreen).toContain('>RATING<');
    expect(managerHub).toContain("label: 'Rankings'");
    expect(managerHub).toContain("to: 'InternationalCalendar'");
  });

  it('shows format and discipline controls for capped players', () => {
    expect(calendarScreen).toContain('World Player Rankings');
    expect(calendarScreen).toContain("values={['TEST', 'ODI', 'T20']}");
    expect(calendarScreen).toContain("values={['BATTING', 'BOWLING', 'ALL_ROUNDER']}");
    expect(calendarScreen).toContain("entry.isUser ? ' (You)' : ''");
    expect(calendarScreen).toContain('CAREER BEST');
    expect(calendarScreen).toContain('selectedRankingPeak.bestRank');
    expect(calendarScreen).toContain('selectedRankingPeak.bestRating');
  });
});
