/* global __dirname */
// Exercise the installed SDK's actual JS decoder, not just Node's fast native
// TextDecoder. This is correctness coverage, not an iPhone performance claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextDecoder, TextEncoder } = require('node:util');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function evaluate(file, globals = {}) {
  const exports = {};
  const context = vm.createContext({ exports, module: { exports }, ...globals });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context);
  return exports;
}
test('yielding decode preserves the actual Expo UTF-8 polyfill output', async () => {
  const ExpoDecoder = evaluate(path.join(root, 'node_modules/expo/src/winter/TextDecoder.ts'),
    { Uint8Array, ArrayBuffer, DataView }).TextDecoder;
  let maxBytes = 0;
  class ObservedDecoder extends ExpoDecoder {
    decode(input, options) {
      maxBytes = Math.max(maxBytes, input?.byteLength ?? 0);
      return super.decode(input, options);
    }
  }
  const { decodeSaveText } = evaluate(path.join(root, 'src/storage/decodeSaveText.ts'),
    { TextDecoder: ObservedDecoder, setTimeout });
  const encoder = new TextEncoder();
  const examples = [new Uint8Array(), encoder.encode('a'.repeat(16_383) + '🏏 नाम 日本語'.repeat(4000)),
    encoder.encode('\ufeff' + JSON.stringify({ history: 'abc'.repeat(40_000), name: '🏏' }))];
  const invalid = new Uint8Array(32_770).fill(0x61);
  invalid.set([0xf0, 0x9f, 0x8f, 0x8f], 16_382);
  invalid.set([0xe0, 0xff, 0xc0, 0xe2], invalid.length - 4);
  examples.push(invalid);
  for (const bytes of examples) {
    assert.equal(await decodeSaveText(bytes), new TextDecoder().decode(bytes));
  }
  assert(maxBytes <= 16 * 1024);
});
