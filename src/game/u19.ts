import { SaveGame } from '../domain/types';
import { clamp } from '../utils/math';

const U19_QUALIFY_MATCHES = 3;
const U19_QUALIFY_RATING = 6.5;

/** Whether the user has earned their U19 World Cup squad place this season. */
export function u19Qualifies(save: SaveGame): boolean {
  if (save.careerPathLevel !== 'U19' || !save.userPlayerId) return false;
  const matches = save.careerPathMatches ?? 0;
  if (matches < U19_QUALIFY_MATCHES) return false;

  const avgRating = clamp(5 + (save.nationalRep ?? 0) / 50, 1, 10);
  return avgRating >= U19_QUALIFY_RATING;
}

/** True if a U19 World Cup should fire this season. */
export function shouldRunU19WorldCup(save: SaveGame): boolean {
  if (save.careerPathLevel !== 'U19') return false;
  const year = save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
  return year % 2 === 0;
}
