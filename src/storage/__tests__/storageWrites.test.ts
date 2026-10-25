const mockStorage = new Map<string, string>();
let mockSetFailure = false;
let mockRemoveFailure = false;
let mockClearFailure = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  multiGet: jest.fn(async (keys: string[]) => keys.map((key) => [key, mockStorage.get(key) ?? null])),
  multiSet: jest.fn(async (rows: [string, string][]) => {
    if (mockSetFailure) throw new Error('disk full');
    rows.forEach(([key, value]) => mockStorage.set(key, value));
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    if (mockRemoveFailure) throw new Error('remove failed');
    keys.forEach((key) => mockStorage.delete(key));
  }),
  setItem: jest.fn(async (key: string, value: string) => {
    if (mockSetFailure) throw new Error('disk full');
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    if (mockRemoveFailure) throw new Error('remove failed');
    mockStorage.delete(key);
  }),
  clear: jest.fn(async () => {
    if (mockClearFailure) throw new Error('clear failed');
    mockStorage.clear();
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllLocalData, getJSON, getJSONStrict, hasStoredValue, removeKey, setJSON } from '../storage';

describe('critical storage writes', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    mockSetFailure = false;
    mockRemoveFailure = false;
    mockClearFailure = false;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks occupancy without parsing damaged rows or reconstructing a chunked career', async () => {
    await expect(hasStoredValue('save')).resolves.toBe(false);
    for (const value of ['null', 'bad-json', '']) {
      mockStorage.set('save', value);
      await expect(hasStoredValue('save')).resolves.toBe(true);
    }
    mockStorage.delete('save');
    mockStorage.set('save:__chunk_manifest', 'damaged-manifest');
    await expect(hasStoredValue('save')).resolves.toBe(true);
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  });

  it('confirms successful writes and removals', async () => {
    await setJSON('save', { value: 7 });
    expect(mockStorage.get('save')).toBe('{"value":7}');
    await removeKey('save');
    expect(mockStorage.has('save')).toBe(false);
  });

  it('round-trips large saves through bounded rows and removes every chunk', async () => {
    const largeValue = { payload: 'x'.repeat(700_000), marker: 'latest-result' };

    await setJSON('large-save', largeValue);
    expect(AsyncStorage.multiSet).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1); // manifest only

    expect(mockStorage.has('large-save')).toBe(false);
    expect(mockStorage.has('large-save:__chunk_manifest')).toBe(true);
    expect([...mockStorage.keys()].filter((key) => key.startsWith('large-save:__chunk:')).length).toBe(
      3,
    );
    await expect(getJSON('large-save')).resolves.toEqual(largeValue);
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);

    await removeKey('large-save');
    expect(AsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
    expect([...mockStorage.keys()].some((key) => key.startsWith('large-save'))).toBe(false);
  });

  it('keeps the old generation readable after a failed payload batch', async () => {
    const previous = { payload: 'x'.repeat(700_000) };
    await setJSON('save', previous);
    const manifest = mockStorage.get('save:__chunk_manifest');
    // Even a partially completed adapter write must not publish the new pointer.
    jest.mocked(AsyncStorage.multiSet).mockImplementationOnce(async (rows) => {
      mockStorage.set(rows[0][0], rows[0][1]);
      throw new Error('interrupted batch');
    });
    await expect(setJSON('save', { payload: 'y'.repeat(700_000) })).rejects.toThrow('interrupted batch');
    expect(mockStorage.get('save:__chunk_manifest')).toBe(manifest);
    await expect(getJSONStrict('save')).resolves.toEqual(previous);
    expect([...mockStorage.keys()].filter(key => key.startsWith('save:__chunk:'))).toHaveLength(3);
  });

  it('orders batch reads by chunk key and rejects a missing chunk', async () => {
    const value = { payload: 'a'.repeat(300_000) + 'b'.repeat(300_000) };
    await setJSON('save', value);
    jest.mocked(AsyncStorage.multiGet).mockImplementationOnce(async (keys) =>
      keys.map((key) => [key, mockStorage.get(key) ?? null] as [string, string | null]).reverse());
    await expect(getJSONStrict('save')).resolves.toEqual(value);
    const chunk = [...mockStorage.keys()].find((key) => key.includes(':__chunk:'))!;
    mockStorage.delete(chunk);
    await expect(getJSONStrict('save')).rejects.toThrow('Missing storage chunk');
  });

  it('keeps the old generation when manifest publication fails', async () => {
    const previous = { payload: 'x'.repeat(700_000) };
    await setJSON('save', previous);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('manifest failed'));
    await expect(setJSON('save', { payload: 'y'.repeat(700_000) })).rejects.toThrow('manifest failed');
    await expect(getJSONStrict('save')).resolves.toEqual(previous);
    expect([...mockStorage.keys()].filter(key => key.startsWith('save:__chunk:'))).toHaveLength(3);
  });

  it.each([false, true])('reclaims every uncommitted chunk across repeated disk-full retries (old chunked=%s)', async oldChunked => {
    const previous = { payload: oldChunked ? 'x'.repeat(700_000) : 'last good progress' };
    await setJSON('save', previous);
    await setJSON('unrelated-save', { payload: 'z'.repeat(700_000) });
    const committedKeys = [...mockStorage.keys()].sort();
    const setItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      if (key === 'save:__chunk_manifest') throw new Error('SQLITE_FULL at commit');
      return setItem(key, value);
    });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        await expect(setJSON('save', { payload: 'y'.repeat(700_000) })).rejects.toThrow('SQLITE_FULL');
        await expect(getJSONStrict('save')).resolves.toEqual(previous);
        expect([...mockStorage.keys()].sort()).toEqual(committedKeys);
      }
    } finally {
      jest.mocked(AsyncStorage.setItem).mockImplementation(setItem);
    }
    const next = { payload: 'successful retry'.repeat(60_000) };
    await setJSON('save', next);
    await expect(getJSONStrict('save')).resolves.toEqual(next);
  });

  it('preserves a published generation when the adapter rejects after committing the manifest', async () => {
    await setJSON('save', { marker: 'old progress' });
    const next = { payload: 'y'.repeat(700_000) };
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
      mockStorage.set(key, value);
      throw new Error('bridge failed after commit');
    });
    await expect(setJSON('save', next)).rejects.toThrow('bridge failed after commit');
    await expect(getJSONStrict('save')).resolves.toEqual(next);
    expect([...mockStorage.keys()].filter(key => key.startsWith('save:__chunk:'))).toHaveLength(3);
  });

  it('does not delete potentially committed chunks if checking publication fails', async () => {
    await setJSON('save', { marker: 'old progress' });
    const next = { payload: 'y'.repeat(700_000) };
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
      mockStorage.set(key, value);
      jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage temporarily unavailable'));
      throw new Error('unconfirmed commit');
    });
    await expect(setJSON('save', next)).rejects.toThrow('unconfirmed commit');
    await expect(getJSONStrict('save')).resolves.toEqual(next);
  });

  it('reports the original write failure even if staged chunk cleanup also fails', async () => {
    const previous = { marker: 'old progress' };
    await setJSON('save', previous);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('original manifest failure'));
    jest.mocked(AsyncStorage.multiRemove).mockRejectedValueOnce(new Error('cleanup failure'));
    await expect(setJSON('save', { payload: 'y'.repeat(700_000) })).rejects.toThrow('original manifest failure');
    await expect(getJSONStrict('save')).resolves.toEqual(previous);
  });

  it('commits the new generation even if old chunk cleanup fails', async () => {
    await setJSON('save', { payload: 'x'.repeat(700_000) });
    const next = { payload: '🏏'.repeat(350_000) };
    jest.mocked(AsyncStorage.multiRemove).mockRejectedValueOnce(new Error('cleanup failed'));
    await setJSON('save', next);
    await expect(getJSONStrict('save')).resolves.toEqual(next);
    const rows = jest.mocked(AsyncStorage.multiSet).mock.calls[1][0];
    for (const [, value] of rows) {
      expect(/[\uD800-\uDBFF]$/.test(value)).toBe(false);
      expect(/^[\uDC00-\uDFFF]/.test(value)).toBe(false);
    }
  });

  it('rejects when AsyncStorage does not confirm a write', async () => {
    mockSetFailure = true;
    await expect(setJSON('save', { value: 7 })).rejects.toThrow('disk full');
  });

  it('rejects when deletion or full-data clearing fails', async () => {
    mockRemoveFailure = true;
    await expect(removeKey('save')).rejects.toThrow('remove failed');

    mockClearFailure = true;
    await expect(clearAllLocalData()).rejects.toThrow('clear failed');
  });
});
