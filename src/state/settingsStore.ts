import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type Appearance = 'classic' | 'warm';
export const APPEARANCE_PROMPT_MS = 20 * 60 * 1000;
export function migrateAppearanceSettings(value: unknown) {
  const old = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const { themeMode: _legacy, ...rest } = old;
  return { ...rest, appearance: old.appearance === 'warm' ? 'warm' as const : 'classic' as const,
    appearancePromptDone: old.appearancePromptDone === true,
    appearancePlayMs: typeof old.appearancePlayMs === 'number' && Number.isFinite(old.appearancePlayMs)
      ? Math.max(0, Math.min(APPEARANCE_PROMPT_MS, old.appearancePlayMs)) : 0 };
}
export type Language = 'en' | 'hi';

interface SettingsState {
  sound: boolean;
  usageAnalytics: boolean;
  crashReports: boolean;
  setUsageAnalytics: (v: boolean) => void;
  setCrashReports: (v: boolean) => void;
  music: boolean;
  haptics: boolean;
  notifications: boolean;
  graphics: GraphicsQuality;
  appearance: Appearance;
  appearancePlayMs: number;
  appearancePromptDone: boolean;
  addAppearancePlayTime: (ms: number) => void;
  dismissAppearancePrompt: () => void;
  language: Language;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  playedMatchesAllModes: number;
  qaUnlimitedEnergy: boolean;
  /** Set of coach tip IDs that have been dismissed. */
  dismissedTips: string[];

  setSound: (v: boolean) => void;
  setMusic: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setNotifications: (v: boolean) => void;
  setGraphics: (v: GraphicsQuality) => void;
  setAppearance: (v: Appearance) => void;
  setLanguage: (v: Language) => void;
  setOnboarded: (v: boolean) => void;
  setHydrated: () => void;
  recordPlayedMatch: () => void;
  setQaUnlimitedEnergy: (v: boolean) => void;
  dismissTip: (tipId: string) => void;
  replayGuides: () => void;
  reset: () => void;
}

const DEFAULTS = {
  usageAnalytics: false,
  crashReports: false,
  sound: true,
  music: true,
  haptics: true,
  notifications: true,
  graphics: 'high' as GraphicsQuality,
  appearance: 'classic' as Appearance,
  appearancePlayMs: 0,
  appearancePromptDone: false,
  language: 'en' as Language,
  hasOnboarded: false,
  playedMatchesAllModes: 0,
  qaUnlimitedEnergy: false,
  dismissedTips: [] as string[],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      hasHydrated: false,
      setUsageAnalytics: (usageAnalytics) => set({ usageAnalytics }),
      setCrashReports: (crashReports) => set({ crashReports }),
      setSound: (sound) => set({ sound }),
      setMusic: (music) => set({ music }),
      setHaptics: (haptics) => set({ haptics }),
      setNotifications: (notifications) => set({ notifications }),
      setGraphics: (graphics) => set({ graphics }),
      setAppearance: (appearance) => set({ appearance, appearancePromptDone: true }),
      dismissAppearancePrompt: () => set({ appearancePromptDone: true }),
      addAppearancePlayTime: (ms) => set(s => ({ appearancePlayMs: s.appearancePromptDone ? s.appearancePlayMs
        : Math.min(APPEARANCE_PROMPT_MS, s.appearancePlayMs + (Number.isFinite(ms) ? Math.max(0, ms) : 0)) })),
      setLanguage: (language) => set({ language }),
      setOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      setHydrated: () => set({ hasHydrated: true }),
      recordPlayedMatch: () => set((s) => ({ playedMatchesAllModes: s.playedMatchesAllModes + 1 })),
      setQaUnlimitedEnergy: (qaUnlimitedEnergy) => set({ qaUnlimitedEnergy }),
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
      version: 1,
      migrate: (state) => migrateAppearanceSettings(state),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        usageAnalytics: s.usageAnalytics,
        crashReports: s.crashReports,
        sound: s.sound,
        music: s.music,
        haptics: s.haptics,
        notifications: s.notifications,
        graphics: s.graphics,
        appearance: s.appearance,
        appearancePlayMs: s.appearancePlayMs,
        appearancePromptDone: s.appearancePromptDone,
        language: s.language,
        hasOnboarded: s.hasOnboarded,
        playedMatchesAllModes: s.playedMatchesAllModes,
        qaUnlimitedEnergy: s.qaUnlimitedEnergy,
        dismissedTips: s.dismissedTips,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
