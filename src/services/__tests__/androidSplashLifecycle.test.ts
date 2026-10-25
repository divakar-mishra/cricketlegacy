import fs from 'node:fs';
import path from 'node:path';

// Source contract coverage of the existing Expo mitigation. These tests are NOT
// a reproduction/fix certification for ActivityThread's null splash leash bug.
const manager = fs.readFileSync(path.join(process.cwd(), 'node_modules/expo-splash-screen/android/src/main/java/expo/modules/splashscreen/SplashScreenManager.kt'), 'utf8');
const activity = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/java/com/coverdrive/cricket/MainActivity.kt'), 'utf8');

describe('preserved Android splash lifecycle protections', () => {
  it('keeps native splash registration before activity creation', () => {
    expect(activity.indexOf('SplashScreenManager.registerOnActivity(this)')).toBeLessThan(activity.indexOf('super.onCreate(null)'));
  });
  it('keeps the existing API31–33 stop-transition mitigation scoped to the owning activity', () => {
    expect(manager).toContain('Build.VERSION.SDK_INT in Build.VERSION_CODES.S..Build.VERSION_CODES.TIRAMISU');
    expect(manager).toContain('override fun onActivityStopped(activity: Activity)');
    expect(manager).toContain('if (activity == mainActivity)');
    expect(manager).toContain('mainActivity.splashScreen.clearOnExitAnimationListener()');
    expect(manager).toContain('application.unregisterActivityLifecycleCallbacks(this)');
  });
  it('does not invoke SurfaceControl transactions from repeated JS hide requests', () => {
    const hide = manager.match(/fun hide\(\) \{([^}]+)\}/)?.[1];
    expect(hide?.trim()).toBe('keepSplashScreenOnScreen = false');
  });
  it('retains both legacy and platform-specific splash removal paths', () => {
    expect(manager).toContain('Build.VERSION.SDK_INT < Build.VERSION_CODES.S');
    expect(manager).toContain('splashScreenViewProvider.remove()');
    expect(manager).toContain('(splashScreenView as SplashScreenView).remove()');
  });
});
