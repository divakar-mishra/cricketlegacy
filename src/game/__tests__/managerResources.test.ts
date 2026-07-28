import {
  executeManagerResourceAction,
  MANAGER_ELITE_STAFF_SEARCH_GEMS,
  MANAGER_MATCH_ANALYSIS_COINS,
} from '../managerResources';
import { makeManagerSave } from './_depthHelpers';

describe('Manager wallet resource desk', () => {
  it('spends coins once per fixture and applies a small visible XI preparation effect', () => {
    const save = makeManagerSave();
    save.wallet.coins = 5_000;
    const team = save.teams[save.userTeamId!];
    const player = save.players[(team.xi?.length ? team.xi : team.playerIds)[0]];
    const formBefore = player.meta.form;
    const moraleBefore = player.morale ?? 70;

    const first = executeManagerResourceAction(save, 'MATCH_ANALYSIS', 100);
    const second = executeManagerResourceAction(save, 'MATCH_ANALYSIS', 101);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(save.wallet.coins).toBe(5_000 - MANAGER_MATCH_ANALYSIS_COINS);
    expect(player.meta.form).toBe(Math.min(99, formBefore + 2));
    expect(player.morale).toBe(Math.min(100, moraleBefore + 1));
    expect(save.managerResources?.transactions).toHaveLength(1);
  });

  it('spends gems once per season and adds stronger budget-gated staff candidates', () => {
    const save = makeManagerSave();
    save.wallet.gems = 100;
    const beforeIds = new Set((save.staffCandidates ?? []).map((candidate) => candidate.id));

    const first = executeManagerResourceAction(save, 'ELITE_STAFF_SEARCH', 200);
    const second = executeManagerResourceAction(save, 'ELITE_STAFF_SEARCH', 201);
    const added = (save.staffCandidates ?? []).filter((candidate) => !beforeIds.has(candidate.id));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(save.wallet.gems).toBe(100 - MANAGER_ELITE_STAFF_SEARCH_GEMS);
    expect(added).toHaveLength(3);
    expect(added.every((candidate) => candidate.quality >= 68)).toBe(true);
    expect(save.managerResources?.transactions).toHaveLength(1);
  });
});
