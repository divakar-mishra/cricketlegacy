// Original, self-contained audition clips and selected in-app audio assets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sampleRate = 22050;
const target = join(process.cwd(), 'output', 'audio-previews');
const musicAssets = join(process.cwd(), 'assets', 'audio');
const sfxAssets = join(process.cwd(), 'assets', 'sfx');
mkdirSync(target, { recursive: true });

function wav(samples, name, folder = target) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  writeFileSync(join(folder, name), bytes);
}

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * sampleRate));
}

function tone(out, start, duration, frequency, volume, timbre = 'marimba') {
  const begin = Math.round(start * sampleRate);
  const length = Math.min(Math.round(duration * sampleRate), out.length - begin);
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    const attack = Math.min(1, t / 0.014);
    const release = Math.min(1, (duration - t) / 0.08);
    const envelope = timbre === 'pad'
      ? Math.min(1, t / 0.55) * Math.min(1, (duration - t) / 0.65)
      : Math.exp(-t * (timbre === 'bass' ? 3.2 : 6.8)) * attack * release;
    const phase = Math.PI * 2 * frequency * t;
    const wave = timbre === 'pad'
      ? Math.sin(phase) * 0.65 + Math.sin(phase * 1.005) * 0.2 + Math.sin(phase * 2) * 0.15
      : timbre === 'bass'
        ? Math.sin(phase) * 0.82 + Math.sin(phase * 2) * 0.18
        : Math.sin(phase) * 0.68 + Math.sin(phase * 2) * 0.22 + Math.sin(phase * 3) * 0.1;
    out[begin + n] += wave * envelope * volume;
  }
}

let seed = 57;
function noise() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
}

function tick(out, start, duration, volume, softness = 0) {
  const begin = Math.round(start * sampleRate);
  const length = Math.min(Math.round(duration * sampleRate), out.length - begin);
  let low = 0;
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    const raw = noise();
    low += (raw - low) * (softness ? 0.08 : 0.35);
    const body = Math.sin(2 * Math.PI * (softness ? 430 : 760) * t) * Math.exp(-t * 58);
    out[begin + n] += (low * (softness ? 0.42 : 0.58) + body * 0.42)
      * Math.exp(-t * (softness ? 34 : 53)) * volume;
  }
}

const duration = 12;
const a = buffer(duration);
const aNotes = [392, 440, 523.25, 587.33, 523.25, 440, 392, 329.63,
  392, 440, 523.25, 659.25, 587.33, 523.25, 440, 392];
for (let i = 0; i < 16; i++) {
  const t = i * 0.75;
  tone(a, t, 0.65, aNotes[i], 0.24);
  if (i % 2 === 0) tone(a, t, 0.7, i < 8 ? 98 : 110, 0.15, 'bass');
  if (i % 4 === 2) tick(a, t, 0.075, 0.05, 1);
}
for (let i = 0; i < 4; i++) tone(a, i * 3, 2.8, [196, 174.61, 164.81, 196][i], 0.05, 'pad');
wav(a, 'music-a-pavilion.wav');

const b = buffer(duration);
const bNotes = [293.66, 349.23, 440, 349.23, 293.66, 261.63, 293.66, 440,
  293.66, 349.23, 523.25, 440, 392, 349.23, 293.66, 261.63];
for (let i = 0; i < 16; i++) {
  const t = i * 0.75;
  tone(b, t, 0.55, bNotes[i], 0.19);
  if (i % 2 === 0) tone(b, t, 0.65, i < 8 ? 73.42 : 65.41, 0.24, 'bass');
  if (i % 2 === 1) tick(b, t, 0.07, 0.12);
  tick(b, t + 0.375, 0.04, 0.035, 1);
}
for (let i = 0; i < 4; i++) tone(b, i * 3, 2.9, [146.83, 130.81, 174.61, 146.83][i], 0.045, 'pad');
wav(b, 'music-b-broadcast.wav');

// Keep B's exact note sequence, timing, rhythm and instrumentation. Transpose
// its pitched notes down without slowing the beat, then lower the whole mix.
const lowerB = buffer(duration);
const pitch = 0.8;
for (let i = 0; i < 16; i++) {
  const t = i * 0.75;
  tone(lowerB, t, 0.55, bNotes[i] * pitch, 0.19);
  if (i % 2 === 0) tone(lowerB, t, 0.65, (i < 8 ? 73.42 : 65.41) * pitch, 0.24, 'bass');
  if (i % 2 === 1) tick(lowerB, t, 0.07, 0.12);
  tick(lowerB, t + 0.375, 0.04, 0.035, 1);
}
for (let i = 0; i < 4; i++) {
  tone(lowerB, i * 3, 2.9, [146.83, 130.81, 174.61, 146.83][i] * pitch, 0.045, 'pad');
}
for (let i = 0; i < lowerB.length; i++) lowerB[i] *= 0.7;
wav(lowerB, 'music-b-lower-quieter.wav');
wav(lowerB, 'menu_broadcast_soft.wav', musicAssets);

const c = buffer(duration);
for (let i = 0; i < 4; i++) {
  const t = i * 3;
  tone(c, t, 2.95, [164.81, 146.83, 130.81, 146.83][i], 0.18, 'pad');
  tone(c, t, 2.95, [246.94, 220, 196, 220][i], 0.10, 'pad');
  tone(c, t + 0.25, 0.85, [493.88, 440, 392, 440][i], 0.12);
  tone(c, t + 1.75, 0.85, [392, 349.23, 329.63, 392][i], 0.11);
  tick(c, t + 1.5, 0.08, 0.045, 1);
}
wav(c, 'music-c-night-match.wav');

const taps = [
  ['tap-a-soft-wood.wav', 0.08, 510, 0.37, true],
  ['tap-b-crisp-scoreboard.wav', 0.065, 850, 0.46, false],
  ['tap-c-gentle-glass.wav', 0.12, 1040, 0.29, false],
];
for (const [name, length, pitch, level, soft] of taps) {
  const out = buffer(0.3);
  tick(out, 0.018, length, level, soft ? 1 : 0);
  tone(out, 0.018, length * 1.5, pitch, level * (soft ? 0.28 : 0.18));
  if (name.includes('glass')) tone(out, 0.022, 0.17, pitch * 1.5, 0.095);
  wav(out, name);
  if (name === 'tap-a-soft-wood.wav') wav(out, 'ui_soft_wood_tap.wav', sfxAssets);
}

console.log(`Created original audition WAVs in ${target} and selected app assets.`);
