import {
  evaluateIntegrity,
  IntegrityPayload,
} from '../../../supabase/functions/_shared/playIntegrityVerdict';

const expected = {
  requestHash: 'bound-hash',
  packageName: 'com.coverdrive.cricket',
  certificates: ['play-signing-cert'],
  now: 1000000,
};
const valid = (): IntegrityPayload => ({
  requestDetails: {
    requestHash: expected.requestHash,
    requestPackageName: expected.packageName,
    timestampMillis: '1000000',
  },
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED',
    packageName: expected.packageName,
    certificateSha256Digest: ['play-signing-cert'],
  },
  accountDetails: { appLicensingVerdict: 'LICENSED' },
});
it('accepts only a fresh, bound, recognised, licensed and correctly signed verdict', () => {
  expect(evaluateIntegrity(valid(), expected)).toBe('VERIFIED');
});
it('rejects explicit modified/unlicensed app verdicts without claiming outages are cheating', () => {
  const payload = valid();
  payload.appIntegrity!.appRecognitionVerdict = 'UNRECOGNIZED_VERSION';
  expect(evaluateIntegrity(payload, expected)).toBe('REJECTED');
  payload.appIntegrity!.appRecognitionVerdict = 'UNEVALUATED';
  expect(evaluateIntegrity(payload, expected)).toBe('UNAVAILABLE');
  payload.accountDetails!.appLicensingVerdict = 'UNLICENSED';
  expect(evaluateIntegrity(payload, expected)).toBe('REJECTED');
});
it('rejects the wrong signing certificate', () => {
  const payload = valid();
  payload.appIntegrity!.certificateSha256Digest = ['debug-cert'];
  expect(evaluateIntegrity(payload, expected)).toBe('REJECTED');
});
it.each(['requestHash', 'requestPackageName', 'timestampMillis'] as const)(
  'does not trust mismatched %s',
  (field) => {
    const payload = valid();
    payload.requestDetails![field] = 'wrong';
    expect(evaluateIntegrity(payload, expected)).toBe('UNAVAILABLE');
  },
);
it.each(['1', '2000000'])('rejects stale or future timestamps %s', (timestamp) => {
  const payload = valid();
  payload.requestDetails!.timestampMillis = timestamp;
  expect(evaluateIntegrity(payload, expected)).toBe('UNAVAILABLE');
});
it('fails closed on replay-cleared, missing and misconfigured verdicts', () => {
  expect(evaluateIntegrity({}, expected)).toBe('UNAVAILABLE');
  expect(evaluateIntegrity(valid(), { ...expected, certificates: [] })).toBe('UNAVAILABLE');
  const payload = valid();
  payload.accountDetails!.appLicensingVerdict = 'UNEVALUATED';
  expect(evaluateIntegrity(payload, expected)).toBe('UNAVAILABLE');
});
