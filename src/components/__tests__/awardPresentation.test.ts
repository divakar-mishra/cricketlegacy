import { buildAwardList } from '../awardPresentation';
import { seasonAwards } from '../../game/progression';
import { standings } from '../../game/season';
import type { SaveGame } from '../../domain/types';
import type { ThemeColors } from '../../theme';
jest.mock('../../game/progression', () => ({seasonAwards:jest.fn()}));
jest.mock('../../game/season', () => ({standings:jest.fn()}));
const colors = {accent:'#D5B56D',primary:'#20BB88'} as ThemeColors;
const save = {mode:'career', userTeamId:'home', players:{batter:{name:'Actual Batter'},bowler:{name:'Actual Bowler'}},teams:{home:{name:'Home'},away:{name:'Away'}}} as unknown as SaveGame;
describe('Awards Night winner artwork', () => {
  beforeEach(() => {
    (seasonAwards as jest.Mock).mockReturnValue({topScorer:{playerId:'batter',runs:503},topWicketTaker:{playerId:'bowler',wickets:24}});
    (standings as jest.Mock).mockReturnValue([{teamId:'away',won:9,points:18},{teamId:'home',won:8,points:16}]);
  });
  it('attaches the real player identity to each individual award and not the team cup', () => {
    const awards=buildAwardList(save,colors);
    expect(awards[0]).toMatchObject({artwork:'cup',winner:'Away'});
    expect(awards[0].playerId).toBeUndefined();
    expect(awards[1]).toMatchObject({artwork:'bat',playerId:'batter',winner:'Actual Batter',stat:'503 runs'});
    expect(awards[2]).toMatchObject({artwork:'ball',playerId:'bowler',winner:'Actual Bowler',stat:'24 wickets'});
    expect(awards[3]).toMatchObject({artwork:'silver',title:'RUNNERS-UP'});
  });
  it('does not invent individual winners when the season has no award data', () => {
    (seasonAwards as jest.Mock).mockReturnValue({});
    expect(buildAwardList(save,colors).some(a=>a.playerId)).toBe(false);
  });
  it('uses the career franchise result without substituting the player as team winner', () => {
    const awards=buildAwardList({...save,franchiseTeamId:'away'},colors);
    expect(awards.at(-1)).toMatchObject({winner:'Away',artwork:'cup',title:'YOU ARE CHAMPIONS!'});
    expect(awards.at(-1)?.playerId).toBeUndefined();
  });
});
