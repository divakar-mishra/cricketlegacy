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
});
