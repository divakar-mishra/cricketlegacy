/**
 * Sound-effects manager. Lazily creates one persistent expo-audio player per
 * effect, honours the user's `sound` setting, and degrades to a silent no-op if
 * audio can't initialise (e.g. unsupported platform). The bundled sources are
 * recorded, CC0-derived 44.1 kHz stereo MP3s.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettings } from '../state/settingsStore';

export type SfxKey = 'tap' | 'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'win' | 'crowd';

const SOURCES: Record<SfxKey, number> = {
  tap: require('../../assets/sfx/ui_glass_tap.mp3'),
  four: require('../../assets/sfx/bat_impact_classic.mp3'),
  six: require('../../assets/sfx/bat_impact_classic.mp3'),
  wicket: require('../../assets/sfx/stump_clack.mp3'),
  fifty: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  hundred: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  win: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
  crowd: require('../../assets/sfx/stadium_crowd_cheer.mp3'),
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

/** Release native resources (call on unmount of a long-lived audio surface). */
export function releaseAll(): void {
  for (const key of Object.keys(players) as SfxKey[]) {
    try {
      players[key]?.release();
    } catch {
      // ignore
    }
    delete players[key];
  }
  initialised = false;
}
