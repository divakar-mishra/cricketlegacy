const mockStorage = new Map<string, string>();
let mockSetFailure = false;
let mockRemoveFailure = false;
let mockClearFailure = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
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

import { clearAllLocalData, getJSON, removeKey, setJSON } from '../storage';

describe('critical storage writes', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSetFailure = false;
    mockRemoveFailure = false;
    mockClearFailure = false;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    expect(mockStorage.has('large-save')).toBe(false);
    expect(mockStorage.has('large-save:__chunk_manifest')).toBe(true);
    expect([...mockStorage.keys()].filter((key) => key.startsWith('large-save:__chunk:')).length).toBe(
      3,
    );
    await expect(getJSON('large-save')).resolves.toEqual(largeValue);

    await removeKey('large-save');
    expect([...mockStorage.keys()].some((key) => key.startsWith('large-save'))).toBe(false);
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
