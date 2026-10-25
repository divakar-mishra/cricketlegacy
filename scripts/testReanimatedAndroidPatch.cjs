/* global __dirname */
// Compiles/runs the real NativeProxy method on a host JVM with small API doubles.
// Requires an installed Android/JDK toolchain and cached Kotlin compiler jars.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const patch = require('./patchReanimatedAndroid.cjs');

function jar(group, name, version) {
  const base = path.join(os.homedir(), '.gradle/caches/modules-2/files-2.1', group, name, version);
  if (!fs.existsSync(base)) throw new Error(`Missing cached compiler dependency: ${group}:${name}:${version}`);
  const files = fs.readdirSync(base, { recursive: true }).filter(file => file.endsWith('.jar'));
  if (files.length !== 1) throw new Error(`Expected one compiler jar in ${base}`);
  return path.join(base, files[0]);
}

function main() {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt'), 'utf8');
  const vulnerable = source.replace(patch.GUARDED_LOOKUP, patch.LOOKUP)
    .replace(patch.GUARDED_UPDATE, patch.UPDATE).replace(patch.CONCISE_WARNING, patch.WARNING);
  const patched = patch.patchSource(vulnerable, '4.5.1').source;
  if (source !== patched) throw new Error('Install/postinstall patch must be applied before native regression testing');
  const kotlinVersion = '2.1.20';
  const stdlib = jar('org.jetbrains.kotlin', 'kotlin-stdlib', kotlinVersion);
  const compilerClasspath = [
    jar('org.jetbrains.kotlin', 'kotlin-compiler-embeddable', kotlinVersion), stdlib,
    jar('org.jetbrains.kotlin', 'kotlin-script-runtime', kotlinVersion),
    jar('org.jetbrains.kotlin', 'kotlin-reflect', kotlinVersion),
    jar('org.jetbrains.kotlin', 'kotlin-daemon-embeddable', kotlinVersion),
    jar('org.jetbrains.intellij.deps', 'trove4j', '1.0.20200330'),
    jar('org.jetbrains', 'annotations', '13.0'),
    jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0'),
  ].join(path.delimiter);
  const androidJava = '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java';
  const java = process.env.REANIMATED_TEST_JAVA || (fs.existsSync(androidJava) ? androidJava : 'java');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cricket-reanimated-regression-'));
  const template = fs.readFileSync(path.join(__dirname, 'fixtures/reanimated-sync-props/SynchronousPropsRegression.kt'), 'utf8');
  const reports = [];
  for (const [name, native] of [['vulnerable-control', vulnerable], ['patched', patched]]) {
    const start = native.indexOf('    private val mountingManager: Any by lazy');
    const end = native.indexOf('\n    @DoNotStrip\n    fun setGestureState(', start);
    if (start < 0 || end < 0) throw new Error('NativeProxy method extraction markers changed');
    const actual = 'class NativeProxy(private val mFabricUIManager: FabricUIManager) {\n' + native.slice(start, end) + '\n}';
    const directory = path.join(temporary, name);
    fs.mkdirSync(directory);
    const generated = path.join(directory, 'SynchronousPropsRegression.kt');
    fs.writeFileSync(generated, template.replace('/* INSERT_ACTUAL_NATIVE_PROXY */', actual));
    const classes = path.join(directory, 'classes');
    const compile = spawnSync(java, ['-cp', compilerClasspath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', stdlib, '-d', classes, generated], { encoding: 'utf8', timeout: 60000 });
    if (compile.status !== 0) throw new Error(`Kotlin compile failed for ${name}: ${compile.error || compile.stderr}`);
    const run = spawnSync(java, ['-cp', classes + path.delimiter + stdlib, 'SynchronousPropsRegressionKt'], { encoding: 'utf8', timeout: 30000 });
    console.log(name + '\n' + run.stdout);
    reports.push({ name, exitCode: run.status, stdout: run.stdout, timedOut: Boolean(run.error) });
  }
  const passed = reports[0].exitCode !== 0 && reports[0].stdout.includes('FAIL: unmounted tag') && reports[1].exitCode === 0 && reports[1].stdout.includes('RESULT: 12 passed, 0 failed');
  const summary = { passed, scope: 'Host-JVM execution of actual NativeProxy code, not an Android/JNI/draw or GPU certification', reports };
  const output = path.join(root, 'output/anr-investigation-2026-10-19');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'native-jvm-regression.json'), JSON.stringify(summary, null, 2) + '\n');
  if (!passed) throw new Error('Expected vulnerable-control failure and all patched regressions passing');
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
