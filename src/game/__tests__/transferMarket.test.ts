import { makeRng } from '../../engine/rng';
import { generatePlayer } from '../../generation/players';
import { computeValue, ffpBlockReason, signFreeAgent } from '../finance';
import {
  isDeadlineDay,
  isTransferWindowOpen,
  rivalInterestCount,
  runAiTransferWindow,
  transferWindowClosedReason,
} from '../transferMarket';
import { makeManagerSave } from './_depthHelpers';

function enrichAiClubs(save: ReturnType<typeof makeManagerSave>): void {
  for (const t of Object.values(save.teams)) if (t.id !== save.userTeamId) t.budget = 10_000_000;
}

describe('living transfer market', () => {
  it('enforces the FFP wage ceiling for the user', () => {
    const save = makeManagerSave();
    const faId = save.freeAgents![0];
    // Tighten the wage budget to nothing → the signing must be blocked by FFP.
    save.finances!.wageBudgetPerSeason = 1;
    const r = signFreeAgent(save, faId);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/FFP/);
  });

  it('allows a signing that fits under the wage ceiling', () => {
    const save = makeManagerSave();
    const faId = save.freeAgents![0];
    save.finances!.wageBudgetPerSeason = 5_000_000; // generous
    save.teams[save.userTeamId!].budget = 10_000_000;
    expect(signFreeAgent(save, faId).ok).toBe(true);
  });

  it('deducts the accepted counter-offer and removes the player from the market', () => {
    const save = makeManagerSave();
    const faId = save.freeAgents![0];
    const base = computeValue(save.players[faId]);
    const counter = base + 123_456;
    save.finances!.wageBudgetPerSeason = 5_000_000;
    save.teams[save.userTeamId!].budget = 10_000_000;

    const before = save.teams[save.userTeamId!].budget;
    const r = signFreeAgent(save, faId, counter);

    expect(r.ok).toBe(true);
    expect(r.cost).toBe(counter);
    expect(save.teams[save.userTeamId!].budget).toBe(before - counter);
    expect(save.finances!.transferBudget).toBe(before - counter);
    expect(save.freeAgents).not.toContain(faId);
    expect(save.players[faId].contract).toBeDefined();
  });

  it('cannot sign the same player twice after he leaves the market', () => {
    const save = makeManagerSave();
    const faId = save.freeAgents![0];
    save.finances!.wageBudgetPerSeason = 5_000_000;
    save.teams[save.userTeamId!].budget = 10_000_000;

    const first = signFreeAgent(save, faId);
    const budgetAfterFirst = save.teams[save.userTeamId!].budget;
    const squadCopies = () =>
      save.teams[save.userTeamId!].playerIds.filter((id) => id === faId).length;
    const second = signFreeAgent(save, faId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/Not available/);
    expect(save.teams[save.userTeamId!].budget).toBe(budgetAfterFirst);
    expect(squadCopies()).toBe(1);
  });

  it('rejects a corrupted free-agent entry that is already owned by another club', () => {
    const save = makeManagerSave();
    const rival = Object.values(save.teams).find((t) => t.id !== save.userTeamId)!;
    const ownedId = rival.playerIds[0];
    save.freeAgents = [ownedId, ...(save.freeAgents ?? [])];
    save.teams[save.userTeamId!].budget = 10_000_000;

    const before = save.teams[save.userTeamId!].budget;
    const res = signFreeAgent(save, ownedId);

    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/belongs to another club/i);
    expect(save.teams[save.userTeamId!].budget).toBe(before);
    expect(save.teams[save.userTeamId!].playerIds).not.toContain(ownedId);
    expect(rival.playerIds).toContain(ownedId);
  });

  it('opens only during the manager off-season', () => {
    const save = makeManagerSave();
    save.managerCalendar!.phase = 'FIRST_CLASS';
    expect(isTransferWindowOpen(save)).toBe(false);
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.currentMonth = 6;
    expect(isTransferWindowOpen(save)).toBe(true);
  });

  it('shows Deadline Day only in late transfer-window months', () => {
    const save = makeManagerSave();
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.currentMonth = 6;
    expect(isTransferWindowOpen(save)).toBe(true);
    expect(isDeadlineDay(save)).toBe(false);
    save.currentMonth = 7;
    expect(isDeadlineDay(save)).toBe(false);
    save.currentMonth = 8;
    expect(isDeadlineDay(save)).toBe(true);
    save.mode = 'career';
    expect(isDeadlineDay(save)).toBe(false);
  });

  it('returns a manager-only closed-window reason for signing actions', () => {
    const save = makeManagerSave();
    save.managerCalendar!.phase = 'FIRST_CLASS';
    expect(transferWindowClosedReason(save)).toMatch(/four-day|first class/i);
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.currentMonth = 6;
    expect(transferWindowClosedReason(save)).toBeNull();
    save.mode = 'career';
    save.currentMonth = 2;
    expect(transferWindowClosedReason(save)).toBeNull();
  });

  it('AI clubs actively sign strong free agents (the pool churns)', () => {
    const save = makeManagerSave();
    enrichAiClubs(save);
    const starId = 'fa-super';
    save.players[starId] = generatePlayer({
      id: starId,
      nationality: 'india',
      role: 'BATTER',
      quality: 90,
      rng: makeRng(1),
    });
    save.freeAgents = [starId, ...(save.freeAgents ?? [])];

    const report = runAiTransferWindow(save, makeRng(5));
    expect(report.signings).toBeGreaterThan(0);
    expect(save.freeAgents).not.toContain(starId); // signed by a rival
  });

  it('reports rival interest in a coveted free agent', () => {
    const save = makeManagerSave();
    enrichAiClubs(save);
    const starId = 'fa-super';
    save.players[starId] = generatePlayer({
      id: starId,
      nationality: 'india',
      role: 'BATTER',
      quality: 90,
      rng: makeRng(2),
    });
    expect(rivalInterestCount(save, starId)).toBeGreaterThan(0);
  });

  it('ffpBlockReason is a no-op without a wage system (career mode)', () => {
    const save = makeManagerSave();
    const p = save.players[save.freeAgents![0]];
    save.finances = undefined;
    expect(ffpBlockReason(save, p)).toBeNull();
  });
});
