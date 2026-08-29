import fs from 'node:fs';
import path from 'node:path';

const music = fs.readFileSync(path.join(__dirname, '..', 'music.ts'), 'utf8');
const sfx = fs.readFileSync(path.join(__dirname, '..', 'sfx.ts'), 'utf8');

describe('native audio playback-rate compatibility', () => {
  it('uses Expo Audio methods instead of assigning its read-only native property', () => {
    expect(music).not.toMatch(/\.playbackRate\s*=/);
    expect(sfx).not.toMatch(/\.playbackRate\s*=/);
    expect(music.match(/\.setPlaybackRate\(/g)).toHaveLength(2);
    expect(sfx).toContain('p.setPlaybackRate(');
  });
});
