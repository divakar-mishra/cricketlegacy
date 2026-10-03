import { useIsCompact } from '../useResponsive';

let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native', () => ({ useWindowDimensions: () => mockDimensions }));

describe('room for text in responsive cards', () => {
  it.each([
    [320, 1, 380, true], [360, 1, 380, true], [390, 1, 380, false],
    [412, 1.3, 380, true], [600, 1.3, 560, true], [768, 1, 560, false],
    [768, 1.5, 560, true], [320, 0.8, 380, true],
  ])('width %s / font scale %s uses breakpoint %s → compact %s', (width, fontScale, breakpoint, expected) => {
    mockDimensions = { width: width as number, fontScale: fontScale as number, height: 844, scale: 3 };
    expect(useIsCompact(breakpoint as number)).toBe(expected);
  });
});
