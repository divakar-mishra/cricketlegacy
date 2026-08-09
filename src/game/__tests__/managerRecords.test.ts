import { emptyStats } from '../stats';
import { activeManagerRecords, rankManagerRows } from '../managerRecords';
import { buildManagerSeasonCalendar } from '../managerCalendar';
import { makeManagerSave } from './_depthHelpers';

describe('manager competition records', () => {
  it('uses only the active format and identifies players from the managed team', () => {
    const save = makeManagerSave(941);
    const managedTeam = save.teams[save.userTeamId!];
    const opponentTeam = Object.values(save.teams).find(
      (team) => !team.isNationalTeam && team.id !== managedTeam.id,
    )!;
    const managedPlayer = save.players[managedTeam.playerIds[0]];
    const opponentPlayer = save.players[opponentTeam.playerIds[0]];

    managedPlayer.seasonFormatStats = {
      T20: { ...emptyStats(), matches: 3, runs: 120, balls: 90, highScore: 61 },
      ODI: { ...emptyStats(), matches: 3, runs: 900, balls: 600, highScore: 240 },
    };
    opponentPlayer.seasonFormatStats = {
      T20: { ...emptyStats(), matches: 3, runs: 180, balls: 110, highScore: 84 },
      ODI: { ...emptyStats(), matches: 3, runs: 20, balls: 40, highScore: 12 },
    };

    const t20 = activeManagerRecords(save);
    const t20Runs = rankManagerRows(t20.rows, 'runs');

    expect(t20.format).toBe('T20');
    expect(t20.competitionLabel).toBe('T20');
    expect(t20Runs.map((row) => row.runs)).toEqual([180, 120]);
    expect(t20Runs.find((row) => row.playerId === managedPlayer.id)).toMatchObject({
      runs: 120,
      isManagedPlayer: true,
    });
    expect(t20Runs.find((row) => row.playerId === opponentPlayer.id)).toMatchObject({
      runs: 180,
      isManagedPlayer: false,
    });

    save.managerCareerLevel = 'STATE';
    buildManagerSeasonCalendar(save, 2027, 'LIST_A');
    const listA = activeManagerRecords(save);
    const listARuns = rankManagerRows(listA.rows, 'runs');

    expect(listA.format).toBe('ODI');
    expect(listA.competitionLabel).toBe('List A');
    expect(listARuns.map((row) => row.runs)).toEqual([900, 20]);
  });
});
