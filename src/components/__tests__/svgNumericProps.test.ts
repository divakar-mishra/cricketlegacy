import fs from 'fs';
import path from 'path';

describe('SVG numeric props', () => {
  it('uses a leading zero for fractional values parsed by react-native-svg', () => {
    const files = [
      'CricketerArtwork.tsx',
      'avatar/ProfileFrame.tsx',
      'AwardArtwork.tsx',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).not.toMatch(
        /\b(?:offset|strokeOpacity|strokeWidth|stopOpacity|x1|x2|y1|y2)="\.\d/,
      );
    }
  });
});
