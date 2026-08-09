import fs from 'fs';
import path from 'path';

describe('MatchScreen live commentary order', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'MatchScreen.tsx'), 'utf8');

  it('renders recent commentary before crease and field controls can push it off screen', () => {
    const commentaryIndex = source.indexOf('accessibilityLabel="Recent commentary"');
    const partnershipIndex = source.indexOf('{/* Partnership Tracker */}');
    const fieldIndex = source.indexOf(
      '<View style={[styles.midRow, fastMatchUi && styles.midRowFast]}>',
    );

    expect(commentaryIndex).toBeGreaterThan(-1);
    expect(partnershipIndex).toBeGreaterThan(-1);
    expect(fieldIndex).toBeGreaterThan(-1);
    expect(commentaryIndex).toBeLessThan(partnershipIndex);
    expect(commentaryIndex).toBeLessThan(fieldIndex);
  });
});
