export type PrivacyPolicySection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export const PRIVACY_POLICY_EFFECTIVE_DATE = '20 August 2026';
export const PRIVACY_POLICY_UPDATE_DATE = '13 September 2026';
export const PRIVACY_CONTACT_EMAIL = 'devsunlightpvt@gmail.com';

/**
 * Native, offline-readable copy of the published Cricket Legacy policy.
 * Keep this synchronized with legal-site/build-core.cjs and legal.config.json.
 */
export const PRIVACY_POLICY_SECTIONS: readonly PrivacyPolicySection[] = [
  {
    title: 'Scope of this policy',
    paragraphs: [
      'This policy applies specifically to Cricket Legacy and its related support and web pages. It does not apply to other apps published by Sunlight; those apps have their own privacy policies.',
    ],
  },
  {
    title: 'Who is responsible',
    paragraphs: [
      'Sunlight provides Cricket Legacy and is responsible for the personal data described here. Sunlight is operated by Divakar Mishra, an individual developer in Maharashtra, India.',
      `Privacy and support contact: ${PRIVACY_CONTACT_EMAIL}`,
    ],
  },
  {
    title: 'Information the app handles',
    bullets: [
      'Local game data: careers, squads, match history, settings, rewards and other progress stored on your device.',
      'Account and cloud data: an anonymous or linked account identifier, authentication records and cloud saves when the online backend is enabled.',
      'Purchases: product, entitlement, transaction status and pseudonymous verification identifiers supplied by Google Play, Apple or RevenueCat. Sunlight does not receive your full payment-card number.',
      'Online play and security: leaderboard entries you submit, server timestamps, app/build version, fraud checks, IP address and service logs.',
      'Age preferences: your self-declared age band, India/outside-India choice and, where applicable, parent or guardian permission are stored on your device. The app does not ask for a date of birth or upload these answers.',
      'Advertising: Google Mobile Ads may process device or advertising identifiers, IP address, ad interactions, diagnostics and consent choices. Ads are not initialized for users who declare they are under 18. Adult ad requests wait for the Google consent flow and remain non-personalized.',
      'Support: your email address, message and attachments if you contact support.',
      'Optional diagnostics: if enabled in Settings, Firebase Analytics may process app-instance identifiers, app/device information, sessions and limited gameplay or purchase events. Crashlytics may process installation identifiers, device diagnostics, session information and crash traces. Both choices are off by default and can be withdrawn in Settings. We do not attach account names, emails or save contents to Firebase reports. Turning these options off stops future reporting but does not automatically erase reports already received by Google.',
      'Device features: notification permission and locally scheduled reminders. The current app does not upload a push-notification token.',
    ],
    paragraphs: [
      'The public legal site does not intentionally set advertising or analytics cookies. Cloudflare may process ordinary network and security logs while hosting those pages.',
    ],
  },
  {
    title: 'Why information is used',
    bullets: [
      'Run the game, save progress and provide requested online features.',
      'Verify purchases, restore eligible entitlements and prevent duplicate or fraudulent grants.',
      'Show and measure ads where enabled, subject to consent and age rules.',
      'Secure the service, diagnose failures, answer support requests and comply with law.',
    ],
    paragraphs: [
      'Depending on the context and applicable law, processing is based on providing the requested service, consent, legitimate service-security interests or a legal obligation. Consent for optional processing can be withdrawn without affecting earlier lawful processing.',
    ],
  },
  {
    title: 'Service providers and disclosures',
    paragraphs: [
      'Information may be processed for Sunlight by Supabase, RevenueCat, Google Play, Apple, Google Mobile Ads, Google Firebase Analytics and Crashlytics, and Cloudflare. Their handling is also governed by their own terms and privacy notices.',
      'Information may be disclosed when required by law, to protect users or the service, or in connection with a business transfer. Sunlight does not sell personal data. Leaderboard information is public only when that feature is enabled and you submit an entry.',
    ],
  },
  {
    title: 'Storage, transfers and retention',
    paragraphs: [
      'Local data remains on the device until you delete it or remove the app. Active account and cloud-game data is normally removed within 7 days after a verified deletion request. Residual backup copies rotate out within 7 days and are not returned to the active service.',
      'Pseudonymous deletion-request status is retained for up to 30 days. Security and support records are retained for up to 90 days. Minimum pseudonymized purchase, refund, chargeback, fraud and accounting evidence is retained for up to 365 days when required for compliance or dispute handling.',
      'Providers may process data outside India. Where required, Sunlight uses provider terms and safeguards intended to protect transferred data.',
    ],
  },
  {
    title: 'Your choices and rights',
    bullets: [
      'Use local play without enabling optional cloud or leaderboard features.',
      'Control notifications in the app or device settings.',
      'Control optional usage analytics, crash reporting and ad privacy choices in Settings.',
      'Manage subscriptions through Google Play or the App Store.',
      'Ask for access, correction, a copy, deletion, withdrawal of consent or grievance review where applicable law provides those rights.',
    ],
    paragraphs: [
      `Use Account & Data Deletion in Settings or contact ${PRIVACY_CONTACT_EMAIL}. We may need to verify that you control the relevant account before acting.`,
    ],
  },
  {
    title: 'Children and younger users',
    paragraphs: [
      'Cricket Legacy is not directed to children. Users in India must be at least 18. Users elsewhere must be at least 13 and, where local law requires it, have permission from a parent or guardian.',
      'We do not knowingly collect personal data from anyone below the applicable minimum age. A parent or guardian who believes a child supplied personal data may contact us so that we can investigate and delete it.',
    ],
  },
  {
    title: 'Security and changes',
    paragraphs: [
      'Sunlight uses access controls, encrypted transport and restricted server credentials, but no service can guarantee absolute security. Material policy changes will be published with a new effective date and, when appropriate, explained in the app.',
    ],
  },
];
