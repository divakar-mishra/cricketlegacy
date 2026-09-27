import fs from 'fs';
import path from 'path';

describe('FranchiseOfferModal club-choice presentation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'FranchiseOfferModal.tsx'), 'utf8');

  it('shows the approaching T20 clubs and cricket fit without auction jargon', () => {
    expect(source).toContain('T20 CLUB OFFERS');
    expect(source).toContain('clubs have approached you');
    expect(source).toContain('franchiseSquadFit');
    expect(source).not.toContain('HAMMER BID');
    expect(source).not.toContain('BIDDING PADDLES');
  });

  it('shows the money the player actually receives, including on legacy saves', () => {
    expect(source).toContain('SEASON SALARY');
    expect(source).toContain('SIGNING BONUS');
    expect(source).toContain('contractCoinsAtLeast(offer.wagePromise, currentSalary)');
    expect(source).toContain('roundContractCoins(offer.signingBonus)');
    expect(source).toContain('Your First-Class and List A club will not change.');
  });

  it('gives each club a direct sign action and a stay option', () => {
    expect(source).toContain('Sign with ${club?.shortName');
    expect(source).toContain('Stay with {currentClub?.shortName');
  });
});
