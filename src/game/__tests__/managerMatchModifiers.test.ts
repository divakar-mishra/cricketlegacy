import { prepareManagerPlayerForMatch } from '../season';
import { makeManagerSave } from './_depthHelpers';

describe('manager match modifiers', () => {
  it('penalizes ignored condition or morale by 15 percent without mutating the save', () => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 40;
    player.morale = 40;
    const technique = player.batting.technique;

    const prepared = prepareManagerPlayerForMatch(save, player, true, false);

    expect(prepared.batting.technique).toBe(Math.round(technique * 0.85));
    expect(player.batting.technique).toBe(technique);
  });

  it('caps the explicit preparation advantage at a 10 percent match-only lift', () => {
    const save = makeManagerSave();
    const player = save.players[save.teams[save.userTeamId!].playerIds[0]];
    player.condition = 100;
    player.morale = 80;
    const technique = player.batting.technique;

    const prepared = prepareManagerPlayerForMatch(save, player, true, true);

    expect(prepared.batting.technique).toBe(Math.min(99, Math.round(technique * 1.1)));
    expect(player.batting.technique).toBe(technique);
  });
});
