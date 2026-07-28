import AsyncStorage from '@react-native-async-storage/async-storage';

/** Thin typed JSON wrapper around AsyncStorage. */
export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.warn(`storage.getJSON failed for ${key}`, err);
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`storage.setJSON failed for ${key}`, err);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`storage.removeKey failed for ${key}`, err);
  }
}
