import fs from 'fs';
import path from 'path';

const source = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('per-save premium sponsor presentation', () => {
  const playerLife = source('PlayerLifeScreen.tsx');
  const clubOffice = source('ClubOfficeScreen.tsx');
  const purchase = source('PurchaseScreen.tsx');
  const savedGames = source('SavedGamesScreen.tsx');

  it('shows the extra slot separately from the earned contract in both modes', () => {
    for (const screen of [playerLife, clubOffice]) {
      expect(screen).toContain('Permanent sponsor');
      expect(screen).toContain('qualifying week');
      expect(screen).toContain('Extra slot');
      expect(screen).toContain('This save only');
      expect(screen).toContain('View permanent sponsor');
      expect(screen).toContain("navigation.navigate('Purchase')");
    }
  });

  it('warns before deleting the exact save that owns the sponsor', () => {
    expect(savedGames).toContain('save.sponsorship?.premium');
    expect(savedGames).toContain('Delete permanently');
    expect(savedGames).toContain('server backup and sponsor binding');
    expect(savedGames).toContain('deletePremiumSponsorExactSave(save)');
  });

  it('keeps an owned Manager sponsor visible and explicit during national duty', () => {
    expect(purchase).toContain('ownedSaveSponsorProductId === product.id');
    expect(purchase).toContain("save?.managerCareerLevel === 'NATIONAL'");
    expect(purchase).toContain(
      'Owned · payments paused during national duty · resumes with next domestic club',
    );
  });

  it('names and previews the approved Legacy Crown permanent partner', () => {
    expect(purchase).toContain("brandId: 'legacy_crown'");
    expect(purchase).toContain("brandName: 'Legacy Crown'");
    expect(playerLife).toContain('brandId="legacy_crown"');
    expect(clubOffice).toContain('brandId="legacy_crown"');
  });

  it('keeps story campaigns visible but explicitly off the shirt', () => {
    expect(playerLife).toContain('Off-shirt endorsements');
    expect(playerLife).not.toContain('never occupy or appear in a kit-partner slot');
    expect(playerLife).toContain('sponsor.perMatchCoins.toLocaleString()');
  });
});
