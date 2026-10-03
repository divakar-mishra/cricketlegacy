/**
 * Background-music controller. Wires the (previously dead) "music" setting to a
 * real expo-audio service that owns playback state and respects the toggle.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettings } from '../state/settingsStore';

const TRACK = require('../../assets/audio/menu_broadcast_soft.wav');

export type MusicScene = 'MENU' | 'MATCH_CALM' | 'MATCH_LIVE' | 'VICTORY' | 'DEFEAT';

let enabled = false;
let playing = false;
let player: ReturnType<typeof createAudioPlayer> | null = null;
let scene: MusicScene = 'MENU';

const SCENE_VOLUME: Record<MusicScene, number> = {
  MENU: 0.2,
  MATCH_CALM: 0.12,
  MATCH_LIVE: 0,
  VICTORY: 0.17,
  DEFEAT: 0.1,
};

function getPlayer(): ReturnType<typeof createAudioPlayer> | null {
  if (player) return player;
  try {
    const next = createAudioPlayer(TRACK);
    next.loop = true;
    next.volume = SCENE_VOLUME[scene];
    player = next;
    return next;
  } catch {
    return null;
  }
}

function applySceneMix(): void {
  const base = getPlayer();
  if (base) base.volume = SCENE_VOLUME[scene];
}

function start(): void {
  if (playing) return;
  const next = getPlayer();
  if (!next) return;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  try {
    next.play();
    playing = true;
    applySceneMix();
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
  } catch {
    // Music is optional; state still needs to reflect the user's intent.
  }
  playing = false;
}

/** Turn background music on/off (persisted intent lives in settings). */
export function setMusicEnabled(next: boolean): void {
  enabled = next;
  if (enabled && scene !== 'MATCH_LIVE') start();
  else stop();
}

/**
 * Live play pauses the music without changing the user's saved preference.
 * Menus and results resume the same track when music is enabled.
 */
export function setMusicScene(next: MusicScene): void {
  scene = next;
  if (enabled && scene !== 'MATCH_LIVE') {
    start();
    applySceneMix();
  } else stop();
}

/** Align the controller with the current setting (call at app start / resume). */
export function syncMusicWithSettings(): void {
  try {
    setMusicEnabled(useSettings.getState().music);
  } catch {
    /* best-effort */
  }
}
