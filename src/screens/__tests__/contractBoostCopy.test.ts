import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(path.join(__dirname, '..', 'ContractNegotiationScreen.tsx'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '..', '..', 'state', 'careerStore.ts'), 'utf8');

describe('contract negotiation boost', () => {
  it('shows the stored benefit and links the unowned offer to the store', () => {
    expect(screen).toContain('Renewal boost ready');
    expect(screen).toContain('+25% wage and signing bonus will apply when you sign.');
    expect(screen).toContain("navigation.navigate('Purchase')");
  });

  it('applies and consumes the token in the negotiated signing action', () => {
    const branch = store.slice(
      store.indexOf('signNegotiatedContract: (offer) =>'),
      store.indexOf('// ── Manager IAP actions'),
    );
    expect(branch).toContain("inventoryCount(save, 'contract_boost_token')");
    expect(branch).toContain('offer.wage * 1.25');
    expect(branch).toContain("setInventoryCount(save, 'contract_boost_token', boostTokens - 1)");
  });
});
