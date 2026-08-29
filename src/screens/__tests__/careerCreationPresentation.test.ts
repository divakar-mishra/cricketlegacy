import fs from 'node:fs';
import path from 'node:path';

const readScreen = (name: string) =>
  fs.readFileSync(path.join(__dirname, '..', `${name}Screen.tsx`), 'utf8');
const readComponent = (name: string) =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'components', `${name}.tsx`), 'utf8');

const newGame = readScreen('NewGame');
const teamSelect = readScreen('TeamSelect');
const playerCreation = readScreen('PlayerCreation');
const managerHub = readScreen('ManagerHub');
const countrySelect = readComponent('CountrySelect');

describe('compact career creation', () => {
  it('keeps both career choices while removing repeated mode explanations', () => {
    expect(newGame).toContain("navigation.navigate('PlayerCreation')");
    expect(newGame).toContain("navigation.navigate('TeamSelect')");
    expect(newGame).not.toContain('details={[');
    expect(newGame).not.toContain('detailPill');
    expect(newGame).not.toContain("subtitle={t('newgame.subtitle')}");
  });

  it('uses the same country dropdown for player and manager creation', () => {
    expect(playerCreation).toContain('<CountrySelect');
    expect(playerCreation).toContain('onChange={changeNationality}');
    expect(teamSelect).toContain('<CountrySelect');
    expect(teamSelect).toContain('setCountryId(nextCountryId)');
    expect(teamSelect).toContain('setTeamId(null)');
    expect(playerCreation).not.toContain('COUNTRIES.map');
    expect(teamSelect).not.toContain('COUNTRIES.map');
  });

  it('keeps every configured country in a safe, scrollable and accessible list', () => {
    expect(countrySelect).toContain('data={COUNTRIES}');
    expect(countrySelect).toContain('<CountryFlag');
    expect(countrySelect).toContain('useSafeAreaInsets()');
    expect(countrySelect).toContain('accessibilityState={{ expanded: open }}');
    expect(countrySelect).toContain('accessibilityRole="radio"');
    expect(countrySelect).toContain('onRequestClose={() => setOpen(false)}');
  });

  it('keeps Squad reachable without restoring the removed Home roster preview', () => {
    expect(managerHub).toContain("label: 'Team Sheet'");
    expect(managerHub).toContain("to: 'Squad'");
    expect(managerHub).not.toContain('<Text style={styles.section}>Squad</Text>');
    expect(managerHub).not.toContain('<Text style={styles.section}>Playing XI</Text>');
    expect(managerHub).not.toContain('`Show all ${squad.length} players`');
  });
});
