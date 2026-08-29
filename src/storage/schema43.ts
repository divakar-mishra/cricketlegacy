import type { SaveGame } from '../domain/types';

/**
 * Begin prospective career-best international ranking tracking. Historical
 * ranks cannot be reconstructed honestly from aggregate old-save totals, so
 * the ledger starts empty and records the next completed international match.
 */
export function synchronizeSchema43InternationalRankingPeaks(save: SaveGame): void {
  if (save.mode !== 'career') return;
  save.internationalPlayerRankingPeaks ??= {};
}
