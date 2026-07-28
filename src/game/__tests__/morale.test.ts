import { createManagerSave } from '../createGame';
import { updateTeamMorale } from '../progression';
import { talkToPlayer } from '../teamTalk';

function makeSave() {
  return createManagerSave({ teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed: 42 });
}

describe('updateTeamMorale', () => {
  it('boosts morale after a win', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const squad = save.teams[teamId].playerIds;
    // Set baseline morale.
    for (const id of squad) {
      save.players[id].morale = 70;
    }

    updateTeamMorale(save, true);

    for (const id of squad) {
      expect(save.players[id].morale).toBeGreaterThan(70);
      expect(save.players[id].morale).toBeLessThanOrEqual(100);
    }
  });

  it('drops morale after a loss', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const squad = save.teams[teamId].playerIds;
    for (const id of squad) {
      save.players[id].morale = 70;
    }

    updateTeamMorale(save, false);

    for (const id of squad) {
      expect(save.players[id].morale).toBeLessThan(70);
      expect(save.players[id].morale).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps morale between 0 and 100', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const squad = save.teams[teamId].playerIds;
    for (const id of squad) {
      save.players[id].morale = 100;
    }
    updateTeamMorale(save, true);
    for (const id of squad) {
      expect(save.players[id].morale).toBeLessThanOrEqual(100);
    }
  });
});

describe('talkToPlayer', () => {
  it('PRAISE lifts morale', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const playerId = save.teams[teamId].playerIds[0];
    save.players[playerId].morale = 50;

    const result = talkToPlayer(save, playerId, 'PRAISE');
    expect(result.ok).toBe(true);
    expect(save.players[playerId].morale).toBeGreaterThan(50);
  });

  it('REST boosts morale and fitness', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const playerId = save.teams[teamId].playerIds[0];
    save.players[playerId].morale = 60;
    const prevFitness = save.players[playerId].meta.fitness;

    const result = talkToPlayer(save, playerId, 'REST');
    expect(result.ok).toBe(true);
    expect(save.players[playerId].morale).toBeGreaterThan(60);
    expect(save.players[playerId].meta.fitness).toBeGreaterThanOrEqual(prevFitness);
  });

  it('enforces cooldown between talks', () => {
    const save = makeSave();
    const teamId = save.userTeamId!;
    const playerId = save.teams[teamId].playerIds[0];

    // First talk should succeed.
    const r1 = talkToPlayer(save, playerId, 'PRAISE');
    expect(r1.ok).toBe(true);

    // Immediate second talk should fail (cooldown).
    const r2 = talkToPlayer(save, playerId, 'PRAISE');
    expect(r2.ok).toBe(false);
  });
});
