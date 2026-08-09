import { PlayerStats, SaveGame } from '../domain/types';

function emptyStats(): PlayerStats {
  return {
    matches: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highScore: 0,
    notOuts: 0,
    fifties: 0,
    hundreds: 0,
    wickets: 0,
    ballsBowled: 0,
    runsConceded: 0,
    bestBowling: '-',
    catches: 0,
    stumpings: 0,
  };
}

function cloneStats(stats?: PlayerStats): PlayerStats {
  return stats ? { ...stats } : emptyStats();
}

/**
 * v27 begins exact domestic/international stat tracking. A player with no
 * international caps can safely assign all historical output to domestic
 * cricket; mixed older careers retain their verified all-career total and
 * start both scoped ledgers from zero rather than inventing a split.
 */
export function synchronizeSchema27State(save: SaveGame): void {
  for (const player of Object.values(save.players ?? {})) {
    const allHistoryIsDomestic =
      player.id === save.userPlayerId && (save.userCaps ?? 0) === 0;
    player.domesticStats ??= allHistoryIsDomestic
      ? cloneStats(player.careerStats)
      : emptyStats();
    player.internationalStats ??= emptyStats();
  }
  save.statsScopeTrackingStartedAt ??= save.updatedAt ?? save.createdAt;
}
