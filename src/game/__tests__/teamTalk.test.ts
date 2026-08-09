import { talkToPlayer } from '../teamTalk';
import { makeManagerSave } from './_depthHelpers';

describe('player conversations', () => {
  it('praising a player lifts form and morale', () => {
    const save = makeManagerSave();
    const id = save.teams[save.userTeamId!].playerIds[0];
    save.players[id].meta.form = 40;
    save.players[id].morale = 40;

    const result = talkToPlayer(save, id, 'PRAISE');

    expect(result.ok).toBe(true);
    expect(save.players[id].meta.form).toBeGreaterThan(40);
    expect(save.players[id].morale).toBeGreaterThan(40);
  });
});
