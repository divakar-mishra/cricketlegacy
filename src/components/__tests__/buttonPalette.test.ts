import type { ThemeColors } from '../../theme';
import { buttonForeground } from '../buttonPalette';

const light = {
  black: '#000000',
  white: '#FFFFFF',
  text: '#0E1B13',
  primaryDark: '#007547',
  primaryLight: '#00B86E',
} as ThemeColors;

describe('button foreground contrast', () => {
  it('uses dark text on pale light-theme secondary surfaces', () => {
    expect(buttonForeground('secondary', light, false)).toBe(light.text);
    expect(buttonForeground('ghost', light, false)).toBe(light.primaryDark);
  });

  it('keeps solid actions legible in either theme', () => {
    expect(buttonForeground('primary', light, false)).toBe(light.white);
    expect(buttonForeground('gold', light, false)).toBe(light.black);
  });
});
