import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import { runMigrations } from '../migrate';

describe('schema 39 player kit identity', () => {
  it('adds a deterministic back name and number without changing balances', () => {
    const legacy = makeCareerSave(39_001);
    legacy.schemaVersion = 38;
    if (legacy.cosmetics) {
      delete legacy.cosmetics.shirtName;
      delete legacy.cosmetics.shirtNumber;
    }
    const balances = JSON.stringify(legacy.wallet);

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.cosmetics?.shirtName).toBe('STAR');
    expect(migrated.cosmetics?.shirtNumber).toBeGreaterThanOrEqual(1);
    expect(migrated.cosmetics?.shirtNumber).toBeLessThanOrEqual(99);
    expect(JSON.stringify(migrated.wallet)).toBe(balances);
  });

  it('keeps Manager saves unchanged and normalizes invalid Player values', () => {
    const manager = makeManagerSave(39_002);
    manager.schemaVersion = 38;
    const migratedManager = runMigrations(JSON.parse(JSON.stringify(manager)))!;
    expect(migratedManager.cosmetics).toBeUndefined();

    const career = makeCareerSave(39_003);
    career.schemaVersion = 38;
    career.cosmetics!.shirtName = '  ocean  star  ';
    career.cosmetics!.shirtNumber = 240;
    const migratedCareer = runMigrations(JSON.parse(JSON.stringify(career)))!;
    expect(migratedCareer.cosmetics).toMatchObject({
      shirtName: 'OCEAN STAR',
      shirtNumber: 99,
    });
  });
});
