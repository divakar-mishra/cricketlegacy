/* global __dirname */
// Targeted backport of upstream Reanimated PR #10435 (MIT), not a version upgrade.
// https://github.com/software-mansion/react-native-reanimated/pull/10435
const fs = require('node:fs');
const path = require('node:path');

const VERSION = '4.5.1';
const LOOKUP = `    @DoNotStrip
    fun synchronouslyUpdateUIProps(`;
const GUARDED_LOOKUP = `    // Backport #10435: a removed view must not throw/log on every drawing frame.
    private val getViewExistsMethod by lazy {
        runCatching {
            mountingManager.javaClass.getMethod("getViewExists", Int::class.javaPrimitiveType)
        }.getOrNull()
    }

${LOOKUP}`;
const UPDATE = `                    updatePropsSynchronouslyMethod.invoke(mountingManager, viewTag, props)`;
const GUARDED_UPDATE = `                    if (getViewExistsMethod?.invoke(mountingManager, viewTag) == false) {
                        return@parse
                    }
${UPDATE}`;
const WARNING = '                    Log.w("Reanimated", "synchronouslyUpdateUIProps failed for tag $viewTag", e)';
const CONCISE_WARNING = '                    Log.w("Reanimated", "synchronouslyUpdateUIProps failed for tag $viewTag: ${e.cause ?: e}")';

function patchSource(source, version) {
  if (version !== VERSION) {
    throw new Error(`Reanimated ANR backport targets ${VERSION}, found ${version}; review/retire it before upgrading.`);
  }
  const normalized = source.replace(/\r\n/g, '\n');
  const original = [LOOKUP, UPDATE, WARNING];
  const replacement = [GUARDED_LOOKUP, GUARDED_UPDATE, CONCISE_WARNING];
  if (replacement.every((part) => normalized.includes(part)) && !normalized.includes(WARNING)) {
    return { source, changed: false };
  }
  if (normalized.includes('getViewExistsMethod') || normalized.includes(CONCISE_WARNING)) {
    throw new Error('Reanimated ANR backport is only partially present; refusing a partial rewrite.');
  }
  if (!original.every((part) => normalized.split(part).length === 2)) {
    throw new Error('Reanimated native source changed; ANR backport markers are not unique.');
  }
  let patched = normalized;
  original.forEach((part, i) => { patched = patched.replace(part, replacement[i]); });
  return { source: source.includes('\r\n') ? patched.replace(/\n/g, '\r\n') : patched, changed: true };
}

function main() {
  const dependency = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated');
  const version = JSON.parse(fs.readFileSync(path.join(dependency, 'package.json'), 'utf8')).version;
  const nativeFile = path.join(dependency, 'android/src/main/java/com/swmansion/reanimated/NativeProxy.kt');
  const result = patchSource(fs.readFileSync(nativeFile, 'utf8'), version);
  if (result.changed) fs.writeFileSync(nativeFile, result.source);
  console.log(`Reanimated Android stale-view ANR backport ${result.changed ? 'applied' : 'already applied'}.`);
}

module.exports = { patchSource, VERSION, LOOKUP, GUARDED_LOOKUP, UPDATE, GUARDED_UPDATE, WARNING, CONCISE_WARNING };
if (require.main === module) main();
