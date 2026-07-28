import { SaveGame } from '../domain/types';

export function saveTitle(save: SaveGame): string {
  if (save.mode === 'career' && save.userPlayerId) {
    return save.players[save.userPlayerId]?.name ?? 'Career';
  }
  if (save.userTeamId) return save.teams[save.userTeamId]?.name ?? 'Manager';
  return 'Saved game';
}

export function saveSubtitle(save: SaveGame): string {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const mode = save.mode === 'career' ? 'Player' : 'Manager';
  return [mode, team?.name, season ? `Season ${season.year}` : null].filter(Boolean).join(' · ');
}
