import fs from 'fs';
import path from 'path';

const screen = (name: string) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

describe('sponsorship navigation', () => {
  it('opens the player media page at the partnership section', () => {
    expect(screen('CareerHubScreen.tsx')).toContain("navigation.navigate('PlayerLife', { initialTab: 'media' })");
    const playerLife = screen('PlayerLifeScreen.tsx');
    expect(playerLife.indexOf("renderSectionTitle('Kit Partnership'")).toBeLessThan(
      playerLife.indexOf("renderSectionTitle('Public profile'"),
    );
    expect(playerLife).not.toContain('requestAnimationFrame');
  });

  it('supports the same direct section target for manager club office', () => {
    expect(screen('ManagerHubScreen.tsx')).toContain("navigation.navigate('ClubOffice', { focusSponsor: true })");
    expect(screen('ClubOfficeScreen.tsx')).toContain('route.params?.focusSponsor');
    expect(screen('ClubOfficeScreen.tsx')).toContain('sponsorScrollRef.current?.scrollTo');
  });
});
