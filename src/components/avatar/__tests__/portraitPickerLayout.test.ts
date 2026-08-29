import { portraitPickerLayout } from '../portraitPickerLayout';

describe('portrait picker responsive layout', () => {
  it.each([
    { windowWidth: 320, expectedColumns: 2 },
    { windowWidth: 390, expectedColumns: 2 },
    { windowWidth: 420, expectedColumns: 3 },
    { windowWidth: 448, expectedColumns: 3 },
    { windowWidth: 800, expectedColumns: 4 },
  ])(
    'uses $expectedColumns columns at a $windowWidth px window width',
    ({ windowWidth, expectedColumns }) => {
      expect(portraitPickerLayout(windowWidth).columns).toBe(expectedColumns);
    },
  );

  it.each([280, 320, 360, 390, 448, 700, 800, 1200])(
    'keeps each portrait inside its card at a %ipx window width',
    (windowWidth) => {
      const layout = portraitPickerLayout(windowWidth);

      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.portraitSize).toBeLessThanOrEqual(layout.cardWidth - 20);
      expect(layout.previewSize).toBeGreaterThanOrEqual(132);
      expect(layout.previewSize).toBeLessThanOrEqual(164);
    },
  );

  it.each([280, 320, 390, 448])(
    'fits all tone choices in four columns on a %ipx phone',
    (windowWidth) => {
      const layout = portraitPickerLayout(windowWidth);

      expect(layout.toneColumns).toBe(4);
      expect(layout.toneCellWidth).toBeGreaterThanOrEqual(48);
    },
  );

  it.each([700, 800, 1200])(
    'uses one eight-choice tone row when a %ipx screen has room',
    (windowWidth) => {
      const layout = portraitPickerLayout(windowWidth);

      expect(layout.toneColumns).toBe(8);
      expect(layout.toneCellWidth).toBeGreaterThanOrEqual(52);
    },
  );
});
