import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('closed-test report enhancements', () => {
  it('offers native privacy access and a categorized feedback route from Settings', () => {
    const app = read('App.tsx');
    const navigation = read('src/navigation/index.ts');
    const settings = read('src/screens/SettingsScreen.tsx');
    const feedback = read('src/screens/FeedbackScreen.tsx');

    expect(navigation).toContain('PrivacyPolicy: undefined');
    expect(navigation).toContain('Feedback: undefined');
    expect(app).toContain('name="PrivacyPolicy"');
    expect(app).toContain('name="Feedback"');
    expect(settings).toContain("navigation.navigate('PrivacyPolicy')");
    expect(settings).toContain("navigation.navigate('Feedback')");
    expect(feedback).toContain("{ value: 'BUG', label: 'Bug' }");
    expect(feedback).toContain("{ value: 'GAMEPLAY', label: 'Gameplay' }");
    expect(feedback).toContain('Nothing is submitted until you review and send it.');
  });

  it('keeps the offline policy aligned with the published legal configuration', () => {
    const policy = read('src/content/privacyPolicy.ts');
    const legalConfig = JSON.parse(read('legal-site/legal.config.json'));

    expect(policy).toContain(legalConfig.publisher.email);
    expect(policy).toContain(`${legalConfig.retention.activeDataDeletionDays} days`);
    expect(policy).toContain(`${legalConfig.retention.deletionRequestAuditDays} days`);
    expect(policy).toContain(`${legalConfig.retention.securityAndSupportDays} days`);
    expect(policy).toContain(`${legalConfig.retention.purchaseAuditDays} days`);
    expect(policy).toContain('Users in India must be at least 18');
    expect(policy).toContain('Users elsewhere must be at least 13');
    expect(policy).toContain('Both choices are off by default');
  });

  it('keeps Play listing copy within the documented field limits', () => {
    const listing = read('docs/PLAY_STORE_LISTING_RECOMMENDATION_2026-09-23.md');
    const title = listing.match(/## App name\n\n```text\n([\s\S]*?)\n```/)?.[1] ?? '';
    const shortDescription =
      listing.match(/## Short description\n\n```text\n([\s\S]*?)\n```/)?.[1] ?? '';
    const fullDescription =
      listing.match(/## Full description\n\n```text\n([\s\S]*?)\n```/)?.[1] ?? '';

    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(30);
    expect(shortDescription.length).toBeLessThanOrEqual(80);
    expect(fullDescription.length).toBeGreaterThanOrEqual(3000);
    expect(fullDescription.length).toBeLessThanOrEqual(4000);
  });
});
