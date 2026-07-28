import fs from 'fs';
import path from 'path';

describe('AdMob monetization configuration', () => {
  it('keeps debug builds on provider test inventory unless explicitly overridden', () => {
    const monetizationSource = fs.readFileSync(path.join(__dirname, '..', 'monetization.ts'), 'utf8');

    expect(monetizationSource).toContain("IS_DEV_BUILD ? '' : ADMOB_ANDROID_REWARDED_UNIT");
  });

  it('records the Cricket Legacy Android AdMob ids for native and release builds', () => {
    const monetizationSource = fs.readFileSync(path.join(__dirname, '..', 'monetization.ts'), 'utf8');
    const appConfig = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8');
    const androidManifest = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    );

    expect(appConfig).toContain('ca-app-pub-4249020515368291~8405865949');
    expect(androidManifest).toContain('com.google.android.gms.ads.APPLICATION_ID');
    expect(androidManifest).toContain('ca-app-pub-4249020515368291~8405865949');
    expect(monetizationSource).toContain('ca-app-pub-4249020515368291/1717736882');
  });
});
