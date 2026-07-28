import { TeamBlueprint } from '../../content/teams';
import {
  careerStartToPath,
  teamSelectionSummary,
  trainingAttributeCeiling,
  youthOpponentQuality,
  youthSelectionRequirement,
} from '../youthBalance';

const team: TeamBlueprint = {
  id: 'test_club',
  name: 'Test Club',
  shortName: 'TST',
  country: 'india',
  primaryColor: '#111111',
  secondaryColor: '#ffffff',
  strength: 82,
  tier: 1,
};

describe('youth balance policy', () => {
  it('maps career start choices to age-compatible pathway levels', () => {
    expect(careerStartToPath('u14')).toBe('SCHOOL');
    expect(careerStartToPath('u19')).toBe('U19');
    expect(careerStartToPath('domestic')).toBe('DOMESTIC');
  });

  it('keeps youth opponent strength and training caps below senior levels', () => {
    expect(youthOpponentQuality('SCHOOL')).toBe(34);
    expect(youthOpponentQuality('U19')).toBe(48);
    expect(trainingAttributeCeiling('SCHOOL')).toBe(62);
    expect(trainingAttributeCeiling('U19')).toBe(76);
    expect(trainingAttributeCeiling('DOMESTIC')).toBe(99);
    expect(youthSelectionRequirement('SCHOOL')).toBe(34);
    expect(youthSelectionRequirement('U19')).toBe(47);
  });

  it('does not show senior division labels for youth team selection', () => {
    const u14 = teamSelectionSummary(team, 'u14');
    const u19 = teamSelectionSummary(team, 'u19');
    const domestic = teamSelectionSummary(team, 'domestic');

    expect(u14).toContain('Under-14 pathway');
    expect(u14).toContain('School district cricket');
    expect(u14).toContain('Opponents 28-40 OVR');
    expect(u14).toContain('Selection starter pathway');
    expect(u14).not.toContain('Division 1');
    expect(u14).not.toContain('Squad strength 82');
    expect(u19).toContain('State youth cricket');
    expect(domestic).toContain('Top division');
    expect(domestic).toContain('Squad strength 82');
  });
});
