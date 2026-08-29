import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import { runMigrations } from '../migrate';

describe('schema 43 international ranking peaks', () => {
  it('starts prospective Player tracking without fabricating historical ranks', () => {
    const legacy = makeCareerSave(43);
    legacy.schemaVersion = 42;
    legacy.players[legacy.userPlayerId!].competitionStats = {
      ODI: {
        matches: 80,
        runs: 4_000,
        balls: 4_200,
        fours: 300,
        sixes: 80,
        highScore: 160,
        notOuts: 8,
        fifties: 24,
        hundreds: 8,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        bestBowling: '-',
        catches: 30,
        stumpings: 0,
      },
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.internationalPlayerRankingPeaks).toEqual({});
    expect(migrated.players[migrated.userPlayerId!].competitionStats?.ODI?.runs).toBe(4_000);
  });

  it('does not add a Player ranking ledger to Manager saves', () => {
    const legacy = makeManagerSave(43);
    legacy.schemaVersion = 42;
    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.internationalPlayerRankingPeaks).toBeUndefined();
  });
});
