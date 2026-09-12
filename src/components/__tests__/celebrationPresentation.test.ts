import { CELEBRATIONS } from '../../data/cosmetics';
import { celebrationAppearance, CELEBRATION_MOTIONS, personalCelebrationId } from '../celebrationPresentation';
import type { BallEvent } from '../../domain/types';

const event: Pick<BallEvent, 'strikerId' | 'bowlerId' | 'outcome' | 'isWicket' | 'dismissal'> = {
  strikerId: 'me', bowlerId: 'opponent', outcome: '4', isWicket: false,
};
const input = { mode: 'career', playerId: 'me', equippedId: 'cel_fist', event };
describe('personal celebration presentation', () => {
  it('covers every equipped celebration with an explicit motif, colour and motion', () => {
    expect(Object.keys(CELEBRATION_MOTIONS).sort()).toEqual(CELEBRATIONS.map(x=>x.id).sort());
    for(const c of CELEBRATIONS) {
      expect(celebrationAppearance(c.id)).toEqual(expect.objectContaining({ label:c.label, color:expect.stringMatching(/^#[0-9A-Fa-f]{6}$/), icon:expect.any(String) }));
    }
    expect(celebrationAppearance('unknown')).toBeUndefined();
  });
  it.each(['4', '6'] as const)('celebrates own %s, never the opponent or non-striker', outcome => {
    expect(personalCelebrationId({...input,event:{...event,outcome}})).toBe('cel_fist');
    expect(personalCelebrationId({...input,event:{...event,outcome,strikerId:'other'}})).toBeUndefined();
  });
  it('celebrates credited bowling and fielding wickets, not a run-out as bowler or own dismissal', () => {
    const wicket = {...event,outcome:'W' as const,isWicket:true,strikerId:'opponent',bowlerId:'me',dismissal:{type:'BOWLED' as const}};
    expect(personalCelebrationId({...input,event:wicket})).toBe('cel_fist');
    expect(personalCelebrationId({...input,event:{...wicket,dismissal:{type:'RUN_OUT',fielderId:'other'}}})).toBeUndefined();
    expect(personalCelebrationId({...input,event:{...wicket,bowlerId:'other',dismissal:{type:'RUN_OUT',fielderId:'me'}}})).toBe('cel_fist');
    expect(personalCelebrationId({...input,event:{...wicket,strikerId:'me',bowlerId:'other'}})).toBeUndefined();
  });
  it('only uses a personal milestone for its owner', () => {
    expect(personalCelebrationId({...input,milestonePlayerId:'me'})).toBe('cel_fist');
    expect(personalCelebrationId({...input,milestonePlayerId:'other'})).toBeUndefined();
  });
  it('preserves generic effects for manager mode, missing players and unknown cosmetics', () => {
    for(const override of [{mode:'manager'},{playerId:undefined},{equippedId:'unknown'}]) expect(personalCelebrationId({...input,...override})).toBeUndefined();
    expect(personalCelebrationId({...input,event:{...event,outcome:'DOT'}})).toBeUndefined();
  });
});
