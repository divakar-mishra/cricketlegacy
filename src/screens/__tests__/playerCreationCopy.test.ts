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
    expect(source).toContain('DEFAULT_AVATAR_CUSTOMIZATION');
    expect(source).toContain('<PlayerAvatar');
    expect(source).toContain('Create your player look');
    expect(source).toContain('label="Difficulty"');
    expect(source).toContain('avatarCustomization,');
  });
});
