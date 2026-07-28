/**
 * Background-music controller. Wires the (previously dead) "music" setting to a
 * real expo-audio service that owns playback state and respects the toggle.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettings } from '../state/settingsStore';

const TRACK = require('../../assets/audio/menu_ambient.mp3');
const DEFAULT_MUSIC_VOLUME = 0.25;

let enabled = false;
let playing = false;
let player: ReturnType<typeof createAudioPlayer> | null = null;

function getPlayer(): ReturnType<typeof createAudioPlayer> | null {
  if (player) return player;
  try {
    const next = createAudioPlayer(TRACK);
    next.loop = true;
    next.volume = DEFAULT_MUSIC_VOLUME;
    player = next;
    return next;
  } catch {
    return null;
  }
}

function start(): void {
  if (playing) return;
  const next = getPlayer();
  if (!next) return;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  try {
    next.play();
    playing = true;
  } catch {
    playing = false;
  }
}

function stop(): void {
  if (!player) {
    playing = false;
    return;
  }
  try {
    player.pause();
    player.seekTo(0);
  } catch {
    // Music is optional; state still needs to reflect the user's intent.
  }
  playing = false;
}

/** Turn background music on/off (persisted intent lives in settings). */
export function setMusicEnabled(next: boolean): void {
  enabled = next;
  if (enabled) start();
  else stop();
}

export function isMusicPlaying(): boolean {
  return playing;
}

/** Align the controller with the current setting (call at app start / resume). */
export function syncMusicWithSettings(): void {
  try {
    setMusicEnabled(useSettings.getState().music);
  } catch {
    /* best-effort */
  }
}
