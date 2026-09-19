const mockAnalytics = {
  getAnalytics: jest.fn(() => ({})),
  setConsent: jest.fn(async () => {}),
  setAnalyticsCollectionEnabled: jest.fn(async () => {}),
  resetAnalyticsData: jest.fn(async () => {}),
  logEvent: jest.fn(async () => {}),
  setUserProperty: jest.fn(async () => {}),
};
const mockCrashes = {
  getCrashlytics: jest.fn(() => ({})),
  setCrashlyticsCollectionEnabled: jest.fn(async () => {}),
  deleteUnsentReports: jest.fn(async () => {}),
  recordError: jest.fn(),
};
jest.mock('@react-native-firebase/analytics', () => mockAnalytics);
jest.mock('@react-native-firebase/crashlytics', () => mockCrashes);
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../../state/settingsStore', () => ({ useSettings: {} }));
import { configureTelemetry, canSendAnalytics, canSendCrashes } from '../telemetry';
import { logEvent, EVT, sanitizeAnalyticsParams } from '../analytics';
import { captureException, sanitizedException } from '../crash';

beforeEach(async () => {
  await configureTelemetry(false, false);
  jest.clearAllMocks();
});
test('does not forward without opt-in', () => {
  logEvent(EVT.MATCH_END, { won: true });
  captureException(new Error('secret'));
  expect(mockAnalytics.logEvent).not.toHaveBeenCalled();
  expect(mockCrashes.recordError).not.toHaveBeenCalled();
});
test('separate consent and sanitised forwarding', async () => {
  await configureTelemetry(true, false);
  logEvent(EVT.MATCH_END, { mode: 'manager', won: true, email: 'private', playerId: 'private' });
  expect(mockAnalytics.logEvent).toHaveBeenCalledWith({}, EVT.MATCH_END, {
    mode: 'manager',
    won: 1,
  });
  expect(canSendCrashes()).toBe(false);
  expect(mockAnalytics.setConsent).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ ad_storage: false, ad_user_data: false }),
  );
});
test('revocation stops immediately and clears unsent reports', async () => {
  await configureTelemetry(true, true);
  const stopping = configureTelemetry(false, false);
  expect(canSendAnalytics()).toBe(false);
  expect(canSendCrashes()).toBe(false);
  await stopping;
  expect(mockCrashes.deleteUnsentReports).toHaveBeenCalled();
});
test('latest rapid preference change wins', async () => {
  await Promise.all([configureTelemetry(true, true), configureTelemetry(false, false)]);
  expect(canSendAnalytics()).toBe(false);
  expect(canSendCrashes()).toBe(false);
});
test('SDK failure fails closed', async () => {
  mockAnalytics.setAnalyticsCollectionEnabled.mockRejectedValueOnce(new Error('offline'));
  await configureTelemetry(true, false);
  expect(canSendAnalytics()).toBe(false);
});
test('never sends raw errors, context or arbitrary parameters', async () => {
  const error = new Error('token=private@example.com');
  error.stack = 'secret\n at fn (index.android.bundle:1:1234)';
  expect(sanitizedException(error).stack).not.toContain('secret');
  expect(sanitizedException(error).stack).toContain(':1:1234');
  expect(sanitizeAnalyticsParams({ coins: NaN, mode: 'email@example.com', userId: 'x' })).toEqual(
    {},
  );
  await configureTelemetry(false, true);
  captureException(error, { password: 'secret' });
  expect(mockCrashes.recordError).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ message: 'Application error' }),
  );
});
