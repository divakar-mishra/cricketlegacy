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
  | 'bat'
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
  tap: require('../../assets/sfx/ui_soft_wood_tap.wav'),
  bat: require('../../assets/sfx/bat_impact_classic.mp3'),
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
  tap: 0.36,
  bat: 0.55,
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
let modeReady: Promise<void> | null = null;
const requests: Partial<Record<SfxKey, number>> = {};

function ensureMode(): Promise<void> {
  if (modeReady) return modeReady;
  // Play even when the device is on silent (games expect this).
  modeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
    modeReady = null;
  });
  return modeReady;
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
    p.setPlaybackRate(
      PLAYBACK_RATE[key] ?? 1,
      ['six', 'coin', 'phone', 'trophy', 'defeat'].includes(key) ? 'low' : 'medium',
    );
    players[key] = p;
    return p;
  } catch {
    return null;
  }
}

/** Fire-and-forget playback of a one-shot effect. */
export function play(key: SfxKey, isCurrent: () => boolean = () => true): void {
  if (!soundOn() || !isCurrent()) return;
  const request = (requests[key] ?? 0) + 1;
  requests[key] = request;
  const p = getPlayer(key);
  if (!p) return;
  void replay(key, p, request, isCurrent);
}

async function replay(key: SfxKey, p: Player, request: number, isCurrent: () => boolean): Promise<void> {
  try {
    await ensureMode();
    if (requests[key] !== request || !soundOn() || !isCurrent()) return;
    // Expo seekTo is asynchronous. Starting before it finishes can play from
    // the previous end position and drop repeated impacts on Android.
    await p.seekTo(0);
    if (requests[key] !== request || !soundOn() || !isCurrent()) return;
    p.play();
  } catch {
    // Audio feedback is non-critical.
  }
}

/** Load match effects during preparation so the first impact is already ready. */
export function preloadMatchSounds(): void {
  if (!soundOn()) return;
  void ensureMode();
  for (const key of ['bat', 'four', 'six', 'wicket', 'crowd', 'fifty', 'hundred'] as const) {
    getPlayer(key);
  }
}
