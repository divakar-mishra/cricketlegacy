import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../../App.tsx'), 'utf8');

test('startup navigation and onboarding do not require an age questionnaire', () => {
  expect(source).not.toContain('AgeEligibilityGate');
  expect(source).not.toContain('if (!ageDeclaration)');
  expect(source).toContain('<Onboarding />');
  expect(source).toContain('<AppIntegrityGate>');
});

test('removing the questionnaire does not silently declare new users adult', () => {
  expect(source).toContain('getJSON<unknown>(AGE_DECLARATION_KEY)');
  expect(source).toContain('isAgeDeclaration(stored) && canUseAds(stored)');
});
