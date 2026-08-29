import { makeRng } from '../../engine/rng';
import {
  academyProspects,
  applyManagerDebtControls,
  facilityMaintenance,
  facilityUpgradeCost,
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
import { stadiumSeasonUpkeep } from '../stadiumManagement';
import { computeValue, managerOperatingReserve } from '../finance';
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

  it('uses Club Balance when explicitly selected even while a token is owned', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 2 };
    const before = save.facilities!.training;
    const cost = facilityUpgradeCost(before + 1);

    const res = upgradeFacility(save, 'training', 'CLUB_BUDGET');

    expect(res).toEqual({
      ok: true,
      cost,
      level: before + 1,
      paymentMethod: 'CLUB_BUDGET',
    });
    expect(save.facilities!.training).toBe(before + 1);
    expect(team.budget).toBe(5_000_000 - cost);
    expect(save.finances?.transferBudget).toBe(team.budget);
    expect(save.inventory.facility_upgrade_token).toBe(2);
  });

  it('uses one optional token without spending Club Balance when explicitly selected', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 2 };
    const before = save.facilities!.medical;

    const res = upgradeFacility(save, 'medical', 'TOKEN');

    expect(res).toEqual({
      ok: true,
      cost: 0,
      level: before + 1,
      paymentMethod: 'TOKEN',
    });
    expect(save.facilities!.medical).toBe(before + 1);
    expect(team.budget).toBe(5_000_000);
    expect(save.inventory.facility_upgrade_token).toBe(1);
  });

  it('refuses insufficient Club Balance without falling back to an owned token', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const before = save.facilities!.academy;
    const cost = facilityUpgradeCost(before + 1);
    team.budget = cost - 1;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 1 };

    expect(upgradeFacility(save, 'academy', 'CLUB_BUDGET')).toEqual({
      ok: false,
      cost,
      reason: 'Not enough club balance.',
    });
    expect(save.facilities!.academy).toBe(before);
    expect(team.budget).toBe(cost - 1);
    expect(save.inventory.facility_upgrade_token).toBe(1);
  });

  it('refuses a token selection with no token without falling back to Club Balance', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 0 };
    const before = save.facilities!.academy;

    expect(upgradeFacility(save, 'academy', 'TOKEN')).toEqual({
      ok: false,
      cost: 0,
      reason: 'No facility upgrade token.',
    });
    expect(save.facilities!.academy).toBe(before);
    expect(team.budget).toBe(5_000_000);
    expect(save.inventory.facility_upgrade_token).toBe(0);
  });

  it('refuses a max-level upgrade without spending either payment source', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.facilities!.training = 5;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 1 };

    expect(upgradeFacility(save, 'training', 'CLUB_BUDGET').ok).toBe(false);
    expect(upgradeFacility(save, 'training', 'TOKEN').ok).toBe(false);
    expect(save.facilities!.training).toBe(5);
    expect(team.budget).toBe(5_000_000);
    expect(save.inventory.facility_upgrade_token).toBe(1);
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

  it('protects itemised operating costs before allowing an optional renewal fee', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const playerId = team.playerIds[0];
    save.players[playerId].contract = { wage: 1_000, yearsLeft: 1 };
    save.lastSeasonSettlement = {
      year: 2026,
      leaguePosition: 4,
      leaguePrize: 0,
      continentalPrize: 0,
      sponsorIncome: 0,
      broadcastIncome: 0,
      playerWages: 0,
      gateReceipts: 0,
      staffWages: 0,
      facilityUpkeep: facilityMaintenance(save) + stadiumSeasonUpkeep(save.managerClubs![team.id].stadium),
      previousBudget: 0,
      newBudget: 0,
    };
    const reserve = managerOperatingReserve(save);
    const fee = Math.round(computeValue(save.players[playerId]) * 0.1);
    expect(reserve).toBeGreaterThan(0);

    team.budget = reserve + fee - 1;
    const blocked = renewContract(save, playerId, 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain('committed season costs');
    expect(team.budget).toBe(reserve + fee - 1);

    team.budget = reserve + fee;
    expect(renewContract(save, playerId, 2).ok).toBe(true);
    expect(team.budget).toBe(reserve);
  });

  it('uses emergency one-season extensions instead of dropping below a legal XI', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.playerIds = team.playerIds.slice(0, 11);
    for (const id of team.playerIds) {
      save.players[id].contract = { wage: 1_000, yearsLeft: 1 };
    }

    const departed = tickContracts(save);

    expect(departed).toEqual([]);
    expect(team.playerIds).toHaveLength(11);
    expect(team.playerIds.every((id) => save.players[id].contract?.yearsLeft === 1)).toBe(true);
  });
});

