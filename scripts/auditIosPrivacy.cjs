/* Read-only inventory. Manifest declarations are not a runtime tracking verdict. */
/* global require, module, process */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function summarizeManifest(relativePath, manifest) {
  return {
    path: relativePath,
    trackingDeclared: typeof manifest.NSPrivacyTracking === 'boolean' ? manifest.NSPrivacyTracking : null,
    trackingDomains: manifest.NSPrivacyTrackingDomains ?? [],
    collectedData: (manifest.NSPrivacyCollectedDataTypes ?? []).map(data => ({
      type: data.NSPrivacyCollectedDataType,
      linked: data.NSPrivacyCollectedDataTypeLinked ?? null,
      tracking: data.NSPrivacyCollectedDataTypeTracking ?? null,
      purposes: data.NSPrivacyCollectedDataTypePurposes ?? [],
    })),
    requiredReasonApis: (manifest.NSPrivacyAccessedAPITypes ?? []).map(api => ({
      category: api.NSPrivacyAccessedAPIType,
      reasons: api.NSPrivacyAccessedAPITypeReasons ?? [],
    })),
  };
}

function auditBundle(bundlePath) {
  const bundle = path.resolve(bundlePath);
  if (!bundle.endsWith('.app') || !fs.statSync(bundle).isDirectory()) {
    throw new Error('Supply the exact existing .app bundle, not a source tree or archive root.');
  }
  const readPlist = file => JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }));
  const info = readPlist(path.join(bundle, 'Info.plist'));
  const manifests = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      // Do not traverse links outside the supplied artifact.
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name === 'PrivacyInfo.xcprivacy') {
        manifests.push(summarizeManifest(path.relative(bundle, file), readPlist(file)));
      }
    }
  }
  visit(bundle);
  manifests.sort((a, b) => a.path.localeCompare(b.path));
  return {
    inspectedAt: new Date().toISOString(),
    bundle,
    identity: {
      bundleId: info.CFBundleIdentifier,
      version: info.CFBundleShortVersionString,
      build: info.CFBundleVersion,
      platforms: info.CFBundleSupportedPlatforms,
      hasTrackingUsageDescription: Boolean(info.NSUserTrackingUsageDescription),
      usesNonExemptEncryption: info.ITSAppUsesNonExemptEncryption ?? null,
      delayedAdMeasurement: info.GADDelayAppMeasurementInit ?? null,
    },
    manifestCount: manifests.length,
    manifests,
    reviewRequired: manifests.filter(item => item.trackingDeclared || item.trackingDomains.length || item.collectedData.some(data => data.tracking)).map(item => item.path),
    limitations: [
      'This is a static artifact inventory, not observed network collection or an App Privacy answer.',
      'SDK tracking declarations require reconciliation with actual configuration and behavior; no ATT prompt does not prove no tracking.',
      'Inspect the final signed device archive again. Simulator SDK slices and configuration may differ.',
      'Missing encryption metadata is unresolved, not an automatic exemption. Required-reason declarations still need a valid use audit.',
    ],
  };
}

module.exports = { auditBundle, summarizeManifest };
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/auditIosPrivacy.cjs /exact/path/Cricket.app (macOS/plutil required)');
    process.stdout.write(JSON.stringify(auditBundle(process.argv[2]), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`iOS privacy inventory failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
