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
  it('uses a real stadium asset without a repeating animation', () => {
    expect(spotlight).toContain("require('../../assets/generated/career-stadium.png')");
    expect(spotlight).not.toContain('withRepeat');
    expect(spotlight).not.toContain('useSharedValue');
    expect(spotlight).not.toContain('entering=');
    expect(spotlight).toContain('accessibilityRole="header"');
  });

  it('is shared by both career modes', () => {
    expect(playerHub).toContain('<CareerSpotlight');
    expect(playerHub).toContain('mode="player"');
    expect(managerHub).toContain('<CareerSpotlight');
    expect(managerHub).toContain('mode="manager"');
  });
});
