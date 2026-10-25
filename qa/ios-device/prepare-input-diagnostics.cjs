/* global __dirname */
// Frozen-source diagnostic build preparation, never shared runtime edits.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const plist = require('plist');
const root = path.resolve(__dirname, '../..');
const sourceBase = path.join(root, 'output/ios-device/device-qa-2026-10-24-r2');
const original = path.join(sourceBase, 'workspace');
const originalApp = path.join(sourceBase, 'derived-data/Build/Products/Release-iphoneos/CricketSimulator.app');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expectedBundle = '1c682e7ff3b2c9a8912452156f55fb1335ddf9b1ad0b4565534648ad52b7788e';

function replaceOnce(text, old, next) {
  assert.equal(text.split(old).length, 2, 'Instrumentation anchor missing or ambiguous');
  return text.replace(old, next);
}
function prepare(label, build = '2') {
  assert.match(label || '', /^[a-zA-Z0-9_-]+$/);
  assert(['2', '3', '4'].includes(build), 'Only known diagnostic/candidate versions supported');
  const base = path.join(root, 'output/ios-device', label);
  const workspace = path.join(base, 'workspace');
  const app = path.join(base, 'CricketSimulator.app');
  assert(!fs.existsSync(base), 'Refusing to overwrite diagnostic output');
  assert.equal(sha(path.join(originalApp, 'main.jsbundle')), expectedBundle);
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceBase, 'source-snapshot.json'), 'utf8'));
  const files = Object.entries(manifest.sourceHashes);
  for (const [file, expected] of files) {
    assert(!path.isAbsolute(file) && !file.split(path.sep).includes('..'));
    assert.equal(sha(path.join(original, file)), expected, `Frozen source changed: ${file}`);
  }
  for (const name of ['package.json', 'package-lock.json']) {
    assert.equal(sha(path.join(root, name)), sha(path.join(original, name)), 'Dependency checkpoint changed');
  }
  fs.mkdirSync(workspace, { recursive: true });
  for (const [file] of files) {
    const dest = path.join(workspace, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(original, file), dest, fs.constants.COPYFILE_EXCL);
  }
  // Derived public configuration only, not .env files or provider secrets.
  for (const file of ['app.config.js', 'qa-public-env.json']) {
    fs.copyFileSync(path.join(original, file), path.join(workspace, file), fs.constants.COPYFILE_EXCL);
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), 'dir');
  const edit = (file, transform) => {
    const name = path.join(workspace, file);
    fs.writeFileSync(name, transform(fs.readFileSync(name, 'utf8')));
  };
  edit('App.tsx', (text) => {
    text = "import { diagnosticRootHandlers, setInputDiagnosticRoute, startInputDiagnostics } from './src/diagnostics/inputDiagnostics';\nimport { InputDiagnosticsBadge } from './src/diagnostics/InputDiagnosticsBadge';\n" + text;
    text = replaceOnce(text, '  const fontsReady = useAppFonts();', '  useEffect(() => startInputDiagnostics(), []);\n  const fontsReady = useAppFonts();');
    text = replaceOnce(text, 'onLayout={hideNativeSplash}>', 'onLayout={hideNativeSplash} {...diagnosticRootHandlers}>');
    for (const event of ['onReady', 'onStateChange']) {
      text = replaceOnce(text,
        `${event}={() => setAppearanceRoute(navigationRef.getCurrentRoute()?.name)}`,
        `${event}={() => { const route = navigationRef.getCurrentRoute()?.name; setInputDiagnosticRoute(route); setAppearanceRoute(route); }}`);
    }
    return replaceOnce(text, '              <GlassAlertHost />', '              <GlassAlertHost />\n              <InputDiagnosticsBadge />');
  });
  edit('src/screens/MainMenuScreen.tsx', (text) => {
    text = "import { diagnosticPressHandlers, traceInput } from '../diagnostics/inputDiagnostics';\n" + text;
    const first = text.indexOf('// ─── Menu buttons');
    assert(first > 0);
    const prefix = text.slice(0, first);
    const rest = replaceOnce(text.slice(first),
      '        onPress={onPress}',
      "        {...(iconName === 'settings' ? diagnosticPressHandlers('settings') : iconName === 'folder-open' ? diagnosticPressHandlers('saved-games') : {})}\n        onPress={iconName === 'settings' || iconName === 'folder-open' ? (event) => { traceInput('press', iconName === 'settings' ? 'settings' : 'saved-games', event); onPress(); } : onPress}");
    return prefix + rest;
  });
  edit('src/components/ScreenHeader.tsx', (text) => {
    text = "import { diagnosticPressHandlers, traceInput } from '../diagnostics/inputDiagnostics';\n" + text;
    text = replaceOnce(text, '  onBack?: () => void;', '  onBack?: () => void;\n  inputDiagnosticBack?: boolean;');
    text = replaceOnce(text, 'title, subtitle, onBack, right }: Props)', 'title, subtitle, onBack, right, inputDiagnosticBack }: Props)');
    return replaceOnce(text, '          onPress={onBack}',
      "          {...(inputDiagnosticBack ? diagnosticPressHandlers('back') : {})}\n          onPress={inputDiagnosticBack ? (event) => { traceInput('press', 'back', event); onBack(); } : onBack}");
  });
  edit('src/screens/SettingsScreen.tsx', (text) => replaceOnce(text,
    "<ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />",
    "<ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} inputDiagnosticBack />"));
  if (build !== '2') {
    edit('src/screens/SavedGamesScreen.tsx', text => replaceOnce(text,
      '        title="Saved Games"', '        title="Saved Games"\n        inputDiagnosticBack'));
    edit('src/storage/saveGames.ts', text => {
      text = "import { traceInputWork } from '../diagnostics/inputDiagnostics';\n" + text;
      text = replaceOnce(text, '    const raw = await getJSONStrict<unknown>(key);\n    return { raw, save: await openSave(raw, context), occupied: raw !== null };',
        "    const readAt = performance.now();\n    const raw = await getJSONStrict<unknown>(key);\n    traceInputWork('storage-read', readAt);\n    return { raw, save: await openSave(raw, context), occupied: raw !== null };");
      text = replaceOnce(text, '    const migrated = runMigrations(saved);',
        "    const migrationAt = performance.now();\n    const migrated = runMigrations(saved);\n    traceInputWork('migrations', migrationAt);");
      text = replaceOnce(text, '      try { await syncVipArchive(migrated); }',
        "      const vipAt = performance.now();\n      try { await syncVipArchive(migrated); traceInputWork('vip-sync', vipAt); }");
      text = replaceOnce(text, 'export async function listSlots(mode: GameMode): Promise<SlotView[]> {',
        'export async function listSlots(mode: GameMode): Promise<SlotView[]> {\n  const listAt = performance.now();');
      return replaceOnce(text, '  return out;\n}\n\nexport function firstFreeSlot',
        "  traceInputWork('list-slots', listAt);\n  return out;\n}\n\nexport function firstFreeSlot");
    });
    edit('src/storage/saveEncryption.ts', text => {
      text = "import { traceInputWork } from '../diagnostics/inputDiagnostics';\n" + text;
      text = replaceOnce(text, '  const raw = await store.getItemAsync(keyName(context));',
        "  const keyReadAt = performance.now();\n  const raw = await store.getItemAsync(keyName(context));\n  traceInputWork('key-read', keyReadAt);");
      text = replaceOnce(text, "    const key = await crypto.AESEncryptionKey.import(record.key, 'hex');",
        "    const importAt = performance.now();\n    const key = await crypto.AESEncryptionKey.import(record.key, 'hex');\n    traceInputWork('aes-import', importAt);\n    const decodeAt = performance.now();\n    const bytes = encryptedBytes(data);\n    traceInputWork('transport-decode', decodeAt);\n    const sealedAt = performance.now();\n    const sealed = crypto.AESSealedData.fromCombined(bytes);\n    traceInputWork('sealed-data', sealedAt);\n    const openAt = performance.now();");
      text = replaceOnce(text, '      crypto.AESSealedData.fromCombined(encryptedBytes(data)),', '      sealed,');
      return replaceOnce(text, '    const save = unwrapSave(JSON.parse(new TextDecoder().decode(plaintext)));',
        "    traceInputWork('aes-open', openAt);\n    const utf8At = performance.now();\n    const decoded = new TextDecoder().decode(plaintext);\n    traceInputWork('utf8-decode', utf8At);\n    const jsonAt = performance.now();\n    const parsed = JSON.parse(decoded);\n    traceInputWork('json-parse', jsonAt);\n    const integrityAt = performance.now();\n    const save = unwrapSave(parsed);\n    traceInputWork('integrity-check', integrityAt);");
    });
  }
  const diagnosticFolder = path.join(workspace, 'src/diagnostics');
  fs.mkdirSync(diagnosticFolder);
  for (const name of ['inputDiagnostics.ts', 'InputDiagnosticsBadge.tsx']) {
    const template = fs.readFileSync(path.join(__dirname, 'input-diagnostics', name), 'utf8');
    fs.writeFileSync(path.join(diagnosticFolder, name), template.replaceAll('Input QA 2', `Input QA ${build}`).replaceAll('input-qa-2', `input-qa-${build}`));
  }
  const added = ['src/diagnostics/inputDiagnostics.ts', 'src/diagnostics/InputDiagnosticsBadge.tsx'];
  if (build === '4') {
    const helper = 'src/storage/decodeSaveText.ts';
    fs.copyFileSync(path.join(root, helper), path.join(workspace, helper));
    added.push(helper);
    edit('src/storage/saveEncryption.ts', text => {
      text = "import { decodeSaveText } from './decodeSaveText';\n" + text;
      return replaceOnce(text, 'const decoded = new TextDecoder().decode(plaintext);',
        'const decoded = await decodeSaveText(plaintext);');
    });
  }
  fs.cpSync(originalApp, app, { recursive: true, errorOnExist: true, force: false });
  const infoFile = path.join(app, 'Info.plist');
  // Compiled app plists are binary; convert in memory without changing the base.
  const info = plist.parse(cp.execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', infoFile], { encoding: 'utf8' }));
  assert.equal(info.CFBundleIdentifier, 'com.coverdrive.cricket');
  assert.equal(info.CFBundleVersion, '1');
  info.CFBundleVersion = build;
  fs.writeFileSync(infoFile, plist.build(info));
  const changed = files.filter(([name, hash]) => sha(path.join(workspace, name)) !== hash).map(([name]) => name).sort();
  const expectedChanges = ['App.tsx', 'src/components/ScreenHeader.tsx', 'src/screens/MainMenuScreen.tsx', 'src/screens/SettingsScreen.tsx'];
  if (build !== '2') expectedChanges.push('src/screens/SavedGamesScreen.tsx', 'src/storage/saveGames.ts', 'src/storage/saveEncryption.ts');
  assert.deepEqual(changed, expectedChanges.sort());
  // Verify the original checkpoint is still immutable after preparation.
  for (const [name, hash] of files) assert.equal(sha(path.join(original, name)), hash);
  const result = { kind: build === '4' ? 'input-timing QA with yielding save decode candidate; not a distribution release' : 'temporary input-timing QA, not a fix or distribution release',
    sourceBase: path.relative(root, sourceBase), originalBundleSha256: expectedBundle,
    baseFiles: files.length, changedExistingFiles: changed, addedFiles: added,
    build, nativeExecutableUnchanged: sha(path.join(app, 'CricketSimulator')) === sha(path.join(originalApp, 'CricketSimulator')),
    sharedRuntimeEdited: false, data: 'bounded numeric input/work timings, menu/settings/saved-games only, local cache, 10 minute limit',
    capturedAtUtc: new Date().toISOString() };
  fs.writeFileSync(path.join(base, 'diagnostic-snapshot.json'), JSON.stringify(result, null, 2) + '\n');
  return { base, workspace, app, ...result };
}
module.exports = { replaceOnce, prepare };
if (require.main === module) console.log(JSON.stringify(prepare(process.argv[2], process.argv[3]), null, 2));
