import fs from 'fs';
import path from 'path';

const flagSource = fs.readFileSync(path.join(__dirname, '..', 'CountryFlag.tsx'), 'utf8');
const profileSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'PlayerProfileScreen.tsx'),
  'utf8',
);

describe('England flag fallback', () => {
  it('draws the St George cross without relying on an emoji glyph', () => {
    expect(flagSource).toContain("countryId === 'england'");
    expect(flagSource).toContain('horizontalCross');
    expect(flagSource).toContain('verticalCross');
    expect(flagSource).toContain("backgroundColor: '#CE1124'");
    expect(profileSource).toContain('<CountryFlag countryId={country.id}');
  });
});
