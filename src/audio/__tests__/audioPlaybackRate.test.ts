import fs from 'node:fs';
import path from 'node:path';

const music = fs.readFileSync(path.join(__dirname, '..', 'music.ts'), 'utf8');
const sfx = fs.readFileSync(path.join(__dirname, '..', 'sfx.ts'), 'utf8');

describe('native audio playback-rate compatibility', () => {
  it('never assigns Expo Audio’s read-only playback-rate property', () => {
    expect(music).not.toMatch(/\.playbackRate\s*=/);
    expect(sfx).not.toMatch(/\.playbackRate\s*=/);
    expect(sfx).toContain('p.setPlaybackRate(');
  });

  it('plays one steady, quiet music layer instead of doubling or speeding it up', () => {
    expect(music).toContain('menu_broadcast_soft.wav');
    expect(music).not.toContain('texturePlayer');
    expect(music).not.toContain('.setPlaybackRate(');
    expect(music).toContain('MATCH_CALM: 0.12');
    expect(music).toContain('MENU: 0.2');
    expect(sfx).toContain('ui_soft_wood_tap.wav');
  });
});
