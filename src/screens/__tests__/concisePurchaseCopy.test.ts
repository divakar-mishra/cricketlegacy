import fs from 'fs';
import path from 'path';

describe('concise purchase copy', () => {
  it('omits redundant outcome disclaimers while retaining purchase benefits', () => {
    const store = fs.readFileSync(path.join(__dirname, '../PurchaseScreen.tsx'), 'utf8');
    const pass = fs.readFileSync(path.join(__dirname, '../SeasonPassScreen.tsx'), 'utf8');
    expect(store).not.toMatch(/Does not (buy|change|heal)/);
    expect(pass).not.toContain('Does not grant wins');
    expect(store).toContain('eligible non-injured players');
    expect(store).toContain('Permanent ad removal');
    expect(store).toContain('Every Player and Manager save keeps separate XP and reward claims');
  });
});
