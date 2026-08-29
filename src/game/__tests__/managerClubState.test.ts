import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { runMigrations } from '../../storage/migrate';
import { createManagerSave } from '../createGame';
import {
  activateManagerClub,
  activeManagerClub,
  persistActiveManagerClub,
} from '../managerClubState';
import { applyManagerAppointment } from '../managerJobs';

function makeSave() {
  return createManagerSave({
    teamId: 'manager_india_t3_1',
    country: 'india',
    difficulty: 'NORMAL',
    seed: 351,
  });
}

describe('club-owned manager infrastructure', () => {
  it('migrates the active club without moving balances or legacy facility values', () => {
    const legacy = makeSave();
    legacy.schemaVersion = 34;
    legacy.facilities = { training: 4, medical: 3, academy: 2 };
    legacy.teams[legacy.userTeamId!].budget = 912_345;
    legacy.finances = { transferBudget: 912_345, wageBudgetPerSeason: 765_432 };
    delete legacy.managerClubs;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));
    const club = migrated?.managerClubs?.[migrated.userTeamId!];

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(club?.facilities).toEqual({ training: 4, medical: 3, academy: 2 });
    expect(club?.finances).toEqual({
      transferBudget: 912_345,
      wageBudgetPerSeason: 765_432,
    });
    expect(migrated?.teams[migrated.userTeamId!].budget).toBe(912_345);
  });

  it('keeps each club state independent across a move and return', () => {
    const save = makeSave();
    const firstId = save.userTeamId!;
    const secondId = save.divisions!.tier3!.find((id) => id !== firstId)!;
    save.facilities!.training = 5;
    save.scoutReports = [
      {
        playerId: save.teams[firstId].playerIds[0],
        knownOverall: 61,
        uncertainty: 0.2,
        scoutedYear: 2026,
        recommended: true,
      },
    ];
    persistActiveManagerClub(save);

    expect(applyManagerAppointment(save, secondId).ok).toBe(true);
    expect(save.facilities?.training).not.toBe(5);
    save.facilities!.medical = 5;
    persistActiveManagerClub(save);

    expect(applyManagerAppointment(save, firstId).ok).toBe(true);
    expect(save.facilities?.training).toBe(5);
    expect(save.scoutReports).toHaveLength(1);
    expect(save.facilities?.medical).not.toBe(5);
  });

  it('does not share nested references between clubs', () => {
    const save = makeSave();
    const first = activeManagerClub(save)!;
    const secondId = save.divisions!.tier3!.find((id) => id !== save.userTeamId)!;
    const second = activateManagerClub(save, secondId)!;

    second.trainingPlan.playerOverrides[save.teams[secondId].playerIds[0]] = 'RECOVERY';
    second.stadium.ticketPresets.T20 = 'PREMIUM';

    expect(first.trainingPlan.playerOverrides).toEqual({});
    expect(first.stadium.ticketPresets.T20).toBe('STANDARD');
  });
});
