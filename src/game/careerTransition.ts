import { ensurePlayerCareerResources, ensureUserContract, PromotionResult } from './career';
import { buildPlayerSeasonCalendar } from './playerCalendar';
import { archiveNewspaperStory, buildPromotionNewspaperStory } from './newspaper';
import { ensureRival } from './rivalry';
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

  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (user) {
    // Each new career level opens its own paid training allocation. Promotion
    // never grants attributes by itself.
    user.trainingSessionsThisSeason = 0;
    user.trainingGroupSessionsThisSeason = {};
  }

  const removedFixtureIds = new Set<string>();
  for (const [fixtureId, fixture] of Object.entries(save.fixtures)) {
    if (isYouthFixture(fixture)) {
      removedFixtureIds.add(fixtureId);
      delete save.fixtures[fixtureId];
    }
  }
  for (const season of Object.values(save.seasons)) {
    season.fixtureIds = season.fixtureIds.filter((fixtureId) => !removedFixtureIds.has(fixtureId));
  }
  save.playerCalendar = undefined;

  if (promotion.to === 'SCHOOL' || promotion.to === 'U19') {
    activateCareerPathTeam(save, promotion.to);
  } else if (promotion.to === 'DOMESTIC' || promotion.to === 'INTERNATIONAL') {
    activateSeniorDomesticContract(save);
    ensureUserContract(save);
  }
  const resources = ensurePlayerCareerResources(save);
  if (resources && promotion.to !== 'SCHOOL') {
    // A deserved promotion must include a real chance to acclimatize. Three
    // appearances prevent one unlucky debut from immediately undoing the
    // promotion; merit selection resumes after the short settling window.
    resources.selectionGuaranteeMatches = Math.max(resources.selectionGuaranteeMatches ?? 0, 3);
    resources.coachTrust = Math.max(resources.coachTrust, 55);
    resources.playerCondition = Math.max(resources.playerCondition, 80);
  }
  const fixtureIds =
    promotion.to === 'SCHOOL' || promotion.to === 'U19' ? generateYouthFixtures(save) : [];
  buildPlayerSeasonCalendar(save);
  ensureRival(save);
  if (promotion.from) {
    const story = buildPromotionNewspaperStory(save, promotion.from, promotion.to);
    if (story) archiveNewspaperStory(save, story);
  }
  return fixtureIds;
}
