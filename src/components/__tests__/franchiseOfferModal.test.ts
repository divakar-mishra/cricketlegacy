import fs from 'fs';
import path from 'path';

describe('FranchiseOfferModal auction-room presentation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'FranchiseOfferModal.tsx'), 'utf8');

  it('leads with the player lot, bidding paddles and cricket fit', () => {
    expect(source).toContain('T20 FRANCHISE AUCTION · FINAL CALL');
    expect(source).toContain('PLAYER LOT');
    expect(source).toContain('BIDDING PADDLES');
    expect(source).toContain('CRICKET FIT');
    expect(source).toContain('franchiseSquadFit');
  });

  it('keeps money on a contract sheet and explains the separate affiliation', () => {
    expect(source).toContain('AGENT&apos;S CONTRACT SHEET');
    expect(source).toContain('HAMMER BID');
    expect(source).toContain('SEASON SALARY');
    expect(source).toContain(
      'Separate T20 contract · First-Class and List A affiliation stays unchanged',
    );
  });

  it('does not fall back to the old salary-card offer list', () => {
    expect(source).not.toContain('styles.offerCard');
    expect(source).not.toContain('Clubs want to sign');
  });
});
