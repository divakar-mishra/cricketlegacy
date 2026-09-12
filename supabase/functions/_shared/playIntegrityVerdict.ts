export type IntegrityDecision = 'VERIFIED' | 'REJECTED' | 'UNAVAILABLE';
export interface IntegrityPayload {
  requestDetails?: { requestPackageName?: string; requestHash?: string; timestampMillis?: string };
  appIntegrity?: {
    appRecognitionVerdict?: string;
    packageName?: string;
    certificateSha256Digest?: string[];
    versionCode?: string;
  };
  accountDetails?: { appLicensingVerdict?: string };
}

/** Only call with Google's server-decoded response, never client-supplied JSON. */
export function evaluateIntegrity(
  payload: IntegrityPayload,
  expected: { requestHash: string; packageName: string; certificates: string[]; now: number },
): IntegrityDecision {
  const details = payload.requestDetails;
  const timestamp = Number(details?.timestampMillis);
  if (
    !details ||
    details.requestHash !== expected.requestHash ||
    details.requestPackageName !== expected.packageName ||
    !Number.isFinite(timestamp) ||
    timestamp > expected.now + 30_000 ||
    timestamp < expected.now - 120_000
  )
    return 'UNAVAILABLE';
  const app = payload.appIntegrity;
  const license = payload.accountDetails?.appLicensingVerdict;
  if (app?.appRecognitionVerdict === 'UNRECOGNIZED_VERSION' || license === 'UNLICENSED')
    return 'REJECTED';
  if (app?.appRecognitionVerdict !== 'PLAY_RECOGNIZED' || license !== 'LICENSED')
    return 'UNAVAILABLE';
  if (
    app.packageName !== expected.packageName ||
    !app.certificateSha256Digest?.length ||
    expected.certificates.length === 0
  )
    return 'UNAVAILABLE';
  if (!app.certificateSha256Digest.some((digest) => expected.certificates.includes(digest)))
    return 'REJECTED';
  return 'VERIFIED';
}
