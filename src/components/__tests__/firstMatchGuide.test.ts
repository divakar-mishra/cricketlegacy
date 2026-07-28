import fs from 'fs';
import path from 'path';

describe('FirstMatchGuide layout', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'FirstMatchGuide.tsx'), 'utf8');

  it('uses an intentional modal overlay instead of colliding with live match controls', () => {
    expect(source).toContain("justifyContent: 'center'");
    expect(source).toContain('StyleSheet.absoluteFill');
    expect(source).toContain("backgroundColor: 'rgba(0,0,0,0.48)'");
    expect(source).toContain('intensity={0.95}');
    expect(source).toContain('blur={false}');
    expect(source).toContain('pointerEvents="auto"');
  });
});
