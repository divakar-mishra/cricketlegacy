// Read-only audit of source/artifacts. Writes only generated evidence under output/.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output/deep-audit-2026-10-25');
const logs = path.join(out, 'logs');
fs.mkdirSync(logs, { recursive: true });
const names = [
  'progression-storage', 'full-careers', 'coverage', 'assets', 'native-guard',
  'creation', 'callback', 'storage-capacity', 'reproductions-after',
  'ad-races-before', 'fixes-focused', 'typecheck', 'lint',
  'legal', 'legal-production', 'legal-production-network', 'final-suite', 'final-extended',
];
for (const name of names) {
  const source = `/private/tmp/cricket-deep-audit-${name}.log`;
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(logs, `${name}.log`));
}
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'output/production-android-2026-10-25/source-inputs.json'), 'utf8'));
const changed = [];
const missing = [];
const current = {};
for (const [file, oldHash] of Object.entries(baseline.hashes)) {
  if (!fs.existsSync(path.join(root, file))) { missing.push(file); continue; }
  current[file] = hash(fs.readFileSync(path.join(root, file)));
  if (current[file] !== oldHash) changed.push(file);
}
const diagnosticFiles = fs.readdirSync(path.join(root, 'scripts'))
  .filter(name => /^deep-.*audit.*2026-10-25\.(test\.ts|cjs)$/.test(name))
  .map(name => `scripts/${name}`);
for (const file of diagnosticFiles) current[file] = hash(fs.readFileSync(path.join(root, file)));
const aab = 'output/production-1.0.12/cricket-player-manager-1.0.12-vc21.aab';
const careers = JSON.parse(fs.readFileSync(path.join(out, 'full-careers.json'), 'utf8'));
const summary = {
  generatedAt: new Date().toISOString(),
  baselineAggregateSha256: baseline.aggregateSha256,
  changedCapturedFiles: changed,
  missingCapturedFiles: missing,
  capturedHashes: current,
  diagnosticFiles,
  oldArtifact: { path: aab, sha256: hash(fs.readFileSync(path.join(root, aab))),
    containsAuditFixes: false, status: 'SUPERSEDED_SOURCE_DO_NOT_UPLOAD' },
  simulation: {
    matchMode: careers.config.matchMode, iapOrAds: careers.config.iapOrAds,
    playerCareers: careers.players.length, managerCareers: careers.managers.length,
    seasons: [...careers.players, ...careers.managers].reduce((n, p) => n + p.seasonsCompleted, 0),
    results: [...careers.players, ...careers.managers].reduce((n, p) =>
      n + p.careerRecord.wins + p.careerRecord.losses + p.careerRecord.drawsOrNoResults, 0),
    allRetired: [...careers.players, ...careers.managers].every(p => p.retired),
    errors: [...careers.players, ...careers.managers].flatMap(p => p.errors),
    warnings: [...careers.players, ...careers.managers].flatMap(p => p.warnings),
  },
};
fs.writeFileSync(path.join(out, 'evidence-index.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ changedCapturedFiles: changed, missingCapturedFiles: missing,
  oldArtifact: summary.oldArtifact, simulation: summary.simulation }, null, 2));
