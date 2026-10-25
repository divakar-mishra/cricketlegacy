// Reproduce conditional review files without assuming a private Unity setting.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { parseCsv, serializeCsv, validate } = require('./checkPlayDataSafety.cjs');

const SOURCE = 'docs/data-safety-REVIEW-DRAFT-DO-NOT-IMPORT-2026-10-20.csv';
const SOURCE_HASH = 'd384667996615746245b3a897e01e13ef30887e0447c2e763d9958b28b0396a0';
const FILES = {
  unconfirmed: 'docs/data-safety-UNITY-UNCONFIRMED-DO-NOT-IMPORT-2026-10-21.csv',
  off: 'docs/data-safety-CONDITIONAL-ACQUIRE-OFF-2026-10-21.csv',
  on: 'docs/data-safety-CONDITIONAL-ACQUIRE-ON-2026-10-21.csv',
};
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function prepare(source, variant) {
  assert(Object.hasOwn(FILES, variant), 'Unknown Acquire variant');
  const rows = source.map((row) => [...row]);
  const set = (question, response, value) => {
    const matches = rows.filter((row) => row[0] === question && row[1] === response);
    assert.equal(matches.length, 1, `Expected one response: ${question}/${response}`);
    matches[0][2] = value;
  };
  for (const purpose of ['DATA_USAGE_COLLECTION_PURPOSE', 'DATA_USAGE_SHARING_PURPOSE']) {
    set(`PSL_DATA_USAGE_RESPONSES:PSL_APPROX_LOCATION:${purpose}`, 'PSL_PERSONALIZATION', '');
  }
  set('PSL_DATA_TYPES_APP_PERFORMANCE', 'PSL_OTHER_PERFORMANCE', '');
  for (const row of rows) {
    if (row[0].startsWith('PSL_DATA_USAGE_RESPONSES:PSL_OTHER_PERFORMANCE:')) row[2] = '';
  }
  const prefix = 'PSL_DATA_USAGE_RESPONSES:PSL_OTHER_APP_ACTIVITY:';
  if (variant === 'off') {
    set(prefix + 'DATA_USAGE_USER_CONTROL', 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL', 'true');
  } else if (variant === 'on') {
    set(prefix + 'DATA_USAGE_USER_CONTROL', 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED', 'true');
    set(prefix + 'PSL_DATA_USAGE_COLLECTION_AND_SHARING', 'PSL_DATA_USAGE_ONLY_SHARED', 'true');
    for (const response of ['PSL_ADVERTISING', 'PSL_FRAUD_PREVENTION_SECURITY']) {
      set(prefix + 'DATA_USAGE_COLLECTION_PURPOSE', response, 'true');
    }
    for (const response of ['PSL_ADVERTISING', 'PSL_ANALYTICS', 'PSL_FRAUD_PREVENTION_SECURITY']) {
      set(prefix + 'DATA_USAGE_SHARING_PURPOSE', response, 'true');
    }
  }
  const validation = validate(rows, source);
  assert.equal(validation.incomplete.length, variant === 'unconfirmed' ? 1 : 0);
  const changes = rows.slice(1).flatMap((row, index) => row[2] === source[index + 1][2] ? [] : [{
    questionId: row[0], responseId: row[1], before: source[index + 1][2], after: row[2], label: row[4],
  }]);
  const csv = serializeCsv(rows);
  assert.deepEqual(parseCsv(csv), rows);
  return { rows, csv, review: {
    path: FILES[variant], sha256: sha256(csv), ...validation,
    condition: variant === 'unconfirmed' ? 'No provider state assumed; incomplete review only'
      : variant === 'off' ? 'Only after verified Acquire OFF and baseline service-provider handling confirmed'
        : 'Only after verified Acquire ON without universal app-level opt-out',
    providerConfigurationVerified: false, readyForImport: false,
    modifiedResponseValuesFromOctober20Draft: changes.length, changes,
  } };
}

module.exports = { SOURCE, SOURCE_HASH, FILES, sha256, prepare };

if (require.main === module) {
  const [command, variant] = process.argv.slice(2);
  const input = fs.readFileSync(SOURCE, 'utf8');
  assert.equal(sha256(input), SOURCE_HASH, 'Historical review source changed; re-review before generating');
  const source = parseCsv(input);
  if (command === '--patch') {
    const { csv } = prepare(source, variant);
    assert(!fs.existsSync(FILES[variant]), 'Refusing to overwrite an existing review file');
    process.stdout.write('*** Begin Patch\n*** Add File: ' + FILES[variant] + '\n'
      + csv.trimEnd().split('\n').map((line) => '+' + line).join('\n') + '\n*** End Patch\n');
  } else if (command === '--check') {
    for (const name of Object.keys(FILES)) {
      const { csv, review } = prepare(source, name);
      assert.equal(fs.readFileSync(FILES[name], 'utf8'), csv, `Generated file changed: ${name}`);
      const { changes, ...summary } = review;
      process.stdout.write(JSON.stringify(summary) + '\n');
    }
  } else {
    throw new Error('Usage: node scripts/preparePlayDataSafetyReview.cjs --patch <unconfirmed|off|on> OR --check');
  }
}
