import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_AVATAR_CONFIG, isValidAvatarConfig } from '../../avatar';

const wrapperSource = fs.readFileSync(path.join(__dirname, '..', 'PlayerAvatar.tsx'), 'utf8');
const rendererSource = fs.readFileSync(
  path.join(__dirname, '..', 'avatar', 'PortraitAvatar.tsx'),
  'utf8',
);
const customizerSource = fs.readFileSync(
  path.join(__dirname, '..', 'avatar', 'PortraitPicker.tsx'),
  'utf8',
);
const pickerLayoutSource = fs.readFileSync(
  path.join(__dirname, '..', 'avatar', 'portraitPickerLayout.ts'),
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

describe('fixed player portraits', () => {
  it('ships a complete offline-safe default identity', () => {
    expect(isValidAvatarConfig(DEFAULT_AVATAR_CONFIG)).toBe(true);
    expect(DEFAULT_AVATAR_CONFIG).toEqual(
      expect.objectContaining({
        sex: 'male',
        portraitId: 'portrait_male_025',
      }),
    );
  });

  it('renders circular portraits with green normal and gold Championship frames', () => {
    expect(rendererSource).toContain('portraitAssetSource(safeConfig.portraitId)');
    expect(rendererSource).toContain('<Image');
    expect(rendererSource).toContain('resizeMode="cover"');
    expect(rendererSource).toContain("height: '100%'");
    expect(rendererSource).toContain("width: '100%'");
    expect(rendererSource).toContain('<ProfileFrame frameId={activeFrame} size={size} />');
    expect(rendererSource).toContain("frameId === 'frame_gold'");
    expect(rendererSource).toContain("main: '#24D63B'");
    expect(rendererSource).toContain("main: '#E8B52F'");
    expect(rendererSource).toContain('const borderRadius = size / 2');
    expect(rendererSource).not.toContain("frameId === 'frame_none') return null");
    expect(rendererSource).not.toContain('<Svg');
    expect(wrapperSource).toContain('<PortraitAvatar');
    expect(wrapperSource).toContain("avatarFromSeed(name, 'male', profileFrame)");
  });

  it('edits and reuses the same persisted AvatarConfig on profile surfaces', () => {
    expect(editorSource).toContain('<PortraitPicker');
    expect(editorSource).toContain('avatarConfig,');
    expect(profileSource).toContain('config={isUser ? save.cosmetics?.avatarConfig : undefined}');
  });

  it('uses gender tabs, eight accessible tone ranges and a fixed portrait grid', () => {
    expect(customizerSource).toContain('AVATAR_TONE_BANDS.map');
    expect(customizerSource).toContain('portraitsForTone(safeValue.sex, selectedTone)');
    expect(customizerSource).toContain('accessibilityLabel={`Skin tone ${toneBand} of 8`}');
    expect(customizerSource).not.toContain("'beard'");
    expect(customizerSource).not.toContain("'moustache'");
    expect(customizerSource).not.toContain("'headwear'");
  });

  it('keeps portrait IDs accessible without showing index labels in the grid', () => {
    expect(customizerSource).toContain('const label = portraitOptionLabel(portrait)');
    expect(customizerSource).toContain('accessibilityLabel={label}');
    expect(customizerSource).not.toContain('styles.portraitLabel');
    expect(customizerSource).not.toContain('String(portrait.index)');
    expect(customizerSource).not.toContain('portraitOptionLabel(safeValue.portraitId)');
  });

  it('wraps tone choices instead of clipping them in a horizontal scroller', () => {
    expect(customizerSource).toContain('accessibilityRole="radiogroup"');
    expect(customizerSource).toContain('accessibilityRole="radio"');
    expect(customizerSource).toContain('{ width: layout.toneCellWidth }');
    expect(customizerSource).not.toContain('<ScrollView');
  });

  it('sizes portrait cards from the available screen width', () => {
    expect(customizerSource).toContain('portraitPickerLayout(width)');
    expect(pickerLayoutSource).toContain('safeWidth < 420 ? 2 : safeWidth < 700 ? 3 : 4');
    expect(customizerSource).toContain('{ flexBasis: cardWidth, maxWidth: cardWidth }');
    expect(customizerSource).not.toContain("flexBasis: '46%'");
  });

  it('uses readable profile rating bars instead of an oversized three-axis radar', () => {
    expect(profileSource).toContain('Core ratings');
    expect(profileSource).toContain('<RatingRow');
    expect(profileSource).not.toContain('<RadarChart');
  });
});
