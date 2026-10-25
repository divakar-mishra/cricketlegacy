const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseCsv, serializeCsv, validate } = require('./checkPlayDataSafety.cjs');
const { SOURCE, SOURCE_HASH, sha256, prepare } = require('./preparePlayDataSafetyReview.cjs');
const input = fs.readFileSync(SOURCE, 'utf8');
const source = parseCsv(input);
const other = 'PSL_DATA_USAGE_RESPONSES:PSL_OTHER_APP_ACTIVITY:';
const answer = (rows, question, response) => rows.find((row) => row[0] === question && row[1] === response)?.[2];

test('historical source hash is pinned; response identities and all five columns round-trip', () => {
  assert.equal(sha256(input), SOURCE_HASH);
  assert.equal(source.length, 783);
  assert.deepEqual(parseCsv(serializeCsv(source)), source);
  assert.equal(validate(source).incomplete.length, 1);
});

test('quoted commas, escaped quotes, multiline labels, CRLF, BOM and terminal empty cells', () => {
  const rows = [['a,b', 'a"b', 'line\nnext', 'trailing space ', ''], ['', '', '', '', '']];
  assert.deepEqual(parseCsv(serializeCsv(rows)), rows);
  assert.deepEqual(parseCsv('\uFEFFa,b,\r\nc,d,\r\n'), [['a', 'b', ''], ['c', 'd', '']]);
});

test('malformed quote structures are rejected', () => {
  for (const csv of ['"unterminated', 'a"b,c', '"a"x,b', '"a""']) {
    assert.throws(() => parseCsv(csv));
  }
});

test('both inherited answers are corrected without dropping crash or diagnostic disclosures', () => {
  const { rows, review } = prepare(source, 'unconfirmed');
  assert.equal(review.modifiedResponseValuesFromOctober20Draft, 13);
  for (const suffix of ['DATA_USAGE_COLLECTION_PURPOSE', 'DATA_USAGE_SHARING_PURPOSE']) {
    assert.equal(answer(rows, 'PSL_DATA_USAGE_RESPONSES:PSL_APPROX_LOCATION:' + suffix, 'PSL_PERSONALIZATION'), '');
  }
  assert.equal(answer(rows, 'PSL_DATA_TYPES_APP_PERFORMANCE', 'PSL_OTHER_PERFORMANCE'), '');
  assert(rows.filter((row) => row[0].startsWith('PSL_DATA_USAGE_RESPONSES:PSL_OTHER_PERFORMANCE:'))
    .every((row) => row[2] === ''));
  for (const type of ['PSL_CRASH_LOGS', 'PSL_PERFORMANCE_DIAGNOSTICS']) {
    assert.equal(answer(rows, 'PSL_DATA_TYPES_APP_PERFORMANCE', type), 'true');
  }
  assert.equal(review.selectedTypes.length, 10);
});

test('unconfirmed provider state cannot be reported as a completed declaration', () => {
  const { review } = prepare(source, 'unconfirmed');
  assert.deepEqual(review.incomplete, [{ type: 'PSL_OTHER_APP_ACTIVITY', missing: ['required/optional'] }]);
  assert.equal(review.readyForImport, false);
});

test('Acquire OFF scenario is optional collection, not Unity retention sharing', () => {
  const { rows, review } = prepare(source, 'off');
  assert.equal(answer(rows, other + 'DATA_USAGE_USER_CONTROL', 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL'), 'true');
  assert.equal(answer(rows, other + 'DATA_USAGE_USER_CONTROL', 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED'), '');
  assert.equal(answer(rows, other + 'PSL_DATA_USAGE_COLLECTION_AND_SHARING', 'PSL_DATA_USAGE_ONLY_SHARED'), '');
  assert.equal(review.selectedTypeFollowUpsComplete, true);
  assert.equal(review.providerConfigurationVerified, false);
  assert.equal(review.readyForImport, false);
});

test('Acquire ON scenario adds required sharing and all conditional purposes', () => {
  const { rows, review } = prepare(source, 'on');
  assert.equal(answer(rows, other + 'DATA_USAGE_USER_CONTROL', 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED'), 'true');
  assert.equal(answer(rows, other + 'PSL_DATA_USAGE_COLLECTION_AND_SHARING', 'PSL_DATA_USAGE_ONLY_SHARED'), 'true');
  for (const purpose of ['PSL_ANALYTICS', 'PSL_ADVERTISING', 'PSL_FRAUD_PREVENTION_SECURITY']) {
    assert.equal(answer(rows, other + 'DATA_USAGE_SHARING_PURPOSE', purpose), 'true');
  }
  assert.equal(review.selectedTypeFollowUpsComplete, true);
  assert.equal(review.readyForImport, false);
});

test('all scenarios preserve the original schema, unrelated answers and do not mutate the source', () => {
  const before = serializeCsv(source);
  for (const variant of ['unconfirmed', 'off', 'on']) {
    const { rows } = prepare(source, variant);
    validate(rows, source);
    for (let i = 1; i < rows.length; i += 1) {
      const [question, response] = rows[i];
      const inScope = question.startsWith(other)
        || question.startsWith('PSL_DATA_USAGE_RESPONSES:PSL_OTHER_PERFORMANCE:')
        || (question === 'PSL_DATA_TYPES_APP_PERFORMANCE' && response === 'PSL_OTHER_PERFORMANCE')
        || (question.startsWith('PSL_DATA_USAGE_RESPONSES:PSL_APPROX_LOCATION:') && response === 'PSL_PERSONALIZATION');
      if (!inScope) assert.deepEqual(rows[i], source[i]);
    }
  }
  assert.equal(serializeCsv(source), before);
});

test('negative controls reject contradictory single choices and invalid booleans', () => {
  const { rows } = prepare(source, 'off');
  rows.find((row) => row[0] === other + 'DATA_USAGE_USER_CONTROL' && row[1] === 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED')[2] = 'true';
  assert.throws(() => validate(rows, source), /Multiple single-choice/);
  rows[1][2] = 'unknown';
  assert.throws(() => validate(rows, source), /Invalid response value/);
});

test('negative controls reject schema drift, inactive answers and sharing without purposes', () => {
  const renamed = prepare(source, 'off').rows;
  renamed[1][0] += '_TYPO';
  assert.throws(() => validate(renamed, source), /Schema changed/);
  const inactive = prepare(source, 'off').rows;
  inactive.find((row) => row[0].startsWith('PSL_DATA_USAGE_RESPONSES:PSL_OTHER_PERFORMANCE:'))[2] = 'true';
  assert.throws(() => validate(inactive, source), /Inactive type/);
  const missing = prepare(source, 'on').rows;
  missing.filter((row) => row[0] === other + 'DATA_USAGE_SHARING_PURPOSE').forEach((row) => { row[2] = ''; });
  assert.deepEqual(validate(missing, source).incomplete, [
    { type: 'PSL_OTHER_APP_ACTIVITY', missing: ['DATA_USAGE_SHARING_PURPOSE'] },
  ]);
});
