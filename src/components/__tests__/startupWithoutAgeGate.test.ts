import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../../App.tsx'), 'utf8');

test('startup navigation remains available with an age-only ad prompt', () => {
  expect(source).not.toContain('AgeEligibilityGate');
  expect(source).not.toContain('if (!ageDeclaration)');
  expect(source).toContain('<Onboarding />');
  expect(source).toContain('<AdAgePrompt />');
  expect(source).toContain('<AppIntegrityGate>');
});

test('startup does not infer adulthood from Google sign-in or guest play', () => {
  expect(source).not.toContain('ads.configureAds(MONETIZATION.admob, true)');
});
