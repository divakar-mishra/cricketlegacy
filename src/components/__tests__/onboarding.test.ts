import fs from 'fs';
import path from 'path';

const onboardingSource = fs.readFileSync(path.join(__dirname, '..', 'Onboarding.tsx'), 'utf8');

describe('first-launch onboarding', () => {
  it('offers optional contextual coaching in a scrollable accessible welcome', () => {
    expect(onboardingSource).toContain('<ScrollView');
    expect(onboardingSource).not.toContain('style={styles.body} numberOfLines');
    expect(onboardingSource).toContain('label="Guide me"');
    expect(onboardingSource).toContain('label="Explore on my own"');
    expect(onboardingSource).toContain('SafeAreaView');
  });

  it('explains real controls and optional replay without a timed slideshow', () => {
    expect(onboardingSource).toContain('highlight the real controls');
    expect(onboardingSource).toContain('at your pace');
    expect(onboardingSource).toContain('replay a screen guide');
    expect(onboardingSource).not.toContain('setTimeout');
  });
});
