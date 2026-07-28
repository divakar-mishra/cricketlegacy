import {
  CommentaryEntry,
  commentaryEntriesForView,
} from '../../game/commentaryArchive';

const entry = (id: number, inningsIndex: number, over: number): CommentaryEntry => ({
  id,
  inningsIndex,
  over,
  ballInOver: id,
  label: `${over}.${id}`,
  text: `Ball ${id}`,
  tone: 'normal',
  outcome: '1',
  strikerName: 'Batter',
  bowlerName: 'Bowler',
});

describe('commentary archive', () => {
  const newestFirst = [
    entry(9, 1, 1),
    entry(8, 1, 1),
    entry(7, 1, 0),
    entry(6, 1, 0),
    entry(5, 0, 19),
  ];

  it('keeps the current innings separate and preserves newest-first order', () => {
    expect(commentaryEntriesForView(newestFirst, 1, 'innings').map((item) => item.id)).toEqual([
      9, 8, 7, 6,
    ]);
  });

  it('returns the active over and previous completed over independently', () => {
    expect(commentaryEntriesForView(newestFirst, 1, 'current').map((item) => item.id)).toEqual([
      9, 8,
    ]);
    expect(commentaryEntriesForView(newestFirst, 1, 'previous').map((item) => item.id)).toEqual([
      7, 6,
    ]);
  });

  it('returns an empty previous over at the start of an innings', () => {
    expect(commentaryEntriesForView([entry(1, 2, 0)], 2, 'previous')).toEqual([]);
  });
});
