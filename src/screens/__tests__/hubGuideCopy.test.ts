import fs from 'fs';
import path from 'path';
import { CAREER_GUIDES } from '../../content/careerGuides';
const read = (file: string) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
describe('interactive career coaching replaces standalone hub slides', () => {
  it.each(['CareerHub', 'ManagerHub'])('uses anchored controls in %s', screen => {
    const text = read(`screens/${screen}Screen.tsx`);
    expect(text).not.toContain('<ModeGuideModal');
    expect(text).toContain('<GuideReplayButton');
    expect(text).toContain('<GuideTarget id="next-step"');
  });
  it('makes Player customisation and training explicit Home destinations', () => {
    const source = read('screens/CareerHubScreen.tsx');
    expect(source).toContain('label="Customise player"');
    expect(source).toContain("navigation.navigate('PlayerCosmetics')");
    expect(CAREER_GUIDES['player.home'].some(s => s.target === 'training')).toBe(true);
  });
  it('can replay all chapter progress using the existing settings action', () => {
    expect(read('screens/SettingsScreen.tsx')).toContain('onPress={s.replayGuides}');
    expect(read('state/settingsStore.ts')).toContain('replayGuides: () => set({ hasOnboarded: false, dismissedTips: [] })');
    expect(read('components/CareerGuide.tsx')).toContain('replayCareerGuide(chapter');
  });
  it('has no timed guide advancement and never simulates a winning career result', () => {
    const source = read('components/CareerGuide.tsx');
    expect(source).not.toContain('setTimeout(advance');
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('simulateMatch');
    expect(read('screens/MatchScreen.tsx')).not.toContain('<FirstMatchGuide');
  });
});