describe('settleManagerSeason', () => {
  it('penalizes debt and caps a severe overdraft at one broadcast distribution', () => {
    const save = makeManagerSave(80);
    const team = save.teams[save.userTeamId!];
    team.budget = -1_000_000;
    save.boardConfidence = 60;

    const outcome = applyManagerDebtControls(save, 2026);

    expect(outcome).toMatchObject({ inDebt: true, intervention: expect.any(Number) });
    expect(outcome.intervention).toBeGreaterThan(0);
    expect(team.budget).toBe(-outcome.debtLimit);
    expect(save.boardConfidence).toBe(48);
    expect(save.finances?.transferBudget).toBe(team.budget);
    expect(save.inbox?.filter((message) => message.id === 'manager-debt-2026')).toHaveLength(1);
  });

  it('deducts staff wages and reports intake/departures', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 10_000_000;
    save.academy!.nextIntakeYear = save.seasons[save.currentSeasonId!].year;
    const budgetBefore = team.budget;
    const staffWages = staffWageBill(save);
    const stadium = save.managerClubs?.[save.userTeamId!]?.stadium;
    const upkeep = facilityMaintenance(save) + (stadium ? stadiumSeasonUpkeep(stadium) : 0);
    const previousGateReceipts = save.finances?.lastGateReceipts;
    const { intake } = settleManagerSeason(save, makeRng(8));
    expect(intake.length).toBeGreaterThan(0);
    expect(save.finances?.lastGateReceipts).toBe(previousGateReceipts);
    expect(save.finances?.lastWageBill).toBe(staffWages);
    expect(save.finances?.transferBudget).toBe(team.budget);
    expect(team.budget).toBe(budgetBefore - staffWages - upkeep);
  });

  it('retains rollover training for migrated legacy saves without a manager calendar', () => {
    const save = makeManagerSave();
    delete save.managerCalendar;
    expect(save.managerClubs?.[save.userTeamId!]).toBeDefined();
    const playerId = save.teams[save.userTeamId!].playerIds[0];
    const player = save.players[playerId];
    save.trainingFocus = { [playerId]: 'batting' };
    save.facilities!.training = 5;
    const battingBefore = { ...player.batting };

    settleManagerSeason(save, makeRng(81));

    expect(player.batting.technique).toBeGreaterThan(battingBefore.technique);
    expect(player.batting.timing).toBeGreaterThan(battingBefore.timing);
  });

  it('is a no-op for a retained club while the manager is on National duty', () => {
    const save = makeManagerSave(82);
    const team = save.teams[save.userTeamId!];
    save.managerCareerLevel = 'NATIONAL';
    save.academy!.nextIntakeYear = save.seasons[save.currentSeasonId!].year;
    const snapshot = {
      budget: team.budget,
      playerIds: [...team.playerIds],
      contracts: Object.fromEntries(
        team.playerIds.map((id) => [id, save.players[id].contract?.yearsLeft]),
      ),
      academy: [...save.academy!.prospectIds],
      staffWages: save.finances!.lastWageBill,
    };

    expect(settleManagerSeason(save, makeRng(82))).toEqual({ departed: [], intake: [] });
    expect(team.budget).toBe(snapshot.budget);
    expect(team.playerIds).toEqual(snapshot.playerIds);
    expect(
      Object.fromEntries(team.playerIds.map((id) => [id, save.players[id].contract?.yearsLeft])),
    ).toEqual(snapshot.contracts);
    expect(save.academy!.prospectIds).toEqual(snapshot.academy);
    expect(save.finances!.lastWageBill).toBe(snapshot.staffWages);
  });

  it('can settle the final domestic season after promotion has already changed the level', () => {
    const save = makeManagerSave(83);
    const team = save.teams[save.userTeamId!];
    save.managerCareerLevel = 'NATIONAL';
    team.budget = 10_000_000;
    const budgetBefore = team.budget;
    const staffWages = staffWageBill(save);
    const stadium = save.managerClubs?.[save.userTeamId!]?.stadium;
    const upkeep = facilityMaintenance(save) + (stadium ? stadiumSeasonUpkeep(stadium) : 0);

    settleManagerSeason(save, makeRng(83), { finishedManagerLevel: 'ELITE' });

    expect(team.budget).toBe(budgetBefore - staffWages - upkeep);
  });
});
