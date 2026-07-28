import type { SaveGame } from '../domain/types';
import { ensurePlayerCareerResources } from '../game/career';

/** Idempotent defaults for Player Career workload, selection and media state. */
export function synchronizeSchema20State(save: SaveGame): void {
  ensurePlayerCareerResources(save);

  if (!save.experience) return;
  save.experience.mediaScrapbook = [...(save.experience.mediaScrapbook ?? [])]
    .filter((story) => Boolean(story?.id && story.matchId && story.headline))
    .slice(-40);
  if (
    save.experience.pendingNewspaperId &&
    !save.experience.mediaScrapbook.some(
      (story) => story.id === save.experience?.pendingNewspaperId,
    )
  ) {
    save.experience.pendingNewspaperId = undefined;
  }
}
