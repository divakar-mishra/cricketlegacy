import { readFileSync } from 'fs';
import { join } from 'path';

const screen = (name: string) => readFileSync(join(__dirname, '..', name), 'utf8');
describe('paid cosmetic visibility contracts', () => {
  it('labels the featured bundle as one-time, including its buy button', () => {
    const source = screen('PurchaseScreen.tsx');
    expect(source).toContain('One-time bundle · No subscription');
    expect(source).toContain('Buy · ${legendProduct.priceString} once');
  });
  it('does not let Legend ownership override an explicitly selected office collection', () => {
    expect(screen('ClubOfficeScreen.tsx')).toContain("selectedOffice === 'office_classic' && Boolean(save.inventory?.manager_legend_office_theme)");
  });
  it('keeps equipped kits and frames connected to profile and match portraits', () => {
    expect(screen('PlayerProfileScreen.tsx')).toContain('kitId={isUser ? save.cosmetics?.kit : undefined}');
    expect(screen('MatchScreen.tsx')).toContain('kitId={save.cosmetics?.kit}');
    expect(screen('MatchScreen.tsx')).toContain('profileFrame={save.cosmetics?.profileFrame}');
    expect(screen('MatchScreen.tsx')).toContain('equippedId: save?.cosmetics?.celebration');
  });
});
