import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { leaderboard, userRank } from '../leaderboard';
import { emptyStats } from '../stats';

function makeSave(): SaveGame {
  const player = buildUserPlayer({
    name: 'Chart Topper',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
    bowling: { paceOrSpin: 20, accuracy: 20, movement: 20, variations: 20, stamina: 40 },
    fielding: { catching: 60, throwing: 60, agility: 60, keeping: 30 },
    meta: { fitness: 70, confidence: 60, aggression: 55, discipline: 60 },
  });
  return createCareerSave({ player, teamId: TEAM_BLUEPRINTS[0].id, difficulty: 'NORMAL', seed: 321 });
}

describe('leaderboard', () => {
  it('ranks by the chosen metric, best first', () => {
    const save = makeSave();
    save.players[save.userPlayerId!].careerStats = { ...emptyStats(), runs: 99_999 };
    const board = leaderboard(save, 'runs', 'career', 10);
    expect(board.length).toBe(10);
    expect(board[0].isUser).toBe(true);
    expect(board[0].rank).toBe(1);
    for (let index = 1; index < board.length; index++) {
      expect(board[index].rank).toBe(index + 1);
      expect(board[index].value).toBeLessThanOrEqual(board[index - 1].value);
    }
  });

  it('reports the user rank even when outside the top 10', () => {
    const save = makeSave();
    save.players[save.userPlayerId!].careerStats = { ...emptyStats(), runs: 0 };
    const rank = userRank(save, 'runs', 'career');
    expect(rank).toBeGreaterThan(0);
    expect(rank).toBeLessThanOrEqual(Object.values(save.players).filter((player) => !player.hidden).length);
  });

  it('excludes hidden youth prospects', () => {
    const save = makeSave();
    const hiddenId = Object.values(save.players).find((player) => !player.isUserPlayer)!.id;
    save.players[hiddenId].hidden = true;
    const board = leaderboard(save, 'overall', 'career', 100);
    expect(board.some((row) => row.playerId === hiddenId)).toBe(false);
  });
});
