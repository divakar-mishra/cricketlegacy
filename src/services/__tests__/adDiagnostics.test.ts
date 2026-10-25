import fs from 'fs';
import path from 'path';
const mockQa = { enabled: true };
const mockReady = jest.fn();
const mockOpen = jest.fn();
const mockGuard = jest.fn();
const mockConfigureSession = jest.fn();
const mockNative: { CricketUnityConsent?: { openQaDiagnostics: typeof mockOpen; assertQaTestDevice: typeof mockGuard } } = {};
const mockPlatform = { OS: 'android' };
jest.mock('../../config/qa', () => ({ get QA_TOOLS_ENABLED() { return mockQa.enabled; } }));
jest.mock('../ads', () => ({ isAdsReady: () => mockReady(), configureQaAdSession: (...args: unknown[]) => mockConfigureSession(...args) }));
jest.mock('react-native', () => ({ NativeModules: mockNative, Platform: mockPlatform }));
import { openQaAdDiagnostics, prepareQaAdSession } from '../adDiagnostics';
import { MONETIZATION } from '../../config/monetization';

describe('isolated ad diagnostics', () => {
  beforeEach(() => {
    mockQa.enabled = true; mockPlatform.OS = 'android';
    mockReady.mockReset().mockReturnValue(true);
    mockOpen.mockReset().mockResolvedValue(null);
    mockGuard.mockReset().mockResolvedValue(null);
    mockConfigureSession.mockReset().mockResolvedValue(true);
    mockNative.CricketUnityConsent = { openQaDiagnostics: mockOpen, assertQaTestDevice: mockGuard };
  });
  it('opens only the native QA panel with this app configured units', async () => {
    await openQaAdDiagnostics();
    expect(mockOpen).toHaveBeenCalledWith(MONETIZATION.admob);
  });
  it('blocks a production JS session before touching the native panel', async () => {
    mockQa.enabled = false;
    await expect(openQaAdDiagnostics()).rejects.toThrow('QA ads need');
    expect(mockOpen).not.toHaveBeenCalled();
  });
  it('does not bypass age or UMP readiness', async () => {
    mockReady.mockReturnValue(false);
    await expect(openQaAdDiagnostics()).rejects.toThrow('eligible');
    expect(mockOpen).not.toHaveBeenCalled();
  });
  it('does not offer Android diagnostics on iOS', async () => {
    mockPlatform.OS = 'ios';
    await expect(openQaAdDiagnostics()).rejects.toThrow('Android QA');
  });
  it('reports a stale binary rather than claiming that a test ran', async () => {
    delete mockNative.CricketUnityConsent;
    await expect(openQaAdDiagnostics()).rejects.toThrow('matching Android QA build');
  });
  it.each(['us-adult', 'teen', 'normal'] as const)('guards native build/test device before applying %s', async (profile) => {
    await expect(prepareQaAdSession(profile)).resolves.toBe(true);
    expect(mockConfigureSession).toHaveBeenCalledWith(profile);
    expect(mockGuard.mock.invocationCallOrder[0]).toBeLessThan(mockConfigureSession.mock.invocationCallOrder[0]);
  });
  it('never resets consent in a production JS session', async () => {
    mockQa.enabled = false;
    await expect(prepareQaAdSession('us-adult')).rejects.toThrow('disabled');
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockConfigureSession).not.toHaveBeenCalled();
  });
  it('blocks consent overrides when the native test-device check fails', async () => {
    mockGuard.mockRejectedValue(new Error('test device required'));
    await expect(prepareQaAdSession('teen')).rejects.toThrow('test device required');
    expect(mockConfigureSession).not.toHaveBeenCalled();
  });
  it('does not offer QA consent overrides on iOS or a stale native binary', async () => {
    mockPlatform.OS = 'ios';
    await expect(prepareQaAdSession('us-adult')).rejects.toThrow('matching Android QA');
    mockPlatform.OS = 'android';
    delete mockNative.CricketUnityConsent;
    await expect(prepareQaAdSession('teen')).rejects.toThrow('matching Android QA');
    expect(mockConfigureSession).not.toHaveBeenCalled();
  });
  it('keeps the Activity in the QA source set and excludes game grants', () => {
    const root = path.resolve(__dirname, '../../..');
    const activity = fs.readFileSync(path.join(root, 'android/app/src/qa/java/com/coverdrive/cricket/AdDiagnosticsActivity.kt'), 'utf8');
    expect(activity).toContain('request().isTestDevice(this)');
    expect(activity).toContain('testModeConfirmed.isChecked');
    expect(activity).toContain('canRequestAds()');
    expect(activity).toContain('mediationAdapterClassName');
    expect(activity).toContain('gameGrant=NONE');
    expect(activity).not.toContain('careerStore');
    expect(activity).not.toContain('grantAdReward');
    expect(activity).not.toContain('UnityAds.initialize');
    const mainManifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    expect(mainManifest).not.toContain('AdDiagnosticsActivity');
    const qaManifest = fs.readFileSync(path.join(root, 'android/app/src/qa/AndroidManifest.xml'), 'utf8');
    expect(qaManifest).toContain('android:exported="false"');
    const bridge = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/coverdrive/cricket/UnityConsentModule.kt'), 'utf8');
    expect(bridge).toContain('BuildConfig.BUILD_TYPE != "qa"');
    expect(bridge).toContain('BuildConfig.BUILD_TYPE == "qa"');
    expect(bridge).toContain('setTestDeviceIds(listOf(AdRequest.DEVICE_ID_EMULATOR))');
    // GMA 24.9 throws if setAppMuted runs in the pre-initialize privacy bridge.
    expect(bridge).not.toContain('MobileAds.setAppMuted(');
    expect(activity).toContain('MobileAds.setAppMuted(true)');
    expect(activity).toContain('putString("npa", "1")');
    expect(activity).toContain('PRIVACY tfua=');
    expect(bridge).toContain('!AdRequest.Builder().build().isTestDevice(reactApplicationContext)');
  });
});
