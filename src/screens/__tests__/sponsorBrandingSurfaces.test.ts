import fs from 'node:fs';
import path from 'node:path';

function screen(name: string): string {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

describe('sponsor branding surfaces', () => {
  it('carries both sponsor slots through Career Home and Profile', () => {
    for (const source of [screen('CareerHubScreen.tsx'), screen('PlayerProfileScreen.tsx')]) {
      expect(source).toContain('earnedSponsor={sponsorBranding.earned}');
      expect(source).toContain('premiumSponsor={sponsorBranding.premium}');
    }
  });

  it('uses the selected kit colour in the full Cosmetics shirt preview', () => {
    const source = screen('PlayerCosmeticsScreen.tsx');
    expect(source).toContain('<SponsoredKitPreview');
    expect(source).toContain("kitColor={kitColorHex(kit) ?? '#F7F7F7'}");
    expect(source).toContain('earned={sponsorBranding.earned}');
    expect(source).toContain('premium={sponsorBranding.premium}');
    expect(source).toContain('shirtName={normalizeShirtName');
    expect(source).toContain('shirtNumber={normalizeShirtNumber');
    expect(source).toContain('side={kitSide}');
    expect(source).toContain('BACK NAME');
    expect(source).toContain('NUMBER');
    expect(source).not.toContain('Premium cosmetics use gems.');
    expect(source).not.toContain('More looks unlock during your career.');
  });

  it('shows both marks at Matchday and in domestic Manager club headers', () => {
    const match = screen('MatchScreen.tsx');
    const manager = screen('ManagerHubScreen.tsx');
    const office = screen('ClubOfficeScreen.tsx');
    expect(match).toContain('<SponsorBrandRow');
    expect(match).toContain('premium={sponsorBranding.premium}');
    expect(manager).toContain('premium={managerSponsorBranding.premium}');
    expect(manager).toContain('isNationalManager\n    ? { earned: undefined, premium: undefined }');
    expect(office).toContain('earned={sponsorBranding.earned}');
    expect(office).toContain('premium={sponsorBranding.premium}');
    expect(match).toContain('activeSponsorBranding(save)');
  });

  it('uses approved artwork in offer and active-contract cards', () => {
    const playerLife = screen('PlayerLifeScreen.tsx');
    const office = screen('ClubOfficeScreen.tsx');
    for (const source of [playerLife, office]) {
      expect(source).toContain('<SponsorLogo brand={offer}');
      expect(source).toContain('brandId={activeEarnedSponsor.brandId}');
    }
  });
});
