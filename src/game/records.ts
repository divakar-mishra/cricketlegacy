/**
 * All-time records & Hall of Fame. Names are snapshotted so records survive when
 * players retire and leave the world.
 */
import { MatchState, Records, SaveGame } from '../domain/types';

export function emptyRecords(): Records {
  return { centuries: [], fiveWicketHauls: [], titles: [] };
}

function ensure(save: SaveGame): Records {
  if (!save.records) save.records = emptyRecords();
  return save.records;
}

/** Scan a completed match for milestones and update the record book. */
export function updateRecords(save: SaveGame, match: MatchState, year: number): void {
  const rec = ensure(save);
  const nameOf = (id: string) => save.players[id]?.name ?? 'Unknown';

  for (const inn of match.innings) {
    for (const b of inn.batting) {
      if (b.runs >= 100) rec.centuries.unshift({ name: nameOf(b.playerId), detail: `${b.runs} (${b.balls})`, year });
      if (b.runs > 0 && (!rec.highestScore || b.runs > rec.highestScore.runs)) {
        rec.highestScore = { name: nameOf(b.playerId), runs: b.runs, year };
      }
    }
    for (const bw of inn.bowling) {
      if (bw.wickets >= 5) rec.fiveWicketHauls.unshift({ name: nameOf(bw.playerId), detail: `${bw.wickets}/${bw.runs}`, year });
      if (
        bw.wickets > 0 &&
        (!rec.bestBowling ||
          bw.wickets > rec.bestBowling.wickets ||
          (bw.wickets === rec.bestBowling.wickets && bw.runs < rec.bestBowling.runs))
      ) {
        rec.bestBowling = { name: nameOf(bw.playerId), wickets: bw.wickets, runs: bw.runs, year };
      }
    }
  }

  rec.centuries = rec.centuries.slice(0, 25);
  rec.fiveWicketHauls = rec.fiveWicketHauls.slice(0, 25);
}

export function recordTitle(save: SaveGame, teamName: string, year: number): void {
  const rec = ensure(save);
  rec.titles.unshift({ name: teamName, detail: 'Champions', year });
  rec.titles = rec.titles.slice(0, 30);
}
