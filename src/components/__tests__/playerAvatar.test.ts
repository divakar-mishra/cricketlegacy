import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_AVATAR_CONFIG, isValidAvatarConfig } from '../../avatar';

const wrapperSource = fs.readFileSync(path.join(__dirname, '..', 'PlayerAvatar.tsx'), 'utf8');
const rendererSource = fs.readFileSync(
  path.join(__dirname, '..', 'avatar', 'LayeredAvatar.tsx'),
  'utf8',
);
const editorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'PlayerCosmeticsScreen.tsx'),
  'utf8',
);
const profileSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'PlayerProfileScreen.tsx'),
  'utf8',
);

describe('modular player avatar', () => {
  it('ships a complete offline-safe default identity', () => {
    expect(isValidAvatarConfig(DEFAULT_AVATAR_CONFIG)).toBe(true);
    expect(DEFAULT_AVATAR_CONFIG).toEqual(
      expect.objectContaining({
        sex: 'male',
        rigId: 'medium',
        beardId: 'beard_none',
        moustacheId: 'moustache_none',
      }),
    );
  });

  it('uses the supplied common-canvas image stack in the required order', () => {
    const order = [
      'layers.hairBack',
      'layers.outfit',
      'layers.base',
      'layers.eyes',
      'layers.hairFront',
      'layers.beard',
      'layers.moustache',
      'layers.headwear',
      '<ProfileFrame',
    ];
    for (let index = 1; index < order.length; index += 1) {
      expect(rendererSource.indexOf(order[index - 1])).toBeLessThan(
        rendererSource.indexOf(order[index]),
      );
    }
    expect(rendererSource).toContain('resizeMode="contain"');
    expect(wrapperSource).toContain('<LayeredAvatar');
    expect(wrapperSource).not.toContain('function Beard');
  });

  it('edits and reuses the same persisted AvatarConfig on profile surfaces', () => {
    expect(editorSource).toContain('<AvatarCustomizer');
    expect(editorSource).toContain('avatarConfig,');
    expect(profileSource).toContain('config={isUser ? save.cosmetics?.avatarConfig : undefined}');
  });
});
