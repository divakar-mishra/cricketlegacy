import { darkColors, lightColors, gradientsDark, gradientsLight } from '../../theme';

jest.mock('react-native', () => ({ useColorScheme: jest.fn() }));
jest.mock('../../state/settingsStore', () => ({ useSettings: jest.fn() }));
jest.mock('../../theme/fonts', () => ({ fonts: {}, useAppFonts: jest.fn() }));

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(start => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('warm neutral palette with semantic greens', () => {
  it('keeps large surfaces and primary buttons warm rather than green', () => {
    for (const hex of [darkColors.surface, darkColors.surfaceAlt, lightColors.surface, ...gradientsDark.brand]) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
  });
  it('keeps cream and muted text readable on warm cards', () => {
    for (const palette of [darkColors, lightColors]) {
      for (const background of [palette.surface, palette.surfaceAlt]) {
        for (const foreground of [palette.text, palette.textMuted]) {
          expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it('keeps white primary-button labels readable throughout both opaque gradients', () => {
    for (const gradient of [gradientsDark.brand, gradientsLight.brand]) {
      for (const stop of gradient) expect(contrast('#FFFFFF', stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps green labels readable on the shared card surfaces', () => {
    for (const palette of [darkColors, lightColors]) {
      for (const background of [palette.bg, palette.surface, palette.surfaceAlt]) {
        for (const foreground of [palette.primary, palette.success]) {
          expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
