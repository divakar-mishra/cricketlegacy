import fs from 'fs';
import path from 'path';

const clubOffice = fs.readFileSync(path.join(__dirname, '..', 'ClubOfficeScreen.tsx'), 'utf8');

describe('Club Office infrastructure', () => {
  it('keeps board confidence on Manager Home instead of duplicating it here', () => {
    expect(clubOffice).not.toContain('Board confidence');
    expect(clubOffice).not.toContain('save.boardConfidence');
  });

  it('puts the home ground and club balance first, with all three facilities below them', () => {
    const homeGround = clubOffice.indexOf('<Text style={styles.section}>Home Ground</Text>');
    const infrastructure = clubOffice.indexOf('<Text style={styles.section}>Infrastructure</Text>');
    const finance = clubOffice.indexOf('<Card style={styles.finance}>');
    const resourceDesk = clubOffice.indexOf(
      '<Text style={styles.section}>Manager Resource Desk</Text>',
    );

    expect(homeGround).toBeGreaterThan(-1);
    expect(infrastructure).toBeGreaterThan(-1);
    expect(homeGround).toBeLessThan(finance);
    expect(finance).toBeLessThan(infrastructure);
    expect(finance).toBeLessThan(resourceDesk);
    expect(clubOffice).toContain("{ kind: 'training', label: 'Training Ground'");
    expect(clubOffice).toContain("{ kind: 'medical', label: 'Medical Centre'");
    expect(clubOffice).toContain("{ kind: 'academy', label: 'Youth Academy'");
    expect(clubOffice).not.toContain("label: 'Stadium'");
  });

  it('uses short qualitative facility labels instead of exposed formulas', () => {
    expect(clubOffice).toContain("return 'Player development'");
    expect(clubOffice).toContain("return 'Recovery and injury prevention'");
    expect(clubOffice).toContain("return 'Youth intake quality'");
    expect(clubOffice).toContain('{currentFacilityEffect(kind)}');
    expect(clubOffice).not.toContain('trainingBonus(save, group)');
    expect(clubOffice).not.toContain('medicalBonus(save)');
    expect(clubOffice).not.toContain('youthQualityBonus(save)');
    expect(clubOffice).not.toContain('near-instant recovery');
    expect(clubOffice).not.toContain('niggles auto-clear');
  });

  it('opens an explicit cash-or-token choice without auto-consuming a token', () => {
    expect(clubOffice).toContain('const hasPaymentChoice = !maxed && facilityUpgradeTokens > 0;');
    expect(clubOffice).toContain("'Upgrade options'");
    expect(clubOffice).toContain('`Upgrade · ${fmtMoney(cost)}`');
    expect(clubOffice).toContain('confirmFacilityUpgrade(');
    expect(clubOffice).toContain('upgradeFacilityLevel(kind, paymentMethod)');
    expect(clubOffice).toContain('onPress={() => doUpgrade(kind, label)}');
    expect(clubOffice).not.toContain("'Upgrade · 1 token'");
  });

  it('keeps Academy prospects reachable without removing direct upgrades', () => {
    expect(clubOffice).toContain('label="View prospects"');
    expect(clubOffice).toContain("navigation.navigate('Academy')");
    expect(clubOffice).toContain('const res = upgradeFacilityLevel(kind, paymentMethod);');
  });

  it('makes the Medical Centre a prominent destination without changing facility upgrades', () => {
    expect(clubOffice).toContain('label="Open medical centre"');
    expect(clubOffice).toContain("navigation.navigate('MedicalCentre')");
    expect(clubOffice).toContain('onPress={() => doUpgrade(kind, label)}');
  });

  it('uses the compact Pixel-width layout and a short office-theme strip', () => {
    expect(clubOffice).toContain('const compactActions = useIsCompact(520);');
    expect(clubOffice).toContain('compactActions && styles.infrastructureGridCompact');
    expect(clubOffice).toContain('compactActions && styles.infrastructureCardCompact');
    expect(clubOffice).toContain(
      "infrastructureGridCompact: { flexDirection: 'column', flexWrap: 'nowrap' }",
    );
    expect(clubOffice).toContain("infrastructureCardCompact: { width: '100%', minWidth: 0 }");
    expect(clubOffice).toContain('minHeight: 64');
    expect(clubOffice).not.toContain('minHeight: 190');
  });

  it('keeps every prior Club Office destination and service reachable', () => {
    expect(clubOffice).toContain("navigation.navigate('WageBreakdown')");
    expect(clubOffice).toContain("purchaseProduct('transfer_budget_sm')");
    expect(clubOffice).toContain("runManagerResource('ELITE_STAFF_SEARCH')");
    expect(clubOffice).toContain("navigation.navigate('StaffRecruitment')");
    expect(clubOffice).toContain('onPress={() => doRenew(p.id, p.name)}');
    expect(clubOffice).toContain('onPress={() => doRelease(p.id, p.name)}');
  });
});
