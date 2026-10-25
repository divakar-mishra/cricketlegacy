import fs from 'fs';
import path from 'path';
import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATE_DATE } from '../../content/privacyPolicy';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderLegalSite } = require('../../../legal-site/build-core.cjs');

describe('Android Unity mediation integration configuration', () => {
  it('pins both native artifacts to the existing GMA-compatible pair', () => {
    const gradle = read('android/app/build.gradle');
    const adsPackage = JSON.parse(read('node_modules/react-native-google-mobile-ads/package.json'));
    expect(adsPackage.sdkVersions.android.googleMobileAds).toBe('24.9.0');
    expect(gradle).toContain('implementation("com.google.ads.mediation:unity:4.16.6.0")');
    expect(gradle).toContain('implementation("com.unity3d.ads:unity-ads:4.16.6")');
    expect(read('android/app/src/main/java/com/coverdrive/cricket/MainApplication.kt')).toContain('add(UnityConsentPackage())');
  });
  it('does not initialize Unity directly or hardcode dashboard placements into app initialization', () => {
    const native = read('android/app/src/main/java/com/coverdrive/cricket/UnityConsentModule.kt');
    expect(native).not.toContain('UnityAds.initialize(');
    expect(native).not.toContain('800403247');
    expect(native).toContain('set("privacy.consent", allowed)');
    expect(native).toContain('registerOnSharedPreferenceChangeListener(this)');
    expect(native).toContain('unregisterOnSharedPreferenceChangeListener(this)');
  });
  it('defers only Unity automatic startup until age and UMP allow requests', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:name="com.unity3d.services.core.configuration.AdsSdkInitializer" tools:node="remove"');
    expect(manifest).not.toContain('android:name="androidx.startup.InitializationProvider" tools:node="remove"');
    const native = read('android/app/src/main/java/com/coverdrive/cricket/UnityConsentModule.kt');
    expect(native).toContain('if (audience != "none" && canRequestAds)');
    expect(native.indexOf('updateMetadata()')).toBeLessThan(native.indexOf('.initializeComponent(AdsSdkInitializer::class.java)'));
  });
  it('preserves our Google DIRECT seller and the exact Unity dashboard identity', () => {
    const sellers = read('legal-site/static/app-ads.txt').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    expect(sellers[0]).toBe('google.com, pub-4249020515368291, DIRECT, f08c47fec0942fa0');
    expect(sellers).toContain('unity.com, 143233260, DIRECT, 96cabb5fbdde37a7');
    expect(sellers).toHaveLength(162); // Original Google DIRECT + all 161 dashboard entries.
    expect(new Set(sellers).size).toBe(sellers.length);
    for (const line of sellers) {
      const fields = line.split(',').map(field => field.trim());
      expect(fields.length === 3 || fields.length === 4).toBe(true);
      expect(fields[0]).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      expect(fields[1].length).toBeGreaterThan(0);
      expect(['DIRECT', 'RESELLER']).toContain(fields[2]);
    }
    expect(sellers.some(line => /^unity\.com, (800404108|13469957541110),/.test(line))).toBe(false);
  });
  it('discloses Android Unity and consent flags in both policies without changing Auction XI', () => {
    const pages = renderLegalSite(JSON.parse(read('legal-site/legal.config.json')));
    for (const route of ['privacy/index.html', 'products/cricket-legacy/privacy/index.html']) {
      expect(pages[route]).toContain('Unity Ads');
      expect(pages[route]).toContain('19 October 2026');
      expect(pages[route]).toContain('vendor-and-purpose consent grant');
      expect(pages[route]).not.toContain('receive child-directed');
    }
    const offline = JSON.stringify(PRIVACY_POLICY_SECTIONS);
    // The iOS/platform clarification followed the original 19 October Unity
    // disclosure. Retain that disclosure while testing the current policy date.
    expect(PRIVACY_POLICY_UPDATE_DATE).toBe('21 October 2026');
    expect(offline).toContain('Unity Ads (Android ad mediation only)');
    expect(offline).toContain('age-treatment and consent flags');
    expect(pages['products/auction-xi/privacy/index.html']).not.toContain('Unity Ads');
  });
});
