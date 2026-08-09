/**
 * Sound-effects manager. Lazily creates one persistent expo-audio player per
 * effect, honours the user's `sound` setting, and degrades to a silent no-op if
 * audio can't initialise (e.g. unsupported platform). The bundled sources are
 * recorded, CC0-derived 44.1 kHz stereo MP3s.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettings } from '../state/settingsStore';

export type SfxKey =
  | 'tap'
  | 'four'
  | 'six'
  | 'wicket'
  | 'fifty'
  | 'hundred'
  | 'win'
  | 'crowd'
  | 'coin'
  | 'phone'
  | 'trophy'
  | 'defeat';

const SOURCES: Record<SfxKey, number> = {
  tap: require('../../assets/sfx/ui_glass_tap.mp3'),
  four: require('../../assets/sfx/bat_impact_classic.mp3'),
  six: require('../../assets/sfx/bat_impact_classic.mp3'),
  wicket: require('../../assets/sfx/stump_clack.mp3'),
  fifty: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  hundred: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  win: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  crowd: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  coin: require('../../assets/sfx/ui_glass_tap.mp3'),
  phone: require('../../assets/sfx/ui_glass_tap.mp3'),
  trophy: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  defeat: require('../../assets/sfx/stump_clack.mp3'),
};

const VOLUME: Partial<Record<SfxKey, number>> = {
  tap: 0.42,
  four: 0.78,
  six: 0.88,
  wicket: 0.86,
  crowd: 0.52,
  fifty: 0.58,
  hundred: 0.65,
  win: 0.68,
  coin: 0.62,
  phone: 0.48,
  trophy: 0.72,
  defeat: 0.62,
};

// Reuse the compact CC0 impact recording while giving sixes a lower, heavier
// transient. This keeps the APK lean and makes fours/sixes distinguishable on
// small phone speakers instead of relying on volume alone.
const PLAYBACK_RATE: Partial<Record<SfxKey, number>> = {
  four: 1,
  six: 0.9,
  coin: 1.55,
  phone: 1.28,
  trophy: 1.06,
  defeat: 0.68,
};

type Player = ReturnType<typeof createAudioPlayer>;
const players: Partial<Record<SfxKey, Player>> = {};
let initialised = false;

function ensureMode(): void {
  if (initialised) return;
  initialised = true;
  // Play even when the device is on silent (games expect this).
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

function soundOn(): boolean {
  try {
    return useSettings.getState().sound;
  } catch {
    return false;
  }
}

function getPlayer(key: SfxKey): Player | null {
  if (players[key]) return players[key] ?? null;
  try {
    const p = createAudioPlayer(SOURCES[key]);
    p.volume = VOLUME[key] ?? 0.8;
    p.playbackRate = PLAYBACK_RATE[key] ?? 1;
    p.shouldCorrectPitch = !['six', 'coin', 'phone', 'trophy', 'defeat'].includes(key);
    players[key] = p;
    return p;
  } catch {
    return null;
  }
}

/** Fire-and-forget playback of a one-shot effect. */
export function play(key: SfxKey): void {
  if (!soundOn()) return;
  ensureMode();
  const p = getPlayer(key);
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // Audio feedback is non-critical.
  }
}
