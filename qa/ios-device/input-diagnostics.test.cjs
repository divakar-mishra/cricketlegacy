/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Buffer } = require('node:buffer');
const ts = require('typescript');
const { replaceOnce } = require('./prepare-input-diagnostics.cjs');
const { nativeSectionHashes } = require('./native-section-hashes.cjs');
const source = fs.readFileSync(path.join(__dirname, 'input-diagnostics/inputDiagnostics.ts'), 'utf8');

function harness(options = {}) {
  let now = 0;
  let tick;
  let stateChanged;
  const writes = [];
  const copies = [];
  const exports = {};
  const native = {
    AppState: { currentState: 'active', addEventListener: (_name, callback) => {
      stateChanged = callback;
      return { remove() {} };
    } },
  };
  const filesystem = {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async () => ({ exists: !!options.previous }),
    copyAsync: async (args) => { copies.push(args); },
    writeAsStringAsync: async (file, body) => {
      writes.push({ file, body });
      if (options.failWrite) throw new Error('private error content must not be logged');
    },
  };
  const context = vm.createContext({ exports, module: { exports },
    require(name) {
      if (name === 'react-native') return native;
      if (name === 'expo-file-system/legacy') return filesystem;
      throw new Error('Unexpected diagnostic dependency: ' + name);
    },
    performance: { now: () => now },
    setInterval(callback) { tick = callback; return 1; },
    clearInterval() { tick = undefined; },
  });
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInContext(js, context);
  return { api: exports, writes, copies,
    advance(ms) { now += ms; tick?.(); },
    state(value) { stateChanged(value); },
    payload() { return JSON.parse(writes.at(-1).body); },
  };
}

test('strict snapshot anchors fail closed', () => {
  assert.equal(replaceOnce('a b c', 'b', 'x'), 'a x c');
  assert.throws(() => replaceOnce('a', 'b', 'x'));
  assert.throws(() => replaceOnce('b b', 'b', 'x'));
});

test('native-section comparison ignores non-section signature bytes, not code changes', () => {
  const bytes = Buffer.alloc(200);
  bytes.writeUInt32LE(0xfeedfacf, 0);
  bytes.writeUInt32LE(1, 16);
  bytes.writeUInt32LE(0x19, 32);
  bytes.writeUInt32LE(152, 36);
  bytes.writeUInt32LE(1, 96);
  bytes.write('__text', 104);
  bytes.write('__TEXT', 120);
  bytes.writeBigUInt64LE(3n, 144);
  bytes.writeUInt32LE(184, 152);
  bytes.write('abc', 184);
  const expected = nativeSectionHashes(bytes);
  bytes[199] = 1;
  assert.deepEqual(nativeSectionHashes(bytes), expected);
  bytes[184] = 1;
  assert.notDeepEqual(nativeSectionHashes(bytes), expected);
  assert.throws(() => nativeSectionHashes(Buffer.alloc(32)));
});

test('only approved screens, targets and numeric event fields are recorded', async () => {
  const h = harness();
  h.api.startInputDiagnostics();
  h.api.setInputDiagnosticRoute('Login');
  h.api.traceInput('touch-start', 'root', { nativeEvent: { text: 'SECRET_CREDENTIAL' } });
  h.api.setInputDiagnosticRoute('MainMenu');
  h.api.traceInput('touch-start', 'root', { nativeEvent: {
    timestamp: 123.456, pageX: 50, pageY: 80, identifier: 0,
    text: 'SECRET_CREDENTIAL', url: 'SECRET_URL', target: { token: 'SECRET_TOKEN' },
  } });
  h.api.traceInput('press', 'settings');
  h.api.traceInput('press', 'back'); // Wrong route: must be ignored.
  h.api.traceInput('arbitrary-private-string', 'root');
  h.api.setInputDiagnosticRoute('Settings');
  h.api.traceInput('press', 'back');
  h.api.setInputDiagnosticRoute('PrivateAccount');
  h.api.traceInput('touch-start', 'root');
  await h.api.flushInputDiagnostics();
  const p = h.payload();
  assert.equal(p.counts.touch, 1);
  assert.equal(p.counts.press, 2);
  assert.equal(p.counts.nav, 2);
  assert.ok(p.events.every(e => ['MainMenu', 'Settings'].includes(e.route)));
  assert.equal(p.events.find(e => e.phase === 'touch-start').nativeAtMs, 123.46);
  assert.doesNotMatch(h.writes.at(-1).body, /SECRET_|Login|PrivateAccount/);
  assert.ok(h.writes.every(w => w.file === 'file:///cache/cricket-input-trace-v1.json'));
});

test('event ring is bounded, timer expires and no post-expiry input is captured', async () => {
  const h = harness();
  h.api.startInputDiagnostics();
  h.api.setInputDiagnosticRoute('MainMenu');
  for (let i = 0; i < 1500; i++) h.api.traceInput('touch-start', 'root');
  h.advance(600_000);
  h.api.traceInput('press', 'settings');
  await h.api.flushInputDiagnostics();
  const p = h.payload();
  assert.equal(p.events.length, 1024);
  assert.equal(p.counts.press, 0);
  assert.equal(p.events.at(-1).phase, 'expired');
  assert.match(h.api.readInputDiagnosticsDisplay(), /expired/);
});

test('background is ignored and foreground time does not invent a JS gap', async () => {
  const h = harness();
  h.api.startInputDiagnostics();
  h.api.setInputDiagnosticRoute('MainMenu');
  h.state('background');
  h.advance(10_000);
  h.api.traceInput('press', 'settings');
  h.state('active');
  h.advance(100);
  await h.api.flushInputDiagnostics();
  assert.equal(h.payload().counts.press, 0);
  assert.equal(h.payload().counts.gap, 0);
  h.advance(500);
  await h.api.flushInputDiagnostics();
  assert.equal(h.payload().counts.gap, 1);
});

test('Saved Games stage timings accept only known labels and finite elapsed numbers', async () => {
  const h = harness();
  h.api.startInputDiagnostics();
  h.api.setInputDiagnosticRoute('SavedGames');
  h.api.traceInputWork('aes-open', 0);
  h.advance(500);
  h.api.traceInputWork('sealed-data', 100);
  h.api.traceInputWork('SECRET_SAVE_CONTENT', 0);
  h.api.traceInputWork('key-read', NaN);
  h.api.traceInputWork('json-parse', 10_000);
  h.api.setInputDiagnosticRoute('Login');
  h.api.traceInputWork('key-read', 0);
  await h.api.flushInputDiagnostics();
  const work = h.payload().events.filter(e => e.phase === 'work');
  assert.equal(work.length, 2);
  assert.equal(work[1].durationMs, 400);
  assert.equal(work[1].stage, 'sealed-data');
  assert.ok(work.every(e => e.route === 'SavedGames'));
  assert.doesNotMatch(h.writes.at(-1).body, /SECRET_|NaN|Login/);
});

test('rotates only its own prior diagnostic file; write failures do not escape', async () => {
  const h = harness({ previous: true, failWrite: true });
  h.api.startInputDiagnostics();
  h.api.setInputDiagnosticRoute('MainMenu');
  await h.api.flushInputDiagnostics();
  h.advance(1000);
  assert.equal(h.copies.length, 1);
  assert.equal(h.copies[0].from, 'file:///cache/cricket-input-trace-v1.json');
  assert.equal(h.copies[0].to, 'file:///cache/cricket-input-trace-v1.previous.json');
  assert.match(h.api.readInputDiagnosticsDisplay(), /write failed/);
  assert.doesNotMatch(h.writes.at(-1).body, /private error/);
});
