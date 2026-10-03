import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../../App.tsx'), 'utf8');

test('startup navigation waits for the declared game-eligibility age choice', () => {
  expect(source).not.toContain('AgeEligibilityGate');
  expect(source).not.toContain('if (!ageDeclaration)');
  expect(source).toMatch(/ageEligible\s*\?\s*\(\s*<AppIntegrityGate>/);
  expect(source).toContain('{ageEligible ? <Onboarding /> : null}');
  expect(source).toContain('<AdAgePrompt onEligibilityChange={setAgeEligible} />');
  expect(source).toContain('<AppIntegrityGate>');
});

test('startup does not infer adulthood from Google sign-in or guest play', () => {
  expect(source).not.toContain('ads.configureAds(MONETIZATION.admob, true)');
});
