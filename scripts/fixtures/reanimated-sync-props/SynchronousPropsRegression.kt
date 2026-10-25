// Host-JVM contract regression harness. The runner inserts the actual patched
// NativeProxy properties/method, not a JavaScript reimplementation of the guard.
// Android drawing, JNI and the SDK buffer decoder are NOT simulated faithfully.
import java.lang.reflect.Method

annotation class DoNotStrip
class JavaOnlyMap(val value: String = "unchanged")
object BuildConfig { var IS_REACT_NATIVE_86_OR_NEWER = true }
object Log {
  data class Entry(val message: String, val throwable: Throwable?)
  val entries = mutableListOf<Entry>()
  fun w(tag: String, message: String): Int { entries.add(Entry(message, null)); return 0 }
  fun w(tag: String, message: String, error: Throwable): Int { entries.add(Entry(message, error)); return 0 }
}
object SynchronousPropsBufferParser {
  // The unchanged SDK decoder is outside this harness: test its per-tag callback contract.
  fun parse(tags: IntArray, values: DoubleArray, update: (Int, JavaOnlyMap) -> Unit) {
    tags.forEach { update(it, JavaOnlyMap()) }
  }
}
class FabricUIManager(@JvmField val mMountingManager: Any) {
  val legacyUpdates = mutableListOf<Int>()
  fun synchronouslyUpdateViewOnUIThread(tag: Int, props: JavaOnlyMap) { legacyUpdates.add(tag) }
}
class MountingManager(val mounted: MutableSet<Int>) {
  val updates = mutableListOf<Int>()
  val props = mutableListOf<JavaOnlyMap>()
  val failingChecks = mutableSetOf<Int>()
  val failingUpdates = mutableSetOf<Int>()
  fun getViewExists(tag: Int): Boolean {
    if (tag in failingChecks) error("unexpected lookup failure")
    return tag in mounted
  }
  fun updatePropsSynchronously(tag: Int, value: JavaOnlyMap) {
    check(tag in mounted) { "Unable to find SurfaceMountingManager for tag: [$tag]" }
    if (tag in failingUpdates) error("unexpected update failure")
    updates.add(tag); props.add(value)
  }
}
class LegacyMountingManager {
  val updates = mutableListOf<Int>()
  fun updatePropsSynchronously(tag: Int, props: JavaOnlyMap) { updates.add(tag) }
}

/* INSERT_ACTUAL_NATIVE_PROXY */

fun main() {
  var passed = 0
  var failed = 0
  fun scenario(name: String, body: () -> Unit) {
    BuildConfig.IS_REACT_NATIVE_86_OR_NEWER = true
    Log.entries.clear()
    try { body(); passed++; println("PASS: $name") }
    catch (e: Throwable) { failed++; println("FAIL: $name: ${e.message}") }
  }
  fun proxy(manager: Any) = NativeProxy(FabricUIManager(manager))
  fun update(target: NativeProxy, vararg tags: Int) = target.synchronouslyUpdateUIProps(tags, doubleArrayOf())

  scenario("mounted views retain their native update and props") {
    val manager = MountingManager(mutableSetOf(1))
    update(proxy(manager), 1)
    check(manager.updates == listOf(1)); check(manager.props.single().value == "unchanged")
    check(Log.entries.isEmpty())
  }
  scenario("unmounted tag is skipped without a throwable warning") {
    val manager = MountingManager(mutableSetOf())
    update(proxy(manager), 404)
    check(manager.updates.isEmpty()); check(Log.entries.isEmpty())
  }
  scenario("a removed tag cannot abort later live tags in the same batch") {
    val manager = MountingManager(mutableSetOf(2, 4))
    update(proxy(manager), 1, 2, 3, 4)
    check(manager.updates == listOf(2, 4)); check(Log.entries.isEmpty())
  }
  scenario("10000 stale updates do not flood UI-thread exception logs") {
    val manager = MountingManager(mutableSetOf())
    val target = proxy(manager)
    repeat(1000) { update(target, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) }
    check(manager.updates.isEmpty()); check(Log.entries.isEmpty())
  }
  scenario("unexpected update failures stay observable without full stack logging") {
    val manager = MountingManager(mutableSetOf(1, 2))
    manager.failingUpdates.add(1)
    update(proxy(manager), 1, 2)
    check(manager.updates == listOf(2))
    check(Log.entries.size == 1); check(Log.entries.single().throwable == null)
    check(Log.entries.single().message.contains("unexpected update failure"))
  }
  scenario("a failing existence lookup does not abort subsequent tags") {
    val manager = MountingManager(mutableSetOf(1, 2))
    manager.failingChecks.add(1)
    update(proxy(manager), 1, 2)
    check(manager.updates == listOf(2)); check(Log.entries.size == 1)
    check(Log.entries.single().throwable == null)
  }
  scenario("missing optional existence API keeps the compatibility fallback") {
    val manager = LegacyMountingManager()
    update(proxy(manager), 8, 9)
    check(manager.updates == listOf(8, 9)); check(Log.entries.isEmpty())
  }
  scenario("pre RN-0.86 uses its original public Fabric API") {
    BuildConfig.IS_REACT_NATIVE_86_OR_NEWER = false
    val fabric = FabricUIManager(Any())
    update(NativeProxy(fabric), 8, 9)
    check(fabric.legacyUpdates == listOf(8, 9)); check(Log.entries.isEmpty())
  }
  scenario("empty buffers need no reflective API lookup") {
    update(proxy(Any()))
    check(Log.entries.isEmpty())
  }
  scenario("a tag becoming mounted later can receive new updates") {
    val manager = MountingManager(mutableSetOf<Int>())
    val target = proxy(manager)
    update(target, 1); manager.mounted.add(1); update(target, 1)
    check(manager.updates == listOf(1)); check(Log.entries.isEmpty())
  }
  scenario("a live tag becoming unmounted is skipped on the next batch") {
    val manager = MountingManager(mutableSetOf(1))
    val target = proxy(manager)
    update(target, 1); manager.mounted.remove(1); update(target, 1)
    check(manager.updates == listOf(1)); check(Log.entries.isEmpty())
  }
  scenario("repeated live updates are neither lost nor deduplicated") {
    val manager = MountingManager(mutableSetOf(1))
    val target = proxy(manager)
    repeat(1000) { update(target, 1) }
    check(manager.updates.size == 1000); check(Log.entries.isEmpty())
  }
  println("RESULT: $passed passed, $failed failed")
  if (failed != 0) error("Native synchronous-props regression failed")
}
