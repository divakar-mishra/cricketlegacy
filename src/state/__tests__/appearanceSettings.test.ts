import AsyncStorage from '@react-native-async-storage/async-storage';
import { APPEARANCE_PROMPT_MS, migrateAppearanceSettings, useSettings } from '../settingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(() => useSettings.getState().reset());

test('Classic is the default and the chooser threshold is exactly 20 minutes', () => {
  expect(useSettings.getState().appearance).toBe('classic');
  expect(APPEARANCE_PROMPT_MS).toBe(1200000);
  useSettings.getState().addAppearancePlayTime(1199999);
  expect(useSettings.getState().appearancePlayMs).toBeLessThan(APPEARANCE_PROMPT_MS);
  useSettings.getState().addAppearancePlayTime(1);
  expect(useSettings.getState().appearancePlayMs).toBe(APPEARANCE_PROMPT_MS);
});

test.each(['dark', 'light', 'system'])('migrates legacy %s without losing other settings', themeMode => {
  const migrated = migrateAppearanceSettings({ themeMode, music: false, dismissedTips: ['batting'], playedMatchesAllModes: 18 });
  expect(migrated).toMatchObject({ appearance: 'classic', music: false, dismissedTips: ['batting'], playedMatchesAllModes: 18 });
  expect(migrated).not.toHaveProperty('themeMode');
});

test('persists a choice and never prompts again after choosing or dismissing', async () => {
  useSettings.getState().setAppearance('warm');
  expect(useSettings.getState().appearancePromptDone).toBe(true);
  await useSettings.persist.rehydrate();
  expect(useSettings.getState().appearance).toBe('warm');
  expect(useSettings.getState().appearancePromptDone).toBe(true);
  expect(AsyncStorage.setItem).toHaveBeenCalled();
  useSettings.getState().reset();
  useSettings.getState().dismissAppearancePrompt();
  useSettings.getState().addAppearancePlayTime(5000);
  expect(useSettings.getState().appearancePlayMs).toBe(0);
  expect(useSettings.getState().appearance).toBe('classic');
});

test('sanitizes corrupt timing and preserves already chosen Warm', () => {
  expect(migrateAppearanceSettings({ appearance: 'warm', appearancePlayMs: NaN })).toMatchObject({ appearance: 'warm', appearancePlayMs: 0 });
  useSettings.getState().addAppearancePlayTime(-100);
  useSettings.getState().addAppearancePlayTime(Infinity);
  expect(useSettings.getState().appearancePlayMs).toBe(0);
});
