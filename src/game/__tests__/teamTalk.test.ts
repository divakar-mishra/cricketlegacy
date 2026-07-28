import { makeRng } from '../../engine/rng';
import { applyTeamTalk, talkToPlayer } from '../teamTalk';
import { makeManagerSave } from './_depthHelpers';

describe('team talks', () => {
  it('a calm talk lifts low-form players toward a target (with diminishing returns)', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const ids = (team.xi && team.xi.length ? team.xi : team.playerIds).slice(0, 11);
    for (const id of ids) save.players[id].meta.form = 30;

    applyTeamTalk(save, 'CALM', makeRng(1));
    const after1 = save.players[ids[0]].meta.form;
    expect(after1).toBeGreaterThan(30);

    // Repeating converges toward ~68 but never overshoots wildly.
    for (let i = 0; i < 20; i++) applyTeamTalk(save, 'CALM', makeRng(i));
    expect(save.players[ids[0]].meta.form).toBeLessThanOrEqual(70);
  });

  it('firing them up is a gamble (seed decides the swing)', () => {
    const save = makeManagerSave();
    const id = (save.teams[save.userTeamId!].xi ?? save.teams[save.userTeamId!].playerIds)[0];
    save.players[id].meta.form = 55;
    const res = applyTeamTalk(save, 'FIRE_UP', makeRng(1));
    expect(res.ok).toBe(true);
    expect(typeof res.text).toBe('string');
  });

  it('praising a player lifts form and morale', () => {
    const save = makeManagerSave();
    const id = save.teams[save.userTeamId!].playerIds[0];
    save.players[id].meta.form = 40;
    save.players[id].morale = 40;
    const res = talkToPlayer(save, id, 'PRAISE');
    expect(res.ok).toBe(true);
    expect(save.players[id].meta.form).toBeGreaterThan(40);
    expect(save.players[id].morale!).toBeGreaterThan(40);
  });
});
