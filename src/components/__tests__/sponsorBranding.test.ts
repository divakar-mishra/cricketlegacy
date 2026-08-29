import fs from 'node:fs';
import path from 'node:path';

const brandingSource = fs.readFileSync(path.join(__dirname, '..', 'SponsorBranding.tsx'), 'utf8');
const avatarSource = fs.readFileSync(path.join(__dirname, '..', 'PlayerAvatar.tsx'), 'utf8');
const sponsorMarkSource = fs.readFileSync(path.join(__dirname, '..', 'SponsorMark.tsx'), 'utf8');

describe('dynamic sponsor presentation', () => {
  it('uses code-native SVG artwork and never edits or embeds a portrait asset', () => {
    expect(brandingSource).toContain("from 'react-native-svg'");
    expect(brandingSource).toContain('export function SponsoredKitPreview');
    expect(brandingSource).toContain('viewBox="0 0 320 260"');
    expect(brandingSource).toContain('<SvgLinearGradient id="kit-body"');
    expect(brandingSource).toContain('kitBackNumber');
    expect(brandingSource).not.toContain('<Image');
    expect(brandingSource).not.toContain('require(');
  });

  it('keeps centre-chest earned and secondary premium marks independent', () => {
    expect(brandingSource).toContain("side === 'front' && earned ? (");
    expect(brandingSource).toContain("side === 'front' && premium ? (");
    expect(brandingSource).toContain('centre-chest sponsor');
    expect(brandingSource).toContain('secondary chest sponsor');
    expect(brandingSource).toContain('kitPrimarySponsor');
    expect(brandingSource).toContain('kitPremiumSponsor');
  });

  it('keeps compact sponsor badges clear of the role badge', () => {
    expect(avatarSource).toContain('reserveRoleSpace={showRole}');
    expect(avatarSource).toContain('right: 2');
    expect(brandingSource).toContain("position: 'absolute'");
    expect(brandingSource).toContain('reserveRoleSpace &&');
  });

  it('provides explicit accessible names for every sponsor placement', () => {
    expect(brandingSource).toContain('accessibilityRole="image"');
    expect(brandingSource).toContain('printed shirt sponsor');
    expect(brandingSource).toContain('shirt sponsor');
    expect(brandingSource).toContain("'Front' : 'Back'} kit preview");
  });

  it('uses the audited opaque lockup palette instead of theme-dependent pill contrast', () => {
    const logoStyle = brandingSource.slice(
      brandingSource.indexOf('logo: {'),
      brandingSource.indexOf('logoBadge: {'),
    );
    expect(brandingSource).toContain('SPONSOR_LOCKUP_BACKGROUND');
    expect(brandingSource).toContain("backgroundColor: print ? 'transparent'");
    expect(brandingSource).toContain("borderColor: print ? 'transparent' : brand.primary");
    expect(brandingSource).toContain('{ color: brand.secondary }');
    expect(logoStyle).not.toContain('colors.surfaceAlt');
  });

  it('upgrades contract-information marks to the approved logo when a brand id exists', () => {
    expect(sponsorMarkSource).toContain('brandId?: string');
    expect(sponsorMarkSource).toContain('<SponsorLogo');
    expect(sponsorMarkSource).toContain('brand={{ brandId, brandName: displayName }}');
  });
});
