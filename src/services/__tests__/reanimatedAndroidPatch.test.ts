import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const patch = require('../../../scripts/patchReanimatedAndroid.cjs');
const nativePath = path.join(process.cwd(), 'node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt');
const installed = fs.readFileSync(nativePath, 'utf8');
const vulnerable = installed
  .replace(patch.GUARDED_LOOKUP, patch.LOOKUP)
  .replace(patch.GUARDED_UPDATE, patch.UPDATE)
  .replace(patch.CONCISE_WARNING, patch.WARNING);

describe('durable Android Reanimated stale-view backport', () => {
  it('guards removed tags before invoking the synchronous native update', () => {
    const result = patch.patchSource(vulnerable, '4.5.1');
    expect(result.changed).toBe(true);
    expect(result.source).toContain(patch.GUARDED_LOOKUP);
    expect(result.source).toContain(patch.GUARDED_UPDATE);
    expect(result.source).not.toContain(patch.WARNING);
    expect(result.source).toContain(patch.CONCISE_WARNING);
    // The old-RN branch and all other native code remain byte-for-byte unchanged.
    expect(result.source.replace(patch.GUARDED_LOOKUP, patch.LOOKUP)
      .replace(patch.GUARDED_UPDATE, patch.UPDATE)
      .replace(patch.CONCISE_WARNING, patch.WARNING)).toBe(vulnerable);
  });

  it('does not rewrite an already patched dependency on repeated installs', () => {
    const once = patch.patchSource(vulnerable, '4.5.1');
    expect(patch.patchSource(once.source, '4.5.1')).toEqual({ source: once.source, changed: false });
  });

  it('preserves CRLF line endings', () => {
    const result = patch.patchSource(vulnerable.replace(/\n/g, '\r\n'), '4.5.1');
    expect(result.source.replace(/\r\n/g, '')).not.toContain('\n');
    expect(patch.patchSource(result.source, '4.5.1').changed).toBe(false);
  });

  it.each(['4.5.2', '4.7.0', undefined])('requires review for dependency version %s', version => {
    expect(() => patch.patchSource(vulnerable, version)).toThrow(/review\/retire/);
  });

  it.each([
    vulnerable.replace(patch.WARNING, ''),
    vulnerable + '\n' + patch.UPDATE,
    vulnerable.replace(patch.UPDATE, patch.GUARDED_UPDATE),
    vulnerable.replace(patch.LOOKUP, patch.GUARDED_LOOKUP),
  ])('fails closed on changed or partially patched native source', source => {
    expect(() => patch.patchSource(source, '4.5.1')).toThrow();
  });

  it('applies the mitigation to the actual dependency used by local/native builds', () => {
    expect(patch.patchSource(installed, '4.5.1').changed).toBe(false);
  });

  it('runs after every clean npm/EAS install without changing the lockfile version', () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    expect(config.scripts.postinstall).toContain('node scripts/patchReanimatedAndroid.cjs');
    expect(config.dependencies['react-native-reanimated']).toBe('4.5.1');
  });
});
