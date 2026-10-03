import fs from 'fs';
import path from 'path';

const screen = fs.readFileSync(path.join(__dirname, '../PurchaseScreen.tsx'), 'utf8');
describe('Store prerequisites and background work', () => {
  it('gives expanded VIP benefits the full card width with the price below them', () => {
    expect(screen).toContain('(compact || expandedFeatureCard === passProduct.id) && styles.passCardStacked');
    expect(screen).toContain("passCardStacked: { flexDirection: 'column', alignItems: 'stretch' }");
    expect(screen).toContain('fullWidth={compact || expandedFeatureCard === passProduct.id}');
  });
  it('gives Restore an explicit centered layout instead of intrinsic percentage sizing', () => {
    expect(screen).toContain("restoreButton: { width: '100%', maxWidth: 360 }");
    expect(screen).toContain('Open a Player or Manager career to buy or restore purchases.');
  });
  it('blocks purchases without a save and translates stale no-save errors', () => {
    expect(screen).toContain('const available = hasSave &&');
    expect(screen).toContain('if (!useCareer.getState().save)');
    expect(screen).toContain("no_save: 'Open a career before making a purchase.'");
    expect(screen).toContain(
      'disabled={!save || busy != null || !purchases.isProductAvailable(legendProduct)}',
    );
  });
  it('does not tick an offscreen or expired Store countdown', () => {
    expect(screen).toContain('if (!isFocused || !starterOfferActive) return;');
  });
});
