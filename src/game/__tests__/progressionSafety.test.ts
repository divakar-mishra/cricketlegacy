import { makeCareerSave, makeManagerSave } from './_depthHelpers';
import { expiringContracts, recallLoan, renewContract, tickContracts } from '../manager';
import { releasePlayer } from '../finance';
import { validateSeasonState } from '../season';
import { resolveStoryChoice } from '../careerEvents';
import { applyMgrEffects, resolveManagerChoice } from '../managerEvents';

describe('progression safety failure paths', () => {
  it('rejects renewals and manual returns of a borrowed minimum XI without spending', () => {
    const save = makeManagerSave(77101);
    const team = save.teams[save.userTeamId!];
    team.playerIds = team.playerIds.slice(0, 11);
    for (const id of team.playerIds) {
      save.players[id].loanedFrom = 'free_agent';
      save.players[id].contract = { wage: 100, yearsLeft: 1 };
    }
    const before = JSON.stringify(save);
    expect(renewContract(save, team.playerIds[0], 2)).toMatchObject({ ok: false, cost: 0 });
    expect(recallLoan(save, team.playerIds[0])).toBe(false);
    expect(releasePlayer(save, team.playerIds[0])).toMatchObject({ ok: false, recouped: 0 });
    expect(expiringContracts(save)).toEqual([]);
    expect(JSON.stringify(save)).toBe(before);
    expect(tickContracts(save)).toEqual([]);
    expect(save.players[team.playerIds[0]].contract?.yearsLeft).toBe(1);
  });

  it('returns a surplus loan only once and refuses someone outside the squad', () => {
    const save = makeManagerSave(77102);
    const team = save.teams[save.userTeamId!];
    team.playerIds = team.playerIds.slice(0, 12);
    const id = team.playerIds[0];
    save.players[id].loanedFrom = 'free_agent';
    expect(recallLoan(save, id)).toBe(true);
    const after = JSON.stringify(save);
    expect(recallLoan(save, id)).toBe(false);
    expect(JSON.stringify(save)).toBe(after);
    expect(save.freeAgents!.filter(value => value === id)).toHaveLength(1);
    const other = save.freeAgents!.find(value => value !== id)!;
    save.players[other].loanedFrom = 'free_agent';
    expect(recallLoan(save, other)).toBe(false);
    expect(save.players[other].loanedFrom).toBe('free_agent');
  });

  it('repairs an already-empty legacy club through youth without currency changes or repeated grants', () => {
    const save = makeManagerSave(77103);
    const team = save.teams[save.userTeamId!];
    const budget = team.budget;
    const wallet = { ...save.wallet };
    const year = save.seasons[save.currentSeasonId!].year;
    const protectedId = `y-${year}-${team.id}-0`;
    save.players[protectedId] = { ...save.players[team.playerIds[0]], id: protectedId };
    const protectedPlayer = JSON.stringify(save.players[protectedId]);
    team.playerIds = ['missing-player', 'missing-player'];
    team.xi = ['missing-player'];
    validateSeasonState(save);
    expect(team.playerIds).toHaveLength(11);
    expect(new Set(team.playerIds).size).toBe(11);
    expect(team.playerIds.every(id => Boolean(save.players[id]))).toBe(true);
    expect(team.playerIds.some(id => save.players[id].role === 'WK_BATTER')).toBe(true);
    expect(JSON.stringify(save.players[protectedId])).toBe(protectedPlayer);
    expect(team.budget).toBe(budget);
    expect(save.wallet).toEqual(wallet);
    const after = JSON.stringify(save);
    validateSeasonState(save);
    expect(JSON.stringify(save)).toBe(after);
  });

  it('resolves only the current story, once, without consuming a following beat', () => {
    const save = makeCareerSave(77104);
    save.story!.pendingEventIds = ['career_start'];
    expect(resolveStoryChoice(save, 'career_start', 'invalid', () => 0)).toEqual({ ok: false });
    expect(resolveStoryChoice(save, 'career_start', 'work', () => 0).ok).toBe(true);
    const after = JSON.stringify(save);
    expect(resolveStoryChoice(save, 'career_start', 'work', () => 0)).toEqual({ ok: false });
    expect(JSON.stringify(save)).toBe(after);
    expect(save.story!.flags.resolutionSequence).toBe(1);
  });

  it('rejects out-of-order press actions but permits a newly queued recurring occurrence', () => {
    const save = makeManagerSave(77105);
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [],
      pendingEventIds: ['m_unveiling', 'press_manager_away_win'] };
    expect(resolveManagerChoice(save, 'press_manager_away_win', 'first').ok).toBe(false);
    expect(resolveManagerChoice(save, 'm_unveiling', 'promise').ok).toBe(true);
    expect(resolveManagerChoice(save, 'm_unveiling', 'promise').ok).toBe(false);
    expect(resolveManagerChoice(save, 'press_manager_away_win', 'first').ok).toBe(true);
    save.managerStory.pendingEventIds.push('press_manager_away_win');
    expect(resolveManagerChoice(save, 'press_manager_away_win', 'first').ok).toBe(true);
    expect(save.managerStory.flags.resolutionSequence).toBe(3);
  });

  it('does not mutate a retained club during National Manager press effects or repair', () => {
    const save = makeManagerSave(77106);
    save.managerCareerLevel = 'NATIONAL';
    const club = save.teams[save.userTeamId!];
    const nationalId = Object.values(save.teams).find(team => team.isNationalTeam)?.id;
    expect(nationalId).toBeTruthy();
    save.managerNationalTeamId = nationalId;
    const domestic = JSON.stringify({ club, players: club.playerIds.map(id => save.players[id]) });
    const national = save.teams[nationalId!];
    national.playerIds.push(club.playerIds[0]); // Shared international/domestic identity.
    const budget = national.budget;
    applyMgrEffects(save, { squadMorale: 2, squadForm: 2, reputation: 1, budget: 5000 });
    expect(JSON.stringify({ club, players: club.playerIds.map(id => save.players[id]) })).toBe(domestic);
    expect(national.budget).toBe(budget);
    club.playerIds = [];
    validateSeasonState(save);
    expect(club.playerIds).toEqual([]);
  });
});
