import fs from 'fs';
import path from 'path';

const onboardingSource = fs.readFileSync(path.join(__dirname, '..', 'Onboarding.tsx'), 'utf8');

describe('first-launch onboarding', () => {
  it('keeps a full introduction flow with explicit navigation and skip controls', () => {
    expect(onboardingSource.match(/title: '/g)).toHaveLength(5);
    expect(onboardingSource).toContain('<ScrollView');
    expect(onboardingSource).toContain('onTouchStart={handleTouchStart}');
    expect(onboardingSource).toContain('onTouchEnd={handleTouchEnd}');
    expect(onboardingSource).toContain('showsVerticalScrollIndicator={false}');
    expect(onboardingSource).not.toContain('style={styles.body} numberOfLines');
    expect(onboardingSource).toContain('dx <= -48');
    expect(onboardingSource).toContain('dx >= 48');
    expect(onboardingSource).toContain('label="Previous"');
    expect(onboardingSource).toContain("label={last ? \"Let's play\" : 'Next'}");
    expect(onboardingSource).toContain('accessibilityLabel="Skip intro"');
    expect(onboardingSource).toContain('SafeAreaView');
  });

  it('uses concise slide copy while keeping the core actions', () => {
    expect(onboardingSource).toContain('Choose your batting stance and bowling plan.');
    expect(onboardingSource).toContain('Train, earn your place and rise through selection.');
    expect(onboardingSource).toContain('Shape the squad, tactics and future of the club.');
    expect(onboardingSource).toContain('Daily Rewards & Season Pass');
    expect(onboardingSource).toContain('Complete challenges and claim rewards.');
    expect(onboardingSource).not.toContain('fight for your XI place');
  });
});
