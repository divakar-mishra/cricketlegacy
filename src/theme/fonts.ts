/**
 * Typography — a premium pairing: Sora (geometric display) for headings, scores
 * and CTAs; Inter (highly legible) for body/UI. Loaded at startup via
 * {@link useAppFonts}. If loading ever fails the app still renders — every
 * `fontFamily` simply falls back to the system font (no crash).
 */
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';

/** Family names to reference in `fontFamily`. */
export const fonts = {
  // Display / headings / big numbers (Sora).
  display: 'Sora_800ExtraBold',
  heading: 'Sora_700Bold',
  headingSemi: 'Sora_600SemiBold',
  // Body / UI (Inter).
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Loads all app fonts. Returns true once ready (or if loading errored). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });
  return loaded || Boolean(error);
}
