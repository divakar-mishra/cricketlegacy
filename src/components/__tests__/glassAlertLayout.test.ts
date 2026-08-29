import fs from 'node:fs';
import path from 'node:path';
import { modalViewportMetrics } from '../modalLayout';

const source = fs.readFileSync(path.join(__dirname, '..', 'GlassAlertModal.tsx'), 'utf8');

describe('shared glass alert layout', () => {
  it('keeps every alert inside both system safe areas', () => {
    expect(source).toContain('useSafeAreaInsets()');
    expect(source).toContain('modalViewportMetrics(');
    expect(source).toContain('paddingTop: insets.top + verticalMargin');
    expect(source).toContain('paddingBottom: insets.bottom + verticalMargin');
    expect(source).toContain('navigationBarTranslucent');
  });

  it('never exceeds the safe height in short split-screen windows', () => {
    expect(modalViewportMetrics(160, 48, 48, 24)).toEqual({
      availableHeight: 16,
      verticalMargin: 24,
    });
    expect(modalViewportMetrics(80, 48, 48, 24)).toEqual({
      availableHeight: 1,
      verticalMargin: 0,
    });
  });

  it('scrolls the complete dialog instead of clipping actions outside the card', () => {
    expect(source).toContain('style={[styles.contentScroll, { maxHeight: availableHeight }]}');
    expect(source).toContain('contentContainerStyle={styles.cardContent}');
    expect(source).not.toContain("maxHeight: '78%'");
    expect(source).not.toContain('style={styles.messageScroll}');
  });
});
