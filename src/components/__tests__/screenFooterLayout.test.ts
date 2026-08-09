import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(path.join(__dirname, '..', 'Screen.tsx'), 'utf8');

describe('shared screen footer layout', () => {
  it('keeps footer actions outside the scroll viewport instead of overlaying content', () => {
    expect(screen).not.toContain("position: 'absolute'");
    expect(screen).not.toContain('footerHeight');
    expect(screen).not.toContain('onLayout=');
    expect(screen).toContain("flexShrink: 0");
    expect(screen).toContain('{inner}');
    expect(screen).toContain('{footer ? <View style={footerStyle}>{footer}</View> : null}');
  });
});
