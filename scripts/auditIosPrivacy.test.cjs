/* global require */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeManifest } = require('./auditIosPrivacy.cjs');

test('missing tracking declarations stay unknown rather than being certified false', () => {
  const result = summarizeManifest('PrivacyInfo.xcprivacy', {});
  assert.equal(result.trackingDeclared, null);
  assert.deepEqual(result.collectedData, []);
  assert.deepEqual(result.requiredReasonApis, []);
});

test('retains per-type linking, tracking, purposes and API reasons for review', () => {
  const result = summarizeManifest('Ads.bundle/PrivacyInfo.xcprivacy', {
    NSPrivacyTracking: true,
    NSPrivacyTrackingDomains: ['example.test'],
    NSPrivacyCollectedDataTypes: [{ NSPrivacyCollectedDataType: 'DeviceID', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: true, NSPrivacyCollectedDataTypePurposes: ['ThirdPartyAdvertising'] }],
    NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'UserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] }],
  });
  assert.equal(result.trackingDeclared, true);
  assert.equal(result.collectedData[0].linked, true);
  assert.equal(result.collectedData[0].tracking, true);
  assert.deepEqual(result.collectedData[0].purposes, ['ThirdPartyAdvertising']);
  assert.deepEqual(result.requiredReasonApis[0].reasons, ['CA92.1']);
});
