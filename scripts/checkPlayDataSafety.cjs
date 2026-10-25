// Offline CSV checks only. These cannot verify a provider's private settings.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const HEADER = [
  'Question ID (machine readable)',
  'Response ID (machine readable)',
  'Response value',
  'Answer requirement',
  'Human-friendly question label',
];

function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => { finishField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i += 1; }
      else { quoted = false; closed = true; }
    } else if (char === ',') finishField();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      finishRow();
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else {
      assert(!closed && char !== '"', 'Malformed CSV quoting');
      field += char;
    }
  }
  assert(!quoted, 'Unterminated quoted CSV field');
  if (field !== '' || row.length || closed) finishRow();
  return rows;
}

function serializeCsv(rows) {
  return rows.map((row) => row.map((value) => /[,"\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"` : value).join(',')).join('\n') + '\n';
}

function validate(rows, reference) {
  assert.deepEqual(rows[0], HEADER, 'Unexpected Play CSV header');
  if (reference) assert.equal(rows.length, reference.length, 'Response row count changed');
  const keys = new Set(), groups = new Map();
  for (const [index, row] of rows.entries()) {
    assert.equal(row.length, 5, `Row ${index + 1}: expected five columns`);
    if (index === 0) continue;
    const [question, response, value, requirement] = row;
    assert(question, `Row ${index + 1}: missing question ID`);
    const key = JSON.stringify([question, response]);
    assert(!keys.has(key), `Duplicate response: ${key}`);
    keys.add(key);
    if (reference) for (const column of [0, 1, 3, 4]) {
      assert.equal(row[column], reference[index][column], `Schema changed at row ${index + 1}`);
    }
    if (!groups.has(question)) groups.set(question, []);
    groups.get(question).push(row);
    const textAnswer = ['PSL_ACCOUNT_DELETION_URL', 'PSL_DATA_DELETION_URL',
      'PSL_ACM_SPECIFY', 'PSL_OUTSIDE_APP_ACCOUNT_TYPE_SPECIFY'].includes(question);
    assert(textAnswer || ['', 'true', 'false'].includes(value), `Invalid response value: ${key}`);
    if (requirement === 'REQUIRED') assert(value !== '', `Required answer missing: ${question}`);
  }
  for (const [question, group] of groups) {
    if (group[0][3] === 'SINGLE_CHOICE') {
      assert(group.filter((row) => row[2] === 'true').length <= 1,
        `Multiple single-choice answers: ${question}`);
    }
  }
  const selected = rows.filter((row) => row[0].startsWith('PSL_DATA_TYPES_') && row[2] === 'true');
  const incomplete = [];
  for (const typeRow of rows.filter((row) => row[0].startsWith('PSL_DATA_TYPES_'))) {
    const type = typeRow[1], prefix = `PSL_DATA_USAGE_RESPONSES:${type}:`;
    const answers = rows.filter((row) => row[0].startsWith(prefix));
    assert(answers.length, `Missing follow-ups: ${type}`);
    if (typeRow[2] !== 'true') {
      assert(answers.every((row) => row[2] === ''), `Inactive type has answers: ${type}`);
      continue;
    }
    const question = (suffix) => groups.get(prefix + suffix) || [];
    const chosen = (suffix) => question(suffix).filter((row) => row[2] === 'true');
    const missing = [];
    const handling = chosen('PSL_DATA_USAGE_COLLECTION_AND_SHARING').map((row) => row[1]);
    if (!handling.length) missing.push('collected/shared');
    if (!['true', 'false'].includes(question('PSL_DATA_USAGE_EPHEMERAL')[0]?.[2])) missing.push('ephemeral');
    if (chosen('DATA_USAGE_USER_CONTROL').length !== 1) missing.push('required/optional');
    for (const [flag, purpose] of [
      ['PSL_DATA_USAGE_ONLY_COLLECTED', 'DATA_USAGE_COLLECTION_PURPOSE'],
      ['PSL_DATA_USAGE_ONLY_SHARED', 'DATA_USAGE_SHARING_PURPOSE'],
    ]) {
      if (handling.includes(flag)) {
        if (!chosen(purpose).length) missing.push(purpose);
      } else assert.equal(chosen(purpose).length, 0, `Purposes without ${flag}: ${type}`);
    }
    if (missing.length) incomplete.push({ type, missing });
  }
  return {
    responseRows: rows.length - 1,
    uniqueResponseKeys: keys.size,
    selectedTypes: selected.map((row) => row[1]),
    incomplete,
    selectedTypeFollowUpsComplete: incomplete.length === 0,
  };
}

module.exports = { parseCsv, serializeCsv, validate };

if (require.main === module) {
  const paths = process.argv.slice(2);
  assert(paths.length, 'Usage: node scripts/checkPlayDataSafety.cjs <CSV> [CSV ...]');
  const reference = parseCsv(fs.readFileSync(
    'docs/data-safety-REVIEW-DRAFT-DO-NOT-IMPORT-2026-10-20.csv', 'utf8'));
  for (const path of paths) {
    const rows = parseCsv(fs.readFileSync(path, 'utf8'));
    assert.deepEqual(parseCsv(serializeCsv(rows)), rows, 'CSV round-trip failed');
    process.stdout.write(JSON.stringify({ path, ...validate(rows, reference),
      providerConfigurationVerified: false, readyForImport: false }) + '\n');
  }
}
