import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'PlayerCreationScreen.tsx'), 'utf8');

describe('player creation attribute dashboard', () => {
  it('shows the live remaining point total in the dashboard', () => {
    expect(source).toContain('<Text style={styles.attrDashBudget}>{remaining} pts</Text>');
    expect(source).not.toContain('<Text style={styles.attrDashBudget}>{creationBudget} pts</Text>');
  });

  it('starts new careers only at U14 school level', () => {
    expect(source).toContain("const [careerStart, setCareerStart] = useState<CareerStart>('u14')");
    expect(source).toContain("value: 'u14' as const");
    expect(source).not.toContain("value: 'u19' as const");
    expect(source).not.toContain("value: 'domestic' as const");
    expect(source).not.toContain('Youth pathways start with a lower OVR');
  });

  it('puts avatar setup and difficulty where players can see them before review', () => {
    expect(source).toContain("'Identity & Avatar'");
    expect(source).toContain('DEFAULT_AVATAR_CONFIG');
    expect(source).toContain('<AvatarCustomizer');
    expect(source).toContain('label="Difficulty"');
    expect(source).toContain('avatarConfig,');
  });

  it('renders country flags through the cross-platform flag component', () => {
    expect(source).toContain('CountryFlag,');
    expect(source).toContain('<CountryFlag countryId={c.id} flag={c.flag} size={24} />');
    expect(source).not.toContain('<Text style={styles.flag}>{c.flag}</Text>');
  });
});
