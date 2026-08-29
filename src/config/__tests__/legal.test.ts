import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  evaluatePublicResourceReadiness,
  normalizePublicHttpsUrl,
  SUBSCRIPTION_MANAGEMENT_URLS,
} from '../legal';

const root = path.join(__dirname, '..', '..', '..');

describe('store legal resource configuration', () => {
  it('accepts only public HTTPS destinations', () => {
    expect(normalizePublicHttpsUrl(' https://example.com/privacy ')).toBe(
      'https://example.com/privacy',
    );
    expect(normalizePublicHttpsUrl('http://example.com/privacy')).toBeUndefined();
    expect(normalizePublicHttpsUrl('https://localhost/privacy')).toBeUndefined();
    expect(normalizePublicHttpsUrl('https://192.168.1.4/privacy')).toBeUndefined();
    expect(normalizePublicHttpsUrl('https://user:secret@example.com/privacy')).toBeUndefined();
  });

  it('reports missing, invalid and ready resources without fallback URLs', () => {
    const incomplete = evaluatePublicResourceReadiness({
      privacyPolicy: 'https://example.com/privacy.pdf',
      terms: 'https://example.com/terms',
      support: undefined,
      accountDeletion: 'not-a-url',
    });
    expect(incomplete.ready).toBe(false);
    expect(incomplete.missing).toEqual(['support']);
    expect(incomplete.invalid).toEqual(['privacyPolicy', 'accountDeletion']);

    const ready = evaluatePublicResourceReadiness({
      privacyPolicy: 'https://example.com/privacy',
      terms: 'https://example.com/terms',
      support: 'https://example.com/support',
      accountDeletion: 'https://example.com/delete-account',
    });
    expect(ready.ready).toBe(true);
  });

  it('uses official platform subscription-management destinations', () => {
    expect(SUBSCRIPTION_MANAGEMENT_URLS.android).toBe(
      'https://play.google.com/store/account/subscriptions',
    );
    expect(SUBSCRIPTION_MANAGEMENT_URLS.ios).toBe('https://apps.apple.com/account/subscriptions');
  });

  it('documents every required Expo public URL and fails closed when absent', () => {
    const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const key of [
      'EXPO_PUBLIC_PRIVACY_POLICY_URL',
      'EXPO_PUBLIC_TERMS_URL',
      'EXPO_PUBLIC_SUPPORT_URL',
      'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    ]) {
      expect(envExample).toContain(`${key}=`);
    }

    const emptyLegalEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' };
    for (const key of [
      'EXPO_PUBLIC_PRIVACY_POLICY_URL',
      'EXPO_PUBLIC_TERMS_URL',
      'EXPO_PUBLIC_SUPPORT_URL',
      'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    ]) {
      delete emptyLegalEnv[key];
    }
    const result = spawnSync(process.execPath, ['scripts/check-legal-readiness.mjs'], {
      cwd: root,
      env: emptyLegalEnv,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Store legal readiness failed.');
  });

  it('runs the legal gate automatically for production EAS builds and tagged releases', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const easHook = fs.readFileSync(
      path.join(root, 'scripts', 'eas-build-post-install.mjs'),
      'utf8',
    );
    const releaseWorkflow = fs.readFileSync(
      path.join(root, '.github', 'workflows', 'release-readiness.yml'),
      'utf8',
    );
    const readinessScript = fs.readFileSync(
      path.join(root, 'scripts', 'check-legal-readiness.mjs'),
      'utf8',
    );

    expect(packageJson.scripts['eas-build-post-install']).toBe(
      'node scripts/eas-build-post-install.mjs',
    );
    expect(easHook).toContain("process.env.EAS_BUILD_PROFILE !== 'production'");
    expect(easHook).toContain("['run', 'check:legal']");
    expect(releaseWorkflow).toContain('npm run check:release');
    expect(readinessScript).toContain("headers: { Accept: 'text/html' }");
    expect(readinessScript).toContain("body.includes('Sunlight')");
    expect(readinessScript).toContain("body.includes('Divakar Mishra')");
    expect(readinessScript).toContain("'/publisher/'");
    expect(readinessScript).toContain("'/delete-account/'");
    expect(readinessScript).toContain('data-legal-page=');
  });

  it('binds direct Android release builds to the same legal gate', () => {
    const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
    expect(gradle).toContain('checkLegalReadinessForRelease');
    expect(gradle).toContain('scripts/check-legal-readiness.mjs');
    expect(gradle).toContain('task.name == "preReleaseBuild"');
  });

  it('exposes legal links in Settings and subscription disclosures on the pass screen', () => {
    const settings = fs.readFileSync(
      path.join(root, 'src', 'screens', 'SettingsScreen.tsx'),
      'utf8',
    );
    const pass = fs.readFileSync(path.join(root, 'src', 'screens', 'SeasonPassScreen.tsx'), 'utf8');
    expect(settings).toContain('Legal & Support');
    expect(settings).toContain('PUBLIC_RESOURCE_LABELS');
    expect(settings).toContain('Linking.openURL(url)');
    expect(pass).toContain('Auto-renews until canceled');
    expect(pass).toContain('Manage subscription');
    expect(pass).toContain('SubscriptionPolicyLinks');
  });
});
