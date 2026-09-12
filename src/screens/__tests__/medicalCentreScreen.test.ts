import fs from 'fs';
import path from 'path';

const screensDir = path.join(__dirname, '..');
const medical = fs.readFileSync(path.join(screensDir, 'MedicalCentreScreen.tsx'), 'utf8');
const managerHub = fs.readFileSync(path.join(screensDir, 'ManagerHubScreen.tsx'), 'utf8');
const clubOffice = fs.readFileSync(path.join(screensDir, 'ClubOfficeScreen.tsx'), 'utf8');
const screenExports = fs.readFileSync(path.join(screensDir, 'index.ts'), 'utf8');
const navigation = fs.readFileSync(path.join(screensDir, '..', 'navigation', 'index.ts'), 'utf8');
const app = fs.readFileSync(path.resolve(screensDir, '..', '..', 'App.tsx'), 'utf8');

describe('Manager Medical Centre', () => {
  it('moves the recovery offer off Manager Home into a dedicated Club Office route', () => {
    expect(managerHub).not.toContain('Physio Recovery Pack');
    expect(managerHub).not.toContain("purchaseProduct('recovery_pack')");
    expect(managerHub).not.toContain('applySquadRecovery');
    expect(managerHub).not.toContain('confirmTokenRecovery');
    expect(navigation).toContain('MedicalCentre: undefined;');
    expect(screenExports).toContain("export { MedicalCentreScreen } from './MedicalCentreScreen';");
    expect(app).toContain('<Stack.Screen name="MedicalCentre" component={MedicalCentreScreen} />');
    expect(clubOffice).toContain('label="Open medical centre"');
    expect(clubOffice).toContain("navigation.navigate('MedicalCentre')");
  });

  it('keeps the complete purchase, preview, confirmation and apply path', () => {
    expect(medical).toContain("showShortageOffer(save, 'conditioning'");
    expect(medical).toContain("navigation.navigate('Purchase', { productId })");
    expect(medical).toContain("applySquadRecovery('token')");
    expect(medical).toContain("'Apply Squad Recovery?'");
    expect(medical).toContain('1 Recovery Token');
    expect(medical).toContain('Squad condition: ${averageCondition}% → ${averageAfterRecovery}%');
    expect(medical).toContain('${affected.length} eligible non-injured players');
    expect(medical).toContain('Cooldown: 3 fixtures or 7 days');
    expect(medical).toContain("{ text: 'Cancel', style: 'cancel' }");
  });

  it('keeps the recovery eligibility threshold and shows squad readiness', () => {
    expect(medical).not.toContain('{recoveryOfferVisible ? (');
    expect(medical).toContain('disabled={!recoveryOfferVisible}');
    expect(medical).toContain('Squad already fit');
    expect(medical).toContain('Recovery not needed yet');
    expect(medical).toContain('if (!recoveryOfferVisible) return;');
    expect(medical).toContain('Your tokens are kept until used.');
    expect(medical).toContain('const RECOVERY_THRESHOLD = 60;');
    expect(medical).toContain('const MINIMUM_TIRED_PLAYERS = 3;');
    expect(medical).toContain('Squad readiness');
    expect(medical).toContain('Needs attention');
    expect(medical).toContain('<Text style={styles.tokenPillValue}>{recoveryTokens}</Text>');
  });

  it('returns a frozen retained-club state during National duty', () => {
    const nationalGuard = medical.indexOf("save.managerCareerLevel === 'NATIONAL'");
    const activeSquadLookup = medical.indexOf('const teamId = managerControlledTeamId(save)');

    expect(nationalGuard).toBeGreaterThan(-1);
    expect(activeSquadLookup).toBeGreaterThan(nationalGuard);
    expect(medical).toContain('Club operations paused');
    expect(medical).not.toContain(
      'Your retained club remains unchanged while you manage the national side.',
    );
  });
});
