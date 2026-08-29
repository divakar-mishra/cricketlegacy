import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(path.join(__dirname, '..', 'Screen.tsx'), 'utf8');

describe('shared screen footer layout', () => {
  it('keeps footer actions outside the scroll viewport instead of overlaying content', () => {
    expect(screen).not.toContain("position: 'absolute'");
    expect(screen).not.toContain('footerHeight');
    expect(screen).not.toContain('onLayout=');
    expect(screen).toContain('flexShrink: 0');
    expect(screen).toContain('{inner}');
    expect(screen).toContain('{footer ? <View style={footerStyle}>{footer}</View> : null}');
  });

  it('keeps the scroll viewport below the status bar while content moves', () => {
    expect(screen).toContain('import { SafeAreaView, useSafeAreaInsets }');
    expect(screen).toContain("<SafeAreaView style={styles.fill} edges={['top']}>\n        {inner}");
    expect(screen).not.toContain('paddingTop: insets.top');
    expect(screen).toContain('Math.max(insets.bottom, spacing.md)');
  });

  it('supports explicit scroll restoration for multi-step screens', () => {
    expect(screen).toContain('scrollResetKey?: string | number');
    expect(screen).toContain('scrollRef.current?.scrollTo({ y: 0, animated: false })');
  });
});
