import fs from 'node:fs';
import path from 'node:path';

const screen = (name: string) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const clubOffice = screen('ClubOfficeScreen.tsx');
const academy = screen('AcademyScreen.tsx');
const prompt = screen('facilityUpgradePrompt.ts');
const alert = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'GlassAlertModal.tsx'),
  'utf8',
);
const purchases = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'purchases.ts'),
  'utf8',
);

describe('facility upgrade payment choice UI', () => {
  it.each([
    ['Club Office', clubOffice],
    ['Academy', academy],
  ])('%s delegates to the same truthful payment prompt', (_name, source) => {
    expect(source).toContain("from './facilityUpgradePrompt'");
    expect(source).toContain('confirmFacilityUpgrade(');
    expect(source).toContain('cashCost:');
    expect(source).toContain('clubBalance: team.budget');
    expect(source).toContain('tokenCount: facilityUpgradeTokens');
    expect(source).toContain('paymentMethod');
  });

  it('shows the exact level, cash cost, balance, token count and upkeep consequence', () => {
    expect(prompt).toContain('Level ${input.currentLevel} → ${input.currentLevel + 1}');
    expect(prompt).toContain('Cash cost · ${formatClubCurrency(input.cashCost)}');
    expect(prompt).toContain('Club Balance · ${formatClubCurrency(input.clubBalance)}');
    expect(prompt).toContain('Facility tokens · ${tokenCount}');
    expect(prompt).toContain('Normal seasonal upkeep still applies.');
  });

  it('offers an optional token alongside cash and confirms cash when no token exists', () => {
    expect(prompt).toContain('Choose Club Balance or one optional facility token.');
    expect(prompt).toContain('Confirm this Club Balance upgrade.');
    expect(prompt).toContain(
      "tokenButtonLabel: tokenCount > 0 ? 'Use 1 optional token' : undefined",
    );
    expect(prompt).toContain("onSelect('TOKEN')");
    expect(prompt).toContain("onSelect('CLUB_BUDGET')");
    expect(prompt).toContain("{ text: 'Cancel', style: 'cancel' }");
  });

  it('visibly disables an unaffordable cash choice instead of switching methods', () => {
    expect(prompt).toContain('disabled: !copy.cashAvailable');
    expect(prompt).toContain('Club Balance short by');
    expect(alert).toContain('disabled={button.disabled}');
  });

  it('describes the ₹199 IAP as an optional shortcut while preserving cash and upkeep', () => {
    expect(purchases).toContain("id: 'facility_upgrade_token'");
    expect(purchases).toContain(
      'Optional shortcut for one facility level. Club Balance upgrades stay available; normal upkeep still applies.',
    );
    expect(purchases).toContain("priceString: '₹199'");
  });
});
