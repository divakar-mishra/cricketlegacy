import { ensureUserContract, PromotionResult } from './career';
import { buildPlayerSeasonCalendar } from './playerCalendar';
import {
  activateCareerPathTeam,
  activateSeniorDomesticContract,
  generateYouthFixtures,
  isYouthFixture,
} from './youthFixtures';
import { SaveGame } from '../domain/types';

/**
 * Completes a pathway promotion as one observable state change. Old youth
 * fixtures and calendar events are removed before the destination phase is
 * generated, so the hub can never point at a fixture from the previous level.
 */
export function synchronizeCareerPromotion(save: SaveGame, promotion: PromotionResult): string[] {
  if (!promotion.promoted || !promotion.to || save.mode !== 'career') return [];

  for (const [fixtureId, fixture] of Object.entries(save.fixtures)) {
    if (isYouthFixture(fixture)) delete save.fixtures[fixtureId];
  }
  save.playerCalendar = undefined;

  if (promotion.to === 'SCHOOL' || promotion.to === 'U19') {
    activateCareerPathTeam(save, promotion.to);
  } else if (promotion.to === 'DOMESTIC' || promotion.to === 'INTERNATIONAL') {
    activateSeniorDomesticContract(save);
    ensureUserContract(save);
  }
  const fixtureIds =
    promotion.to === 'SCHOOL' || promotion.to === 'U19' ? generateYouthFixtures(save) : [];
  buildPlayerSeasonCalendar(save);
  return fixtureIds;
}
