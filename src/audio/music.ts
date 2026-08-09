/**
 * Background-music controller. Wires the (previously dead) "music" setting to a
 * real expo-audio service that owns playback state and respects the toggle.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettings } from '../state/settingsStore';

const TRACK = require('../../assets/audio/menu_ambient.mp3');
const DEFAULT_MUSIC_VOLUME = 0.25;

export type MusicScene = 'MENU' | 'MATCH_CALM' | 'MATCH_TENSE' | 'VICTORY' | 'DEFEAT';

let enabled = false;
let playing = false;
let player: ReturnType<typeof createAudioPlayer> | null = null;
let texturePlayer: ReturnType<typeof createAudioPlayer> | null = null;
let scene: MusicScene = 'MENU';

const SCENE_MIX: Record<
  MusicScene,
  { baseVolume: number; baseRate: number; textureVolume: number; textureRate: number }
> = {
  MENU: { baseVolume: DEFAULT_MUSIC_VOLUME, baseRate: 1, textureVolume: 0, textureRate: 1 },
  MATCH_CALM: { baseVolume: 0.18, baseRate: 0.98, textureVolume: 0.035, textureRate: 1.015 },
  MATCH_TENSE: { baseVolume: 0.26, baseRate: 1.035, textureVolume: 0.065, textureRate: 0.965 },
  VICTORY: { baseVolume: 0.29, baseRate: 1.055, textureVolume: 0.045, textureRate: 1.02 },
  DEFEAT: { baseVolume: 0.14, baseRate: 0.92, textureVolume: 0, textureRate: 1 },
};

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

function getTexturePlayer(): ReturnType<typeof createAudioPlayer> | null {
  if (texturePlayer) return texturePlayer;
  try {
    const next = createAudioPlayer(TRACK);
    next.loop = true;
    next.volume = 0;
    next.seekTo(11.5);
    texturePlayer = next;
    return next;
  } catch {
    return null;
  }
}

function applySceneMix(): void {
  const mix = SCENE_MIX[scene];
  const base = getPlayer();
  if (base) {
    base.volume = mix.baseVolume;
    base.playbackRate = mix.baseRate;
    base.shouldCorrectPitch = false;
  }
  const texture = getTexturePlayer();
  if (!texture) return;
  texture.volume = mix.textureVolume;
  texture.playbackRate = mix.textureRate;
  texture.shouldCorrectPitch = false;
  try {
    if (enabled && playing && mix.textureVolume > 0) texture.play();
    else texture.pause();
  } catch {
    // The adaptive layer is optional.
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
    player.seekTo(0);
    texturePlayer?.pause();
    texturePlayer?.seekTo(11.5);
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

/**
 * Adapt the single bundled soundtrack into a restrained two-layer mix.
 * Match tension changes tempo, volume and a phase-shifted texture without
 * downloading tracks or increasing save/build size.
 */
export function setMusicScene(next: MusicScene): void {
  scene = next;
  if (enabled) applySceneMix();
}

/** Align the controller with the current setting (call at app start / resume). */
export function syncMusicWithSettings(): void {
  try {
    setMusicEnabled(useSettings.getState().music);
  } catch {
    /* best-effort */
  }
}
