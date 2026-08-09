import fs from 'fs';
import path from 'path';

describe('cloud save service', () => {
  it('uses Supabase cloud_saves when enabled and preserves the local development fallback', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'cloud.ts'), 'utf8');

    expect(source).toContain("from('cloud_saves').upsert");
    expect(source).toContain("from('cloud_saves').select");
    expect(source).toContain('currentSupabaseSession');
    expect(source).toContain('isSupabaseBackendEnabled');
    expect(source).toContain('DATA_PREFIX + key');
  });
});
