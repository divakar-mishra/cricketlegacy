import { BallOutcome } from '../domain/types';

export type CommentaryTone = 'normal' | 'four' | 'six' | 'wicket' | 'extra';
export type CommentaryArchiveView = 'current' | 'previous' | 'innings';

export interface CommentaryEntry {
  id: number;
  inningsIndex: number;
  over: number;
  ballInOver: number;
  label: string;
  text: string;
  tone: CommentaryTone;
  outcome: BallOutcome;
  strikerName: string;
  bowlerName: string;
}

export function commentaryEntriesForView(
  entries: CommentaryEntry[],
  inningsIndex: number,
  view: CommentaryArchiveView,
): CommentaryEntry[] {
  const inningsEntries = entries.filter((entry) => entry.inningsIndex === inningsIndex);
  if (view === 'innings') return inningsEntries;
  const currentOver = inningsEntries.reduce((max, entry) => Math.max(max, entry.over), -1);
  if (view === 'current') return inningsEntries.filter((entry) => entry.over === currentOver);
  const previousOver = inningsEntries.reduce(
    (max, entry) => (entry.over < currentOver ? Math.max(max, entry.over) : max),
    -1,
  );
  return inningsEntries.filter((entry) => entry.over === previousOver);
}
