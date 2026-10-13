import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(path.join(__dirname, '..', 'ContractNegotiationScreen.tsx'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '..', '..', 'state', 'careerStore.ts'), 'utf8');

describe('contract negotiation boost', () => {
  it('insets the signed confirmation action through its parent instead of overflowing a full-width button', () => {
    const signed = screen.slice(screen.indexOf("if (stage === 'SIGNED')"), screen.indexOf('// ── Result of negotiation'));
    expect(signed).toMatch(/<View style=\{styles\.actions\}>\s*<Button\s+label="Back to Hub"/);
    expect(signed).not.toContain('style={{ marginHorizontal: spacing.lg');
  });

  it('shows the stored benefit without restoring the removed explanatory sales block', () => {
    expect(screen).toContain('Renewal boost ready · applies when signed');
    expect(screen).not.toContain('+25% wage and signing bonus will apply when you sign.');
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
