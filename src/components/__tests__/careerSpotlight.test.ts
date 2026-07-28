import fs from 'fs';
import path from 'path';

const spotlight = fs.readFileSync(path.join(__dirname, '..', 'CareerSpotlight.tsx'), 'utf8');
const playerHub = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'CareerHubScreen.tsx'),
  'utf8',
);
const managerHub = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'ManagerHubScreen.tsx'),
  'utf8',
);

describe('career hub spotlight', () => {
  it('uses a real stadium asset with graphics-aware restrained motion', () => {
    expect(spotlight).toContain("require('../../assets/generated/career-stadium.png')");
    expect(spotlight).toContain("graphics === 'high'");
    expect(spotlight).toContain('withRepeat');
    expect(spotlight).toContain('cancelAnimation');
    expect(spotlight).toContain('accessibilityRole="header"');
  });

  it('is shared by both career modes', () => {
    expect(playerHub).toContain('<CareerSpotlight');
    expect(playerHub).toContain('mode="player"');
    expect(managerHub).toContain('<CareerSpotlight');
    expect(managerHub).toContain('mode="manager"');
  });
});
