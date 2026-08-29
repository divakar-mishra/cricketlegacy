import fs from 'node:fs';
import path from 'node:path';

describe('Android career save capacity', () => {
  it('raises AsyncStorage above its 6 MB default for full career slots and backups', () => {
    const gradleProperties = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'android', 'gradle.properties'),
      'utf8',
    );
    const configuredLimit = gradleProperties.match(/^AsyncStorage_db_size_in_MB=(\d+)$/m);

    expect(configuredLimit).not.toBeNull();
    expect(Number(configuredLimit?.[1])).toBeGreaterThanOrEqual(64);
  });
});
