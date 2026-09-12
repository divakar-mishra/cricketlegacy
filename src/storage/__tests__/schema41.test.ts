import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { createManagerSave } from '../../game/createGame';
import { startNewSeason } from '../../game/season';
import { runMigrations } from '../migrate';
import { grantModeVip } from '../../game/vip';

describe('schema 41 manager lifespan', () => {
  it('derives a legacy manager age from completed seasons without changing results', () => {
    const legacy = {
      schemaVersion: 40,
      id: 'legacy-manager',
      mode: 'manager',
      careerSeasons: 9,
      careerWins: 81,
      careerLosses: 44,
      careerDraws: 3,
    };

    const migrated = runMigrations(legacy);

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.managerAge).toBe(44);
    expect(migrated?.managerRetired).toBe(false);
    expect(migrated?.careerWins).toBe(81);
    expect(migrated?.careerLosses).toBe(44);
    expect(migrated?.careerDraws).toBe(3);
  });

  it('retires a manager at age 60 and prevents another season rollover', () => {
    const save = createManagerSave({
      teamId: 'mumbai_sharks',
      country: 'india',
      difficulty: 'NORMAL',
      seed: 41,
    });
    save.managerAge = 59;
    grantModeVip(save, 'manager_vip');
    for (const fixture of Object.values(save.fixtures)) fixture.played = true;
    if (save.managerCalendar) save.managerCalendar.phase = 'OFF_SEASON';

    startNewSeason(save);

    expect(save.managerAge).toBe(60);
    expect(save.managerRetired).toBe(true);
    expect(save.vipCollections?.owned).toHaveLength(12);
    const seasonAfterRetirement = save.currentSeasonId;
    startNewSeason(save);
    expect(save.currentSeasonId).toBe(seasonAfterRetirement);
    expect(save.managerAge).toBe(60);
    expect(save.vipCollections?.owned).toHaveLength(12);
  });
});
