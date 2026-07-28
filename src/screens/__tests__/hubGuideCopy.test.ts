import fs from 'fs';
import path from 'path';

const careerHubScreen = fs.readFileSync(path.join(__dirname, '..', 'CareerHubScreen.tsx'), 'utf8');
const managerHubScreen = fs.readFileSync(
  path.join(__dirname, '..', 'ManagerHubScreen.tsx'),
  'utf8',
);
const settingsScreen = fs.readFileSync(path.join(__dirname, '..', 'SettingsScreen.tsx'), 'utf8');
const settingsStore = fs.readFileSync(
  path.join(__dirname, '..', '..', 'state', 'settingsStore.ts'),
  'utf8',
);
const guideModal = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ModeGuideModal.tsx'),
  'utf8',
);

describe('mode hub guides', () => {
  it('shows a dismissible player career guide in the career hub', () => {
    expect(guideModal).toContain('{modeLabel.toUpperCase()} GUIDE');
    expect(careerHubScreen).toContain('career_hub_guide');
    expect(careerHubScreen).toContain('Train with a purpose');
    expect(careerHubScreen).toContain('Earn selection and progress');
    expect(careerHubScreen).toContain('modeLabel="Player Career"');
  });

  it('shows a dismissible manager career guide in the manager hub', () => {
    expect(guideModal).toContain('{modeLabel.toUpperCase()} GUIDE');
    expect(managerHubScreen).toContain('manager_hub_guide');
    expect(managerHubScreen).toContain('Recruit with evidence');
    expect(managerHubScreen).toContain(
      'Records tracks real results, finishes, trophies and legends produced.',
    );
    expect(managerHubScreen).toContain('modeLabel="Manager Career"');
  });

  it('lets players replay onboarding and dismissed mode guides', () => {
    expect(settingsScreen).toContain('Replay game guides');
    expect(settingsScreen).toContain('onPress={s.replayGuides}');
    expect(settingsStore).toContain(
      'replayGuides: () => set({ hasOnboarded: false, dismissedTips: [] })',
    );
  });
});
