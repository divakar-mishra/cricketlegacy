import fs from 'fs';
import path from 'path';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('just-in-time guidance wiring', () => {
  const settings = read('SettingsScreen.tsx');
  const academy = read('CricketAcademyScreen.tsx');
  const careerHub = read('CareerHubScreen.tsx');
  const managerHub = read('ManagerHubScreen.tsx');
  const squad = read('SquadScreen.tsx');
  const transfers = read('TransfersScreen.tsx');

  it('opens a searchable four-tab handbook from Settings', () => {
    expect(settings).toContain("navigation.navigate('CricketAcademy')");
    expect(academy).toContain('searchGuidanceTopics');
    expect(academy).toContain('HANDBOOK_CATEGORIES');
    expect(academy).toContain('Search rules and mechanics');
  });

  it('attaches info buttons to every requested complex mechanic', () => {
    expect(transfers).toContain('topicId="scout-confidence"');
    expect(squad).toContain('topicId="tactical-modifiers"');
    expect(squad).toContain('topicId="first-class-over-rate"');
    expect(managerHub).toContain('topicId="board-grace"');
    expect(careerHub).toContain('topicId="selection-formula"');
    expect(careerHub).toContain('topicId="u19-readiness"');
    expect(managerHub).toContain('topicId="first-class-stamina"');
  });

  it('keeps hub guidance on demand instead of overlaying persistent coach cards', () => {
    expect(careerHub).not.toContain('ContextualMechanicTip');
    expect(managerHub).not.toContain('ContextualMechanicTip');
    expect(careerHub).not.toContain('career_u19_readiness');
    expect(managerHub).not.toContain('manager_board_grace');
    expect(careerHub).toContain('MechanicInfoButton');
    expect(managerHub).toContain('MechanicInfoButton');
  });
});
