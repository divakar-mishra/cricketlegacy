// Gate for APP-PROCESS-SCOPED logs, not unfiltered device-wide logcat.
const fs = require('node:fs');

function scanStabilityLog(text) {
  const lines = text.split(/\r?\n/);
  const counts = {
    fatal: lines.filter(line => /\b(?:FATAL EXCEPTION|Fatal signal \d+|JavaScriptException|JavascriptException|Unable to load script|OutOfMemoryError)\b/.test(line)).length,
    staleViewWarnings: lines.filter(line => /\bsynchronouslyUpdateUIProps failed for tag\b/.test(line)).length,
    mountingExceptions: lines.filter(line => /\bRetryableMountingLayerException\b/.test(line)).length,
    anr: lines.filter(line => /\bInput dispatching timed out\b|\bANR in com\.coverdrive\.cricket\b/.test(line)).length,
    splashSurfaceFailure: /\bNullPointerException\b/.test(text) && text.includes('syncTransferSplashscreenViewTransaction') ? 1 : 0,
  };
  return { passed: Object.values(counts).every(value => value === 0), counts };
}

module.exports = { scanStabilityLog };
if (require.main === module) {
  const args = process.argv.slice(2);
  const files = args.filter(arg => arg !== '--app-process');
  if (!args.includes('--app-process') || files.length === 0) {
    console.error('Usage: node scripts/checkAndroidStability.cjs --app-process <app-process-log> [...]');
    console.error('Do not pass unfiltered device-wide logcat; other apps may produce unrelated failures.');
    process.exitCode = 2;
  } else {
    try {
      const results = files.map(file => ({ file, ...scanStabilityLog(fs.readFileSync(file, 'utf8')) }));
      console.log(JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
      if (results.some(result => !result.passed)) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
