import { applyMgrEffects, managerEventCount, nextManagerEvent, queueManagerEvent, renderMgr, resolveManagerChoice } from '../managerEvents';
import { makeManagerSave } from './_depthHelpers';

describe('manager press-conferences', () => {
  it('queues, renders and resolves a press beat', () => {
    const save = makeManagerSave();
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
    expect(queueManagerEvent(save, 'PRE_SEASON', () => 0.1)).toBe(true);
    const ev = nextManagerEvent(save);
    expect(ev).not.toBeNull();
    const res = resolveManagerChoice(save, ev!.id, ev!.choices[0].id);
    expect(res.ok).toBe(true);
    expect(managerEventCount(save)).toBe(0);
    expect(save.managerStory!.seenEventIds).toContain(ev!.id);
  });

  it('applyMgrEffects moves board confidence, reputation, budget and squad morale', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const repBefore = team.reputation;
    const budgetBefore = team.budget;
    applyMgrEffects(save, { boardConfidence: 5, reputation: 2, budget: 100_000, squadMorale: 4 });
    expect(save.boardConfidence).toBe(65); // ensureManagerDepth seeds 60
    expect(team.reputation).toBe(Math.min(95, repBefore + 2));
    expect(team.budget).toBe(budgetBefore + 100_000);
    expect(save.players[team.playerIds[0]].morale).toBe(74); // default 70 + 4
  });

  it('renders manager placeholders with safe fallbacks', () => {
    const save = makeManagerSave();
    const text = renderMgr('{team} considers {unknown_token}.', save);
    expect(text).toContain(save.teams[save.userTeamId!].name);
    expect(text).toContain('the club');
    expect(text).not.toContain('{team}');
    expect(text).not.toContain('{unknown_token}');
  });
});
