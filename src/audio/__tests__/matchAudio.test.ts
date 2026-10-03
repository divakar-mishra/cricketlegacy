import { deliveryMoment, matchMusicScene } from '../matchAudio';

describe('live match audio choices', () => {
  it.each(['live', 'saving', 'save-error'])('keeps music paused during %s', phase => {
    expect(matchMusicScene(phase)).toBe('MATCH_LIVE');
  });

  it('resumes music for preparation, results and empty matches', () => {
    expect(matchMusicScene('prematch')).toBe('MATCH_CALM');
    expect(matchMusicScene('done', true)).toBe('VICTORY');
    expect(matchMusicScene('done', false)).toBe('DEFEAT');
    expect(matchMusicScene('empty')).toBe('MENU');
  });

  it.each([
    ['1', 'PUSH', 'bat'], ['2', 'DRIVE', 'bat'], ['3', 'CUT', 'bat'],
    ['4', 'COVER_DRIVE', 'four'], ['6', 'SLOG', 'six'], ['DOT', 'DEFEND', 'bat'],
    ['DOT', 'LEAVE', null], ['BYE', 'PUSH', null], ['LB', 'PUSH', null],
    ['WD', undefined, null], ['NB', undefined, null],
  ] as const)('selects %s / %s contact audio without depending on cinematic speed', (outcome, shot, expected) => {
    expect(deliveryMoment({ outcome, shot, isWicket: false })).toBe(expected);
  });

  it('keeps wicket feedback and does not invent contact for a legacy dot ball', () => {
    expect(deliveryMoment({ outcome: 'W', isWicket: true, shot: 'DEFEND' })).toBe('wicket');
    expect(deliveryMoment({ outcome: 'DOT', isWicket: false })).toBeNull();
  });
});
