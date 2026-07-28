import fs from 'fs';
import path from 'path';
import { DEFAULT_AVATAR_CUSTOMIZATION } from '../../data/avatar';

const avatarSource = fs.readFileSync(path.join(__dirname, '..', 'PlayerAvatar.tsx'), 'utf8');
const editorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'PlayerCosmeticsScreen.tsx'),
  'utf8',
);
const profileSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'PlayerProfileScreen.tsx'),
  'utf8',
);

describe('illustrated player avatar', () => {
  it('ships a complete offline-safe default identity', () => {
    expect(DEFAULT_AVATAR_CUSTOMIZATION).toEqual(
      expect.objectContaining({
        skinTone: expect.stringMatching(/^#/),
        faceShape: 'oval',
        hairStyle: 'short',
        facialHair: 'none',
        moustache: 'none',
      }),
    );
  });

  it('draws layered SVG features instead of loading a portrait image', () => {
    expect(avatarSource).toContain('<Svg');
    expect(avatarSource).toContain('<Hair style={config.hairStyle}');
    expect(avatarSource).toContain('<FacialHair config={config}');
    expect(avatarSource).not.toContain('Image source=');
    expect(avatarSource).not.toContain('ImageBackground');
  });

  it('exposes identity choices and reuses the saved avatar on the profile', () => {
    expect(editorSource).toContain('Create Your Avatar');
    expect(editorSource).toContain('title="Skin tone"');
    expect(editorSource).toContain('title="Hair"');
    expect(editorSource).toContain('title="Beard"');
    expect(editorSource).toContain('title="Moustache"');
    expect(profileSource).toContain('customization={isUser ? save.cosmetics?.avatarCustomization');
  });
});
