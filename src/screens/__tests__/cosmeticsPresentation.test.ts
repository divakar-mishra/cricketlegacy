import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'PlayerCosmeticsScreen.tsx'), 'utf8');

describe('player cosmetics presentation', () => {
  it('keeps locked pass rewards visible and clearly labelled', () => {
    expect(source).toContain('opt.previewIcon');
    expect(source).toContain('name="lock-closed"');
    expect(source).toContain("'PASS REWARD'");
    expect(source).toContain('color={previewAccent}');
    expect(source).not.toContain('optionCardLocked: { opacity:');
  });

  it('uses a readable three-column phone grid', () => {
    expect(source).toContain("flexBasis: '30%'");
    expect(source).toContain("maxWidth: '32%'");
    expect(source).toContain("width: '100%'");
  });

  it('uses the kit controls without repeating explanatory banners', () => {
    expect(source).toContain('title="Kit & Look"');
    expect(source).toContain("(['front', 'back'] as const)");
    expect(source).toContain('BACK NAME');
    expect(source).toContain('NUMBER');
    expect(source).not.toContain('Premium cosmetics use gems.');
    expect(source).not.toContain('More looks unlock during your career.');
    expect(source).not.toContain('💎 You have');
    expect(source).not.toContain('Personalise your legend');
  });
});
