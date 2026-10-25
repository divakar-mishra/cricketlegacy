// Diagnostic failure-injection audit; no device database or user save is read.
const mockRows = new Map<string, string>();
let mockFailManifest = false;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockRows.get(key) ?? null,
  multiGet: async (keys: string[]) => keys.map(key => [key, mockRows.get(key) ?? null]),
  setItem: async (key: string, value: string) => {
    if (mockFailManifest && key.endsWith(':__chunk_manifest')) throw new Error('SQLITE_FULL at manifest commit');
    mockRows.set(key, value);
  },
  multiSet: async (rows: [string, string][]) => { rows.forEach(([key, value]) => mockRows.set(key, value)); },
  removeItem: async (key: string) => { mockRows.delete(key); },
  multiRemove: async (keys: string[]) => { keys.forEach(key => mockRows.delete(key)); },
}));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
const { setJSON, getJSONStrict } = jest.requireActual<typeof import('../src/storage/storage')>('../src/storage/storage');

describe('diagnostic: chunked save commit failure and retry capacity', () => {
  beforeEach(() => { mockRows.clear(); mockFailManifest = false; });
  it('reclaims staged chunks after repeated failed manifest commits', async () => {
    const key = 'audit:chunked-save';
    await setJSON(key, { previous: 'authoritative progress' });
    mockFailManifest = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        await expect(setJSON(key, { large: 'x'.repeat(600_000) })).rejects.toThrow('SQLITE_FULL');
        expect(await getJSONStrict(key)).toEqual({ previous: 'authoritative progress' });
      }
      const orphanKeys = [...mockRows.keys()].filter(k => k.startsWith(key + ':__chunk:'));
      expect(orphanKeys).toHaveLength(0);
    } finally { warn.mockRestore(); }
  });
});
