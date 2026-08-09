import { makeRng } from '../../engine/rng';
import {
  academyProspects,
  facilityMaintenance,
  gateReceipts,
  investInStaff,
  offerFreeAgentContract,
  promoteProspect,
  renewContract,
  runYouthIntake,
  scoutPlayer,
  settleManagerSeason,
  staffByRole,
  staffWageBill,
  tickContracts,
  upgradeFacility,
} from '../manager';
import { makeManagerSave } from './_depthHelpers';

describe('ensureManagerDepth', () => {
  it('seeds staff, facilities, academy, finances and contracts', () => {
    const save = makeManagerSave();
    expect(save.staff?.length).toBe(8);
    expect(save.staffCandidates?.length).toBe(16);
    expect(save.facilities).toBeDefined();
    expect(save.academy?.prospectIds).toEqual([]);
    expect(save.finances?.wageBudgetPerSeason).toBeGreaterThan(0);
    const team = save.teams[save.userTeamId!];
    expect(team.playerIds.every((id) => Boolean(save.players[id].contract))).toBe(true);
  });
});

describe('staff & facilities', () => {
  it('investing raises quality and spends budget; fails when broke', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    const before = staffByRole(save, 'HEAD_COACH')!.quality;
    const res = investInStaff(save, 'HEAD_COACH');
    expect(res.ok).toBe(true);
    expect(staffByRole(save, 'HEAD_COACH')!.quality).toBeGreaterThan(before);
    expect(team.budget).toBeLessThan(5_000_000);
    expect(save.finances?.transferBudget).toBe(team.budget);

    team.budget = 0;
    expect(investInStaff(save, 'BATTING_COACH').ok).toBe(false);
  });

  it('upgrading a facility raises its level', () => {
    const save = makeManagerSave();
    save.teams[save.userTeamId!].budget = 5_000_000;
    const before = save.facilities!.training;
    const res = upgradeFacility(save, 'training');
    expect(res.ok).toBe(true);
    expect(save.facilities!.training).toBe(before + 1);
    expect(save.finances?.transferBudget).toBe(save.teams[save.userTeamId!].budget);
  });
});

describe('scouting', () => {
  it('first look is uncertain; repeated looks converge toward the truth', () => {
    const save = makeManagerSave();
    save.teams[save.userTeamId!].budget = 5_000_000;
    const targetId = (save.freeAgents ?? [])[0];
    expect(targetId).toBeTruthy();
    const truth = save.players[targetId].overall;

    const first = scoutPlayer(save, targetId, makeRng(3));
    expect(first.ok).toBe(true);
    expect(first.report!.uncertainty).toBeGreaterThan(0.2);

    for (let i = 0; i < 5; i++) scoutPlayer(save, targetId, makeRng(10 + i));
    const rep = save.scoutReports!.find((r) => r.playerId === targetId)!;
    expect(rep.uncertainty).toBeLessThan(0.4);
    expect(Math.abs(rep.knownOverall - truth)).toBeLessThanOrEqual(6);
    expect('potentialBand' in rep).toBe(false);
  });
});

describe('youth academy', () => {
  it('runs a dated intake once and can promote a prospect', () => {
    const save = makeManagerSave();
    // Intake is dated to next year; force it to fire now.
    save.academy!.nextIntakeYear = save.seasons[save.currentSeasonId!].year;
    const created = runYouthIntake(save, makeRng(4));
    expect(created.length).toBeGreaterThan(0);
    expect(academyProspects(save).length).toBe(created.length);
    // A second call in the same year is a no-op (intake already taken).
    expect(runYouthIntake(save, makeRng(4)).length).toBe(0);

    const team = save.teams[save.userTeamId!];
    const squadBefore = team.playerIds.length;
    const res = promoteProspect(save, created[0]);
    expect(res.ok).toBe(true);
    expect(team.playerIds.length).toBe(squadBefore + 1);
    expect(save.players[created[0]].contract).toBeDefined();
    expect(save.players[created[0]].hidden).toBe(false);
  });
});

describe('contracts', () => {
  it('expire to free agency and can be renewed', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const id = team.playerIds.find((x) => x !== save.userPlayerId)!;
    save.players[id].contract = { wage: 1000, yearsLeft: 1 };

    tickContracts(save);
    expect(team.playerIds).not.toContain(id);
    expect(save.freeAgents).toContain(id);

    // Renew someone still in the squad.
    const keep = team.playerIds[0];
    save.players[keep].contract = { wage: 1000, yearsLeft: 1 };
    team.budget = 5_000_000;
    const res = renewContract(save, keep, 2);
    expect(res.ok).toBe(true);
    expect(save.players[keep].contract!.yearsLeft).toBeGreaterThan(1);
    expect(save.finances?.transferBudget).toBe(team.budget);
  });

  it('keeps finance budget synced when signing a free agent contract', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.finances!.transferBudget = team.budget;
    const playerId = save.freeAgents![0];

    const res = offerFreeAgentContract(save, playerId, 2);

    expect(res.ok).toBe(true);
    expect(team.playerIds).toContain(playerId);
    expect(save.finances?.transferBudget).toBe(team.budget);
  });
});

describe('settleManagerSeason', () => {
  it('deducts staff wages and reports intake/departures', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 10_000_000;
    save.academy!.nextIntakeYear = save.seasons[save.currentSeasonId!].year;
    const budgetBefore = team.budget;
    const gate = gateReceipts(team.reputation) * 7;
    const staffWages = staffWageBill(save);
    const upkeep = facilityMaintenance(save);
    const { intake } = settleManagerSeason(save, makeRng(8));
    expect(intake.length).toBeGreaterThan(0);
    expect(save.finances?.lastGateReceipts).toBe(gate);
    expect(save.finances?.lastWageBill).toBe(staffWages);
    expect(save.finances?.transferBudget).toBe(team.budget);
    expect(team.budget).toBe(budgetBefore + gate - staffWages - upkeep);
  });
});
