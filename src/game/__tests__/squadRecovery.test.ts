import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { runMigrations } from '../../storage/migrate';
import { applyResult, runFixture } from '../season';
import { benefitsFromRecovery, ensureRecoveryClock, recordRecoveryFixture, recoveredCondition } from '../squadRecovery';
import { makeManagerSave } from './_depthHelpers';

describe('squad recovery invariants', () => {
  it.each([40, 80, 95, 96, 100])('never reduces condition %s and preserves the approved cap', condition => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = condition;
    expect(recoveredCondition(player)).toBe(Math.max(condition, Math.min(95, condition + 20)));
    expect(recoveredCondition(player, true)).toBe(100);
  });

  it('injured and already fully recovered players cannot be charged as beneficiaries', () => {
    const save = makeManagerSave();
    const p = save.players[save.teams[save.userTeamId!].playerIds[0]];
    p.condition = 100; p.meta.fitness = 100; p.morale = 100;
    expect(benefitsFromRecovery(p)).toBe(false);
    p.condition = 40;
    p.injury = { type: 'strain', severity: 'STRAIN', matchesOut: 2 };
    expect(benefitsFromRecovery(p)).toBe(false);
    expect(benefitsFromRecovery(p, true)).toBe(false);
    p.injury = undefined;
    expect(benefitsFromRecovery(p)).toBe(true);
  });

  it('canonical results count once and unrelated AI fixtures do not count', () => {
    const save = makeManagerSave();
    const fixture = Object.values(save.fixtures).find(f => f.homeTeamId === save.userTeamId || f.awayTeamId === save.userTeamId)!;
    const before = ensureRecoveryClock(save);
    const match = runFixture(save, fixture.id);
    applyResult(save, match);
    expect(ensureRecoveryClock(save)).toBe(before + 1);
    applyResult(save, match);
    expect(ensureRecoveryClock(save)).toBe(before + 1);
    const ai = Object.values(save.fixtures).find(f => f.homeTeamId !== save.userTeamId && f.awayTeamId !== save.userTeamId)!;
    recordRecoveryFixture(save, ai);
    expect(ensureRecoveryClock(save)).toBe(before + 1);
  });

  it('the fixture clock survives a new season and a club change', () => {
    const save = makeManagerSave();
    save.recoveryCompletedFixtures = 20;
    save.inventory = { squad_recovery_next_fixture: 23, full_fitness_recovery_next_fixture: 25 };
    save.fixtures = {};
    save.currentSeasonId = 'new-season';
    save.userTeamId = Object.keys(save.teams).find(id => id !== save.userTeamId)!;
    for (let n = 0; n < 3; n++) recordRecoveryFixture(save, { id: `new-${n}`, homeTeamId: save.userTeamId } as never);
    expect(ensureRecoveryClock(save)).toBe(23);
    expect(save.inventory.squad_recovery_next_fixture).toBe(23);
    expect(save.inventory.full_fitness_recovery_next_fixture).toBe(25);
  });

  it('migrates schema 44 without resetting balances or extending a broken legacy cooldown', () => {
    const save = makeManagerSave();
    save.schemaVersion = 44;
    delete save.recoveryCompletedFixtures;
    save.inventory = { squad_recovery_token: 2, squad_recovery_next_fixture: 23,
      squad_recovery_next_at: 12345, full_fitness_recovery_next_fixture: 25 };
    const wallet = { ...save.wallet };
    const migrated = runMigrations(save)!;
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.wallet).toEqual(wallet);
    expect(migrated.inventory).toEqual({ squad_recovery_token: 2, squad_recovery_next_fixture: 3,
      squad_recovery_next_at: 12345, full_fitness_recovery_next_fixture: 5 });
    expect(ensureRecoveryClock(migrated)).toBe(0);
  });
});
