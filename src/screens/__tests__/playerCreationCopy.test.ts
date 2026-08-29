import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'PlayerCreationScreen.tsx'), 'utf8');

describe('player creation attribute dashboard', () => {
  it('shows the live remaining point total in the dashboard', () => {
    expect(source).toContain('<Text style={styles.attrDashBudget}>{remaining} pts</Text>');
    expect(source).not.toContain('<Text style={styles.attrDashBudget}>{creationBudget} pts</Text>');
  });

  it('starts new careers only in Grade A at age 16', () => {
    expect(source).toContain("const [careerStart, setCareerStart] = useState<CareerStart>('u14')");
    expect(source).toContain("value: 'u14' as const");
    expect(source).toContain("label: 'Grade A Cricket'");
    expect(source).toContain('ageOverride: 16');
    expect(source).not.toContain("value: 'u19' as const");
    expect(source).not.toContain("value: 'domestic' as const");
    expect(source).not.toContain('Youth pathways start with a lower OVR');
  });

  it('puts avatar setup and difficulty where players can see them before review', () => {
    expect(source).toContain("'Identity & Avatar'");
    expect(source).toContain('DEFAULT_AVATAR_CONFIG');
    expect(source).toContain('<PortraitPicker');
    expect(source).toContain('label="Difficulty"');
    expect(source).toContain('avatarConfig,');
  });

  it('uses the shared compact country selector', () => {
    expect(source).toContain('CountrySelect,');
    expect(source).toContain('<CountrySelect');
    expect(source).toContain('onChange={changeNationality}');
    expect(source).not.toContain('COUNTRIES.map');
  });

  it('returns every creation step to the top before rendering its content', () => {
    expect(source).toContain('scrollResetKey={step}');
  });

  it('explains ratings and the reserved club without repeated prose', () => {
    expect(source).toContain('Active Grade A OVR');
    expect(source).toContain('Reserved Tier 3 club');
    expect(source).toContain('Grade A → Under-19 → senior domestic');
    expect(source).not.toContain('Large numbers are active Grade A ratings');
    expect(source).not.toContain('contract starts after you earn progression');
    expect(source).not.toContain('The large number beside each skill');
  });
});
