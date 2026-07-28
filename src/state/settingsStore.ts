import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ThemeMode = 'dark' | 'light' | 'system';
export type Language = 'en' | 'hi';

interface SettingsState {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  notifications: boolean;
  graphics: GraphicsQuality;
  themeMode: ThemeMode;
  language: Language;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  playedMatchesAllModes: number;
  /** Set of coach tip IDs that have been dismissed. */
  dismissedTips: string[];

  setSound: (v: boolean) => void;
  setMusic: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setNotifications: (v: boolean) => void;
  setGraphics: (v: GraphicsQuality) => void;
  setThemeMode: (v: ThemeMode) => void;
  setLanguage: (v: Language) => void;
  setOnboarded: (v: boolean) => void;
  setHydrated: () => void;
  recordPlayedMatch: () => void;
  dismissTip: (tipId: string) => void;
  replayGuides: () => void;
  reset: () => void;
}

const DEFAULTS = {
  sound: true,
  music: true,
  haptics: true,
  notifications: true,
  graphics: 'high' as GraphicsQuality,
  themeMode: 'dark' as ThemeMode,
  language: 'en' as Language,
  hasOnboarded: false,
  playedMatchesAllModes: 0,
  dismissedTips: [] as string[],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      hasHydrated: false,
      setSound: (sound) => set({ sound }),
      setMusic: (music) => set({ music }),
      setHaptics: (haptics) => set({ haptics }),
      setNotifications: (notifications) => set({ notifications }),
      setGraphics: (graphics) => set({ graphics }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      setHydrated: () => set({ hasHydrated: true }),
      recordPlayedMatch: () => set((s) => ({ playedMatchesAllModes: s.playedMatchesAllModes + 1 })),
      dismissTip: (tipId) =>
        set((s) => ({
          dismissedTips: s.dismissedTips.includes(tipId)
            ? s.dismissedTips
            : [...s.dismissedTips, tipId],
        })),
      replayGuides: () => set({ hasOnboarded: false, dismissedTips: [] }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'cricket:settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        sound: s.sound,
        music: s.music,
        haptics: s.haptics,
        notifications: s.notifications,
        graphics: s.graphics,
        themeMode: s.themeMode,
        language: s.language,
        hasOnboarded: s.hasOnboarded,
        playedMatchesAllModes: s.playedMatchesAllModes,
        dismissedTips: s.dismissedTips,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
