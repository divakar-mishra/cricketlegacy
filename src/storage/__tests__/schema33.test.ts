import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../../game/createGame';
import { synchronizeSchema33State } from '../schema33';
import { runMigrations } from '../migrate';

function legacyU19Save() {
  const player = buildUserPlayer({
    name: 'Legacy Prospect',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 60, timing: 60, power: 58, footwork: 58, temperament: 60, running: 58 },
    bowling: { paceOrSpin: 30, accuracy: 30, movement: 30, variations: 30, stamina: 35 },
    fielding: { catching: 55, throwing: 55, agility: 55, keeping: 32 },
    meta: { fitness: 68, confidence: 62, aggression: 52, discipline: 63 },
    age: 17,
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 92,
  });
  save.schemaVersion = 32;
  save.careerPathLevel = 'U19';
  save.careerPathMatches = 4;
  save.careerPathRuns = 210;
  save.careerPathWickets = 1;
  save.careerPathRatingSum = 26;
  save.wallet = { coins: 4321, gems: 7, energy: 21, energyUpdatedAt: 99 };
  save.userCaps = 2;
  save.capped = false;
  delete save.u19WorldCup;
  return save;
}

describe('schema 33 U19 World Cup migration', () => {
  it('captures exact legacy U19 merit without changing economy or senior caps', () => {
    const legacy = legacyU19Save();
    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.u19WorldCup?.status).toBe('TRACKING');
    expect(migrated.u19WorldCup?.merit).toMatchObject({
      appearances: 4,
      runs: 210,
      wickets: 1,
      ratingSum: 26,
      averageRating: 6.5,
    });
    expect(migrated.wallet).toEqual(legacy.wallet);
    expect(migrated.userCaps).toBe(2);
    expect(migrated.capped).toBe(false);
  });

  it('is idempotent and never creates the journey in Manager mode', () => {
    const save = legacyU19Save();
    synchronizeSchema33State(save);
    const first = JSON.stringify(save.u19WorldCup);
    synchronizeSchema33State(save);
    expect(JSON.stringify(save.u19WorldCup)).toBe(first);

    save.mode = 'manager';
    delete save.u19WorldCup;
    synchronizeSchema33State(save);
    expect(save.u19WorldCup).toBeUndefined();
  });
});
