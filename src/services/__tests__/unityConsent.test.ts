const mockApply = jest.fn();
const mockNative: { CricketUnityConsent?: { applyConsent: typeof mockApply } } = {};
const mockPlatform = { OS: 'android' };
jest.mock('react-native', () => ({ NativeModules: mockNative, Platform: mockPlatform }));
import { synchronizeUnityConsent } from '../unityConsent';

describe('Unity Android privacy bridge', () => {
  beforeEach(() => {
    mockPlatform.OS = 'android';
    mockApply.mockReset().mockResolvedValue(null);
    mockNative.CricketUnityConsent = { applyConsent: mockApply };
  });
  it('passes eligibility and UMP permission, not an inferred personalization flag', async () => {
    await synchronizeUnityConsent('teen', true);
    expect(mockApply).toHaveBeenCalledWith('teen', true);
  });
  it('can clear a previously allowed request', async () => {
    await synchronizeUnityConsent('none', false);
    expect(mockApply).toHaveBeenCalledWith('none', false);
  });
  it('does not enable Unity or require a native bridge on iOS', async () => {
    mockPlatform.OS = 'ios';
    delete mockNative.CricketUnityConsent;
    await expect(synchronizeUnityConsent('adult', true)).resolves.toBeUndefined();
    expect(mockApply).not.toHaveBeenCalled();
  });
  it('fails closed on an old Android binary without the bridge', async () => {
    delete mockNative.CricketUnityConsent;
    await expect(synchronizeUnityConsent('adult', true)).rejects.toThrow('bridge unavailable');
  });
  it('propagates native failures so ad initialization can stop', async () => {
    mockApply.mockRejectedValue(new Error('metadata unavailable'));
    await expect(synchronizeUnityConsent('adult', true)).rejects.toThrow('metadata unavailable');
  });
});
