import { createManagerSave } from '../createGame';
import { maxSquadSize } from '../finance';
import { loanPlayer, recallLoan, offerFreeAgentContract } from '../manager';

function makeSave() {
  return createManagerSave({ teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed: 42 });
}

describe('loanPlayer', () => {
  it('loans a free-agent into the squad', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const faId = save.freeAgents?.[0];
    expect(faId).toBeTruthy();
    const initialSize = save.teams[teamId].playerIds.length;

    const res = loanPlayer(save, faId!, 1);
    expect(res.ok).toBe(true);
    expect(res.cost).toBeGreaterThan(0);
    expect(save.teams[teamId].playerIds).toContain(faId);
    expect(save.teams[teamId].playerIds.length).toBe(initialSize + 1);
    expect(save.players[faId!].loanedFrom).toBe('free_agent');
    expect(save.players[faId!].loanEnd).toBe(
      (save.seasons[save.currentSeasonId!]?.year ?? 2026) + 1,
    );
    expect(save.freeAgents).not.toContain(faId);
  });

  it('fails when the manager squad reaches its calendar limit', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const team = save.teams[teamId];
    // Pad to the configured manager limit using free agents.
    const fas = save.freeAgents ?? [];
    while (team.playerIds.length < maxSquadSize(save) && fas.length > 0) {
      const id = fas.shift()!;
      team.playerIds.push(id);
    }
    save.freeAgents = fas;
    const nextFa = fas[0];
    if (!nextFa) return; // not enough free agents in test world — skip
    const res = loanPlayer(save, nextFa, 1);
    expect(res.ok).toBe(false);
  });

  it('fails when player is already in squad', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const alreadyIn = save.teams[teamId].playerIds[0];
    const res = loanPlayer(save, alreadyIn, 1);
    expect(res.ok).toBe(false);
  });
});

describe('recallLoan', () => {
  it('recalls a loaned player back to their parent club', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const faId = save.freeAgents?.[0]!;

    loanPlayer(save, faId, 1);
    expect(save.teams[teamId].playerIds).toContain(faId);

    const ok = recallLoan(save, faId);
    expect(ok).toBe(true);
    expect(save.teams[teamId].playerIds).not.toContain(faId);
    expect(save.players[faId].loanedFrom).toBeUndefined();
    expect(save.players[faId].loanEnd).toBeUndefined();
    // Returned to free agency (was a free agent originally).
    expect(save.freeAgents).toContain(faId);
  });
});

describe('offerFreeAgentContract', () => {
  it('signs a free agent with no transfer fee', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const faId = save.freeAgents?.[0]!;
    const initialSize = save.teams[teamId].playerIds.length;

    const res = offerFreeAgentContract(save, faId, 2);
    expect(res.ok).toBe(true);
    expect(save.teams[teamId].playerIds).toContain(faId);
    expect(save.teams[teamId].playerIds.length).toBe(initialSize + 1);
    expect(save.freeAgents).not.toContain(faId);
    expect(save.players[faId].contract?.yearsLeft).toBe(2);
    expect(save.players[faId].contract?.wage).toBeGreaterThan(0);
  });

  it('fails when player is not a free agent', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const squadId = save.teams[teamId].playerIds[0];
    const res = offerFreeAgentContract(save, squadId, 2);
    expect(res.ok).toBe(false);
  });
});
