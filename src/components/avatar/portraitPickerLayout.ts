export interface PortraitPickerLayout {
  columns: number;
  cardWidth: number;
  portraitSize: number;
  previewSize: number;
  toneColumns: 4 | 8;
  toneCellWidth: number;
}

const SCREEN_PADDING_MIN = 12;
const SCREEN_PADDING_MAX = 24;
const GRID_GAP = 8;
const GRID_PADDING = 8;
const PICKER_BORDER_WIDTH = 2;
const CARD_HORIZONTAL_INSET = 20;
const PICKER_MAX_WIDTH = 980;
const TONE_SECTION_HORIZONTAL_PADDING = 24;
const TONE_MIN_CELL_WIDTH = 52;

/**
 * Mirrors Screen's horizontal sizing so portrait cards fit their real content
 * width instead of guessing from the device width alone.
 */
export function portraitPickerLayout(windowWidth: number): PortraitPickerLayout {
  const safeWidth = Math.max(280, windowWidth);
  const screenPadding = Math.max(
    SCREEN_PADDING_MIN,
    Math.min(SCREEN_PADDING_MAX, Math.round(safeWidth * 0.045)),
  );
  const pickerWidth =
    Math.min(PICKER_MAX_WIDTH, safeWidth - screenPadding * 2) - PICKER_BORDER_WIDTH;
  const columns = safeWidth < 420 ? 2 : safeWidth < 700 ? 3 : 4;
  const availableCardWidth = (pickerWidth - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;
  const cardWidth = Math.floor(availableCardWidth);
  const portraitSize = Math.max(80, Math.min(120, cardWidth - CARD_HORIZONTAL_INSET));
  const previewSize = Math.max(132, Math.min(164, Math.floor(pickerWidth * 0.44)));
  const toneContentWidth = pickerWidth - TONE_SECTION_HORIZONTAL_PADDING;
  const toneColumns: 4 | 8 = toneContentWidth >= TONE_MIN_CELL_WIDTH * 8 ? 8 : 4;
  const toneCellWidth = Math.floor(toneContentWidth / toneColumns);

  return { columns, cardWidth, portraitSize, previewSize, toneColumns, toneCellWidth };
}
