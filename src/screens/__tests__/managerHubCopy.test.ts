import fs from 'fs';
import path from 'path';

const managerHubScreen = fs.readFileSync(
  path.join(__dirname, '..', 'ManagerHubScreen.tsx'),
  'utf8',
);

describe('manager hub clarity', () => {
  it('removes the duplicate Club Identity band and keeps the next action clear', () => {
    expect(managerHubScreen).not.toContain('CLUB IDENTITY');
    expect(managerHubScreen).not.toContain('clubIdentityBand');
    expect(managerHubScreen).toContain('<CareerSpotlight');
    expect(managerHubScreen).toContain('mode="manager"');
    expect(managerHubScreen).toContain('numberOfLines={2}');
  });

  it('surfaces Legend backing as a compact hero signal', () => {
    expect(managerHubScreen).toContain('manager_legend_backing');
    expect(managerHubScreen).toContain('Legend backing');
  });

  it('explains that multi-format choices stay inside the earned manager level', () => {
    expect(managerHubScreen).toContain('Multi-Format Schedule');
    expect(managerHubScreen).toContain(
      'Promotion to State unlocks both List A and First-Class cricket',
    );
    expect(managerHubScreen).toContain('they do not change your team or bypass the manager');
  });

  it('bases Squad Conditioning prompts on match condition', () => {
    expect(managerHubScreen).toContain('Average condition:');
    expect(managerHubScreen).toContain('Underlying fitness: +20');
    expect(managerHubScreen).toContain('players have low match condition');
    expect(managerHubScreen).not.toContain('players are low on fitness');
  });
});
