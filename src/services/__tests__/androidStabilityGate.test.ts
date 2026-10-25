// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanStabilityLog } = require('../../../scripts/checkAndroidStability.cjs');

describe('Android native QA failure gate', () => {
  it.each([
    'W/Reanimated: synchronouslyUpdateUIProps failed for tag 123',
    'Caused by: com.facebook.react.bridge.RetryableMountingLayerException: Unable to find SurfaceMountingManager for tag [123]',
    'ANR in com.coverdrive.cricket',
    'Input dispatching timed out',
    'FATAL EXCEPTION: main',
    'Fatal signal 11 (SIGSEGV)',
    'java.lang.OutOfMemoryError',
    'com.facebook.react.common.JavascriptException: failed',
    'Unable to load script',
    'java.lang.NullPointerException\n at android.app.ActivityThread.syncTransferSplashscreenViewTransaction',
  ])('fails for %s even when no other fatal marker is present', line => {
    expect(scanStabilityLog(line).passed).toBe(false);
  });

  it('counts warning incidents rather than every matching stack frame', () => {
    const report = scanStabilityLog([
      'W Reanimated: synchronouslyUpdateUIProps failed for tag 1',
      'at com.swmansion.reanimated.NativeProxy.synchronouslyUpdateUIProps$lambda$6',
      'at com.swmansion.reanimated.NativeProxy.synchronouslyUpdateUIProps',
      'W Reanimated: synchronouslyUpdateUIProps failed for tag 2',
    ].join('\n'));
    expect(report.counts.staleViewWarnings).toBe(2);
  });

  it.each([
    '',
    'D RNFBCrashlyticsInit: isCrashlyticsJavascriptExceptionHandlerChainingEnabled final value: true',
    'W StatusBarModule: Ignored status bar change, current activity is edge-to-edge.',
    'at android::uirenderer::ThreadBase::waitForWork()',
    'at android.os.BinderProxy.transactNative',
  ])('does not invent an ANR from a setting or isolated waiting frame: %s', line => {
    expect(scanStabilityLog(line).passed).toBe(true);
  });
});
