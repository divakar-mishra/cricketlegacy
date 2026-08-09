import fs from 'node:fs';
import path from 'node:path';
import { COUNTRIES } from '../../data/countries';
import { managerControlledTeamId, managerPhaseProgress } from '../managerCalendar';
import { managerDomesticBlueprints } from '../domesticBranding';
import { createManagerSave } from '../createGame';
import { resolveNextCareerStep } from '../careerStep';
import { standings } from '../season';

describe('new-career hub launch regression', () => {
  it('creates a complete selectable manager team in every supported country', () => {
    for (const [countryIndex, country] of COUNTRIES.entries()) {
      const tierThree = managerDomesticBlueprints(country.id).filter((team) => team.tier === 3);
      expect(tierThree).toHaveLength(8);
      const selected = tierThree[countryIndex % tierThree.length];
      const save = createManagerSave({
        teamId: selected.id,
        country: country.id,
        difficulty: 'NORMAL',
        format: 'T20',
        seed: 9000 + countryIndex,
      });
      expect(save.teams[save.userTeamId!]?.id).toBe(selected.id);
      expect(save.teams[selected.id].playerIds.length).toBeGreaterThanOrEqual(15);
      expect(save.managerCalendar?.phase).toBe('T20');
      expect(() => managerControlledTeamId(save)).not.toThrow();
      expect(() => managerPhaseProgress(save)).not.toThrow();
      expect(() => resolveNextCareerStep(save)).not.toThrow();
      expect(() => standings(save)).not.toThrow();
    }
  });

  it('does not conditionally add hooks or remount hub cards after a save arrives', () => {
    const careerHub = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'CareerHubScreen.tsx'),
      'utf8',
    );
    const guard = careerHub.indexOf('if (!save || !save.userPlayerId');
    expect(guard).toBeGreaterThan(0);
    const afterGuard = careerHub.slice(guard);
    expect(afterGuard).not.toMatch(/\buse(?:Effect|Memo|Callback|State|Ref)\s*\(/);
    expect(careerHub).not.toContain('<HomeTab');
    expect(careerHub).not.toContain('key={page}');
    expect(careerHub).not.toContain('entering={');

    const managerHub = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'ManagerHubScreen.tsx'),
      'utf8',
    );
    expect(managerHub).not.toContain('entering={');
  });
});
